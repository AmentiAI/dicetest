import { sha256 } from "@noble/hashes/sha2.js";
import { PublicKey } from "@solana/web3.js";
import { asBytes, concatBytes, readU64le, toHex, u64leBytes } from "./bytes";

function d6(bytes: Uint8Array, index: number): number | null {
  const x = bytes[index];
  if (x === undefined || x >= 252) return null;
  return (x % 6) + 1;
}

/**
 * Mirrors on-chain `derive_rolls`. Anyone with the slot hash and duel
 * accounts can recompute the dice — that is the fairness proof.
 */
export function deriveRolls(args: {
  slotHash: Uint8Array;
  duel: PublicKey;
  host: PublicKey;
  challenger: PublicKey;
  wagerLamports: bigint | number;
  revealSlot: bigint | number;
}): { hostRoll: number; challengerRoll: number; counter: number } {
  if (args.slotHash.length !== 32) {
    throw new Error("slot hash must be 32 bytes");
  }
  for (let counter = 0; counter < 64; counter++) {
    const digest = sha256(
      concatBytes([
        args.slotHash,
        args.duel.toBytes(),
        args.host.toBytes(),
        args.challenger.toBytes(),
        u64leBytes(args.wagerLamports),
        u64leBytes(args.revealSlot),
        u64leBytes(counter),
      ]),
    );
    const hostRoll = d6(digest, 0);
    const challengerRoll = d6(digest, 1);
    if (hostRoll && challengerRoll && hostRoll !== challengerRoll) {
      return { hostRoll, challengerRoll, counter };
    }
  }
  throw new Error("could not derive unequal dice from hash");
}

export function parseSlotHashes(data: Uint8Array) {
  const buf = asBytes(data);
  if (buf.length < 8) return [];
  const count = Number(readU64le(buf, 0));
  const entries: { slot: bigint; hash: Uint8Array }[] = [];
  for (let i = 0; i < count; i++) {
    const offset = 8 + i * 40;
    if (offset + 40 > buf.length) break;
    entries.push({
      slot: readU64le(buf, offset),
      hash: buf.subarray(offset + 8, offset + 40),
    });
  }
  return entries;
}

export function findSlotHash(
  data: Uint8Array,
  targetSlot: bigint | number,
): { slot: bigint; hash: Uint8Array } | null {
  const target = BigInt(targetSlot);
  const entries = parseSlotHashes(data);
  return entries.find((e) => e.slot === target) ?? null;
}

export function slotHashExpired(data: Uint8Array, targetSlot: bigint | number): boolean {
  const entries = parseSlotHashes(data);
  if (!entries.length) return false;
  const oldest = entries[entries.length - 1]!;
  return oldest.slot > BigInt(targetSlot);
}

export function hashToHex(hash: Uint8Array) {
  return toHex(hash);
}
