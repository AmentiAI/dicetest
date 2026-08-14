import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  type TransactionSignature,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { PROGRAM_ID } from "./constants";

export async function assertProgramLive(connection: Connection) {
  const info = await connection.getAccountInfo(PROGRAM_ID, "confirmed");
  if (!info?.executable) {
    throw new Error(
      "On-chain program is not deployed on this cluster yet. Escrow cannot land until you `anchor deploy` with program/keys/dice_duel-keypair.json — see README.",
    );
  }
}

export function explainChainError(e: unknown): string {
  const any = e as {
    message?: string;
    cause?: unknown;
    error?: { message?: string; logs?: string[] };
    logs?: string[];
  };
  const logs = [
    ...(any?.logs ?? []),
    ...((any?.error as { logs?: string[] } | undefined)?.logs ?? []),
  ];
  const parts = [
    any?.message,
    typeof any?.cause === "string" ? any.cause : (any?.cause as { message?: string })?.message,
    any?.error?.message,
    ...logs,
  ]
    .filter(Boolean)
    .join(" ");

  if (/user rejected|rejected the request|cancelled|denied/i.test(parts)) {
    return "Wallet rejected the transaction.";
  }
  if (/0x1\b/.test(parts) || /insufficient/i.test(parts)) {
    return "Not enough SOL for the wager plus fees. Airdrop on devnet if needed.";
  }
  if (
    /Attempt to load a program/i.test(parts) ||
    /Invalid program/i.test(parts) ||
    /could not find account/i.test(parts) ||
    /not deployed/i.test(parts)
  ) {
    return "On-chain program is not deployed on this cluster yet. See README to deploy.";
  }
  if (/blockhash/i.test(parts) && /expired|not found/i.test(parts)) {
    return "Blockhash expired. Try again.";
  }
  if (logs.length) return logs.slice(-6).join("\n");
  return any?.message || String(e);
}

export async function sendIxs(args: {
  connection: Connection;
  wallet: WalletContextState;
  ixs: TransactionInstruction[];
}): Promise<TransactionSignature> {
  const { connection, wallet, ixs } = args;
  if (!wallet.publicKey) throw new Error("Connect a wallet first");
  await assertProgramLive(connection);

  const tx = new Transaction().add(...ixs);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = blockhash;

  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) {
    const err = new Error(
      typeof sim.value.err === "string" ? sim.value.err : JSON.stringify(sim.value.err),
    ) as Error & { logs?: string[] };
    err.logs = sim.value.logs ?? [];
    throw err;
  }

  let sig: string;
  if (wallet.signTransaction) {
    const signed = await wallet.signTransaction(tx);
    sig = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: true,
      maxRetries: 3,
    });
  } else if (wallet.sendTransaction) {
    sig = await wallet.sendTransaction(tx, connection, { skipPreflight: true });
  } else {
    throw new Error("Wallet cannot sign transactions");
  }

  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return sig;
}

export function asPubkey(value: PublicKey | string) {
  return typeof value === "string" ? new PublicKey(value) : value;
}
