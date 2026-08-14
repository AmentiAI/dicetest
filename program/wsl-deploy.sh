#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
. "$HOME/.cargo/env"
rustup default 1.85.1

WIN_PROG="/mnt/c/Users/Wilso/dicetest/program"
BUILD="$HOME/src/dice_duel_program"
KEYPAIR="$WIN_PROG/keys/dice_duel-keypair.json"

mkdir -p "$HOME/src"
# Keep the native ext4 target/ cache; only refresh sources.
rsync -a --delete --exclude target --exclude .git "$WIN_PROG/" "$BUILD/"
rm -f "$BUILD/rust-toolchain.toml"
rm -rf "$HOME/.cargo/registry/src"/index.crates.io-*/block-buffer-0.12.1 \
       "$HOME/.cargo/registry/src"/index.crates.io-*/digest-0.11.* \
       "$HOME/.cargo/registry/src"/index.crates.io-*/blake3-1.8.* \
       "$HOME/.cargo/registry/src"/index.crates.io-*/hashbrown-0.17.* \
       "$HOME/.cargo/registry/src"/index.crates.io-*/indexmap-2.14.* \
       "$HOME/.cargo/registry/src"/index.crates.io-*/zeroize-1.9.* || true

cd "$BUILD"
if [ ! -f Cargo.lock ]; then
  echo "==> lockfile"
  cargo generate-lockfile
  cargo update -p toml_edit --precise 0.22.22 || true
  cargo update -p 'indexmap@2.14.0' --precise 2.7.1 || true
  cargo update -p 'hashbrown@0.17.1' --precise 0.15.2 || true
fi
echo "==> building SBF"
cargo-build-sbf --manifest-path programs/dice_duel/Cargo.toml

SO="$(find "$BUILD" -name 'dice_duel.so' | head -n 1)"
echo "SO=$SO"
test -n "$SO"
mkdir -p "$WIN_PROG/target/deploy"
cp "$SO" "$WIN_PROG/target/deploy/dice_duel.so"
cp "$BUILD/Cargo.lock" "$WIN_PROG/Cargo.lock"

echo "==> deployer"
mkdir -p "$HOME/.config/solana"
if [ ! -f "$HOME/.config/solana/id.json" ]; then
  solana-keygen new --no-bip39-passphrase -o "$HOME/.config/solana/id.json" --force
fi
solana config set --url https://api.devnet.solana.com --keypair "$HOME/.config/solana/id.json"
echo "deployer: $(solana address)"
solana airdrop 2 || solana airdrop 1 || true
solana balance

echo "==> deploy"
solana program deploy "$WIN_PROG/target/deploy/dice_duel.so" \
  --program-id "$KEYPAIR" \
  --url https://api.devnet.solana.com

solana program show Djg4PX3upqax7GWrxWUjF3ydhbDDPqugM5QTsoNu14xx --url https://api.devnet.solana.com
