import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { db } from "@/lib/db";
import { chatMessages, matchEvents, profiles, rooms } from "@/lib/db/schema";
import { fetchDuel } from "@/lib/solana/fetch";
import { serverConnection } from "@/lib/solana/connection";
import { PROGRAM_ID } from "@/lib/solana/constants";
import { statusName } from "@/lib/solana/pda";

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

export async function GET() {
  const list = await db().select().from(rooms).orderBy(desc(rooms.createdAt)).limit(80);
  const enriched = await withProfiles(list);
  const waiting = list.filter((r) => r.status === "waiting").length;
  const locked = list.filter((r) => r.status === "locked").length;
  return NextResponse.json({
    rooms: enriched,
    stats: {
      activeRooms: waiting + locked,
      waiting,
      locked,
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const pda = String(body.pda ?? "");
  const duelId = String(body.duelId ?? "");
  const hostWallet = String(body.hostWallet ?? "");
  const wagerLamports = String(body.wagerLamports ?? "");
  const createSignature = String(body.createSignature ?? "");

  if (!pda || !duelId || !hostWallet || !wagerLamports || !createSignature) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

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
    payload: { hostWallet, wagerLamports: onchain.wagerLamports.toString(), program: PROGRAM_ID.toBase58() },
  });
  await db().insert(chatMessages).values({
    roomId: pda,
    wallet: "system",
    username: "SYS",
    kind: "system",
                body: "Circle opened. Wager is locked in the program PDA. Winner takes all.",
  });

  const room = await db().query.rooms.findFirst({ where: eq(rooms.id, pda) });
  return NextResponse.json({ room });
}
