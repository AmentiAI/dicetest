import { TOKEN } from "@/lib/token";

export const GIVEAWAY_USD = 25;
export const GIVEAWAY_SLIPPAGE = 0.08;

export function quoteRtbUnits(priceUsd: number): bigint {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    throw new Error("price unavailable");
  }
  const scaled = (GIVEAWAY_USD / priceUsd) * 10 ** TOKEN.decimals;
  if (!Number.isFinite(scaled) || scaled <= 0) {
    throw new Error("price unavailable");
  }
  if (scaled > Number.MAX_SAFE_INTEGER) {
    throw new Error("quote too large");
  }
  return BigInt(Math.ceil(scaled));
}

export function rtbUiAmount(units: bigint): string {
  const n = Number(units) / 10 ** TOKEN.decimals;
  if (!Number.isFinite(n)) return units.toString();
  return n.toLocaleString(undefined, {
    maximumFractionDigits: TOKEN.decimals,
    minimumFractionDigits: 0,
  });
}

export function minAcceptUnits(priceUsd: number): bigint {
  const quoted = quoteRtbUnits(priceUsd);
  const keep = 1 - GIVEAWAY_SLIPPAGE;
  const min = Number(quoted) * keep;
  if (!Number.isFinite(min) || min <= 0) return quoted;
  const floored = Math.floor(min);
  return BigInt(Math.max(1, floored));
}
