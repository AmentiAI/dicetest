// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBlockDiceNft {
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

/// @notice 2–10 player escrow. Host starts at any filled count (≥2).
/// If 6+ players, the 5 highest round-1 rolls advance; the final winner takes the pot.
/// Fairness: start locks revealBlock = block.number + 3; settle uses that blockhash.
contract DiceDuel {
    uint8 public constant WAITING = 0;
    uint8 public constant LOCKED = 1;
    uint8 public constant SETTLED = 2;
    uint8 public constant CANCELLED = 3;
    uint8 public constant REFUNDED = 4;

    uint8 public constant PHASE_LOBBY = 0;
    uint8 public constant PHASE_ROUND1 = 1;
    uint8 public constant PHASE_FINAL = 2;

    uint8 public constant MIN_PLAYERS = 2;
    uint8 public constant MAX_PLAYERS = 10;
    uint8 public constant FINALISTS = 5;

    uint64 public constant REVEAL_DELAY = 3;
    uint256 public constant MIN_WAGER = 0.0001 ether;
    uint256 public constant MAX_WAGER = 50 ether;
    uint256 public constant HASH_WINDOW = 256;

    IBlockDiceNft public immutable diceNft;
    uint256 public nextDuelId = 1;

    struct Table {
        address host;
        uint256 wagerWei;
        uint8 maxPlayers;
        uint8 playerCount;
        uint8 status;
        uint8 phase;
        uint64 commitBlock;
        uint64 revealBlock;
        bytes32 entropy;
        address winner;
        uint8 winnerRoll;
    }

    mapping(uint256 => Table) public tables;
    mapping(uint256 => address[MAX_PLAYERS]) internal _seats;
    mapping(uint256 => uint256[MAX_PLAYERS]) internal _tokenIds;
    mapping(uint256 => uint8[MAX_PLAYERS]) internal _round1;
    mapping(uint256 => uint8[MAX_PLAYERS]) internal _finals;
    mapping(uint256 => bool[MAX_PLAYERS]) internal _advanced;

    event TableCreated(
        uint256 indexed id,
        address indexed host,
        uint256 wagerWei,
        uint256 tokenId,
        uint8 maxPlayers
    );
    event PlayerJoined(uint256 indexed id, address indexed player, uint256 tokenId, uint8 playerCount);
    event PlayerLeft(uint256 indexed id, address indexed player, uint8 playerCount);
    event MatchStarted(uint256 indexed id, uint8 playerCount, uint64 revealBlock);
    event RoundSettled(uint256 indexed id, uint8 phase, bytes32 entropy);
    event TableSettled(uint256 indexed id, address indexed winner, uint8 winnerRoll, bytes32 entropy);
    event DuelCancelled(uint256 indexed id);
    event DuelRefunded(uint256 indexed id);

    error BadStatus();
    error BadWager();
    error BadStake();
    error BadNft();
    error BadMax();
    error AlreadySeated();
    error TableFull();
    error NeedPlayers();
    error TooEarly();
    error Expired();
    error HashMissing();
    error TransferFailed();
    error NotHost();
    error NotSeated();

    constructor(address nft) {
        diceNft = IBlockDiceNft(nft);
    }

    function createDuel(uint256 tokenId, uint8 maxPlayers) external payable returns (uint256 id) {
        if (maxPlayers < MIN_PLAYERS || maxPlayers > MAX_PLAYERS) revert BadMax();
        if (msg.value != 0 && (msg.value < MIN_WAGER || msg.value > MAX_WAGER)) revert BadWager();
        if (msg.value == 0 && tokenId == 0) revert BadStake();
        _pullNft(msg.sender, tokenId);
        id = nextDuelId++;
        tables[id] = Table({
            host: msg.sender,
            wagerWei: msg.value,
            maxPlayers: maxPlayers,
            playerCount: 1,
            status: WAITING,
            phase: PHASE_LOBBY,
            commitBlock: 0,
            revealBlock: 0,
            entropy: bytes32(0),
            winner: address(0),
            winnerRoll: 0
        });
        _seats[id][0] = msg.sender;
        _tokenIds[id][0] = tokenId;
        emit TableCreated(id, msg.sender, msg.value, tokenId, maxPlayers);
    }

    function joinDuel(uint256 id, uint256 tokenId) external payable {
        Table storage t = tables[id];
        if (t.status != WAITING) revert BadStatus();
        if (t.playerCount >= t.maxPlayers) revert TableFull();
        if (_indexOf(id, msg.sender) < t.playerCount) revert AlreadySeated();
        if (msg.value != t.wagerWei) revert BadWager();
        bool nftTable = _tokenIds[id][0] > 0;
        if (nftTable) {
            if (tokenId == 0) revert BadNft();
            _pullNft(msg.sender, tokenId);
        } else if (tokenId != 0) {
            revert BadNft();
        }
        uint8 i = t.playerCount;
        _seats[id][i] = msg.sender;
        _tokenIds[id][i] = tokenId;
        t.playerCount = i + 1;
        emit PlayerJoined(id, msg.sender, tokenId, t.playerCount);
    }

    function leave(uint256 id) external {
        Table storage t = tables[id];
        if (t.status != WAITING) revert BadStatus();
        if (msg.sender == t.host) revert NotHost();
        uint8 n = t.playerCount;
        uint8 found = n;
        for (uint8 i = 0; i < n; i++) {
            if (_seats[id][i] == msg.sender) {
                found = i;
                break;
            }
        }
        if (found == n) revert NotSeated();
        uint256 token = _tokenIds[id][found];
        uint8 last = n - 1;
        if (found != last) {
            _seats[id][found] = _seats[id][last];
            _tokenIds[id][found] = _tokenIds[id][last];
        }
        _seats[id][last] = address(0);
        _tokenIds[id][last] = 0;
        t.playerCount = last;
        _pay(msg.sender, t.wagerWei);
        _pushNft(msg.sender, token);
        emit PlayerLeft(id, msg.sender, t.playerCount);
    }

    function start(uint256 id) external {
        Table storage t = tables[id];
        if (t.status != WAITING) revert BadStatus();
        if (msg.sender != t.host) revert NotHost();
        if (t.playerCount < MIN_PLAYERS) revert NeedPlayers();
        t.status = LOCKED;
        t.phase = PHASE_ROUND1;
        t.commitBlock = uint64(block.number);
        t.revealBlock = uint64(block.number + REVEAL_DELAY);
        emit MatchStarted(id, t.playerCount, t.revealBlock);
    }

    function settle(uint256 id) external {
        Table storage t = tables[id];
        if (t.status != LOCKED) revert BadStatus();
        if (block.number <= t.revealBlock) revert TooEarly();
        if (block.number > uint256(t.revealBlock) + HASH_WINDOW) revert Expired();
        bytes32 h = blockhash(t.revealBlock);
        if (h == bytes32(0)) revert HashMissing();

        if (t.phase == PHASE_ROUND1) {
            uint64 reveal = t.revealBlock;
            _scoreRound(id, h, reveal, false);
            t.entropy = h;
            if (t.playerCount <= FINALISTS) {
                _payout(id, h);
                return;
            }
            _markFinalists(id, h, reveal);
            t.phase = PHASE_FINAL;
            t.commitBlock = uint64(block.number);
            t.revealBlock = uint64(block.number + REVEAL_DELAY);
            emit RoundSettled(id, PHASE_ROUND1, h);
            return;
        }

        if (t.phase != PHASE_FINAL) revert BadStatus();
        _scoreRound(id, h, t.revealBlock, true);
        t.entropy = h;
        _payout(id, h);
    }

    function cancel(uint256 id) external {
        Table storage t = tables[id];
        if (t.status != WAITING) revert BadStatus();
        if (msg.sender != t.host) revert NotHost();
        t.status = CANCELLED;
        _refundAll(id);
        emit DuelCancelled(id);
    }

    function refundExpired(uint256 id) external {
        Table storage t = tables[id];
        if (t.status != LOCKED) revert BadStatus();
        if (block.number <= uint256(t.revealBlock) + HASH_WINDOW) revert TooEarly();
        t.status = REFUNDED;
        _refundAll(id);
        emit DuelRefunded(id);
    }

    function getPlayers(uint256 id)
        external
        view
        returns (
            address[] memory wallets,
            uint256[] memory tokens,
            uint8[] memory round1Rolls,
            uint8[] memory finalRolls,
            bool[] memory advanced
        )
    {
        uint8 n = tables[id].playerCount;
        wallets = new address[](n);
        tokens = new uint256[](n);
        round1Rolls = new uint8[](n);
        finalRolls = new uint8[](n);
        advanced = new bool[](n);
        for (uint8 i = 0; i < n; i++) {
            wallets[i] = _seats[id][i];
            tokens[i] = _tokenIds[id][i];
            round1Rolls[i] = _round1[id][i];
            finalRolls[i] = _finals[id][i];
            advanced[i] = _advanced[id][i];
        }
    }

    /// @notice Unbiased d6 plus a hash tie-break so rankings are total-ordered.
    function deriveScore(
        bytes32 entropy,
        uint256 tableId,
        address player,
        uint256 wagerWei,
        uint64 revealBlock,
        uint8 phase,
        uint256 index
    ) public pure returns (uint8 roll, uint256 score) {
        for (uint256 c = 0; c < 64; c++) {
            bytes32 digest = keccak256(
                abi.encodePacked(entropy, tableId, player, wagerWei, revealBlock, phase, index, c)
            );
            uint8 a = uint8(digest[0]);
            if (a < 252) {
                roll = (a % 6) + 1;
                score = (uint256(roll) << 248) | uint256(uint248(uint256(digest)));
                return (roll, score);
            }
        }
        revert HashMissing();
    }

    function _scoreRound(uint256 id, bytes32 entropy, uint64 reveal, bool finalsOnly) internal {
        Table storage t = tables[id];
        uint8 n = t.playerCount;
        uint8 phase = finalsOnly ? PHASE_FINAL : PHASE_ROUND1;
        for (uint8 i = 0; i < n; i++) {
            if (finalsOnly && !_advanced[id][i]) continue;
            (uint8 roll,) = deriveScore(entropy, id, _seats[id][i], t.wagerWei, reveal, phase, i);
            if (finalsOnly) _finals[id][i] = roll;
            else _round1[id][i] = roll;
        }
    }

    function _markFinalists(uint256 id, bytes32 entropy, uint64 reveal) internal {
        Table storage t = tables[id];
        uint8 n = t.playerCount;
        uint256[] memory scores = new uint256[](n);
        uint8[] memory idx = new uint8[](n);
        for (uint8 i = 0; i < n; i++) {
            (, scores[i]) = deriveScore(entropy, id, _seats[id][i], t.wagerWei, reveal, PHASE_ROUND1, i);
            idx[i] = i;
        }
        for (uint8 a = 0; a < n; a++) {
            for (uint8 b = uint8(a + 1); b < n; b++) {
                if (scores[idx[b]] > scores[idx[a]]) {
                    (idx[a], idx[b]) = (idx[b], idx[a]);
                }
            }
        }
        uint8 take = FINALISTS < n ? FINALISTS : n;
        for (uint8 k = 0; k < take; k++) {
            _advanced[id][idx[k]] = true;
        }
    }

    function _payout(uint256 id, bytes32 entropy) internal {
        Table storage t = tables[id];
        uint8 n = t.playerCount;
        bool finals = t.phase == PHASE_FINAL;
        uint8 phase = finals ? PHASE_FINAL : PHASE_ROUND1;
        uint64 reveal = t.revealBlock;
        uint256 best;
        uint8 bestI;
        uint8 bestRoll;
        bool found;
        for (uint8 i = 0; i < n; i++) {
            if (finals && !_advanced[id][i]) continue;
            (uint8 roll, uint256 score) = deriveScore(entropy, id, _seats[id][i], t.wagerWei, reveal, phase, i);
            if (!found || score > best) {
                found = true;
                best = score;
                bestI = i;
                bestRoll = roll;
            }
        }
        address winner = _seats[id][bestI];
        t.winner = winner;
        t.winnerRoll = bestRoll;
        t.status = SETTLED;
        _pay(winner, t.wagerWei * uint256(n));
        for (uint8 i = 0; i < n; i++) {
            _pushNft(winner, _tokenIds[id][i]);
        }
        emit TableSettled(id, winner, bestRoll, entropy);
    }

    function _refundAll(uint256 id) internal {
        Table storage t = tables[id];
        uint8 n = t.playerCount;
        for (uint8 i = 0; i < n; i++) {
            address p = _seats[id][i];
            _pay(p, t.wagerWei);
            _pushNft(p, _tokenIds[id][i]);
        }
    }

    function _indexOf(uint256 id, address player) internal view returns (uint8) {
        uint8 n = tables[id].playerCount;
        for (uint8 i = 0; i < n; i++) {
            if (_seats[id][i] == player) return i;
        }
        return n;
    }

    function _pullNft(address from, uint256 tokenId) internal {
        if (tokenId == 0) return;
        if (diceNft.ownerOf(tokenId) != from) revert BadNft();
        diceNft.transferFrom(from, address(this), tokenId);
    }

    function _pushNft(address to, uint256 tokenId) internal {
        if (tokenId == 0 || to == address(0)) return;
        diceNft.transferFrom(address(this), to, tokenId);
    }

    function _pay(address to, uint256 amount) internal {
        if (amount == 0 || to == address(0)) return;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
