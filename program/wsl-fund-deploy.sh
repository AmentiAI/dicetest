#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"

ADDR="$(solana-keygen pubkey "$HOME/.config/solana/id.json")"
echo "deployer: $ADDR"
solana config set --url https://api.devnet.solana.com --keypair "$HOME/.config/solana/id.json"

# Load Helius key from repo .env without printing it.
set -a
# shellcheck disable=SC1091
. /mnt/c/Users/Wilso/dicetest/.env
set +a
HELIUS="https://devnet.helius-rpc.com/?api-key=${NEXT_PUBLIC_HELIUS_API_KEY}"

try_airdrop() {
  local amt="$1"
  local url="$2"
  local label="$3"
  echo "airdrop $amt via $label"
  solana airdrop "$amt" "$ADDR" --url "$url" || true
}

try_airdrop 2 "$HELIUS" helius
try_airdrop 2 "https://api.devnet.solana.com" public
sleep 3
try_airdrop 1 "$HELIUS" helius
try_airdrop 1 "https://api.devnet.solana.com" public

echo "balance:"
solana balance "$ADDR" --url https://api.devnet.solana.com
solana balance "$ADDR" --url "$HELIUS"

SO="/mnt/c/Users/Wilso/dicetest/program/target/deploy/dice_duel.so"
KEYPAIR="/mnt/c/Users/Wilso/dicetest/program/keys/dice_duel-keypair.json"
test -f "$SO"
ls -lh "$SO"

BAL_LAMPORTS="$(solana balance "$ADDR" --url "$HELIUS" --lamports | awk '{print $1}')"
echo "lamports=$BAL_LAMPORTS"
# Need ~2.87 SOL = 2870000000
if [ "${BAL_LAMPORTS:-0}" -lt 2870000000 ]; then
  echo "INSUFFICIENT_FUNDS"
  exit 2
fi

echo "==> deploy"
solana program deploy "$SO" \
  --program-id "$KEYPAIR" \
  --url "$HELIUS"

solana program show Djg4PX3upqax7GWrxWUjF3ydhbDDPqugM5QTsoNu14xx --url "$HELIUS"
