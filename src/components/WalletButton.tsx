"use client";

import { shortKey } from "@/lib/format";
import { CoolBtn } from "@/components/CoolBtn";
import { useEthWallet } from "@/lib/eth/wallet";

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { address, connected, disconnect, openConnectModal } = useEthWallet();

  if (connected && address) {
    return (
      <div className="wallet-session">
        <span className="wallet-chip" title={address}>
          <span className="pulse-dot" />
          {shortKey(address, 4, 4)}
        </span>
        <button
          type="button"
          className="wallet-disconnect"
          onClick={() => void disconnect()}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <CoolBtn
      className={compact ? "btn-compact" : "w-full"}
      pulse={!compact}
      onClick={() => openConnectModal()}
    >
      {compact ? "Connect wallet" : "Connect ETH / Robinhood"}
    </CoolBtn>
  );
}
