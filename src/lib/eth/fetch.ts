import type { Address, Hex } from "viem";
import { zeroAddress } from "viem";
import { duelAbi } from "./abi";
import { DUEL_ADDRESS, DUEL_STATUS } from "./constants";
import type { TableSeat } from "./table";

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
  winnerRoll: number;
  entropy: Hex;
  status: number;
  phase: number;
  maxPlayers: number;
  playerCount: number;
  seats: TableSeat[];
};

const cache = new Map<string, { at: number; value: OnChainDuel | null }>();
const DUEL_TTL = 3_000;

export function statusName(status: number) {
  const names = Object.entries(DUEL_STATUS) as [string, number][];
  return names.find(([, v]) => v === status)?.[0]?.toLowerCase() ?? "unknown";
}

function emptyEntropy(h: Hex) {
  return !h || h === (`0x${"00".repeat(32)}` as Hex);
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
      functionName: "tables",
      args: [id],
    })) as [
      Address,
      bigint,
      number,
      number,
      number,
      number,
      bigint,
      bigint,
      Hex,
      Address,
      number,
    ];
    const [
      host,
      wagerWei,
      maxPlayers,
      playerCount,
      status,
      phase,
      commitBlock,
      revealBlock,
      entropy,
      winner,
      winnerRoll,
    ] = row;
    if (host === zeroAddress) {
      cache.set(key, { at: Date.now(), value: null });
      return null;
    }

    let wallets: Address[] = [];
    let tokens: bigint[] = [];
    let round1Rolls: number[] = [];
    let finalRolls: number[] = [];
    let advanced: boolean[] = [];
    if (playerCount > 0) {
      const players = (await client.readContract({
        address: DUEL_ADDRESS,
        abi: duelAbi,
        functionName: "getPlayers",
        args: [id],
      })) as [Address[], bigint[], number[], number[], boolean[]];
      wallets = players[0];
      tokens = players[1];
      round1Rolls = players[2];
      finalRolls = players[3];
      advanced = players[4];
    }

    const seats: TableSeat[] = wallets.map((wallet, i) => ({
      wallet: wallet.toLowerCase(),
      tokenId: (tokens[i] ?? 0n).toString(),
      round1: Number(round1Rolls[i] ?? 0),
      final: Number(finalRolls[i] ?? 0),
      advanced: Boolean(advanced[i]),
      index: i,
    }));
    const guest = seats[1];
    const hostSeat = seats[0];
    const current = (s?: TableSeat) => {
      if (!s) return 0;
      if (phase >= 2 && s.final > 0) return s.final;
      return s.round1;
    };

    const value: OnChainDuel = {
      host,
      challenger: (guest?.wallet as Address) ?? zeroAddress,
      wagerWei,
      hostTokenId: BigInt(hostSeat?.tokenId ?? 0),
      challengerTokenId: BigInt(guest?.tokenId ?? 0),
      commitBlock,
      revealBlock,
      hostRoll: current(hostSeat),
      challengerRoll: current(guest),
      winner,
      winnerRoll: Number(winnerRoll ?? 0),
      entropy: emptyEntropy(entropy) ? (`0x${"00".repeat(32)}` as Hex) : entropy,
      status,
      phase: Number(phase),
      maxPlayers: Number(maxPlayers),
      playerCount: Number(playerCount),
      seats,
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
