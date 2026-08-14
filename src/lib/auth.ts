import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
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
    const pubkey = new PublicKey(args.wallet).toBytes();
    const message = new TextEncoder().encode(args.message);
    const signature = base64ToBytes(args.signatureBase64);
    if (signature.length !== 64) return false;
    return nacl.sign.detached.verify(message, signature, pubkey);
  } catch {
    return false;
  }
}
