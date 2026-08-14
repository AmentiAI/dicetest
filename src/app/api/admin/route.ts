import { desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { adminConfigured, isAdminWallet } from "@/lib/admin";
import { db } from "@/lib/db";
import { matchEvents, profiles, rooms } from "@/lib/db/schema";

export const runtime = "nodejs";

function secretOk(req: Request) {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return false;
  const given =
    req.headers.get("x-admin-secret") ||
    new URL(req.url).searchParams.get("secret") ||
    "";
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}

function authorized(req: Request) {
  if (secretOk(req)) return true;
  const wallet = new URL(req.url).searchParams.get("wallet");
  return isAdminWallet(wallet);
}

type TxKind = "create" | "join" | "settle";

export async function GET(req: Request) {
  try {
    if (!adminConfigured()) {
      return NextResponse.json(
        { error: "Admin allowlist is not configured" },
        { status: 503 },
      );
    }
    if (!authorized(req)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const [roomRows, eventRows, profileRows, playerCount, agg] = await Promise.all([
      db().select().from(rooms).orderBy(desc(rooms.updatedAt)).limit(400),
      db().select().from(matchEvents).orderBy(desc(matchEvents.id)).limit(400),
      db().select().from(profiles).orderBy(desc(profiles.updatedAt)).limit(200),
      db().select({ n: sql<number>`count(*)::int` }).from(profiles),
      db()
        .select({
          rooms: sql<number>`count(*)::int`,
          waiting: sql<number>`count(*) filter (where ${rooms.status} = 'waiting')::int`,
          locked: sql<number>`count(*) filter (where ${rooms.status} = 'locked')::int`,
          settled: sql<number>`count(*) filter (where ${rooms.status} = 'settled')::int`,
          cancelled: sql<number>`count(*) filter (where ${rooms.status} = 'cancelled')::int`,
          refunded: sql<number>`count(*) filter (where ${rooms.status} = 'refunded')::int`,
          joins: sql<number>`count(${rooms.joinSignature})::int`,
          settles: sql<number>`count(${rooms.settleSignature})::int`,
          waitingLamports: sql<string>`coalesce(sum(${rooms.wagerLamports}::numeric) filter (where ${rooms.status} = 'waiting'), 0)::text`,
          lockedLamports: sql<string>`coalesce(sum(${rooms.wagerLamports}::numeric * 2) filter (where ${rooms.status} = 'locked'), 0)::text`,
          settledLamports: sql<string>`coalesce(sum(${rooms.wagerLamports}::numeric * 2) filter (where ${rooms.status} = 'settled'), 0)::text`,
        })
        .from(rooms),
    ]);

    const settledAt = new Map<string, string>();
    for (const ev of eventRows) {
      if (ev.event === "settled") {
        settledAt.set(ev.roomId, ev.createdAt.toISOString());
      }
    }

    const txs: {
      id: string;
      kind: TxKind;
      signature: string;
      at: string;
      roomId: string;
      duelId: string;
      status: string;
      hostWallet: string;
      challengerWallet: string | null;
      wagerLamports: string;
      winnerWallet: string | null;
      hostRoll: number | null;
      challengerRoll: number | null;
      slotHash: string | null;
      revealSlot: string | null;
    }[] = [];

    for (const r of roomRows) {
      txs.push({
        id: `${r.id}:create`,
        kind: "create",
        signature: r.createSignature,
        at: r.createdAt.toISOString(),
        roomId: r.id,
        duelId: r.duelId,
        status: r.status,
        hostWallet: r.hostWallet,
        challengerWallet: r.challengerWallet,
        wagerLamports: r.wagerLamports,
        winnerWallet: r.winnerWallet,
        hostRoll: r.hostRoll,
        challengerRoll: r.challengerRoll,
        slotHash: r.slotHash,
        revealSlot: r.revealSlot,
      });
      if (r.joinSignature) {
        txs.push({
          id: `${r.id}:join`,
          kind: "join",
          signature: r.joinSignature,
          at: r.updatedAt.toISOString(),
          roomId: r.id,
          duelId: r.duelId,
          status: r.status,
          hostWallet: r.hostWallet,
          challengerWallet: r.challengerWallet,
          wagerLamports: r.wagerLamports,
          winnerWallet: r.winnerWallet,
          hostRoll: r.hostRoll,
          challengerRoll: r.challengerRoll,
          slotHash: r.slotHash,
          revealSlot: r.revealSlot,
        });
      }
      if (r.settleSignature) {
        txs.push({
          id: `${r.id}:settle`,
          kind: "settle",
          signature: r.settleSignature,
          at: settledAt.get(r.id) ?? r.updatedAt.toISOString(),
          roomId: r.id,
          duelId: r.duelId,
          status: r.status,
          hostWallet: r.hostWallet,
          challengerWallet: r.challengerWallet,
          wagerLamports: r.wagerLamports,
          winnerWallet: r.winnerWallet,
          hostRoll: r.hostRoll,
          challengerRoll: r.challengerRoll,
          slotHash: r.slotHash,
          revealSlot: r.revealSlot,
        });
      }
    }

    txs.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

    const totals = agg[0];
    const roomCount = totals?.rooms ?? 0;
    const joinCount = totals?.joins ?? 0;
    const settleCount = totals?.settles ?? 0;

    return NextResponse.json({
      stats: {
        rooms: roomCount,
        waiting: totals?.waiting ?? 0,
        locked: totals?.locked ?? 0,
        settled: totals?.settled ?? 0,
        cancelled: totals?.cancelled ?? 0,
        refunded: totals?.refunded ?? 0,
        players: Number(playerCount[0]?.n ?? profileRows.length),
        creates: roomCount,
        joins: joinCount,
        settles: settleCount,
        txs: roomCount + joinCount + settleCount,
        waitingLamports: totals?.waitingLamports ?? "0",
        lockedLamports: totals?.lockedLamports ?? "0",
        settledLamports: totals?.settledLamports ?? "0",
      },
      txs,
      rooms: roomRows,
      events: eventRows,
      profiles: profileRows,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "admin lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
