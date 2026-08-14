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
import { DEMONS, type DemonId } from "@/lib/demons";
import { getJson, postJson } from "@/lib/http";

export type Profile = {
  wallet: string;
  username: string;
  demon: DemonId | string;
  wins: number;
  losses: number;
  volumeLamports: string;
};

const Ctx = createContext<{
  profile: Profile | null;
  loading: boolean;
  save: (username: string, demon: string) => Promise<void>;
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
    async (username: string, demon: string) => {
      if (!publicKey || !signMessage) {
        throw new Error("Connect a wallet that can sign messages");
      }
      const wallet = publicKey.toBase58();
      const message = identityMessage(wallet, username, demon);
      const sig = await signMessage(new TextEncoder().encode(message));
      const json = await postJson<{ profile: Profile; error?: string }>(
        "/api/profile",
        {
          wallet,
          username,
          demon,
          signatureBase64: bytesToBase64(sig),
        },
      );
      if (!json.profile) throw new Error("Profile was not saved");
      setProfile(json.profile);
    },
    [publicKey, signMessage],
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

export function demonOrDefault(id: string | undefined) {
  return DEMONS.some((d) => d.id === id) ? id! : DEMONS[0].id;
}
