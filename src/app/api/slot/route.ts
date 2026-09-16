import { NextResponse } from "next/server";
import { fail, failInternal } from "@/lib/api";
import { publicClient } from "@/lib/eth/client";
import { deriveRolls, hashToHex } from "@/lib/eth/dice";
import { currentBlock, fetchDuel, fetchRevealHash } from "@/lib/eth/fetch";
import { isU256String } from "@/lib/eth/keys";
import { limitOr429 } from "@/lib/rate-limit";
import { zeroAddress } from "viem";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const limited = limitOr429(req, "slot", 30);
    if (limited) return limited;
    const url = new URL(req.url);
    const pda = url.searchParams.get("pda");
    if (pda && !isU256String(pda)) return fail("invalid room");

    const client = publicClient();
    const slot = await currentBlock(client);

    if (!pda) {
      return NextResponse.json({ slot });
    }

    const onchain = await fetchDuel(client, pda);
    if (!onchain) {
      return NextResponse.json({ slot, onchain: null });
    }

    const revealSlot = onchain.revealBlock;
    let preview: {
      hostRoll: number;
      challengerRoll: number;
      slotHash: string;
      counter: number;
    } | null = null;
    let expired = false;
    let hashReady = false;

    if (revealSlot > 0n) {
      const found = await fetchRevealHash(client, revealSlot);
      expired = found.expired;
      if (found.entry) {
        hashReady = true;
        try {
          const rolls = deriveRolls({
            entropy: found.entry.hash,
            duelId: pda,
            host: onchain.host,
            challenger: onchain.challenger,
            wagerWei: onchain.wagerWei,
            revealBlock: found.entry.slot,
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
      commitSlot: onchain.commitBlock.toString(),
      status: onchain.status,
      hashReady,
      expired,
      preview,
      hostRoll: onchain.hostRoll || null,
      challengerRoll: onchain.challengerRoll || null,
      winner:
        onchain.winner.toLowerCase() === zeroAddress
          ? null
          : onchain.winner.toLowerCase(),
    });
  } catch (e) {
    return failInternal("slot", e);
  }
}
