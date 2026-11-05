"use client";

import { parseEventLogs } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { duelAbi } from "./abi";
import { DUEL_ADDRESS, isContractsConfigured } from "./constants";
import { explainChainError } from "./errors";

export function useDuelActions() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient();

  async function wait(hash: `0x${string}`) {
    if (!client) throw new Error("No RPC client");
    return client.waitForTransactionReceipt({ hash });
  }

  return {
    address: address?.toLowerCase() ?? null,
    configured: isContractsConfigured(),
    explain: explainChainError,
    async createDuel(args: { wagerWei: bigint; maxPlayers: number }) {
      if (!isContractsConfigured()) {
        throw new Error(
          "ETH contracts are not deployed. Set NEXT_PUBLIC_DUEL_ADDRESS.",
        );
      }
      const hash = await writeContractAsync({
        address: DUEL_ADDRESS,
        abi: duelAbi,
        functionName: "createDuel",
        args: [args.maxPlayers],
        value: args.wagerWei,
      });
      const receipt = await wait(hash);
      const logs = parseEventLogs({
        abi: duelAbi,
        logs: receipt.logs,
        eventName: "TableCreated",
      });
      const id = logs[0]?.args.id;
      if (id == null) throw new Error("Create event missing from receipt");
      return { hash, id: id.toString() };
    },
    async joinDuel(args: { duelId: bigint; wagerWei: bigint }) {
      const hash = await writeContractAsync({
        address: DUEL_ADDRESS,
        abi: duelAbi,
        functionName: "joinDuel",
        args: [args.duelId],
        value: args.wagerWei,
      });
      await wait(hash);
      return hash;
    },
    async leave(duelId: bigint) {
      const hash = await writeContractAsync({
        address: DUEL_ADDRESS,
        abi: duelAbi,
        functionName: "leave",
        args: [duelId],
      });
      await wait(hash);
      return hash;
    },
    async start(duelId: bigint) {
      const hash = await writeContractAsync({
        address: DUEL_ADDRESS,
        abi: duelAbi,
        functionName: "start",
        args: [duelId],
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
