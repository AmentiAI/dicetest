import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { chatMessages, matchEvents, profiles, rooms } from "./db/schema";
import { publicClient } from "./eth/client";
import { fetchDuel, statusName } from "./eth/fetch";
import { hashToHex } from "./eth/dice";
import { isU256String } from "./eth/keys";
import { TABLE_PHASE, type TableSeat } from "./eth/table";
import { zeroAddress } from "viem";

export async function syncRoomFromChain(pda: string, opts?: { force?: boolean }) {
  if (!isU256String(pda)) {
    return { room: null, onchain: null };
  }
  const existing = await db().query.rooms.findFirst({
    where: eq(rooms.id, pda),
  });
  const skipChain =
    !opts?.force &&
    existing &&
    (existing.status === "settled" ||
      existing.status === "cancelled" ||
      existing.status === "refunded");
  if (skipChain) {
    return { room: existing, onchain: null };
  }

  const client = publicClient();
  const onchain = await fetchDuel(client, pda);
  if (!onchain) {
    if (existing && existing.status === "waiting") {
      await db()
        .update(rooms)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(rooms.id, pda));
    }
    return { room: existing ?? null, onchain: null };
  }

  const nextStatus = statusName(onchain.status);
  const seats = onchain.seats;
  const challenger = seats[1]?.wallet ?? null;
  const winner =
    onchain.winner.toLowerCase() === zeroAddress ? null : onchain.winner.toLowerCase();
  const hostRoll = onchain.hostRoll || null;
  const guestRoll = onchain.challengerRoll || null;

  const patch = {
    status: nextStatus,
    challengerWallet: challenger,
    commitSlot: onchain.commitBlock === 0n ? null : onchain.commitBlock.toString(),
    revealSlot: onchain.revealBlock === 0n ? null : onchain.revealBlock.toString(),
    hostRoll,
    challengerRoll: guestRoll,
    winnerWallet: winner,
    slotHash:
      onchain.entropy && onchain.entropy !== "0x" + "00".repeat(32)
        ? hashToHex(onchain.entropy)
        : null,
    hostNftId: onchain.hostTokenId > 0n ? onchain.hostTokenId.toString() : null,
    challengerNftId:
      onchain.challengerTokenId > 0n ? onchain.challengerTokenId.toString() : null,
    maxPlayers: onchain.maxPlayers,
    playerCount: onchain.playerCount,
    phase: onchain.phase,
    seats,
    updatedAt: new Date(),
  };

  if (existing) {
    await db().update(rooms).set(patch).where(eq(rooms.id, pda));
  }

  if (existing && existing.status === "waiting" && nextStatus === "locked") {
    await db().insert(matchEvents).values({
      roomId: pda,
      event: "started",
      payload: {
        playerCount: onchain.playerCount,
        maxPlayers: onchain.maxPlayers,
        revealSlot: onchain.revealBlock.toString(),
      },
    });
    await db().insert(chatMessages).values({
      roomId: pda,
      wallet: "system",
      username: "SYS",
      kind: "system",
      body:
        onchain.playerCount > 5
          ? `Host started with ${onchain.playerCount}. Top 5 advance, winner takes the pot.`
          : `Host started a ${onchain.playerCount}-player table. Highest roll takes the pot.`,
    });
  }

  if (
    existing &&
    existing.phase === TABLE_PHASE.Round1 &&
    onchain.phase === TABLE_PHASE.Final
  ) {
    await db().insert(matchEvents).values({
      roomId: pda,
      event: "finalists",
      payload: {
        wallets: seats.filter((s) => s.advanced).map((s) => s.wallet),
      },
    });
    await db().insert(chatMessages).values({
      roomId: pda,
      wallet: "system",
      username: "SYS",
      kind: "system",
      body: "Top 5 are in the final. Winner takes the whole pot.",
    });
  }

  if (existing && existing.status !== "settled" && nextStatus === "settled" && winner) {
    const pot = (onchain.wagerWei * BigInt(onchain.playerCount)).toString();
    const losers = seats.map((s) => s.wallet).filter((w) => w !== winner);
    await db()
      .update(profiles)
      .set({
        wins: sql`${profiles.wins} + 1`,
        volumeLamports: sql`(${profiles.volumeLamports}::numeric + ${onchain.wagerWei.toString()}::numeric)::text`,
        updatedAt: new Date(),
      })
      .where(eq(profiles.wallet, winner));
    for (const loser of losers) {
      await db()
        .update(profiles)
        .set({
          losses: sql`${profiles.losses} + 1`,
          volumeLamports: sql`(${profiles.volumeLamports}::numeric + ${onchain.wagerWei.toString()}::numeric)::text`,
          updatedAt: new Date(),
        })
        .where(eq(profiles.wallet, loser));
    }
    await db().insert(matchEvents).values({
      roomId: pda,
      event: "settled",
      payload: {
        winner,
        winnerRoll: onchain.winnerRoll,
        seats,
        slotHash: hashToHex(onchain.entropy),
        revealSlot: onchain.revealBlock.toString(),
        pot,
      },
    });
    await db().insert(chatMessages).values({
      roomId: pda,
      wallet: "system",
      username: "SYS",
      kind: "system",
      body: `Settled on block ${onchain.revealBlock.toString()}. ${winner.slice(0, 6)}… wins the pot. No house cut.`,
    });
  }

  const room = await db().query.rooms.findFirst({ where: eq(rooms.id, pda) });
  return { room: room ?? null, onchain };
}

export function seatedWallets(seats: TableSeat[] | null | undefined, fallback: string[]) {
  const fromSeats = (seats ?? []).map((s) => s.wallet).filter(Boolean);
  return [...new Set([...fromSeats, ...fallback.filter(Boolean)])];
}
