import { Connection } from "@solana/web3.js";
import { resolveBrowserRpc, resolveServerRpc, rpcFetch } from "./rpc";

const connConfig = {
  commitment: "confirmed" as const,
  confirmTransactionInitialTimeout: 60_000,
  fetch: rpcFetch,
  disableRetryOnRateLimit: false,
};

export function makeConnection(rpcUrl = resolveBrowserRpc()) {
  return new Connection(rpcUrl, connConfig);
}

let cached: Connection | null = null;
let cachedUrl = "";

export function serverConnection() {
  const url = resolveServerRpc();
  if (!cached || cachedUrl !== url) {
    cached = new Connection(url, connConfig);
    cachedUrl = url;
  }
  return cached;
}
