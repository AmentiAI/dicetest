import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { resolveBrowserRpc } from "./rpc";

const FALLBACK_PROGRAM_ID = "Djg4PX3upqax7GWrxWUjF3ydhbDDPqugM5QTsoNu14xx";

function parseProgramId() {
  const raw = process.env.NEXT_PUBLIC_PROGRAM_ID || FALLBACK_PROGRAM_ID;
  try {
    return new PublicKey(raw);
  } catch {
    return new PublicKey(FALLBACK_PROGRAM_ID);
  }
}

export const PROGRAM_ID = parseProgramId();

export const SOLANA_NETWORK =
  (process.env.NEXT_PUBLIC_SOLANA_NETWORK as "devnet" | "mainnet-beta" | "testnet") ||
  "devnet";

export const SOLANA_RPC = resolveBrowserRpc();

export const EXPLORER_CLUSTER =
  SOLANA_NETWORK === "mainnet-beta" ? "" : `?cluster=${SOLANA_NETWORK}`;

export const DUEL_SEED = new TextEncoder().encode("duel");
export const REVEAL_DELAY_SLOTS = 4;
export const MIN_WAGER_SOL = 0.001;
export const MAX_WAGER_SOL = 50;
export const MIN_WAGER_LAMPORTS = MIN_WAGER_SOL * LAMPORTS_PER_SOL;
export const MAX_WAGER_LAMPORTS = MAX_WAGER_SOL * LAMPORTS_PER_SOL;

export const DUEL_STATUS = {
  Waiting: 0,
  Locked: 1,
  Settled: 2,
  Cancelled: 3,
  Refunded: 4,
} as const;

export type DuelStatusName = keyof typeof DUEL_STATUS;

export function explorerTx(signature: string) {
  return `https://explorer.solana.com/tx/${signature}${EXPLORER_CLUSTER}`;
}

export function explorerAccount(address: string) {
  return `https://explorer.solana.com/address/${address}${EXPLORER_CLUSTER}`;
}

export function explorerSlot(slot: number | string) {
  return `https://explorer.solana.com/block/${slot}${EXPLORER_CLUSTER}`;
}

export function isProgramConfigured() {
  return PROGRAM_ID.toBase58() !== "11111111111111111111111111111111";
}
