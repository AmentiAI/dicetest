const PUBLIC_HOSTS = [
  "api.devnet.solana.com",
  "api.testnet.solana.com",
  "api.mainnet-beta.solana.com",
];

function network() {
  return (
    (process.env.NEXT_PUBLIC_SOLANA_NETWORK as
      | "devnet"
      | "mainnet-beta"
      | "testnet") || "devnet"
  );
}

function heliusCluster() {
  const net = network();
  if (net === "mainnet-beta") return "mainnet";
  if (net === "testnet") return "testnet";
  return "devnet";
}

function heliusUrl(key: string) {
  return `https://${heliusCluster()}.helius-rpc.com/?api-key=${key}`;
}

function isPublicRpc(url: string) {
  try {
    return PUBLIC_HOSTS.includes(new URL(url).host);
  } catch {
    return false;
  }
}

function hasEmbeddedApiKey(url: string) {
  return /api-key=/i.test(url);
}

function publicClusterRpc() {
  return network() === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : network() === "testnet"
      ? "https://api.testnet.solana.com"
      : "https://api.devnet.solana.com";
}

export function resolveBrowserRpc() {
  const explicit = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (explicit && !hasEmbeddedApiKey(explicit)) return explicit;
  return publicClusterRpc();
}

export function resolveServerRpc() {
  const explicit = process.env.SOLANA_RPC_URL;
  const helius = process.env.HELIUS_API_KEY;
  if (explicit && !isPublicRpc(explicit)) return explicit;
  if (helius) return heliusUrl(helius);
  if (explicit) return explicit;
  const pub = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (pub && !hasEmbeddedApiKey(pub) && !isPublicRpc(pub)) return pub;
  return publicClusterRpc();
}

export async function rpcFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let last: Response | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    last = await fetch(input, init);
    if (last.status !== 429 && last.status !== 503) return last;
    const retryAfter = Number(last.headers.get("retry-after"));
    const wait = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : Math.min(8_000, 500 * 2 ** attempt);
    await new Promise((r) => setTimeout(r, wait));
  }
  return last!;
}
