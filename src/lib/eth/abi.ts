import { parseAbi } from "viem";

export const duelAbi = parseAbi([
  "function createDuel(uint8 maxPlayers) payable returns (uint256)",
  "function joinDuel(uint256 id) payable",
  "function leave(uint256 id)",
  "function start(uint256 id)",
  "function settle(uint256 id)",
  "function cancel(uint256 id)",
  "function refundExpired(uint256 id)",
  "function tables(uint256 id) view returns (address host, uint256 wagerWei, uint8 maxPlayers, uint8 playerCount, uint8 status, uint8 phase, uint64 commitBlock, uint64 revealBlock, bytes32 entropy, address winner, uint8 winnerRoll)",
  "function getPlayers(uint256 id) view returns (address[] wallets, uint8[] round1Rolls, uint8[] finalRolls, bool[] advanced)",
  "function nextDuelId() view returns (uint256)",
  "function deriveScore(bytes32 entropy, uint256 tableId, address player, uint256 wagerWei, uint64 revealBlock, uint8 phase, uint256 index) pure returns (uint8, uint256)",
  "event TableCreated(uint256 indexed id, address indexed host, uint256 wagerWei, uint8 maxPlayers)",
  "event PlayerJoined(uint256 indexed id, address indexed player, uint8 playerCount)",
  "event PlayerLeft(uint256 indexed id, address indexed player, uint8 playerCount)",
  "event MatchStarted(uint256 indexed id, uint8 playerCount, uint64 revealBlock)",
  "event RoundSettled(uint256 indexed id, uint8 phase, bytes32 entropy)",
  "event TableSettled(uint256 indexed id, address indexed winner, uint8 winnerRoll, bytes32 entropy)",
  "event DuelCancelled(uint256 indexed id)",
  "event DuelRefunded(uint256 indexed id)",
]);
