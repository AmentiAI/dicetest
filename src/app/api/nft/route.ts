import type { Address } from "viem";
import { NextResponse } from "next/server";
import { fail, failInternal } from "@/lib/api";
import { publicClient } from "@/lib/eth/client";
import { NFT_ADDRESS, isContractsConfigured, nftAbi } from "@/lib/eth/constants";
import { isEthAddress, normalizeAddress } from "@/lib/eth/keys";
import { nftLabel } from "@/lib/eth/nft";
import { limitOr429 } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const limited = limitOr429(req, "nft-mine", 30);
    if (limited) return limited;
    const wallet = new URL(req.url).searchParams.get("wallet");
    if (!wallet || !isEthAddress(wallet)) return fail("wallet required");
    if (!isContractsConfigured()) return NextResponse.json({ tokens: [] });

    const client = publicClient();
    const me = normalizeAddress(wallet) as Address;
    const tokens: { id: string; skin: number; name: string }[] = [];

    try {
      const ids = (await client.readContract({
        address: NFT_ADDRESS,
        abi: nftAbi,
        functionName: "tokensOfOwner",
        args: [me],
      })) as bigint[];
      for (const id of ids) {
        const skin = await client.readContract({
          address: NFT_ADDRESS,
          abi: nftAbi,
          functionName: "skin",
          args: [id],
        });
        tokens.push({
          id: id.toString(),
          skin: Number(skin),
          name: nftLabel(Number(skin)),
        });
      }
    } catch {
      const nextId = await client.readContract({
        address: NFT_ADDRESS,
        abi: nftAbi,
        functionName: "nextId",
      });
      const cap = Number(nextId > 201n ? 201n : nextId);
      for (let id = 1; id < cap; id++) {
        try {
          const owner = await client.readContract({
            address: NFT_ADDRESS,
            abi: nftAbi,
            functionName: "ownerOf",
            args: [BigInt(id)],
          });
          if (owner.toLowerCase() !== me) continue;
          const skin = await client.readContract({
            address: NFT_ADDRESS,
            abi: nftAbi,
            functionName: "skin",
            args: [BigInt(id)],
          });
          tokens.push({
            id: String(id),
            skin: Number(skin),
            name: nftLabel(Number(skin)),
          });
        } catch {
          /* burned or missing */
        }
      }
    }

    return NextResponse.json({ tokens });
  } catch (e) {
    return failInternal("nft-mine", e);
  }
}
