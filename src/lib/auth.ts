import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";

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
    const signature = Buffer.from(args.signatureBase64, "base64");
    if (signature.length !== 64) return false;
    return nacl.sign.detached.verify(message, signature, pubkey);
  } catch {
    return false;
  }
}
