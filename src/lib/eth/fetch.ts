import type { Address, Hex } from "viem";
import { zeroAddress } from "viem";
import { duelAbi } from "./abi";
import { DUEL_ADDRESS, DUEL_STATUS } from "./constants";

export type OnChainDuel = {
  host: Address;
  challenger: Address;
  wagerWei: bigint;
  hostTokenId: bigint;
  challengerTokenId: bigint;
  commitBlock: bigint;
  revealBlock: bigint;
  hostRoll: number;
  challengerRoll: number;
  winner: Address;
  entropy: Hex;
  status: number;
};

const cache = new Map<string, { at: number; value: OnChainDuel | null }>();
const DUEL_TTL = 3_000;

export function statusName(status: number) {
  const names = Object.entries(DUEL_STATUS) as [string, number][];
  return names.find(([, v]) => v === status)?.[0]?.toLowerCase() ?? "unknown";
}

export async function fetchDuel(
  client: { readContract: Function },
  duelId: bigint | number | string,
): Promise<OnChainDuel | null> {
  const id = BigInt(duelId);
  const key = id.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DUEL_TTL) return hit.value;
  try {
    const row = (await client.readContract({
      address: DUEL_ADDRESS,
      abi: duelAbi,
      functionName: "duels",
      args: [id],
    })) as [
      Address,
      Address,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      number,
      number,
      Address,
      Hex,
      number,
    ];
    const [
      host,
      challenger,
      wagerWei,
      hostTokenId,
      challengerTokenId,
      commitBlock,
      revealBlock,
      hostRoll,
      challengerRoll,
      winner,
      entropy,
      status,
    ] = row;
    if (host === zeroAddress) {
      cache.set(key, { at: Date.now(), value: null });
      return null;
    }
    const value: OnChainDuel = {
      host,
      challenger,
      wagerWei,
      hostTokenId,
      challengerTokenId,
      commitBlock,
      revealBlock,
      hostRoll,
      challengerRoll,
      winner,
      entropy,
      status,
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    if (hit) return hit.value;
    throw e;
  }
}

export function invalidateDuel(duelId: string) {
  cache.delete(duelId);
}

export async function currentBlock(client: { getBlockNumber: () => Promise<bigint> }) {
  return Number(await client.getBlockNumber());
}

export async function fetchRevealHash(
  client: {
    getBlockNumber: () => Promise<bigint>;
    getBlock: (args: { blockNumber: bigint }) => Promise<{ hash?: Hex | null }>;
  },
  revealBlock: bigint | number,
) {
  const target = BigInt(revealBlock);
  const head = await client.getBlockNumber();
  if (head <= target) {
    return { expired: false, entry: null as { hash: Hex; slot: bigint } | null };
  }
  if (head > target + 256n) {
    return { expired: true, entry: null };
  }
  const block = await client.getBlock({ blockNumber: target });
  return {
    expired: false,
    entry: { hash: block.hash!, slot: target },
  };
}
