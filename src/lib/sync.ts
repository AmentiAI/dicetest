import { eq, sql } from "drizzle-orm";
import { PublicKey } from "@solana/web3.js";
import { db } from "./db";
import { chatMessages, matchEvents, profiles, rooms } from "./db/schema";
import { fetchDuel } from "./solana/fetch";
import { serverConnection } from "./solana/connection";
import { statusName } from "./solana/pda";
import { hashToHex } from "./solana/dice";

export async function syncRoomFromChain(pda: string, opts?: { force?: boolean }) {
  const existing = await db().query.rooms.findFirst({
    where: eq(rooms.id, pda),
  });
  const skipChain =
    !opts?.force &&
    existing &&
    (existing.status === "settled" ||
      existing.status === "cancelled" ||
      existing.status === "refunded" ||
      existing.status === "waiting");
  if (skipChain) {
    return { room: existing, onchain: null };
  }

  const connection = serverConnection();
  const onchain = await fetchDuel(connection, new PublicKey(pda));
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
  const challenger = onchain.challenger.equals(PublicKey.default)
    ? null
    : onchain.challenger.toBase58();
  const winner = onchain.winner.equals(PublicKey.default)
    ? null
    : onchain.winner.toBase58();

  const patch = {
    status: nextStatus,
    challengerWallet: challenger,
    commitSlot: onchain.commitSlot === 0n ? null : onchain.commitSlot.toString(),
    revealSlot: onchain.revealSlot === 0n ? null : onchain.revealSlot.toString(),
    hostRoll: onchain.hostRoll || null,
    challengerRoll: onchain.challengerRoll || null,
    winnerWallet: winner,
    slotHash:
      onchain.slotHash.some((b) => b !== 0) ? hashToHex(onchain.slotHash) : null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db().update(rooms).set(patch).where(eq(rooms.id, pda));
  }

  if (existing && existing.status !== "settled" && nextStatus === "settled" && winner) {
    const loser =
      winner === onchain.host.toBase58()
        ? onchain.challenger.toBase58()
        : onchain.host.toBase58();
    await db()
      .update(profiles)
      .set({
        wins: sql`${profiles.wins} + 1`,
        volumeLamports: sql`(${profiles.volumeLamports}::numeric + ${onchain.wagerLamports.toString()}::numeric)::text`,
        updatedAt: new Date(),
      })
      .where(eq(profiles.wallet, winner));
    await db()
      .update(profiles)
      .set({
        losses: sql`${profiles.losses} + 1`,
        volumeLamports: sql`(${profiles.volumeLamports}::numeric + ${onchain.wagerLamports.toString()}::numeric)::text`,
        updatedAt: new Date(),
      })
      .where(eq(profiles.wallet, loser));
    await db().insert(matchEvents).values({
      roomId: pda,
      event: "settled",
      payload: {
        winner,
        hostRoll: onchain.hostRoll,
        challengerRoll: onchain.challengerRoll,
        slotHash: hashToHex(onchain.slotHash),
        revealSlot: onchain.revealSlot.toString(),
        pot: (onchain.wagerLamports * 2n).toString(),
      },
    });
    await db().insert(chatMessages).values({
      roomId: pda,
      wallet: "system",
      username: "SYS",
      kind: "system",
      body: `Settled on slot ${onchain.revealSlot.toString()}. ${winner.slice(0, 4)}… wins the pot. No house cut.`,
    });
  }

  const room = await db().query.rooms.findFirst({ where: eq(rooms.id, pda) });
  return { room: room ?? null, onchain };
}
