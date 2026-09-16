"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { WalletButton } from "@/components/WalletButton";
import { WalletBadge } from "@/components/WalletBadge";
import { GameIcon } from "@/components/GameIcon";
import { DiceNftBadge } from "@/components/NftPicker";
import { useProfile } from "@/components/ProfileProvider";
import { formatUsd, shortKey } from "@/lib/format";
import { getJson } from "@/lib/http";
import { PLAY_LOCKED } from "@/lib/waitlist";

export function DashboardTopbar() {
  const { address } = useAccount();
  const { data: bal } = useBalance({ address });
  const { profile } = useProfile();
  const [price, setPrice] = useState<number | null>(null);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("blockdice-sound");
    if (stored === "0") setSound(false);
  }, []);

  useEffect(() => {
    void getJson<{ usd: number | null }>("/api/price").then((j) => setPrice(j?.usd ?? null));
  }, []);

  const eth = bal ? Number(bal.formatted) : null;

  return (
    <header className="dash-topbar">
      <div className="dash-topbar-spacer" />

      <div className="dash-topbar-actions">
        {eth != null ? (
          <div className="dash-balance">
            <span className="dash-balance-sol">
              {eth.toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH
            </span>
            <span className="dash-balance-usd">{formatUsd(eth, price)}</span>
          </div>
        ) : null}

        {address ? (
          <div className="dash-wallet-pill">
            <WalletBadge
              label={profile?.username ?? shortKey(address, 2, 2)}
              accent="#8b5cf6"
            />
            <span>{shortKey(address, 4, 4)}</span>
            <DiceNftBadge tokenId={profile?.nftTokenId} />
          </div>
        ) : null}

        <button
          type="button"
          className="dash-icon-btn"
          aria-label="Notifications"
        >
          <GameIcon name="bell" size={18} />
        </button>
        {PLAY_LOCKED ? null : (
          <Link href="/history" className="dash-icon-btn" aria-label="Statistics">
            <GameIcon name="chart" size={18} />
          </Link>
        )}
        <Link href="/fair" className="dash-icon-btn" aria-label="Help">
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

        {!address ? <WalletButton compact /> : null}
      </div>
    </header>
  );
}
