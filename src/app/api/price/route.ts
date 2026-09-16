import { NextResponse } from "next/server";
import { failInternal } from "@/lib/api";
import { limitOr429 } from "@/lib/rate-limit";

let cached: { at: number; usd: number | null; source: string } = {
  at: 0,
  usd: null,
  source: "",
};

async function fromCoinGecko(): Promise<number | null> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    { next: { revalidate: 30 } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { ethereum?: { usd?: number } };
  const n = json.ethereum?.usd;
  return typeof n === "number" ? n : null;
}

export async function GET(req: Request) {
  try {
    const limited = limitOr429(req, "price", 40);
    if (limited) return limited;
    if (Date.now() - cached.at < 30_000 && cached.usd != null) {
      return NextResponse.json(cached);
    }
    const usd = await fromCoinGecko();
    cached = { at: Date.now(), usd, source: "coingecko" };
    return NextResponse.json(cached);
  } catch (e) {
    return failInternal("price", e);
  }
}
