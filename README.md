# BLOCK DICE

1v1 ETH dice. Winner takes the full pot. **No house fee.** Connect MetaMask, Rainbow, Coinbase Wallet, or **Robinhood Wallet** (WalletConnect). Equip a Block Dice NFT as your match character. Bet ETH, the NFT, or both.

This is not a demo ledger. Create / join / settle are real Ethereum transactions. Neon stores names, chat, equipped NFTs, and the leaderboard — never the money.

## How a match works

1. Connect an Ethereum wallet (RainbowKit + WalletConnect). Bind a call sign with `personal_sign`. If you hold a Block Dice NFT, equip it — that skin is your die in the arena and on the leaderboard.
2. Host calls `createDuel(tokenId)` and locks ETH, an NFT, or both in `DiceDuel`.
3. Challenger calls `joinDuel` with the same ETH amount. If the host staked an NFT, the challenger must stake one too.
4. Join sets `revealBlock = block.number + 3`. After that block is hashed, anyone calls `settle`.
5. Dice come from the reveal **blockhash**:

```
digest = keccak256(
  entropy || duel_id || host || challenger || wager_wei || reveal_block || counter
)
host_die       = unbiased d6 from digest[0]  (byte >= 252 rejected)
challenger_die = unbiased d6 from digest[1]
if tied: counter += 1 and re-hash
```

6. Higher roll receives the ETH pot and any staked dice NFTs. Zero fee. Ties re-hash until the dice differ.

Players cannot grind: the hash is unknown at lock time. If the reveal block ages past 256 blocks, `refundExpired` returns each stake. Host can `cancel` before a challenger joins.

Equipping an NFT is **not** staking it. Character = profile `nftTokenId`. Stake = `createDuel` / `joinDuel` token id (winner takes both).

## APIs you need

| What | Required? | Key / URL | Used for |
|---|---|---|---|
| **Neon Postgres** | Yes | `DATABASE_URL` | Profiles, rooms, chat, leaderboard |
| **Ethereum RPC** | Yes | `ETH_RPC_URL` + `NEXT_PUBLIC_ETH_RPC_URL` | Reads, receipts, blockhash |
| **WalletConnect Cloud** | Yes (Robinhood + WC wallets) | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect modal |
| **DiceDuel + BlockDiceNft** | Yes | `NEXT_PUBLIC_DUEL_ADDRESS` + `NEXT_PUBLIC_NFT_ADDRESS` | Escrow + character NFTs |
| **CoinGecko** | No | ETH/USD display | Price chip |

Robinhood Wallet connects through **WalletConnect / Robinhood**. MetaMask, Rainbow, Coinbase, and Rabby use **Browser wallet**.

## Run the web app

```bash
npm install
npm run db:push
npm run dev
```

Copy `.env.example` to `.env`. Open `http://localhost:3000`. Connect a wallet on **Sepolia** (default `NEXT_PUBLIC_CHAIN_ID=11155111`), bind a name, then open a circle.

## Deploy the contracts (required for real escrow)

[Foundry](https://book.getfoundry.sh/getting-started/installation):

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url $ETH_RPC_URL --broadcast --private-key $DEPLOYER_KEY
```

Mint a character NFT (owner-only):

```bash
cast send $NFT_ADDRESS "mint(address,uint8)" $PLAYER 0 --rpc-url $ETH_RPC_URL --private-key $DEPLOYER_KEY
```

Put the printed addresses in `.env`:

```
NEXT_PUBLIC_DUEL_ADDRESS=0x…
NEXT_PUBLIC_NFT_ADDRESS=0x…
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=…   # https://cloud.walletconnect.com
```

Supported chain ids: `1` (Ethereum), `11155111` (Sepolia), `8453` (Base), `84532` (Base Sepolia).

## Environment

See `.env.example`. Neon stays in `.env` (gitignored).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `ETH_RPC_URL` | Server-side RPC |
| `NEXT_PUBLIC_ETH_RPC_URL` | Browser RPC |
| `NEXT_PUBLIC_CHAIN_ID` | `11155111` Sepolia default |
| `NEXT_PUBLIC_DUEL_ADDRESS` | `DiceDuel` escrow |
| `NEXT_PUBLIC_NFT_ADDRESS` | `BlockDiceNft` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect / Robinhood |
| `ADMIN_WALLETS` | Comma-separated 0x admins |
| `ADMIN_SECRET` | Signed admin session |

## App routes

- `/` lobby
- `/circles` open / join tables
- `/duel/[id]` 1v1 table (`id` = on-chain duel id)
- `/leaderboard` wins + equipped dice NFT
- `/api/rooms` list/create (create verifies the tx on-chain first)
- `/api/rooms/[id]` sync from chain
- `/api/profile` wallet-signed identity + equipped NFT
- `/api/nft?wallet=` tokens you hold
- `/api/slot?pda=` current block + hash preview
- `/api/stats` block, contracts live?, pots
- `/api/price` ETH/USD
- `/api/leaderboard`

## Limits

- Min wager **0.0001 ETH**, max **50 ETH**, or NFT-only (0 ETH + a dice NFT)
- 1v1 only
- Host cannot join themselves
- Chat is Neon-only (not on-chain)

Local laws on wagering are yours to follow.
