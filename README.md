# ASHDUEL

1v1 SOL dice. Winner takes the full pot. **No house fee.** Each roll is derived from a **future Solana slot hash** after both wagers are locked in a program PDA.

This is not a demo ledger. Create/join/settle are real Solana transactions. Neon stores names, chat, and leaderboard — never the money.

## How the dice work (on-chain)

1. Host calls `create_duel` and transfers the wager into the duel PDA.
2. Challenger calls `join_duel`, matches the wager, and the program stores `reveal_slot = current_slot + 4`.
3. After that slot exists, anyone calls `settle`.
4. The program reads **Sysvar SlotHashes** (`SysvarS1otHashes111111111111111111111111111`) and requires the **exact** committed slot hash.
5. Dice are:

```
digest = SHA-256(
  slot_hash || duel_pda || host || challenger || wager_u64_le || reveal_slot_u64_le || counter_u64_le
)
host_die       = unbiased d6 from digest[0]   (bytes >= 252 rejected)
challenger_die = unbiased d6 from digest[1]
if equal, counter += 1 and re-hash
```

6. Higher roll receives **2 × wager**. Zero fee CPI. Ties cannot pay out — they re-hash until the dice differ.

Players cannot grind: the hash is not known at lock time. Slot leaders can theoretically bias a hash (this is true of any slot-hash scheme). That is the method you asked for; it is documented rather than hidden. Verify any settle yourself with `src/lib/solana/dice.ts` and the explorer.

If the committed slot falls off SlotHashes (~2 minutes), `refund_expired` returns each wager.

## APIs you need

| What | Required? | Key / URL | Used for |
|---|---|---|---|
| **Neon Postgres** | Yes | `DATABASE_URL` (already in `.env`) | Profiles, rooms, chat, leaderboard |
| **Solana RPC** | Yes | `SOLANA_RPC_URL` + `NEXT_PUBLIC_SOLANA_RPC_URL` | Send txs, read PDAs, SlotHashes, balances |
| **Phantom / Solflare / Backpack** | Yes (user) | No API key — Wallet Standard | Sign create/join/settle and identity |
| **This program** | Yes | `NEXT_PUBLIC_PROGRAM_ID=Djg4PX3upqax7GWrxWUjF3ydhbDDPqugM5QTsoNu14xx` | Escrow + dice |
| **Jupiter Price API** | No | `https://lite-api.jup.ag/price/v3` (no key) | SOL/USD display |
| **CoinGecko** | Fallback | `https://api.coingecko.com/api/v3/simple/price` (no key) | SOL/USD if Jupiter fails |
| **Solana Explorer** | No | `https://explorer.solana.com` | Tx / PDA / slot links |

### Optional (recommended for production)

| What | Why |
|---|---|
| **[Helius](https://www.helius.dev/)** or **[QuickNode](https://www.quicknode.com/)** RPC | Public `https://api.devnet.solana.com` rate-limits. Free Helius key → set both RPC env vars to `https://devnet.helius-rpc.com/?api-key=YOUR_KEY` (mainnet URL differs). |
| **No VRF / no Switchboard / no ORAO** | Intentionally unused. Randomness is the slot hash. |
| **No Stripe / no house wallet** | There is no operator rake. |

Wallets do not need an app API key. Users install [Phantom](https://phantom.app/) (or any Wallet Standard wallet) and approve transactions.

## Run the web app

```bash
npm install
npm run db:push
npm run dev
```

Open `http://localhost:3000`. Connect a wallet on **devnet**, airdrop 1 SOL from the sidebar, bind a name (wallet `signMessage`), then open a pit.

## Deploy the on-chain program (required for real escrow)

Rust + Solana CLI + Anchor are not installed on this machine yet. The program source is in `program/programs/dice_duel`. The program keypair (this **is** the program ID) is at `program/keys/dice_duel-keypair.json`.

### 1. Toolchain (Windows)

- Rust: https://rustup.rs/
- Solana CLI: https://solana.com/docs/intro/installation
- Anchor 0.31.1: https://www.anchor-lang.com/docs/installation

```bash
rustup install 1.84.1
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.31.1
avm use 0.31.1
```

### 2. Devnet wallet with SOL

```bash
solana-keygen new
solana config set --url devnet
solana airdrop 2
```

### 3. Build and deploy with the existing ID

```bash
cd program
solana program deploy target/deploy/dice_duel.so --program-id ../keys/dice_duel-keypair.json
```

Or from the `program` folder after `anchor build`:

```bash
anchor build
anchor deploy --program-name dice_duel --program-keypair keys/dice_duel-keypair.json
```

Copy the `.so` path Anchor prints if it differs. After deploy, `GET /api/stats` should show `programDeployed: true`.

### 4. Mainnet

Set `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta` and both RPC URLs to a paid mainnet endpoint. Redeploy the same program ID to mainnet only if you intend that keypair to be the upgrade authority — treat `program/keys/dice_duel-keypair.json` as a secret.

## Environment

See `.env.example`. Your Neon URL stays in `.env` (gitignored).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `SOLANA_RPC_URL` | Server-side RPC (sync, price-independent chain reads) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Browser wallet RPC |
| `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` \| `mainnet-beta` \| `testnet` |
| `NEXT_PUBLIC_PROGRAM_ID` | Must match the deployed program |

## App routes

- `/` lobby
- `/duel/[pda]` 1v1 table
- `/leaderboard` Neon stats after settles
- `/api/rooms` list/create (create verifies the PDA on-chain first)
- `/api/rooms/[id]` sync from chain
- `/api/rooms/[id]/chat`
- `/api/profile` wallet-signed identity
- `/api/slot?pda=` current slot + hash preview
- `/api/stats` slot, program live?, pots
- `/api/price` SOL/USD
- `/api/leaderboard`

## Limits

- Min wager **0.001 SOL**, max **50 SOL**
- 1v1 only
- Host cannot join themselves
- Chat is Neon-only (not on-chain)

Local laws on wagering are yours to follow.
