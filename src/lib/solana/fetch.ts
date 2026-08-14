import {
  Connection,
  PublicKey,
  SYSVAR_SLOT_HASHES_PUBKEY,
} from "@solana/web3.js";
import { decodeDuel, type OnChainDuel } from "./pda";
import { findSlotHash, slotHashExpired } from "./dice";

export async function fetchDuel(
  connection: Connection,
  pda: PublicKey,
): Promise<OnChainDuel | null> {
  const info = await connection.getAccountInfo(pda, "confirmed");
  if (!info) return null;
  return decodeDuel(new Uint8Array(info.data));
}

export async function fetchSlotHashes(connection: Connection) {
  const info = await connection.getAccountInfo(
    SYSVAR_SLOT_HASHES_PUBKEY,
    "confirmed",
  );
  if (!info) throw new Error("SlotHashes sysvar missing from RPC");
  return new Uint8Array(info.data);
}

export async function fetchRevealHash(
  connection: Connection,
  revealSlot: bigint | number,
) {
  const data = await fetchSlotHashes(connection);
  return {
    entry: findSlotHash(data, revealSlot),
    expired: slotHashExpired(data, revealSlot),
    raw: data,
  };
}

export async function currentSlot(connection: Connection) {
  return connection.getSlot("confirmed");
}
