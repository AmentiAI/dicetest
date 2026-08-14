import { sha256 } from "@noble/hashes/sha2.js";
import {
  PublicKey,
  SystemProgram,
  SYSVAR_SLOT_HASHES_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import { PROGRAM_ID } from "./constants";
import { duelPda } from "./pda";
import { concatBytes, u64leBytes } from "./bytes";

function ixDisc(name: string) {
  return Buffer.from(sha256(new TextEncoder().encode(`global:${name}`)).slice(0, 8));
}

export const DISCS = {
  createDuel: ixDisc("create_duel"),
  joinDuel: ixDisc("join_duel"),
  settle: ixDisc("settle"),
  cancel: ixDisc("cancel"),
  refundExpired: ixDisc("refund_expired"),
};

export function createDuelIx(args: {
  host: PublicKey;
  duelId: bigint | number;
  wagerLamports: bigint | number;
}) {
  const [duel] = duelPda(args.host, args.duelId);
  const data = Buffer.from(
    concatBytes([
      DISCS.createDuel,
      u64leBytes(args.duelId),
      u64leBytes(args.wagerLamports),
    ]),
  );
  return {
    duel,
    ix: new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: args.host, isSigner: true, isWritable: true },
        { pubkey: duel, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    }),
  };
}

export function joinDuelIx(args: {
  challenger: PublicKey;
  host: PublicKey;
  duelId: bigint | number;
}) {
  const [duel] = duelPda(args.host, args.duelId);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: args.challenger, isSigner: true, isWritable: true },
      { pubkey: duel, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: DISCS.joinDuel,
  });
}

export function settleIx(args: {
  settler: PublicKey;
  host: PublicKey;
  challenger: PublicKey;
  duelId: bigint | number;
}) {
  const [duel] = duelPda(args.host, args.duelId);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: args.settler, isSigner: true, isWritable: false },
      { pubkey: duel, isSigner: false, isWritable: true },
      { pubkey: args.host, isSigner: false, isWritable: true },
      { pubkey: args.challenger, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_SLOT_HASHES_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: DISCS.settle,
  });
}

export function cancelIx(args: { host: PublicKey; duelId: bigint | number }) {
  const [duel] = duelPda(args.host, args.duelId);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: args.host, isSigner: true, isWritable: true },
      { pubkey: duel, isSigner: false, isWritable: true },
    ],
    data: DISCS.cancel,
  });
}

export function refundExpiredIx(args: {
  crank: PublicKey;
  host: PublicKey;
  challenger: PublicKey;
  duelId: bigint | number;
}) {
  const [duel] = duelPda(args.host, args.duelId);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: args.crank, isSigner: true, isWritable: false },
      { pubkey: duel, isSigner: false, isWritable: true },
      { pubkey: args.host, isSigner: false, isWritable: true },
      { pubkey: args.challenger, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_SLOT_HASHES_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: DISCS.refundExpired,
  });
}
