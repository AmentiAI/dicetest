import { Connection } from "@solana/web3.js";

export const PUBLIC_SOLANA_RPC = "https://api.mainnet-beta.solana.com";

function mainnetUrl(url: string | undefined) {
  const raw = url?.trim() ?? "";
  if (!raw || /devnet|testnet/i.test(raw)) return PUBLIC_SOLANA_RPC;
  return raw;
}

export function solanaRpcUrl(kind: "server" | "client" = "server") {
  if (kind === "client") {
    return mainnetUrl(process.env.NEXT_PUBLIC_SOLANA_RPC_URL);
  }
  return mainnetUrl(process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL);
}

export function solanaConnection(kind: "server" | "client" = "server") {
  return new Connection(solanaRpcUrl(kind), "confirmed");
}
