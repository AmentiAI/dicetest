"use client";

import { shortKey } from "@/lib/format";
import { CoolBtn } from "@/components/CoolBtn";
import { useEthWallet } from "@/lib/eth/wallet";

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { address, connected, disconnect, openConnectModal } = useEthWallet();

  if (connected && address) {
    return (
      <button
        className="wallet-chip"
        onClick={() => disconnect()}
        title="Disconnect"
      >
        <span className="pulse-dot" />
        {shortKey(address, 4, 4)}
      </button>
    );
  }

  return (
    <CoolBtn
      className={compact ? "btn-compact" : "w-full"}
      pulse={!compact}
      onClick={() => openConnectModal()}
    >
      Connect ETH / Robinhood
    </CoolBtn>
  );
}
