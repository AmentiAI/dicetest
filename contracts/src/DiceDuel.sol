// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBlockDiceNft {
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

/// @notice 1v1 escrow. Stake ETH, a Block Dice NFT, or both. Winner takes the pot.
/// Fairness: join locks revealBlock = block.number + 3, settle uses that blockhash.
contract DiceDuel {
    uint8 public constant WAITING = 0;
    uint8 public constant LOCKED = 1;
    uint8 public constant SETTLED = 2;
    uint8 public constant CANCELLED = 3;
    uint8 public constant REFUNDED = 4;

    uint64 public constant REVEAL_DELAY = 3;
    uint256 public constant MIN_WAGER = 0.0001 ether;
    uint256 public constant MAX_WAGER = 50 ether;
    uint256 public constant HASH_WINDOW = 256;

    IBlockDiceNft public immutable diceNft;
    uint256 public nextDuelId = 1;

    struct Duel {
        address host;
        address challenger;
        uint256 wagerWei;
        uint256 hostTokenId;
        uint256 challengerTokenId;
        uint64 commitBlock;
        uint64 revealBlock;
        uint8 hostRoll;
        uint8 challengerRoll;
        address winner;
        bytes32 entropy;
        uint8 status;
    }

    mapping(uint256 => Duel) public duels;

    event DuelCreated(uint256 indexed id, address indexed host, uint256 wagerWei, uint256 tokenId);
    event DuelLocked(uint256 indexed id, address indexed challenger, uint64 revealBlock, uint256 tokenId);
    event DuelSettled(uint256 indexed id, address indexed winner, uint8 hostRoll, uint8 challengerRoll, bytes32 entropy);
    event DuelCancelled(uint256 indexed id);
    event DuelRefunded(uint256 indexed id);

    error BadStatus();
    error BadWager();
    error BadStake();
    error BadNft();
    error SelfJoin();
    error TooEarly();
    error Expired();
    error HashMissing();
    error TransferFailed();
    error NotHost();

    constructor(address nft) {
        diceNft = IBlockDiceNft(nft);
    }

    function createDuel(uint256 tokenId) external payable returns (uint256 id) {
        if (msg.value != 0 && (msg.value < MIN_WAGER || msg.value > MAX_WAGER)) revert BadWager();
        if (msg.value == 0 && tokenId == 0) revert BadStake();
        if (tokenId > 0) {
            if (diceNft.ownerOf(tokenId) != msg.sender) revert BadNft();
            diceNft.transferFrom(msg.sender, address(this), tokenId);
        }
        id = nextDuelId++;
        duels[id] = Duel({
            host: msg.sender,
            challenger: address(0),
            wagerWei: msg.value,
            hostTokenId: tokenId,
            challengerTokenId: 0,
            commitBlock: 0,
            revealBlock: 0,
            hostRoll: 0,
            challengerRoll: 0,
            winner: address(0),
            entropy: bytes32(0),
            status: WAITING
        });
        emit DuelCreated(id, msg.sender, msg.value, tokenId);
    }

    function joinDuel(uint256 id, uint256 tokenId) external payable {
        Duel storage d = duels[id];
        if (d.status != WAITING) revert BadStatus();
        if (msg.sender == d.host) revert SelfJoin();
        if (msg.value != d.wagerWei) revert BadWager();
        if (d.hostTokenId > 0) {
            if (tokenId == 0) revert BadNft();
            if (diceNft.ownerOf(tokenId) != msg.sender) revert BadNft();
            diceNft.transferFrom(msg.sender, address(this), tokenId);
            d.challengerTokenId = tokenId;
        } else if (tokenId != 0) {
            revert BadNft();
        }
        d.challenger = msg.sender;
        d.commitBlock = uint64(block.number);
        d.revealBlock = uint64(block.number + REVEAL_DELAY);
        d.status = LOCKED;
        emit DuelLocked(id, msg.sender, d.revealBlock, tokenId);
    }

    function settle(uint256 id) external {
        Duel storage d = duels[id];
        if (d.status != LOCKED) revert BadStatus();
        if (block.number <= d.revealBlock) revert TooEarly();
        if (block.number > uint256(d.revealBlock) + HASH_WINDOW) revert Expired();
        bytes32 h = blockhash(d.revealBlock);
        if (h == bytes32(0)) revert HashMissing();
        (uint8 hr, uint8 cr) = deriveRolls(h, id, d.host, d.challenger, d.wagerWei, d.revealBlock);
        d.hostRoll = hr;
        d.challengerRoll = cr;
        d.entropy = h;
        address winner = hr > cr ? d.host : d.challenger;
        d.winner = winner;
        d.status = SETTLED;
        _pay(winner, d.wagerWei * 2);
        if (d.hostTokenId > 0) diceNft.transferFrom(address(this), winner, d.hostTokenId);
        if (d.challengerTokenId > 0) diceNft.transferFrom(address(this), winner, d.challengerTokenId);
        emit DuelSettled(id, winner, hr, cr, h);
    }

    function cancel(uint256 id) external {
        Duel storage d = duels[id];
        if (d.status != WAITING) revert BadStatus();
        if (msg.sender != d.host) revert NotHost();
        d.status = CANCELLED;
        _pay(d.host, d.wagerWei);
        if (d.hostTokenId > 0) diceNft.transferFrom(address(this), d.host, d.hostTokenId);
        emit DuelCancelled(id);
    }

    function refundExpired(uint256 id) external {
        Duel storage d = duels[id];
        if (d.status != LOCKED) revert BadStatus();
        if (block.number <= uint256(d.revealBlock) + HASH_WINDOW) revert TooEarly();
        d.status = REFUNDED;
        _pay(d.host, d.wagerWei);
        _pay(d.challenger, d.wagerWei);
        if (d.hostTokenId > 0) diceNft.transferFrom(address(this), d.host, d.hostTokenId);
        if (d.challengerTokenId > 0) {
            diceNft.transferFrom(address(this), d.challenger, d.challengerTokenId);
        }
        emit DuelRefunded(id);
    }

    function deriveRolls(
        bytes32 entropy,
        uint256 duelId,
        address host,
        address challenger,
        uint256 wagerWei,
        uint64 revealBlock
    ) public pure returns (uint8 hostRoll, uint8 challengerRoll) {
        for (uint256 c = 0; c < 64; c++) {
            bytes32 digest = keccak256(
                abi.encodePacked(entropy, duelId, host, challenger, wagerWei, revealBlock, c)
            );
            uint8 a = uint8(digest[0]);
            uint8 b = uint8(digest[1]);
            if (a < 252 && b < 252) {
                hostRoll = (a % 6) + 1;
                challengerRoll = (b % 6) + 1;
                if (hostRoll != challengerRoll) return (hostRoll, challengerRoll);
            }
        }
        revert HashMissing();
    }

    function _pay(address to, uint256 amount) internal {
        if (amount == 0 || to == address(0)) return;
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
