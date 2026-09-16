"use client";

import { parseEventLogs } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { duelAbi, nftAbi } from "./abi";
import { DUEL_ADDRESS, NFT_ADDRESS, isContractsConfigured } from "./constants";
import { explainChainError } from "./errors";

export function useDuelActions() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient();

  async function wait(hash: `0x${string}`) {
    if (!client) throw new Error("No RPC client");
    return client.waitForTransactionReceipt({ hash });
  }

  async function approveIfNeeded(tokenId: bigint) {
    if (tokenId === 0n) return;
    if (!client || !address) throw new Error("Connect a wallet first");
    const approved = await client.readContract({
      address: NFT_ADDRESS,
      abi: nftAbi,
      functionName: "getApproved",
      args: [tokenId],
    });
    if (approved.toLowerCase() === DUEL_ADDRESS.toLowerCase()) return;
    const operator = await client.readContract({
      address: NFT_ADDRESS,
      abi: nftAbi,
      functionName: "isApprovedForAll",
      args: [address, DUEL_ADDRESS],
    });
    if (operator) return;
    const hash = await writeContractAsync({
      address: NFT_ADDRESS,
      abi: nftAbi,
      functionName: "approve",
      args: [DUEL_ADDRESS, tokenId],
    });
    await wait(hash);
  }

  return {
    address: address?.toLowerCase() ?? null,
    configured: isContractsConfigured(),
    explain: explainChainError,
    async createDuel(args: { wagerWei: bigint; tokenId: bigint }) {
      if (!isContractsConfigured()) throw new Error("ETH contracts are not deployed. Set NEXT_PUBLIC_DUEL_ADDRESS and NEXT_PUBLIC_NFT_ADDRESS.");
      await approveIfNeeded(args.tokenId);
      const hash = await writeContractAsync({
        address: DUEL_ADDRESS,
        abi: duelAbi,
        functionName: "createDuel",
        args: [args.tokenId],
        value: args.wagerWei,
      });
      const receipt = await wait(hash);
      const logs = parseEventLogs({
        abi: duelAbi,
        logs: receipt.logs,
        eventName: "DuelCreated",
      });
      const id = logs[0]?.args.id;
      if (id == null) throw new Error("Create event missing from receipt");
      return { hash, id: id.toString() };
    },
    async joinDuel(args: { duelId: bigint; tokenId: bigint; wagerWei: bigint }) {
      await approveIfNeeded(args.tokenId);
      const hash = await writeContractAsync({
        address: DUEL_ADDRESS,
        abi: duelAbi,
        functionName: "joinDuel",
        args: [args.duelId, args.tokenId],
        value: args.wagerWei,
      });
      await wait(hash);
      return hash;
    },
    async settle(duelId: bigint) {
      const hash = await writeContractAsync({
        address: DUEL_ADDRESS,
        abi: duelAbi,
        functionName: "settle",
        args: [duelId],
      });
      await wait(hash);
      return hash;
    },
    async cancel(duelId: bigint) {
      const hash = await writeContractAsync({
        address: DUEL_ADDRESS,
        abi: duelAbi,
        functionName: "cancel",
        args: [duelId],
      });
      await wait(hash);
      return hash;
    },
    async refundExpired(duelId: bigint) {
      const hash = await writeContractAsync({
        address: DUEL_ADDRESS,
        abi: duelAbi,
        functionName: "refundExpired",
        args: [duelId],
      });
      await wait(hash);
      return hash;
    },
  };
}
