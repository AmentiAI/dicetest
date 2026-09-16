import { createPublicClient, http, fallback } from "viem";
import { CHAIN } from "./constants";

function rpcUrls() {
  const urls = [
    process.env.ETH_RPC_URL,
    process.env.NEXT_PUBLIC_ETH_RPC_URL,
    CHAIN.rpcUrls.default.http[0],
  ].filter((u): u is string => Boolean(u));
  return [...new Set(urls)];
}

export function publicClient() {
  const urls = rpcUrls();
  return createPublicClient({
    chain: CHAIN,
    transport:
      urls.length > 1
        ? fallback(urls.map((url) => http(url)))
        : http(urls[0]),
  });
}
