import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { CHAIN } from "@/lib/eth/constants";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "blockdice-placeholder";

const rpc = process.env.NEXT_PUBLIC_ETH_RPC_URL;

export const wagmiConfig = createConfig({
  chains: [CHAIN],
  ssr: true,
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({
      projectId,
      showQrModal: true,
      metadata: {
        name: "BLOCK DICE",
        description: "1v1 ETH dice. Bet ETH or your dice NFT.",
        url: "https://blockdice.local",
        icons: [],
      },
    }),
  ],
  transports: {
    [CHAIN.id]: http(rpc || CHAIN.rpcUrls.default.http[0]),
  } as Record<number, ReturnType<typeof http>>,
});
