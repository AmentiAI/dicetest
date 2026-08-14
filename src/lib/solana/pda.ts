import { PublicKey } from "@solana/web3.js";
import { DUEL_SEED, DUEL_STATUS, PROGRAM_ID } from "./constants";
import { asBytes, readU64le, u64leBytes } from "./bytes";

export function duelPda(host: PublicKey, duelId: bigint | number) {
  return PublicKey.findProgramAddressSync(
    [DUEL_SEED, host.toBytes(), u64leBytes(duelId)],
    PROGRAM_ID,
  );
}

export type OnChainDuel = {
  duelId: bigint;
  host: PublicKey;
  challenger: PublicKey;
  wagerLamports: bigint;
  status: number;
  commitSlot: bigint;
  revealSlot: bigint;
  hostRoll: number;
  challengerRoll: number;
  winner: PublicKey;
  slotHash: Uint8Array;
  bump: number;
  createdSlot: bigint;
};

const DEFAULT_PUBKEY = PublicKey.default;

export function statusName(status: number) {
  const names = Object.entries(DUEL_STATUS) as [string, number][];
  return names.find(([, v]) => v === status)?.[0]?.toLowerCase() ?? "unknown";
}

export function decodeDuel(raw: Uint8Array): OnChainDuel {
  const data = asBytes(raw);
  if (data.length < 180) {
    throw new Error("duel account is truncated");
  }
  let o = 8;
  const u64 = () => {
    const v = readU64le(data, o);
    o += 8;
    return v;
  };
  const u8 = () => data[o++]!;
  const pk = () => {
    const key = new PublicKey(data.subarray(o, o + 32));
    o += 32;
    return key;
  };

  return {
    duelId: u64(),
    host: pk(),
    challenger: pk(),
    wagerLamports: u64(),
    status: u8(),
    commitSlot: u64(),
    revealSlot: u64(),
    hostRoll: u8(),
    challengerRoll: u8(),
    winner: pk(),
    slotHash: data.subarray(o, o + 32),
    bump: (o += 32, u8()),
    createdSlot: u64(),
  };
}

export function hasChallenger(duel: OnChainDuel) {
  return !duel.challenger.equals(DEFAULT_PUBKEY);
}
