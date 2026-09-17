import { NextResponse } from "next/server";
import { fail, failInternal } from "@/lib/api";
import { publicClient } from "@/lib/eth/client";
import { deriveScore, hashToHex } from "@/lib/eth/dice";
import { currentBlock, fetchDuel, fetchRevealHash } from "@/lib/eth/fetch";
import { isU256String } from "@/lib/eth/keys";
import { TABLE_PHASE } from "@/lib/eth/table";
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
    const phase = onchain.phase;
    let preview: {
      seats: { wallet: string; roll: number; score: string; advanced: boolean }[];
      slotHash: string;
    } | null = null;
    let expired = false;
    let hashReady = false;

    if (revealSlot > 0n) {
      const found = await fetchRevealHash(client, revealSlot);
      expired = found.expired;
      if (found.entry) {
        hashReady = true;
        try {
          const seats = onchain.seats
            .filter((s) => phase < TABLE_PHASE.Final || s.advanced)
            .map((s) => {
              const derived = deriveScore({
                entropy: found.entry!.hash,
                tableId: pda,
                player: s.wallet as `0x${string}`,
                wagerWei: onchain.wagerWei,
                revealBlock: found.entry!.slot,
                phase: phase || TABLE_PHASE.Round1,
                index: s.index,
              });
              return {
                wallet: s.wallet,
                roll: derived.roll,
                score: derived.score.toString(),
                advanced: s.advanced,
              };
            });
          preview = {
            seats,
            slotHash: hashToHex(found.entry.hash),
          };
        } catch {
          preview = null;
        }
      }
    }

    const hostPreview = preview?.seats.find(
      (s) => s.wallet === onchain.host.toLowerCase(),
    );
    const guestPreview = preview?.seats.find(
      (s) => s.wallet === onchain.challenger.toLowerCase(),
    );

    return NextResponse.json({
      slot,
      revealSlot: revealSlot.toString(),
      commitSlot: onchain.commitBlock.toString(),
      status: onchain.status,
      phase,
      maxPlayers: onchain.maxPlayers,
      playerCount: onchain.playerCount,
      hashReady,
      expired,
      preview,
      hostRoll: onchain.hostRoll || hostPreview?.roll || null,
      challengerRoll: onchain.challengerRoll || guestPreview?.roll || null,
      winner:
        onchain.winner.toLowerCase() === zeroAddress ? null : onchain.winner.toLowerCase(),
      seats: onchain.seats,
    });
  } catch (e) {
    return failInternal("slot", e);
  }
}
