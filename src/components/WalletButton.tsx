"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { shortKey } from "@/lib/format";
import { CoolBtn } from "@/components/CoolBtn";

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
    <CoolBtn
      className={compact ? "btn-compact" : "w-full"}
      pulse={!compact}
      onClick={() => setVisible(true)}
    >
      Connect Wallet
    </CoolBtn>
  );
}
