#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
set -a
. /mnt/c/Users/Wilso/dicetest/.env
set +a
RPC="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
HELIUS_KEY="${HELIUS_API_KEY:-${NEXT_PUBLIC_HELIUS_API_KEY:-}}"
if [ -n "$HELIUS_KEY" ]; then
  RPC="https://devnet.helius-rpc.com/?api-key=${HELIUS_KEY}"
fi
USER="9EAhmDdXUKfo2ae4Tx3PPj5Cv17VF5oxjtBaU6FJeSNT"
DEPLOYER="$(solana-keygen pubkey "$HOME/.config/solana/id.json")"
echo "user=$USER"
solana balance "$USER" --url "$RPC"
echo "deployer=$DEPLOYER"
solana balance "$DEPLOYER" --url "$RPC"
solana program show Djg4PX3upqax7GWrxWUjF3ydhbDDPqugM5QTsoNu14xx --url "$RPC" || echo "program_not_deployed"
