#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
. "$HOME/.cargo/env"
rustup default 1.85.1

WIN_PROG="/mnt/c/Users/Wilso/dicetest/program"
BUILD="$HOME/src/dice_duel_program"
rm -rf "$BUILD"
cp -a "$WIN_PROG" "$BUILD"
rm -f "$BUILD/rust-toolchain.toml"
cd "$BUILD"

echo "==> generating lockfile with host cargo"
cargo generate-lockfile
echo "==> pinning pre-edition2024 crates"
# Best-effort downgrades; ignore failures
cargo update -p block-buffer --precise 0.10.4 || true
cargo update -p crypto-common --precise 0.1.6 || true
cargo update -p digest --precise 0.10.7 || true
cargo update -p hashbrown --precise 0.15.2 || true
cargo update -p indexmap --precise 2.7.1 || true
cargo update -p zeroize --precise 1.8.1 || true

echo "==> building"
cargo-build-sbf --manifest-path programs/dice_duel/Cargo.toml
