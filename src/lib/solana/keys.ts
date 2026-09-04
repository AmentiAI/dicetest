import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function isPubkeyString(value: string): boolean {
  if (typeof value !== "string" || value.length < 32 || value.length > 44) {
    return false;
  }
  if (!BASE58.test(value)) return false;
  try {
    return new PublicKey(value).toBase58() === value;
  } catch {
    return false;
  }
}

export function isTxSignature(value: string): boolean {
  if (typeof value !== "string" || value.length < 64 || value.length > 88) {
    return false;
  }
  if (!BASE58.test(value)) return false;
  try {
    return bs58.decode(value).length === 64;
  } catch {
    return false;
  }
}

export function isU64String(value: string): boolean {
  if (typeof value !== "string" || !/^[0-9]{1,20}$/.test(value)) return false;
  try {
    const n = BigInt(value);
    return n >= 0n && n <= 0xffffffffffffffffn;
  } catch {
    return false;
  }
}
