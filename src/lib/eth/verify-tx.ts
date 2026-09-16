import type { Hex } from "viem";
import { DUEL_ADDRESS } from "./constants";
import { isTxHash } from "./keys";

export type TxProof = "ok" | "invalid" | "pending";

export async function verifyProgramTx(args: {
  client: { getTransactionReceipt: Function };
  signature: string;
  pda: string;
}): Promise<TxProof> {
  if (!isTxHash(args.signature)) return "invalid";
  for (let attempt = 0; attempt < 4; attempt++) {
    const receipt = (await args.client.getTransactionReceipt({
      hash: args.signature as Hex,
    }).catch(() => null)) as {
      status: string;
      to?: string | null;
      logs: { address: string; topics: readonly string[] }[];
    } | null;
    if (!receipt) {
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }
    if (receipt.status !== "success") return "invalid";
    if (receipt.to?.toLowerCase() !== DUEL_ADDRESS.toLowerCase()) return "invalid";
    const idHex = BigInt(args.pda).toString(16).padStart(64, "0");
    const mentions = receipt.logs.some(
      (log: { address: string; topics: readonly string[] }) =>
        log.address.toLowerCase() === DUEL_ADDRESS.toLowerCase() &&
        log.topics[1]?.toLowerCase() === `0x${idHex}`,
    );
    return mentions ? "ok" : "invalid";
  }
  return "pending";
}

export function proofError(proof: TxProof) {
  if (proof === "pending") {
    return {
      error: "transaction not confirmed yet — retry shortly",
      status: 409,
    };
  }
  return { error: "transaction does not match this duel", status: 400 };
}
