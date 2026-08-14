import nacl from "tweetnacl";
import bs58 from "bs58";
import { base64ToBytes } from "./base64";

export function identityMessage(wallet: string, username: string, demon: string) {
  return `BLOCK DICE bind\nwallet:${wallet}\nusername:${username}\ndemon:${demon}`;
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
