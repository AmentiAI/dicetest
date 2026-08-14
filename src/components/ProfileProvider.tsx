"use client";

import { Buffer } from "buffer";
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
import { DEMONS, type DemonId } from "@/lib/demons";

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
      const res = await fetch(`/api/profile?wallet=${publicKey.toBase58()}`);
      const json = await res.json();
      setProfile(json.profile ?? null);
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
      const signatureBase64 = Buffer.from(sig).toString("base64");
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, username, demon, signatureBase64 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "profile failed");
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
