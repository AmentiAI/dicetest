import { desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { adminConfigured, isAdminWallet } from "@/lib/admin";
import { issueAdminToken, verifyAdminToken } from "@/lib/admin-session";
import { fail, failInternal } from "@/lib/api";
import {
  adminAuthMessage,
  parseAuthTimestamp,
  verifyWalletSignature,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { matchEvents, profiles, rooms } from "@/lib/db/schema";
import { consumeNonce, limitOr429 } from "@/lib/rate-limit";
import { isEthAddress } from "@/lib/eth/keys";

export const runtime = "nodejs";

function secretOk(req: Request) {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return false;
  const given = req.headers.get("x-admin-secret") ?? "";
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)/i.exec(header);
  return match?.[1] ?? "";
}

function authorize(req: Request): "ok" | "unauthorized" {
  if (secretOk(req)) return "ok";
  const token = bearerToken(req);
  if (!token) return "unauthorized";
  return verifyAdminToken(token) ? "ok" : "unauthorized";
}

type TxKind = "create" | "join" | "settle";

async function adminPayload() {
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

  return {
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
  };
}

export async function GET(req: Request) {
  try {
    const limited = limitOr429(req, "admin-get", 40);
    if (limited) return limited;
    if (!adminConfigured()) {
      return fail("Admin is not configured", 503);
    }
    const gate = authorize(req);
    if (gate !== "ok") return fail("unauthorized", 401);
    return NextResponse.json(await adminPayload());
  } catch (e) {
    return failInternal("admin-get", e);
  }
}

export async function POST(req: Request) {
  try {
    const limited = limitOr429(req, "admin-auth", 10);
    if (limited) return limited;
    if (!adminConfigured()) {
      return fail("Admin is not configured", 503);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("invalid json body");

    const wallet = String((body as { wallet?: unknown }).wallet ?? "");
    const signatureBase64 = String(
      (body as { signatureBase64?: unknown }).signatureBase64 ?? "",
    );
    const ts = parseAuthTimestamp((body as { ts?: unknown }).ts);
    if (!isEthAddress(wallet) || !ts) return fail("invalid auth payload");
    if (!isAdminWallet(wallet)) return fail("forbidden", 403);

    const message = adminAuthMessage(wallet, ts);
    if (!(await verifyWalletSignature({ wallet, message, signatureBase64 }))) {
      return fail("invalid wallet signature", 401);
    }
    if (!consumeNonce(`admin:${wallet}:${ts}`)) {
      return fail("replayed signature", 401);
    }

    const session = issueAdminToken(wallet);
    return NextResponse.json(session);
  } catch (e) {
    return failInternal("admin-auth", e);
  }
}
