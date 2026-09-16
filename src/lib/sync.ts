import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { chatMessages, matchEvents, profiles, rooms } from "./db/schema";
import { publicClient } from "./eth/client";
import { fetchDuel, statusName } from "./eth/fetch";
import { hashToHex } from "./eth/dice";
import { isU256String } from "./eth/keys";
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
  const challenger =
    onchain.challenger.toLowerCase() === zeroAddress
      ? null
      : onchain.challenger.toLowerCase();
  const winner =
    onchain.winner.toLowerCase() === zeroAddress
      ? null
      : onchain.winner.toLowerCase();

  const patch = {
    status: nextStatus,
    challengerWallet: challenger,
    commitSlot: onchain.commitBlock === 0n ? null : onchain.commitBlock.toString(),
    revealSlot: onchain.revealBlock === 0n ? null : onchain.revealBlock.toString(),
    hostRoll: onchain.hostRoll || null,
    challengerRoll: onchain.challengerRoll || null,
    winnerWallet: winner,
    slotHash:
      onchain.entropy && onchain.entropy !== "0x" + "00".repeat(32)
        ? hashToHex(onchain.entropy)
        : null,
    hostNftId: onchain.hostTokenId > 0n ? onchain.hostTokenId.toString() : null,
    challengerNftId:
      onchain.challengerTokenId > 0n ? onchain.challengerTokenId.toString() : null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db().update(rooms).set(patch).where(eq(rooms.id, pda));
  }

  if (existing && existing.status !== "settled" && nextStatus === "settled" && winner) {
    const host = onchain.host.toLowerCase();
    const chal = onchain.challenger.toLowerCase();
    const loser = winner === host ? chal : host;
    await db()
      .update(profiles)
      .set({
        wins: sql`${profiles.wins} + 1`,
        volumeLamports: sql`(${profiles.volumeLamports}::numeric + ${onchain.wagerWei.toString()}::numeric)::text`,
        updatedAt: new Date(),
      })
      .where(eq(profiles.wallet, winner));
    await db()
      .update(profiles)
      .set({
        losses: sql`${profiles.losses} + 1`,
        volumeLamports: sql`(${profiles.volumeLamports}::numeric + ${onchain.wagerWei.toString()}::numeric)::text`,
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
        slotHash: hashToHex(onchain.entropy),
        revealSlot: onchain.revealBlock.toString(),
        pot: (onchain.wagerWei * 2n).toString(),
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
