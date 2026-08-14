#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
set -a
. /mnt/c/Users/Wilso/dicetest/.env
set +a
RPC="https://devnet.helius-rpc.com/?api-key=${NEXT_PUBLIC_HELIUS_API_KEY}"
SO="/mnt/c/Users/Wilso/dicetest/program/target/deploy/dice_duel.so"
KEYPAIR="/mnt/c/Users/Wilso/dicetest/program/keys/dice_duel-keypair.json"
solana config set --url https://api.devnet.solana.com --keypair "$HOME/.config/solana/id.json" >/dev/null
echo "deployer $(solana address) $(solana balance --url "$RPC")"
echo "==> deploy"
solana program deploy "$SO" \
  --program-id "$KEYPAIR" \
  --url "$RPC"
echo "==> show"
solana program show Djg4PX3upqax7GWrxWUjF3ydhbDDPqugM5QTsoNu14xx --url "$RPC"
