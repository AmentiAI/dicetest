import { TOKEN } from "@/lib/token";

type PriceHit = { usd: number | null; source: string };

let cached: PriceHit & { at: number } = { at: 0, usd: null, source: "" };

function positive(n: number) {
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fromDexScreener(): Promise<number | null> {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${TOKEN.mint}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    pairs?: { priceUsd?: string; liquidity?: { usd?: number } }[];
  };
  const pairs = json.pairs ?? [];
  const best = [...pairs].sort(
    (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
  )[0];
  return positive(Number(best?.priceUsd));
}

async function fromJupiter(): Promise<number | null> {
  const res = await fetch(
    `https://lite-api.jup.ag/price/v2?ids=${TOKEN.mint}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: Record<string, { price?: string | number }>;
  };
  return positive(Number(json.data?.[TOKEN.mint]?.price));
}

async function fromPump(): Promise<number | null> {
  const res = await fetch(
    `https://frontend-api-v3.pump.fun/coins/${TOKEN.mint}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as Record<string, unknown>;
  const direct = positive(
    Number(json.price_usd ?? json.usd_price ?? json.price),
  );
  if (direct) return direct;
  const mcap = Number(json.usd_market_cap);
  const supply = Number(json.total_supply);
  if (mcap > 0 && supply > 0) {
    return positive(mcap / (supply / 10 ** TOKEN.decimals));
  }
  return null;
}

async function fromGecko(): Promise<number | null> {
  const res = await fetch(
    `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${TOKEN.mint}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: { attributes?: { price_usd?: string } };
  };
  return positive(Number(json.data?.attributes?.price_usd));
}

export async function rtbUsd(): Promise<PriceHit> {
  if (Date.now() - cached.at < 15_000 && cached.usd != null) {
    return { usd: cached.usd, source: cached.source };
  }
  const usd =
    (await fromDexScreener()) ??
    (await fromJupiter()) ??
    (await fromGecko()) ??
    (await fromPump());
  cached = {
    at: Date.now(),
    usd,
    source: usd != null ? "dex" : "none",
  };
  return { usd: cached.usd, source: cached.source };
}
