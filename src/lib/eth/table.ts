export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const FINALISTS = 5;

export const TABLE_PHASE = {
  Lobby: 0,
  Round1: 1,
  Final: 2,
} as const;

export type TableSeat = {
  wallet: string;
  tokenId: string;
  round1: number;
  final: number;
  advanced: boolean;
  index: number;
};

export function tableModeLabel(maxPlayers: number) {
  if (maxPlayers <= 2) return "1v1";
  if (maxPlayers <= 5) return `${maxPlayers}-player table`;
  return "Free-for-all";
}

export function needsFinal(playerCount: number) {
  return playerCount > FINALISTS;
}

export function potWei(wagerWei: bigint | string, playerCount: number) {
  return BigInt(wagerWei) * BigInt(playerCount);
}

export function displayedRoll(seat: Pick<TableSeat, "round1" | "final" | "advanced">, phase: number) {
  if (phase >= TABLE_PHASE.Final && seat.final > 0) return seat.final;
  if (seat.round1 > 0) return seat.round1;
  return null;
}
