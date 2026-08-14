import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

export function lamportsToSol(lamports: bigint | number | string) {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number) {
  return BigInt(Math.round(sol * LAMPORTS_PER_SOL));
}

export function formatSol(lamports: bigint | number | string, digits = 4) {
  const n = lamportsToSol(lamports);
  return `${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })} SOL`;
}

export function formatUsd(sol: number, price: number | null) {
  if (price == null || !Number.isFinite(price)) return "—";
  const usd = sol * price;
  return usd.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: usd >= 100 ? 0 : 2,
  });
}

export function shortKey(key: string | PublicKey, left = 4, right = 4) {
  const s = typeof key === "string" ? key : key.toBase58();
  if (s.length <= left + right + 1) return s;
  return `${s.slice(0, left)}…${s.slice(-right)}`;
}

export async function getSolBalance(connection: Connection, pubkey: PublicKey) {
  return connection.getBalance(pubkey, "confirmed");
}

export function explorerClusterParam(network: string) {
  return network === "mainnet-beta" ? "" : `?cluster=${network}`;
}
