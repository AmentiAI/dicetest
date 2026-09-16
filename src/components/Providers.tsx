"use client";

import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/eth/wagmi";
import { EthWalletProvider } from "@/lib/eth/wallet";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <EthWalletProvider>{children}</EthWalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
