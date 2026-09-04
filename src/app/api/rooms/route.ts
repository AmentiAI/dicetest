import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { fail, failInternal, ROOM_STATUSES } from "@/lib/api";
import { arenasForRooms } from "@/lib/arena-db";
import { parseArenaId } from "@/lib/cosmetics";
import { db } from "@/lib/db";
import { chatMessages, matchEvents, profiles, rooms } from "@/lib/db/schema";
import { limitOr429 } from "@/lib/rate-limit";
import { isPubkeyString, isTxSignature, isU64String } from "@/lib/solana/keys";
import { proofError, verifyProgramTx } from "@/lib/solana/verify-tx";

export const runtime = "nodejs";

async function withProfiles<T extends { hostWallet: string; challengerWallet: string | null }>(
  list: T[],
) {
  const wallets = [
    ...new Set(
      list.flatMap((r) => [r.hostWallet, r.challengerWallet].filter(Boolean) as string[]),
    ),
  ];
  const people = wallets.length
    ? await db().select().from(profiles).where(inArray(profiles.wallet, wallets))
    : [];
  const map = Object.fromEntries(people.map((p) => [p.wallet, p]));
  return list.map((r) => ({
    ...r,
    host: map[r.hostWallet] ?? null,
    challenger: r.challengerWallet ? map[r.challengerWallet] ?? null : null,
  }));
}

export async function GET(req: Request) {
  try {
    const limited = limitOr429(req, "rooms-list", 60);
    if (limited) return limited;
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const rawLimit = Number(url.searchParams.get("limit") ?? 80);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 250) : 80;
    const statusFilter =
      status && (ROOM_STATUSES as readonly string[]).includes(status) ? status : null;

    const list = statusFilter
      ? await db()
          .select()
          .from(rooms)
          .where(eq(rooms.status, statusFilter))
          .orderBy(desc(rooms.createdAt))
          .limit(limit)
      : await db().select().from(rooms).orderBy(desc(rooms.createdAt)).limit(limit);
    const enriched = await withProfiles(list);
    const arenas = await arenasForRooms(list.map((r) => r.id));
    const roomsOut = enriched.map((r) => ({
      ...r,
      arena: arenas[r.id] ?? null,
    }));
    const waiting = list.filter((r) => r.status === "waiting").length;
    const locked = list.filter((r) => r.status === "locked").length;
    return NextResponse.json({
      rooms: roomsOut,
      stats: {
        activeRooms: waiting + locked,
        waiting,
        locked,
      },
    });
  } catch (e) {
    return failInternal("rooms-list", e);
  }
}

export async function POST(req: Request) {
  try {
    const limited = limitOr429(req, "rooms-create", 12);
    if (limited) return limited;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return fail("invalid json body");
    }
    const pda = String((body as { pda?: unknown }).pda ?? "");
    const duelId = String((body as { duelId?: unknown }).duelId ?? "");
    const hostWallet = String((body as { hostWallet?: unknown }).hostWallet ?? "");
    const wagerLamports = String((body as { wagerLamports?: unknown }).wagerLamports ?? "");
    const createSignature = String(
      (body as { createSignature?: unknown }).createSignature ?? "",
    );
    const rematchOf = String((body as { rematchOf?: unknown }).rematchOf ?? "");
    const arena = parseArenaId((body as { arena?: unknown }).arena);

    if (!pda || !duelId || !hostWallet || !wagerLamports || !createSignature) {
      return fail("missing fields");
    }
    if (!isPubkeyString(pda) || !isPubkeyString(hostWallet) || !isU64String(duelId)) {
      return fail("invalid duel identifiers");
    }
    if (!isTxSignature(createSignature)) return fail("invalid create signature");
    if (rematchOf && !isPubkeyString(rematchOf)) return fail("invalid rematch room");

    const existing = await db().query.rooms.findFirst({ where: eq(rooms.id, pda) });
    if (existing) {
      return NextResponse.json({ room: existing });
    }

    const { PublicKey } = await import("@solana/web3.js");
    const { fetchDuel } = await import("@/lib/solana/fetch");
    const { serverConnection } = await import("@/lib/solana/connection");
    const { PROGRAM_ID } = await import("@/lib/solana/constants");
    const { statusName } = await import("@/lib/solana/pda");
    const connection = serverConnection();
    const proof = await verifyProgramTx({ connection, signature: createSignature, pda });
    if (proof !== "ok") {
      const { error, status } = proofError(proof);
      return fail(error, status);
    }
    const onchain = await fetchDuel(connection, new PublicKey(pda));
    if (!onchain) {
      return fail("duel account not found on chain — wait for confirmation and retry");
    }
    if (onchain.host.toBase58() !== hostWallet) {
      return fail("host mismatch");
    }
    if (onchain.duelId.toString() !== duelId) {
      return fail("duel id mismatch");
    }

    await db()
      .insert(rooms)
      .values({
        id: pda,
        duelId,
        hostWallet,
        wagerLamports: onchain.wagerLamports.toString(),
        status: statusName(onchain.status),
        createSignature,
      })
      .onConflictDoNothing();

    const roomAfterInsert = await db().query.rooms.findFirst({ where: eq(rooms.id, pda) });
    if (!roomAfterInsert) {
      return fail("room create failed", 500);
    }
    if (roomAfterInsert.createSignature !== createSignature) {
      return NextResponse.json({ room: roomAfterInsert });
    }

    const createdAlready = await db()
      .select({ id: matchEvents.id })
      .from(matchEvents)
      .where(eq(matchEvents.roomId, pda))
      .limit(1);
    if (createdAlready.length === 0) {
      await db().insert(matchEvents).values({
        roomId: pda,
        event: "created",
        payload: {
          hostWallet,
          wagerLamports: onchain.wagerLamports.toString(),
          program: PROGRAM_ID.toBase58(),
          arena,
        },
      });
      await db().insert(chatMessages).values({
        roomId: pda,
        wallet: "system",
        username: "SYS",
        kind: "system",
        body: rematchOf
          ? "Rematch circle. Wager is locked in the PDA. Winner takes all."
          : "Circle opened. Wager is locked in the program PDA. Winner takes all.",
      });
    }

    if (rematchOf) {
      const prior = await db().query.rooms.findFirst({ where: eq(rooms.id, rematchOf) });
      const allowed =
        prior &&
        (prior.hostWallet === hostWallet || prior.challengerWallet === hostWallet);
      if (allowed) {
        const already = await db()
          .select()
          .from(matchEvents)
          .where(eq(matchEvents.roomId, rematchOf));
        const rematchLogged = already.some(
          (ev) => ev.event === "rematch" && ev.payload?.rematchPda === pda,
        );
        if (!rematchLogged) {
          await db().insert(matchEvents).values({
            roomId: rematchOf,
            event: "rematch",
            payload: {
              rematchPda: pda,
              hostWallet,
              duelId,
              wagerLamports: onchain.wagerLamports.toString(),
            },
          });
          await db().insert(chatMessages).values({
            roomId: rematchOf,
            wallet: "system",
            username: "SYS",
            kind: "system",
            body: "Rematch opened. Join from this circle or set a different wager.",
          });
        }
      }
    }

    const room = await db().query.rooms.findFirst({ where: eq(rooms.id, pda) });
    return NextResponse.json({ room });
  } catch (e) {
    return failInternal("rooms-create", e);
  }
}
