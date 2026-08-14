import { Connection } from "@solana/web3.js";
import { SOLANA_RPC } from "./constants";

export function makeConnection(rpcUrl = SOLANA_RPC) {
  return new Connection(rpcUrl, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 60_000,
  });
}

export function serverConnection() {
  const url =
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.devnet.solana.com";
  return new Connection(url, "confirmed");
}
