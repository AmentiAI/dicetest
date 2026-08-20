"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatSol, shortKey } from "@/lib/format";
import { getJson } from "@/lib/http";
import { WalletBadge } from "@/components/WalletBadge";

type Leader = {
  wallet: string;
  username: string;
  wins: number;
  losses: number;
  volumeLamports: string;
};

type RoomRow = {
  id: string;
  status: string;
  wagerLamports: string;
  hostRoll: number | null;
  challengerRoll: number | null;
  winnerWallet: string | null;
  host: { username: string } | null;
  challenger: { username: string } | null;
};

const PREVIEW_LEADERS: Leader[] = [
  { wallet: "1", username: "Nova", wins: 18, losses: 4, volumeLamports: "12000000000" },
  { wallet: "2", username: "Kite", wins: 14, losses: 7, volumeLamports: "8600000000" },
  { wallet: "3", username: "Riven", wins: 11, losses: 6, volumeLamports: "6400000000" },
  { wallet: "4", username: "Ash", wins: 9, losses: 8, volumeLamports: "4100000000" },
  { wallet: "5", username: "Lux", wins: 8, losses: 5, volumeLamports: "3200000000" },
];

const PREVIEW_ACTIVITY: RoomRow[] = [
  { id: "a1", status: "settled", wagerLamports: "1200000000", hostRoll: 6, challengerRoll: 4, winnerWallet: "1", host: { username: "Nova" }, challenger: { username: "Kite" } },
  { id: "a2", status: "settled", wagerLamports: "500000000", hostRoll: 2, challengerRoll: 5, winnerWallet: "2", host: { username: "Ash" }, challenger: { username: "Riven" } },
  { id: "a3", status: "settled", wagerLamports: "2000000000", hostRoll: 5, challengerRoll: 3, winnerWallet: "3", host: { username: "Lux" }, challenger: { username: "Nova" } },
  { id: "a4", status: "settled", wagerLamports: "250000000", hostRoll: 6, challengerRoll: 1, winnerWallet: "4", host: { username: "Kite" }, challenger: { username: "Ash" } },
];

export function DashboardRightRail() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [activity, setActivity] = useState<RoomRow[]>([]);
  const [tab, setTab] = useState<"all" | "high">("all");
  const [lbTab, setLbTab] = useState<"weekly" | "all">("weekly");

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const [lb, rooms] = await Promise.all([
        getJson<{ leaders: Leader[] }>("/api/leaderboard"),
        getJson<{ rooms: RoomRow[] }>("/api/rooms"),
      ]);
      if (stop) return;
      setLeaders(lb?.leaders ?? []);
      const recent = (rooms?.rooms ?? [])
        .filter((r) => r.status === "settled" || r.status === "locked")
        .slice(0, 24);
      setActivity(recent);
    };
    void tick();
    const t = setInterval(() => void tick(), 12_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const shown =
    tab === "high"
      ? activity.filter((r) => Number(r.wagerLamports) >= 50_000_000)
      : activity;

  const top3 = (leaders.length ? leaders : PREVIEW_LEADERS).slice(0, 3);
  const rest = (leaders.length ? leaders : PREVIEW_LEADERS).slice(3, 5);
  const feed = shown.length ? shown : PREVIEW_ACTIVITY;

  return (
    <aside className="dash-rail">
      <section className="glass-panel dash-rail-section">
        <div className="dash-rail-head">
          <h2>Live activity</h2>
          <div className="dash-tabs">
            <button
              type="button"
              className={tab === "all" ? "on" : ""}
              onClick={() => setTab("all")}
            >
              All bets
            </button>
            <button
              type="button"
              className={tab === "high" ? "on" : ""}
              onClick={() => setTab("high")}
            >
              High rollers
            </button>
          </div>
        </div>
        <ul className="dash-activity-list">
          {feed.slice(0, 8).map((r) => {
              const winnerName =
                r.hostRoll != null &&
                r.challengerRoll != null &&
                r.host?.username &&
                r.challenger?.username
                  ? r.hostRoll > r.challengerRoll
                    ? r.host.username
                    : r.challenger.username
                  : r.host?.username ?? shortKey(r.id, 4, 4);
              const won = r.status === "settled";
              const profit = BigInt(r.wagerLamports);
              return (
                <li key={r.id} className="dash-activity-item">
                  <WalletBadge label={winnerName.slice(0, 2)} accent="#8b5cf6" />
                  <div className="dash-activity-body">
                    <strong>{winnerName}</strong>
                    <span className="pred-badge sm">HIGHER ROLL</span>
                    <span className="act-meta">
                      {formatSol(r.wagerLamports)} · 2.00×
                    </span>
                  </div>
                  <span className={won ? "dash-profit win" : "dash-profit"}>
                    {won ? `+${formatSol(profit.toString())}` : "…"}
                  </span>
                </li>
              );
            })}
        </ul>
      </section>

      <section className="glass-panel dash-rail-section">
        <div className="dash-rail-head">
          <h2>Leaderboard</h2>
          <div className="dash-tabs">
            <button
              type="button"
              className={lbTab === "weekly" ? "on" : ""}
              onClick={() => setLbTab("weekly")}
            >
              Weekly
            </button>
            <button
              type="button"
              className={lbTab === "all" ? "on" : ""}
              onClick={() => setLbTab("all")}
            >
              All time
            </button>
          </div>
        </div>
        <div className="dash-podium">
          {top3[1] ? (
            <div className="dash-podium-slot silver">
              <span className="podium-medal">🥈</span>
              <WalletBadge label={top3[1].username} accent="#94a3b8" />
              <strong>{top3[1].username}</strong>
              <small>{formatSol(top3[1].volumeLamports)}</small>
            </div>
          ) : (
            <div className="dash-podium-slot silver empty" />
          )}
          {top3[0] ? (
            <div className="dash-podium-slot gold">
              <span className="podium-medal">🥇</span>
              <WalletBadge label={top3[0].username} accent="#fbbf24" />
              <strong>{top3[0].username}</strong>
              <small>{formatSol(top3[0].volumeLamports)}</small>
            </div>
          ) : (
            <div className="dash-podium-slot gold empty" />
          )}
          {top3[2] ? (
            <div className="dash-podium-slot bronze">
              <span className="podium-medal">🥉</span>
              <WalletBadge label={top3[2].username} accent="#d97706" />
              <strong>{top3[2].username}</strong>
              <small>{formatSol(top3[2].volumeLamports)}</small>
            </div>
          ) : (
            <div className="dash-podium-slot bronze empty" />
          )}
        </div>
        <ul className="dash-leader-list">
          {rest.map((p, i) => (
            <li key={p.wallet}>
              <span className="rank-num">{i + 4}</span>
              <WalletBadge label={p.username} />
              <strong>{p.username}</strong>
              <em>{formatSol(p.volumeLamports)}</em>
            </li>
          ))}
        </ul>
        <Link href="/leaderboard" className="btn-dash-outline btn-block">
          View full leaderboard
        </Link>
      </section>
    </aside>
  );
}
