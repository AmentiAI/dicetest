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
          <span className="label-full">Disconnect</span>
          <span className="label-short">Out</span>
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
      {compact ? (
        <>
          <span className="label-full">Connect wallet</span>
          <span className="label-short">Connect</span>
        </>
      ) : (
        "Connect wallet"
      )}
    </CoolBtn>
  );
}
