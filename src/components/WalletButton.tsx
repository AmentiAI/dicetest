"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { shortKey } from "@/lib/format";

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { publicKey, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();

  if (connected && publicKey) {
    return (
      <button
        className="wallet-chip"
        onClick={() => disconnect()}
        title="Disconnect"
      >
        <span className="pulse-dot" />
        {shortKey(publicKey, 4, 4)}
      </button>
    );
  }

  return (
    <button
      className={`btn-ember ${compact ? "btn-compact" : "w-full"}`}
      onClick={() => setVisible(true)}
    >
      Connect Wallet
    </button>
  );
}
