import type { Connection, PublicKey } from "@solana/web3.js";
import { count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { failInternal } from "@/lib/api";
import { limitOr429 } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { profiles, rooms } from "@/lib/db/schema";

export const runtime = "nodejs";

const SLOT_HASHES = "SysvarS1otHashes111111111111111111111111111";
const FALLBACK_PROGRAM_ID = "Djg4PX3upqax7GWrxWUjF3ydhbDDPqugM5QTsoNu14xx";

let deployedAt = 0;
let deployed = false;

async function programDeployedCached(connection: Connection, programId: PublicKey) {
  if (Date.now() - deployedAt < 30_000) return deployed;
  const info = await connection.getAccountInfo(programId, "confirmed");
  deployed = Boolean(info?.executable);
  deployedAt = Date.now();
  return deployed;
}

export async function GET(req: Request) {
  try {
    const limited = limitOr429(req, "stats", 60);
    if (limited) return limited;
    const [waiting, locked, settled, players, potRows] = await Promise.all([
      db().select({ n: count() }).from(rooms).where(eq(rooms.status, "waiting")),
      db().select({ n: count() }).from(rooms).where(eq(rooms.status, "locked")),
      db().select({ n: count() }).from(rooms).where(eq(rooms.status, "settled")),
      db().select({ n: count() }).from(profiles),
      db()
        .select({
          pot: sql<string>`coalesce(sum(${rooms.wagerLamports}::numeric * 2), 0)::text`,
        })
        .from(rooms)
        .where(eq(rooms.status, "locked")),
    ]);

    const programId = process.env.NEXT_PUBLIC_PROGRAM_ID || FALLBACK_PROGRAM_ID;
    let slot: number | null = null;
    let programDeployed = false;
    let rpc: string | null = null;

    try {
      const { serverConnection } = await import("@/lib/solana/connection");
      const { PROGRAM_ID } = await import("@/lib/solana/constants");
      const { currentSlot } = await import("@/lib/solana/fetch");
      const connection = serverConnection();
      rpc = connection.rpcEndpoint.replace(/api-key=[^&]+/i, "api-key=…");
      slot = await currentSlot(connection);
      programDeployed = await programDeployedCached(connection, PROGRAM_ID);
    } catch {
      // RPC / web3.js must not take down the whole stats payload.
    }

    return NextResponse.json({
      slot,
      programId,
      programDeployed,
      slotHashes: SLOT_HASHES,
      waiting: waiting[0]?.n ?? 0,
      locked: locked[0]?.n ?? 0,
      settled: settled[0]?.n ?? 0,
      players: players[0]?.n ?? 0,
      lockedPotLamports: potRows[0]?.pot ?? "0",
      rpc,
    });
  } catch (e) {
    return failInternal("stats", e);
  }
}
