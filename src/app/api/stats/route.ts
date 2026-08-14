import { count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Connection, SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
import { db } from "@/lib/db";
import { profiles, rooms } from "@/lib/db/schema";
import { serverConnection } from "@/lib/solana/connection";
import { PROGRAM_ID } from "@/lib/solana/constants";

export async function GET() {
  const connection = serverConnection();
  const [slot, programInfo, waiting, locked, settled, players] = await Promise.all([
    connection.getSlot("confirmed"),
    connection.getAccountInfo(PROGRAM_ID, "confirmed"),
    db().select({ n: count() }).from(rooms).where(eq(rooms.status, "waiting")),
    db().select({ n: count() }).from(rooms).where(eq(rooms.status, "locked")),
    db().select({ n: count() }).from(rooms).where(eq(rooms.status, "settled")),
    db().select({ n: count() }).from(profiles),
  ]);

  const potRows = await db()
    .select({
      pot: sql<string>`coalesce(sum(${rooms.wagerLamports}::numeric * 2), 0)::text`,
    })
    .from(rooms)
    .where(eq(rooms.status, "locked"));

  return NextResponse.json({
    slot,
    programId: PROGRAM_ID.toBase58(),
    programDeployed: Boolean(programInfo?.executable),
    slotHashes: SYSVAR_SLOT_HASHES_PUBKEY.toBase58(),
    waiting: waiting[0]?.n ?? 0,
    locked: locked[0]?.n ?? 0,
    settled: settled[0]?.n ?? 0,
    players: players[0]?.n ?? 0,
    lockedPotLamports: potRows[0]?.pot ?? "0",
    rpc: (connection as Connection).rpcEndpoint,
  });
}

export const runtime = "nodejs";
