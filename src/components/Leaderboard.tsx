"use client";

import { useEffect, useState } from "react";
import { formatEth, shortKey } from "@/lib/format";
import { getJson } from "@/lib/http";
import { WalletBadge } from "./WalletBadge";
import { DiceNftBadge } from "./NftPicker";

type Leader = {
  wallet: string;
  username: string;
  wins: number;
  losses: number;
  volumeLamports: string;
  nftTokenId: string | null;
  demon: string;
};

export function Leaderboard() {
  const [leaders, setLeaders] = useState<Leader[]>([]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const json = await getJson<{ leaders: Leader[] }>("/api/leaderboard");
      if (!stop) setLeaders(json?.leaders ?? []);
    };
    void tick();
    const t = setInterval(() => void tick(), 8000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <p className="dash-eyebrow">On record</p>
          <h1>Leaderboard</h1>
          <p className="muted">
            Wins land after an on-chain settle. Volume is ETH you put at risk,
            not profit. Equipped Block Dice NFTs show next to each name.
          </p>
        </div>
      </header>
      <div className="lead-list">
        {leaders.length === 0 ? (
          <div className="empty">No settled duels yet.</div>
        ) : (
          leaders.map((p, i) => (
            <div key={p.wallet} className="glass-panel lead-row">
              <span className="rank">{i + 1}</span>
              <WalletBadge label={p.username} />
              <div>
                <b>{p.username}</b>
                <p className="muted">{shortKey(p.wallet)}</p>
                <DiceNftBadge tokenId={p.nftTokenId} />
              </div>
              <span>
                {p.wins}W / {p.losses}L
              </span>
              <span className="gold">{formatEth(p.volumeLamports)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
