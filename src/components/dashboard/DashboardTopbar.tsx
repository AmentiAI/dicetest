"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/WalletButton";
import { WalletBadge } from "@/components/WalletBadge";
import { GameIcon } from "@/components/GameIcon";
import { useProfile } from "@/components/ProfileProvider";
import { formatUsd, shortKey } from "@/lib/format";
import { getJson } from "@/lib/http";

export function DashboardTopbar() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { profile } = useProfile();
  const [balance, setBalance] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("blockdice-sound");
    if (stored === "0") setSound(false);
  }, []);

  useEffect(() => {
    void getJson<{ usd: number | null }>("/api/price").then((j) => setPrice(j?.usd ?? null));
  }, []);

  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    let stop = false;
    const tick = async () => {
      try {
        const lamports = await connection.getBalance(publicKey, "confirmed");
        if (!stop) setBalance(lamports);
      } catch {
        /* ignore */
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 30_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [publicKey, connection]);

  const sol = balance != null ? balance / LAMPORTS_PER_SOL : null;

  return (
    <header className="dash-topbar">
      <div className="dash-topbar-spacer" />

      <div className="dash-topbar-actions">
        {sol != null ? (
          <div className="dash-balance">
            <span className="dash-balance-sol">
              {sol.toLocaleString(undefined, { maximumFractionDigits: 2 })} SOL
            </span>
            <span className="dash-balance-usd">{formatUsd(sol, price)}</span>
          </div>
        ) : null}

        {publicKey ? (
          <div className="dash-wallet-pill">
            <WalletBadge
              label={profile?.username ?? shortKey(publicKey.toBase58(), 2, 2)}
              accent="#8b5cf6"
            />
            <span>{shortKey(publicKey.toBase58(), 4, 4)}</span>
          </div>
        ) : null}

        <button
          type="button"
          className="dash-icon-btn"
          aria-label="Notifications"
        >
          <GameIcon name="bell" size={18} />
        </button>
        <Link href="/history" className="dash-icon-btn" aria-label="Statistics">
          <GameIcon name="chart" size={18} />
        </Link>
        <Link href="/how-to-play" className="dash-icon-btn" aria-label="Help">
          <GameIcon name="help" size={18} />
        </Link>
        <button
          type="button"
          className={`dash-icon-btn${sound ? " on" : ""}`}
          aria-label={sound ? "Mute" : "Unmute"}
          onClick={() => {
            const next = !sound;
            setSound(next);
            localStorage.setItem("blockdice-sound", next ? "1" : "0");
          }}
        >
          <GameIcon name={sound ? "sound" : "settings"} size={18} />
        </button>

        {!publicKey ? <WalletButton compact /> : null}
      </div>
    </header>
  );
}
