import { keccak256, encodePacked, type Address, type Hex } from "viem";

function d6(byte: number): number | null {
  if (byte >= 252) return null;
  return (byte % 6) + 1;
}

function hexToBytes(hex: Hex) {
  const s = hex.slice(2);
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < s.length / 2; i++) {
    out[i] = Number.parseInt(s.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToBigInt(bytes: Uint8Array) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) + BigInt(b);
  return n;
}

/** Mirrors on-chain DiceDuel.deriveScore (keccak256 packed). */
export function deriveScore(args: {
  entropy: Hex;
  tableId: bigint | number | string;
  player: Address;
  wagerWei: bigint | number | string;
  revealBlock: bigint | number | string;
  phase: number;
  index: number;
}): { roll: number; score: bigint; counter: number } {
  for (let counter = 0; counter < 64; counter++) {
    const digest = keccak256(
      encodePacked(
        ["bytes32", "uint256", "address", "uint256", "uint64", "uint8", "uint256", "uint256"],
        [
          args.entropy,
          BigInt(args.tableId),
          args.player,
          BigInt(args.wagerWei),
          BigInt(args.revealBlock),
          args.phase,
          BigInt(args.index),
          BigInt(counter),
        ],
      ),
    );
    const bytes = hexToBytes(digest);
    const roll = d6(bytes[0]!);
    if (roll) {
      const digestInt = bytesToBigInt(bytes);
      const score = (BigInt(roll) << 248n) | (digestInt & ((1n << 248n) - 1n));
      return { roll, score, counter };
    }
  }
  throw new Error("could not derive die from hash");
}

export function rankSeats<T extends { score: bigint }>(seats: T[]) {
  return [...seats].sort((a, b) => (a.score === b.score ? 0 : a.score > b.score ? -1 : 1));
}

export function hashToHex(hash: Hex | Uint8Array) {
  if (typeof hash === "string") return hash.replace(/^0x/, "");
  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
}
