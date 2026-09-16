"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { CoolBtn } from "@/components/CoolBtn";

const ConnectCtx = createContext<{
  openConnectModal: () => void;
} | null>(null);

export function EthWalletProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { isConnected } = useAccount();
  const { connect, connectors, error, isPending } = useConnect();

  const openConnectModal = useCallback(() => setOpen(true), []);

  useEffect(() => {
    if (isConnected) setOpen(false);
  }, [isConnected]);

  const injected = connectors.find((c) => c.id === "injected");
  const walletConnect = connectors.find((c) => c.id === "walletConnect");

  return (
    <ConnectCtx.Provider value={{ openConnectModal }}>
      {children}
      {open ? (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="panel identity-panel" onClick={(e) => e.stopPropagation()}>
            <p className="kicker">Wallet</p>
            <h2>Connect ETH</h2>
            <p className="muted">
              Browser wallets (MetaMask, Rainbow, Coinbase, Rabby) or WalletConnect
              for Robinhood and mobile.
            </p>
            <div className="row-actions">
              <CoolBtn
                fullWidth
                pulse={!isPending}
                disabled={isPending || !injected}
                onClick={() => injected && connect({ connector: injected })}
              >
                Browser wallet
              </CoolBtn>
            </div>
            <div className="row-actions">
              <CoolBtn
                fullWidth
                disabled={isPending || !walletConnect}
                onClick={() => walletConnect && connect({ connector: walletConnect })}
              >
                WalletConnect / Robinhood
              </CoolBtn>
            </div>
            {error ? <p className="err">{error.message}</p> : null}
            <CoolBtn variant="ghost" fullWidth onClick={() => setOpen(false)}>
              Back
            </CoolBtn>
          </div>
        </div>
      ) : null}
    </ConnectCtx.Provider>
  );
}

export function useEthWallet() {
  const ctx = useContext(ConnectCtx);
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  return useMemo(
    () => ({
      address: address?.toLowerCase() ?? null,
      connected: isConnected,
      disconnect,
      openConnectModal: () => {
        ctx?.openConnectModal();
      },
      signMessage: async (message: string) => signMessageAsync({ message }),
    }),
    [address, isConnected, disconnect, signMessageAsync, ctx],
  );
}
