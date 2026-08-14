import {
  Connection,
  PublicKey,
  SYSVAR_SLOT_HASHES_PUBKEY,
} from "@solana/web3.js";
import { decodeDuel, type OnChainDuel } from "./pda";
import { findSlotHash, slotHashExpired } from "./dice";

type Cache<T> = { at: number; value: T };

let slotCache: Cache<number> | null = null;
let hashesCache: Cache<Uint8Array> | null = null;
const duelCache = new Map<string, Cache<OnChainDuel | null>>();

const SLOT_TTL = 1_500;
const HASH_TTL = 2_000;
const DUEL_TTL = 3_000;

async function withStale<T>(
  read: () => Promise<T>,
  cache: Cache<T> | null,
  ttl: number,
): Promise<{ value: T; cache: Cache<T> }> {
  if (cache && Date.now() - cache.at < ttl) {
    return { value: cache.value, cache };
  }
  try {
    const value = await read();
    return { value, cache: { at: Date.now(), value } };
  } catch (e) {
    if (cache) return { value: cache.value, cache };
    throw e;
  }
}

export async function fetchDuel(
  connection: Connection,
  pda: PublicKey,
): Promise<OnChainDuel | null> {
  const key = pda.toBase58();
  const hit = duelCache.get(key);
  if (hit && Date.now() - hit.at < DUEL_TTL) return hit.value;
  try {
    const info = await connection.getAccountInfo(pda, "confirmed");
    const value = info ? decodeDuel(new Uint8Array(info.data)) : null;
    duelCache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    if (hit) return hit.value;
    throw e;
  }
}

export function invalidateDuel(pda: string) {
  duelCache.delete(pda);
}

export async function fetchSlotHashes(connection: Connection) {
  const next = await withStale(
    async () => {
      const info = await connection.getAccountInfo(
        SYSVAR_SLOT_HASHES_PUBKEY,
        "confirmed",
      );
      if (!info) throw new Error("SlotHashes sysvar missing from RPC");
      return new Uint8Array(info.data);
    },
    hashesCache,
    HASH_TTL,
  );
  hashesCache = next.cache;
  return next.value;
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
  const next = await withStale(
    () => connection.getSlot("confirmed"),
    slotCache,
    SLOT_TTL,
  );
  slotCache = next.cache;
  return next.value;
}
