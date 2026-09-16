import { NextResponse } from "next/server";
import { fail, failInternal } from "@/lib/api";
import { limitOr429 } from "@/lib/rate-limit";
import { NFT_PAGE_SIZE } from "@/lib/waitlist";
import catalog from "@/lib/slow-roll/catalog.json";
import type { SlowRollNft } from "@/lib/slow-roll/die";
import { mixByRarity } from "@/lib/slow-roll/mix";

const deck = mixByRarity(catalog as SlowRollNft[]);

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const limited = limitOr429(req, "nfts-page", 40);
    if (limited) return limited;
    const page = Math.max(0, Number(new URL(req.url).searchParams.get("page") ?? 0) || 0);
    const total = deck.length;
    const pages = Math.max(1, Math.ceil(total / NFT_PAGE_SIZE));
    const safe = Math.min(page, pages - 1);
    const start = safe * NFT_PAGE_SIZE;
    const items = deck.slice(start, start + NFT_PAGE_SIZE);
    return NextResponse.json({
      page: safe,
      pages,
      total,
      size: NFT_PAGE_SIZE,
      items,
    });
  } catch (e) {
    return failInternal("nfts-page", e);
  }
}
