import { count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { failInternal } from "@/lib/api";
import { db } from "@/lib/db";
import { profiles, rooms } from "@/lib/db/schema";
import { publicClient } from "@/lib/eth/client";
import { CHAIN, DUEL_ADDRESS, isContractsConfigured } from "@/lib/eth/constants";
import { currentBlock } from "@/lib/eth/fetch";
import { limitOr429 } from "@/lib/rate-limit";

export const runtime = "nodejs";

let deployedAt = 0;
let deployed = false;

async function contractsLive() {
  if (Date.now() - deployedAt < 30_000) return deployed;
  if (!isContractsConfigured()) {
    deployed = false;
    deployedAt = Date.now();
    return false;
  }
  try {
    const client = publicClient();
    const code = await client.getCode({ address: DUEL_ADDRESS });
    deployed = Boolean(code && code !== "0x");
  } catch {
    deployed = false;
  }
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

    let slot: number | null = null;
    let programDeployed = false;
    let rpc: string | null = null;

    try {
      const client = publicClient();
      rpc = CHAIN.rpcUrls.default.http[0] ?? null;
      slot = await currentBlock(client);
      programDeployed = await contractsLive();
    } catch {
      // RPC must not take down the whole stats payload.
    }

    return NextResponse.json({
      slot,
      programId: DUEL_ADDRESS,
      programDeployed,
      chain: CHAIN.name,
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
