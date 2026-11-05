import { PublicKey } from "@solana/web3.js";

const SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{64,128}$/;

export function isSolanaPubkey(value: string): boolean {
  if (typeof value !== "string" || value.length < 32 || value.length > 44) {
    return false;
  }
  try {
    return new PublicKey(value).toBase58() === value;
  } catch {
    return false;
  }
}

export function solanaPubkey(value: string): PublicKey {
  const key = new PublicKey(value);
  if (key.toBase58() !== value) {
    throw new Error("invalid solana address");
  }
  return key;
}

export function isSolanaSignature(value: string): boolean {
  return typeof value === "string" && SIG_RE.test(value);
}

export function devWallet(): string | null {
  const raw = process.env.NEXT_PUBLIC_DEV_WALLET?.trim() ?? "";
  if (!raw || !isSolanaPubkey(raw)) return null;
  return raw;
}
