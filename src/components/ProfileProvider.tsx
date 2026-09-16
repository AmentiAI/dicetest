"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { identityMessage } from "@/lib/auth";
import { getJson, postJson } from "@/lib/http";
import { useEthWallet } from "@/lib/eth/wallet";

export type Profile = {
  wallet: string;
  username: string;
  demon: string;
  nftTokenId: string | null;
  wins: number;
  losses: number;
  volumeLamports: string;
};

const Ctx = createContext<{
  profile: Profile | null;
  loading: boolean;
  save: (username: string, nftTokenId?: string) => Promise<void>;
  refresh: () => Promise<void>;
} | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { address, signMessage } = useEthWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) {
      setProfile(null);
      return;
    }
    setLoading(true);
    try {
      const json = await getJson<{ profile: Profile | null }>(
        `/api/profile?wallet=${address}`,
      );
      setProfile(json?.profile ?? null);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (username: string, nftTokenId?: string) => {
      if (!address) {
        throw new Error("Connect a wallet that can sign messages");
      }
      const nft = nftTokenId ?? profile?.nftTokenId ?? "0";
      const message = identityMessage(address, username, nft);
      const sig = await signMessage(message);
      try {
        const json = await postJson<{ profile: Profile; error?: string }>(
          "/api/profile",
          {
            wallet: address,
            username,
            nftTokenId: nft,
            signatureBase64: sig,
          },
        );
        if (!json.profile) throw new Error("Profile was not saved");
        setProfile(json.profile);
      } catch (e) {
        const json = await getJson<{ profile: Profile | null }>(
          `/api/profile?wallet=${address}`,
        );
        if (json?.profile) {
          setProfile(json.profile);
          return;
        }
        throw e;
      }
    },
    [address, signMessage, profile?.nftTokenId],
  );

  return (
    <Ctx.Provider value={{ profile, loading, save, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProfile outside provider");
  return ctx;
}
