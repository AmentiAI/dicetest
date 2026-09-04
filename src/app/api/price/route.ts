import { NextResponse } from "next/server";
import { failInternal } from "@/lib/api";
import { limitOr429 } from "@/lib/rate-limit";

let cached: { at: number; usd: number | null; source: string } = {
  at: 0,
  usd: null,
  source: "",
};

async function fromJupiter(): Promise<number | null> {
  const res = await fetch(
    "https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112",
    { next: { revalidate: 30 } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    So11111111111111111111111111111111111111112?: { usdPrice?: number };
  };
  const n = json.So11111111111111111111111111111111111111112?.usdPrice;
  return typeof n === "number" ? n : null;
}

async function fromCoinGecko(): Promise<number | null> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
    { next: { revalidate: 30 } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { solana?: { usd?: number } };
  const n = json.solana?.usd;
  return typeof n === "number" ? n : null;
}

export async function GET(req: Request) {
  try {
    const limited = limitOr429(req, "price", 40);
    if (limited) return limited;
    if (Date.now() - cached.at < 30_000 && cached.usd != null) {
      return NextResponse.json(cached);
    }
    let usd = await fromJupiter();
    let source = "jupiter";
    if (usd == null) {
      usd = await fromCoinGecko();
      source = "coingecko";
    }
    cached = { at: Date.now(), usd, source };
    return NextResponse.json(cached);
  } catch (e) {
    return failInternal("price", e);
  }
}
