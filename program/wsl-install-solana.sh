#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
. "$HOME/.cargo/env"

if [ ! -x "$HOME/.local/share/solana/install/active_release/bin/solana" ]; then
  curl -sSfL https://release.anza.xyz/v2.1.21/install -o /tmp/solana-install.sh
  sh /tmp/solana-install.sh
fi

solana --version
cargo-build-sbf --version
