"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { identityMessage } from "@/lib/auth";
import { bytesToBase64 } from "@/lib/base64";
import { getJson, postJson } from "@/lib/http";

const DEFAULT_DEMON = "cinder-wraith";

export type Profile = {
  wallet: string;
  username: string;
  demon: string;
  wins: number;
  losses: number;
  volumeLamports: string;
};

const Ctx = createContext<{
  profile: Profile | null;
  loading: boolean;
  save: (username: string) => Promise<void>;
  refresh: () => Promise<void>;
} | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage } = useWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setProfile(null);
      return;
    }
    setLoading(true);
    try {
      const json = await getJson<{ profile: Profile | null }>(
        `/api/profile?wallet=${publicKey.toBase58()}`,
      );
      setProfile(json?.profile ?? null);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (username: string) => {
      if (!publicKey || !signMessage) {
        throw new Error("Connect a wallet that can sign messages");
      }
      const wallet = publicKey.toBase58();
      const demon = profile?.demon ?? DEFAULT_DEMON;
      const message = identityMessage(wallet, username, demon);
      const sig = await signMessage(new TextEncoder().encode(message));
      try {
        const json = await postJson<{ profile: Profile; error?: string }>(
          "/api/profile",
          {
            wallet,
            username,
            demon,
            signatureBase64: bytesToBase64(new Uint8Array(sig)),
          },
        );
        if (!json.profile) throw new Error("Profile was not saved");
        setProfile(json.profile);
      } catch (e) {
        const json = await getJson<{ profile: Profile | null }>(
          `/api/profile?wallet=${wallet}`,
        );
        if (json?.profile) {
          setProfile(json.profile);
          return;
        }
        throw e;
      }
    },
    [publicKey, signMessage, profile?.demon],
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

