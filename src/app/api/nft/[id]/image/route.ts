import { NextResponse } from "next/server";
import { fail, failInternal } from "@/lib/api";
import { publicClient } from "@/lib/eth/client";
import { NFT_ADDRESS, isContractsConfigured, nftAbi } from "@/lib/eth/constants";
import { nftLabel, nftTone } from "@/lib/eth/nft";

export const runtime = "nodejs";

const FILL: Record<string, [string, string]> = {
  ice: ["#041016", "#00e8ff"],
  chain: ["#07140a", "#b6ff3b"],
  burn: ["#140814", "#c084ff"],
  "black-red": ["#0a0a0a", "#ef4444"],
  "green-purple": ["#07140a", "#22c55e"],
  "orange-blue": ["#140a04", "#f97316"],
};

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!/^[0-9]+$/.test(id) || id === "0") return fail("invalid token");
    let skin = Number(id) % 6;
    if (isContractsConfigured()) {
      try {
        const client = publicClient();
        skin = Number(
          await client.readContract({
            address: NFT_ADDRESS,
            abi: nftAbi,
            functionName: "skin",
            args: [BigInt(id)],
          }),
        );
      } catch {
        /* fallback */
      }
    }
    const tone = nftTone(skin);
    const [bg, accent] = FILL[tone] ?? FILL.ice!;
    const label = nftLabel(skin);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="48" fill="${bg}"/>
  <rect x="96" y="96" width="320" height="320" rx="36" fill="none" stroke="${accent}" stroke-width="18"/>
  <circle cx="256" cy="256" r="28" fill="${accent}"/>
  <circle cx="176" cy="176" r="22" fill="${accent}"/>
  <circle cx="336" cy="176" r="22" fill="${accent}"/>
  <circle cx="176" cy="336" r="22" fill="${accent}"/>
  <circle cx="336" cy="336" r="22" fill="${accent}"/>
  <text x="256" y="460" text-anchor="middle" fill="${accent}" font-family="sans-serif" font-size="28">${label} #${id}</text>
</svg>`;
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return failInternal("nft-image", e);
  }
}
