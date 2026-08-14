#!/usr/bin/env bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
ADDR="$(solana-keygen pubkey "$HOME/.config/solana/id.json")"
echo "addr=$ADDR"
solana balance "$ADDR" --url https://api.devnet.solana.com
