import { keccak256, toBytes } from "viem";
import { verifyMessage } from "viem";
import { isEthAddress, normalizeAddress } from "./eth/keys";

export const AUTH_TS_WINDOW_MS = 2 * 60 * 1000;

export function identityMessage(wallet: string, username: string, nftTokenId: string) {
  return `BLOCK DICE bind\nwallet:${wallet}\nusername:${username}\nnft:${nftTokenId}`;
}

export function chatAuthMessage(
  roomId: string,
  wallet: string,
  body: string,
  ts: number,
) {
  return `BLOCK DICE chat\nroom:${roomId}\nwallet:${wallet}\nbody:${body}\nts:${ts}`;
}

export function adminAuthMessage(wallet: string, ts: number) {
  return `BLOCK DICE admin\nwallet:${wallet}\nts:${ts}`;
}

export function parseAuthTimestamp(ts: unknown) {
  const n = typeof ts === "number" ? ts : Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (Math.abs(Date.now() - n) > AUTH_TS_WINDOW_MS) return null;
  return Math.trunc(n);
}

export async function verifyWalletSignature(args: {
  wallet: string;
  message: string;
  signatureBase64: string;
}) {
  try {
    if (!isEthAddress(args.wallet)) return false;
    const signature = args.signatureBase64.startsWith("0x")
      ? args.signatureBase64
      : `0x${args.signatureBase64}`;
    return await verifyMessage({
      address: normalizeAddress(args.wallet) as `0x${string}`,
      message: args.message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}

export function bytesToEthSignature(sig: string) {
  return sig.startsWith("0x") ? sig : `0x${sig}`;
}

export function messageId(message: string) {
  return keccak256(toBytes(message));
}
