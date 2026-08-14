"use client";

import { useEffect, useState } from "react";
import { formatSol, shortKey } from "@/lib/format";
import { DemonPortrait } from "./DemonPortrait";

type Leader = {
  wallet: string;
  username: string;
  demon: string;
  wins: number;
  losses: number;
  volumeLamports: string;
};

export function Leaderboard() {
  const [leaders, setLeaders] = useState<Leader[]>([]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const res = await fetch("/api/leaderboard");
      const json = await res.json();
      if (!stop) setLeaders(json.leaders ?? []);
    };
    void tick();
    const t = setInterval(() => void tick(), 8000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="lobby">
      <header className="lobby-head">
        <div>
          <p className="kicker">On record</p>
          <h1>Leaderboard</h1>
          <p className="muted">
            Wins land in Neon after an on-chain settle. Volume is SOL you put
            at risk, not profit.
          </p>
        </div>
      </header>
      <div className="lead-list">
        {leaders.length === 0 ? (
          <div className="empty">No settled duels yet.</div>
        ) : (
          leaders.map((p, i) => (
            <div key={p.wallet} className="lead-row">
              <span className="rank">{i + 1}</span>
              <DemonPortrait id={p.demon} size={40} />
              <div>
                <b>{p.username}</b>
                <p className="muted">{shortKey(p.wallet)}</p>
              </div>
              <span>
                {p.wins}W / {p.losses}L
              </span>
              <span className="gold">{formatSol(p.volumeLamports)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
