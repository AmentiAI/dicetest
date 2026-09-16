import { keccak256, encodePacked, type Address, type Hex } from "viem";

function d6(byte: number): number | null {
  if (byte >= 252) return null;
  return (byte % 6) + 1;
}

function hexToBytes(hex: Hex) {
  const s = hex.slice(2);
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(s.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Mirrors on-chain DiceDuel.deriveRolls (keccak256 packed). */
export function deriveRolls(args: {
  entropy: Hex;
  duelId: bigint | number | string;
  host: Address;
  challenger: Address;
  wagerWei: bigint | number | string;
  revealBlock: bigint | number | string;
}): { hostRoll: number; challengerRoll: number; counter: number } {
  for (let counter = 0; counter < 64; counter++) {
    const digest = keccak256(
      encodePacked(
        ["bytes32", "uint256", "address", "address", "uint256", "uint64", "uint256"],
        [
          args.entropy,
          BigInt(args.duelId),
          args.host,
          args.challenger,
          BigInt(args.wagerWei),
          BigInt(args.revealBlock),
          BigInt(counter),
        ],
      ),
    );
    const bytes = hexToBytes(digest);
    const hostRoll = d6(bytes[0]!);
    const challengerRoll = d6(bytes[1]!);
    if (hostRoll && challengerRoll && hostRoll !== challengerRoll) {
      return { hostRoll, challengerRoll, counter };
    }
  }
  throw new Error("could not derive unequal dice from hash");
}

export function hashToHex(hash: Hex | Uint8Array) {
  if (typeof hash === "string") return hash.replace(/^0x/, "");
  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
}
