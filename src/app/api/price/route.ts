import { NextResponse } from "next/server";
import { failInternal } from "@/lib/api";
import { limitOr429 } from "@/lib/rate-limit";
import { TOKEN } from "@/lib/token";

let cached: { at: number; usd: number | null; source: string } = {
  at: 0,
  usd: null,
  source: "",
};

async function fromDexScreener(): Promise<number | null> {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${TOKEN.mint}`,
    { next: { revalidate: 15 } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    pairs?: { priceUsd?: string; liquidity?: { usd?: number } }[];
  };
  const pairs = json.pairs ?? [];
  const best = [...pairs].sort(
    (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
  )[0];
  const n = Number(best?.priceUsd);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fromJupiter(): Promise<number | null> {
  const res = await fetch(
    `https://lite-api.jup.ag/price/v2?ids=${TOKEN.mint}`,
    { next: { revalidate: 15 } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: Record<string, { price?: string | number }>;
  };
  const n = Number(json.data?.[TOKEN.mint]?.price);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(req: Request) {
  try {
    const limited = limitOr429(req, "price", 40);
    if (limited) return limited;
    if (Date.now() - cached.at < 15_000 && cached.usd != null) {
      return NextResponse.json(cached);
    }
    const usd = (await fromDexScreener()) ?? (await fromJupiter());
    cached = {
      at: Date.now(),
      usd,
      source: usd != null ? "dex" : "none",
    };
    return NextResponse.json(cached);
  } catch (e) {
    return failInternal("price", e);
  }
}
