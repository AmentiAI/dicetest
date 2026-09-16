import { parseAbi } from "viem";

export const duelAbi = parseAbi([
  "function createDuel(uint256 tokenId) payable returns (uint256)",
  "function joinDuel(uint256 id, uint256 tokenId) payable",
  "function settle(uint256 id)",
  "function cancel(uint256 id)",
  "function refundExpired(uint256 id)",
  "function duels(uint256 id) view returns (address host, address challenger, uint256 wagerWei, uint256 hostTokenId, uint256 challengerTokenId, uint64 commitBlock, uint64 revealBlock, uint8 hostRoll, uint8 challengerRoll, address winner, bytes32 entropy, uint8 status)",
  "function nextDuelId() view returns (uint256)",
  "function deriveRolls(bytes32 entropy, uint256 duelId, address host, address challenger, uint256 wagerWei, uint64 revealBlock) pure returns (uint8, uint8)",
  "function diceNft() view returns (address)",
  "event DuelCreated(uint256 indexed id, address indexed host, uint256 wagerWei, uint256 tokenId)",
  "event DuelLocked(uint256 indexed id, address indexed challenger, uint64 revealBlock, uint256 tokenId)",
  "event DuelSettled(uint256 indexed id, address indexed winner, uint8 hostRoll, uint8 challengerRoll, bytes32 entropy)",
  "event DuelCancelled(uint256 indexed id)",
  "event DuelRefunded(uint256 indexed id)",
]);

export const nftAbi = parseAbi([
  "function mint(address to, uint8 skinId) returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function skin(uint256 tokenId) view returns (uint8)",
  "function approve(address spender, uint256 tokenId)",
  "function setApprovalForAll(address operator, bool approved)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function nextId() view returns (uint256)",
  "function tokensOfOwner(address owner) view returns (uint256[])",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);
