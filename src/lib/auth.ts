import nacl from "tweetnacl";
import bs58 from "bs58";
import { base64ToBytes } from "./base64";

export const AUTH_TS_WINDOW_MS = 2 * 60 * 1000;

export function identityMessage(wallet: string, username: string, demon: string) {
  return `BLOCK DICE bind\nwallet:${wallet}\nusername:${username}\ndemon:${demon}`;
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

export function verifyWalletSignature(args: {
  wallet: string;
  message: string;
  signatureBase64: string;
}) {
  try {
    const pubkey = bs58.decode(args.wallet);
    if (pubkey.length !== 32) return false;
    const message = new TextEncoder().encode(args.message);
    const signature = base64ToBytes(args.signatureBase64);
    if (signature.length !== 64) return false;
    return nacl.sign.detached.verify(message, signature, pubkey);
  } catch {
    return false;
  }
}
