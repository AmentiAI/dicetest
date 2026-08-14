import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { serverConnection } from "@/lib/solana/connection";
import { fetchRevealHash, currentSlot } from "@/lib/solana/fetch";
import { deriveRolls, hashToHex } from "@/lib/solana/dice";
import { fetchDuel } from "@/lib/solana/fetch";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pda = url.searchParams.get("pda");
  const connection = serverConnection();
  const slot = await currentSlot(connection);

  if (!pda) {
    return NextResponse.json({ slot });
  }

  const onchain = await fetchDuel(connection, new PublicKey(pda));
  if (!onchain) {
    return NextResponse.json({ slot, onchain: null });
  }

  const revealSlot = onchain.revealSlot;
  let preview: {
    hostRoll: number;
    challengerRoll: number;
    slotHash: string;
    counter: number;
  } | null = null;
  let expired = false;
  let hashReady = false;

  if (revealSlot > 0n) {
    const found = await fetchRevealHash(connection, revealSlot);
    expired = found.expired;
    if (found.entry) {
      hashReady = true;
      try {
        const rolls = deriveRolls({
          slotHash: found.entry.hash,
          duel: new PublicKey(pda),
          host: onchain.host,
          challenger: onchain.challenger,
          wagerLamports: onchain.wagerLamports,
          revealSlot: found.entry.slot,
        });
        preview = {
          hostRoll: rolls.hostRoll,
          challengerRoll: rolls.challengerRoll,
          slotHash: hashToHex(found.entry.hash),
          counter: rolls.counter,
        };
      } catch {
        preview = null;
      }
    }
  }

  return NextResponse.json({
    slot,
    revealSlot: revealSlot.toString(),
    commitSlot: onchain.commitSlot.toString(),
    status: onchain.status,
    hashReady,
    expired,
    preview,
    hostRoll: onchain.hostRoll || null,
    challengerRoll: onchain.challengerRoll || null,
    winner: onchain.winner.toBase58() === PublicKey.default.toBase58()
      ? null
      : onchain.winner.toBase58(),
  });
}
