const WEI = 10n ** 18n;

export function weiToEth(wei: bigint | number | string) {
  return Number(wei) / Number(WEI);
}

export function ethToWei(eth: number) {
  return BigInt(Math.round(eth * 1e18));
}

export function formatEth(wei: bigint | number | string, digits = 4) {
  const n = weiToEth(wei);
  return `${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })} ETH`;
}

/** @deprecated use formatEth — kept so remaining UI compiles during the swap */
export const formatSol = formatEth;
export const lamportsToSol = weiToEth;
export const solToLamports = ethToWei;

export function formatUsd(eth: number, price: number | null) {
  if (price == null || !Number.isFinite(price)) return "—";
  const usd = eth * price;
  return usd.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: usd >= 100 ? 0 : 2,
  });
}

export function shortKey(key: string, left = 4, right = 4) {
  const s = key.startsWith("0x") ? key : key;
  if (s.length <= left + right + 1) return s;
  return `${s.slice(0, left)}…${s.slice(-right)}`;
}

export function ethInputFromWei(wei: string) {
  const n = Number(wei) / 1e18;
  if (!Number.isFinite(n)) return "0.05";
  const text = n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return text || "0";
}
