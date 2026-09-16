import { type Address, type Hex, isAddress, zeroAddress } from "viem";
import { base, baseSepolia, mainnet, sepolia } from "viem/chains";
import { duelAbi, nftAbi } from "./abi";

const CHAINS = [sepolia, mainnet, base, baseSepolia] as const;

export const DUEL_STATUS = {
  Waiting: 0,
  Locked: 1,
  Settled: 2,
  Cancelled: 3,
  Refunded: 4,
} as const;

export function appChain() {
  const id = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111);
  return CHAINS.find((c) => c.id === id) ?? sepolia;
}

export const CHAIN = appChain();

export function explorerTx(hash: string) {
  return `${CHAIN.blockExplorers.default.url}/tx/${hash}`;
}

export function explorerAccount(address: string) {
  return `${CHAIN.blockExplorers.default.url}/address/${address}`;
}

export function explorerBlock(block: number | string) {
  return `${CHAIN.blockExplorers.default.url}/block/${block}`;
}

export const DUEL_ADDRESS = ((process.env.NEXT_PUBLIC_DUEL_ADDRESS ||
  zeroAddress) as Address);
export const NFT_ADDRESS = ((process.env.NEXT_PUBLIC_NFT_ADDRESS ||
  zeroAddress) as Address);

export const MIN_WAGER_ETH = 0.0001;
export const MAX_WAGER_ETH = 50;
export const REVEAL_DELAY_BLOCKS = 3;
export const HASH_WINDOW = 256;

export const WEI_PER_ETH = 10n ** 18n;

export function isContractsConfigured() {
  return DUEL_ADDRESS !== zeroAddress && NFT_ADDRESS !== zeroAddress;
}

export { duelAbi, nftAbi };
export type { Address, Hex };
export { isAddress, zeroAddress };
