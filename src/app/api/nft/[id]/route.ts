import { NextResponse } from "next/server";
import { fail, failInternal } from "@/lib/api";
import { publicClient } from "@/lib/eth/client";
import { NFT_ADDRESS, isContractsConfigured, nftAbi } from "@/lib/eth/constants";
import { nftImageSrc, nftLabel, nftTone } from "@/lib/eth/nft";
import { CHAIN } from "@/lib/eth/constants";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!/^[0-9]+$/.test(id) || id === "0") return fail("invalid token");
    if (!isContractsConfigured()) return fail("nft contract is not configured", 503);

    const client = publicClient();
    const skin = Number(
      await client.readContract({
        address: NFT_ADDRESS,
        abi: nftAbi,
        functionName: "skin",
        args: [BigInt(id)],
      }),
    );
    const name = nftLabel(skin);
    return NextResponse.json({
      name: `${name} #${id}`,
      description: "Block Dice character. Equip it in matches and on the leaderboard. Stake it into a circle to bet it.",
      image: nftImageSrc(id),
      external_url: `${CHAIN.blockExplorers.default.url}/token/${NFT_ADDRESS}?a=${id}`,
      attributes: [
        { trait_type: "Skin", value: name },
        { trait_type: "Tone", value: nftTone(skin) },
      ],
    });
  } catch (e) {
    return failInternal("nft-meta", e);
  }
}
