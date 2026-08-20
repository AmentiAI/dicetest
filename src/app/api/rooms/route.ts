import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatMessages, matchEvents, profiles, rooms } from "@/lib/db/schema";
import { arenasForRooms } from "@/lib/arena-db";
import { parseArenaId } from "@/lib/cosmetics";

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
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const rawLimit = Number(url.searchParams.get("limit") ?? 80);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 250) : 80;

    const list = status
      ? await db()
          .select()
          .from(rooms)
          .where(eq(rooms.status, status))
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
    const message = e instanceof Error ? e.message : "rooms lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid json body" }, { status: 400 });
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
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const { PublicKey } = await import("@solana/web3.js");
  const { fetchDuel } = await import("@/lib/solana/fetch");
  const { serverConnection } = await import("@/lib/solana/connection");
  const { PROGRAM_ID } = await import("@/lib/solana/constants");
  const { statusName } = await import("@/lib/solana/pda");
  const connection = serverConnection();
  const onchain = await fetchDuel(connection, new PublicKey(pda));
  if (!onchain) {
    return NextResponse.json(
      { error: "duel account not found on chain — wait for confirmation and retry" },
      { status: 400 },
    );
  }
  if (onchain.host.toBase58() !== hostWallet) {
    return NextResponse.json({ error: "host mismatch" }, { status: 400 });
  }
  if (onchain.duelId.toString() !== duelId) {
    return NextResponse.json({ error: "duel id mismatch" }, { status: 400 });
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

  if (rematchOf) {
    const prior = await db().query.rooms.findFirst({ where: eq(rooms.id, rematchOf) });
    const allowed =
      prior &&
      (prior.hostWallet === hostWallet || prior.challengerWallet === hostWallet);
    if (allowed) {
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

  const room = await db().query.rooms.findFirst({ where: eq(rooms.id, pda) });
  return NextResponse.json({ room });
  } catch (e) {
    const message = e instanceof Error ? e.message : "room create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
