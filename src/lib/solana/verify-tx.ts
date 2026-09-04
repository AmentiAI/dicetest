import type { Connection } from "@solana/web3.js";
import { PROGRAM_ID } from "./constants";
import { isPubkeyString, isTxSignature } from "./keys";

function accountKeysOf(tx: {
  transaction: { message: unknown };
  meta: {
    err: unknown;
    loadedAddresses?: { writable: { toBase58(): string }[]; readonly: { toBase58(): string }[] };
  } | null;
}) {
  const keys = new Set<string>();
  const message = tx.transaction.message as {
    getAccountKeys?: (opts?: {
      accountKeysFromLookups?: {
        writable: { toBase58(): string }[];
        readonly: { toBase58(): string }[];
      };
    }) => { length: number; get(i: number): { toBase58(): string } | undefined };
    accountKeys?: { toBase58(): string }[];
  };
  const loaded = tx.meta?.loadedAddresses;
  if (typeof message.getAccountKeys === "function") {
    const accountKeys = message.getAccountKeys(
      loaded ? { accountKeysFromLookups: loaded } : undefined,
    );
    for (let i = 0; i < accountKeys.length; i++) {
      const key = accountKeys.get(i);
      if (key) keys.add(key.toBase58());
    }
    return keys;
  }
  for (const key of message.accountKeys ?? []) {
    keys.add(key.toBase58());
  }
  return keys;
}

export type TxProof = "ok" | "invalid" | "pending";

export async function verifyProgramTx(args: {
  connection: Connection;
  signature: string;
  pda: string;
}): Promise<TxProof> {
  if (!isTxSignature(args.signature) || !isPubkeyString(args.pda)) return "invalid";

  for (let attempt = 0; attempt < 3; attempt++) {
    const tx = await args.connection.getTransaction(args.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }
    if (tx.meta?.err) return "invalid";
    const keys = accountKeysOf(tx);
    if (keys.has(args.pda) && keys.has(PROGRAM_ID.toBase58())) return "ok";
    return "invalid";
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
