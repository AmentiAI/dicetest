import { getAddress, isAddress, isHex } from "viem";

export function isEthAddress(value: string): boolean {
  return typeof value === "string" && isAddress(value, { strict: false });
}

export function normalizeAddress(value: string) {
  return getAddress(value).toLowerCase();
}

export function isTxHash(value: string): boolean {
  return typeof value === "string" && isHex(value, { strict: true }) && value.length === 66;
}

export function isU256String(value: string): boolean {
  if (typeof value !== "string" || !/^[0-9]{1,78}$/.test(value)) return false;
  try {
    return BigInt(value) >= 0n;
  } catch {
    return false;
  }
}

/** @deprecated use isEthAddress */
export const isPubkeyString = isEthAddress;
/** @deprecated use isTxHash */
export const isTxSignature = isTxHash;
export const isU64String = isU256String;
