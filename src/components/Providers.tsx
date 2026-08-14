"use client";

import "@/lib/polyfill";
import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SOLANA_RPC } from "@/lib/solana/constants";
import { rpcFetch } from "@/lib/solana/rpc";
import "@solana/wallet-adapter-react-ui/styles.css";

export function Providers({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => SOLANA_RPC, []);
  const config = useMemo(
    () => ({
      commitment: "confirmed" as const,
      confirmTransactionInitialTimeout: 60_000,
      fetch: rpcFetch,
    }),
    [],
  );
  return (
    <ConnectionProvider endpoint={endpoint} config={config}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
