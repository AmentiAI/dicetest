import { NextResponse } from "next/server";
import { fail, failInternal } from "@/lib/api";
import { limitOr429 } from "@/lib/rate-limit";
import { isPubkeyString } from "@/lib/solana/keys";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const limited = limitOr429(req, "slot", 30);
    if (limited) return limited;
    const url = new URL(req.url);
    const pda = url.searchParams.get("pda");
    if (pda && !isPubkeyString(pda)) return fail("invalid room");

    const { PublicKey } = await import("@solana/web3.js");
    const { serverConnection } = await import("@/lib/solana/connection");
    const { fetchRevealHash, currentSlot, fetchDuel } = await import(
      "@/lib/solana/fetch"
    );
    const { deriveRolls, hashToHex } = await import("@/lib/solana/dice");

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
      winner:
        onchain.winner.toBase58() === PublicKey.default.toBase58()
          ? null
          : onchain.winner.toBase58(),
    });
  } catch (e) {
    return failInternal("slot", e);
  }
}
