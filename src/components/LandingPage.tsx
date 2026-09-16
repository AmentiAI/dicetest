"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { CubeDie } from "@/components/CubeDie";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { WalletBadge } from "@/components/WalletBadge";
import { GameIcon } from "@/components/GameIcon";
import { CoolBtn } from "@/components/CoolBtn";
import { MiniDie } from "@/components/dashboard/MiniDie";
import { formatEth, formatUsd, shortKey } from "@/lib/format";
import { getJson } from "@/lib/http";
import { MAX_WAGER_ETH, MIN_WAGER_ETH } from "@/lib/eth/constants";
import type { GlassDieTone } from "@/lib/cosmetics";

type Stats = {
  players: number;
  waiting: number;
  locked: number;
  settled: number;
  lockedPotLamports?: string;
};

type RoomRow = {
  id: string;
  status: string;
  wagerLamports: string;
  hostRoll: number | null;
  challengerRoll: number | null;
  winnerWallet: string | null;
  hostWallet: string;
  challengerWallet: string | null;
  host: { username: string } | null;
  challenger: { username: string } | null;
  updatedAt?: string;
};

const HERO_DICE: GlassDieTone[] = ["glass-purple", "glass-green", "glass-orange"];

const PREVIEW_ROLLS = [
  { name: "Nova", bet: "1.20 ETH", usd: "$214.80", a: 6, b: 5, profit: "+1.20 ETH", win: true },
  { name: "Kite", bet: "0.50 ETH", usd: "$89.50", a: 2, b: 4, profit: "-0.50 ETH", win: false },
  { name: "Riven", bet: "2.00 ETH", usd: "$358.00", a: 5, b: 3, profit: "+2.00 ETH", win: true },
  { name: "Ash", bet: "0.25 ETH", usd: "$44.75", a: 1, b: 6, profit: "-0.25 ETH", win: false },
  { name: "Lux", bet: "0.80 ETH", usd: "$143.20", a: 5, b: 2, profit: "+0.80 ETH", win: true },
];

function clampWager(n: number, max: number) {
  return Math.min(MAX_WAGER_ETH, Math.max(MIN_WAGER_ETH, n));
}

export function LandingPage() {
  const { address } = useAccount();
  const { data: bal } = useBalance({ address });
  const [stats, setStats] = useState<Stats | null>(null);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [price, setPrice] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [wager, setWager] = useState("0.05");

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const [statsRes, roomsRes, priceRes] = await Promise.all([
        getJson<Stats>("/api/stats"),
        getJson<{ rooms: RoomRow[] }>("/api/rooms"),
        getJson<{ usd: number | null }>("/api/price"),
      ]);
      if (stop) return;
      if (statsRes) setStats(statsRes);
      setRooms(roomsRes?.rooms ?? []);
      setPrice(priceRes?.usd ?? null);
    };
    void tick();
    const t = setInterval(() => void tick(), 15_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    setBalance(bal ? Number(bal.formatted) : null);
  }, [bal]);

  const settled = useMemo(
    () => rooms.filter((r) => r.status === "settled").slice(0, 12),
    [rooms],
  );

  const totals = useMemo(() => {
    let wagered = 0n;
    let paid = 0n;
    let biggestToday = 0n;
    const today = new Date().toDateString();
    for (const r of rooms) {
      const w = BigInt(r.wagerLamports);
      wagered += w * 2n;
      if (r.status === "settled") paid += w * 2n;
      if (r.status === "settled" && r.updatedAt) {
        const d = new Date(r.updatedAt);
        if (d.toDateString() === today && w > biggestToday) biggestToday = w;
      } else if (r.status === "settled" && w > biggestToday) {
        biggestToday = w;
      }
    }
    return { wagered, paid, biggestToday };
  }, [rooms]);

  const wagerNum = Number(wager);
  const wagerValid = Number.isFinite(wagerNum) && wagerNum >= MIN_WAGER_ETH;
  const maxBal = balance ?? MAX_WAGER_ETH;

  function setWagerClamped(n: number) {
    setWager(String(clampWager(n, maxBal)));
  }

  return (
    <div className="dash-home">
      <section className="glass-panel dash-hero">
        <div className="dash-hero-grid">
          <div className="dash-hero-visual">
            <div className="dice-platform">
              <div className="dice-platform-ring" />
              <div className="dice-platform-glow" />
              <div className="dice-platform-base" />
              <div className="dice-platform-grid">
                {HERO_DICE.map((tone) => (
                  <CubeDie key={tone} tone={tone} orbit />
                ))}
              </div>
            </div>
          </div>

          <div className="dash-hero-panel">
            <h1 className="dash-hero-title">
              ROLL THE <span className="dash-gradient-text">BLOCK</span>
            </h1>
            <p className="dash-hero-sub">
              Connect MetaMask, Rainbow, Coinbase, or Robinhood. Equip a Block
              Dice NFT as your character. Bet ETH, the NFT, or both — higher
              roll takes the pot.
            </p>

            <div className="dash-bet-block">
              <label className="dash-field dash-field-wide">
                <span>Bet amount</span>
                <div className="dash-bet-input-wrap">
                  <span className="dash-sol-icon">
                    <GameIcon name="eth" size={18} />
                  </span>
                  <input
                    type="number"
                    min={MIN_WAGER_ETH}
                    max={MAX_WAGER_ETH}
                    step="0.001"
                    value={wager}
                    onChange={(e) => setWager(e.target.value)}
                  />
                  <span className="dash-bet-usd">
                    {wagerValid ? formatUsd(wagerNum, price) : "—"}
                  </span>
                </div>
                <div className="dash-quick-btns">
                  {[
                    { label: "Min", fn: () => setWagerClamped(MIN_WAGER_ETH) },
                    { label: "½", fn: () => setWagerClamped(wagerNum / 2) },
                    { label: "2×", fn: () => setWagerClamped(wagerNum * 2) },
                    { label: "Max", fn: () => setWagerClamped(maxBal) },
                  ].map((b) => (
                    <button key={b.label} type="button" onClick={b.fn}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </label>

              <div className="dash-bet-row">
                <label className="dash-field">
                  <span>Prediction</span>
                  <div className="dash-select">
                    <select defaultValue="higher">
                      <option value="higher">HIGHER ROLL WINS</option>
                    </select>
                  </div>
                </label>
                <label className="dash-field">
                  <span>Payout</span>
                  <div className="dash-payout-box">
                    <strong>2.00×</strong>
                  </div>
                </label>
              </div>
            </div>

            <CoolBtn
              href={wagerValid ? `/circles?wager=${wager}` : "/circles"}
              className="btn-roll"
              pulse
            >
              <GameIcon name="dice" size={22} />
              <span className="btn-roll-text">
                <strong>ROLL DICE</strong>
                <small>Enter lobby to match &amp; roll on Ethereum</small>
              </span>
            </CoolBtn>
          </div>
        </div>
      </section>

      <section className="dash-stats-row">
        {[
          {
            label: "Total wagered",
            value: totals.wagered,
            icon: "purple",
            sub: price ? formatUsd(Number(totals.wagered) / 1e18, price) : null,
          },
          {
            label: "Total paid out",
            value: totals.paid,
            icon: "green",
            sub: price ? formatUsd(Number(totals.paid) / 1e18, price) : null,
          },
          {
            label: "Total players",
            value: stats?.players ?? null,
            icon: "blue",
            sub: "All time",
          },
          {
            label: "Biggest win",
            value: totals.biggestToday,
            icon: "orange",
            sub: "Today",
          },
        ].map((s) => (
          <article key={s.label} className={`glass-panel dash-stat tone-${s.icon}`}>
            <span className={`dash-stat-badge badge-${s.icon}`}>
              {s.icon === "purple" && "◆"}
              {s.icon === "green" && "◎"}
              {s.icon === "blue" && "◉"}
              {s.icon === "orange" && "★"}
            </span>
            <p className="dash-stat-label">{s.label}</p>
            <p className="dash-stat-value">
              {s.value == null ? (
                "—"
              ) : typeof s.value === "number" ? (
                <AnimatedNumber value={s.value} format={(n) => String(Math.round(n))} />
              ) : Number(s.value) === 0 ? (
                "0.00 ETH"
              ) : (
                `${(Number(s.value) / 1e18).toFixed(2)} ETH`
              )}
            </p>
            <p className="dash-stat-sub">{s.sub ?? "\u00a0"}</p>
          </article>
        ))}
      </section>

      <section className="glass-panel dash-table-section">
        <div className="dash-table-head">
          <h2>Recent rolls</h2>
          <Link href="/history">View all</Link>
        </div>
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Bet</th>
                <th>Prediction</th>
                <th>Roll</th>
                <th>Payout</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {settled.length === 0
                ? PREVIEW_ROLLS.map((r) => (
                    <tr key={r.name}>
                      <td>
                        <div className="dash-table-player">
                          <WalletBadge label={r.name} accent="#8b5cf6" />
                          <div>
                            <strong>{r.name}</strong>
                            <span>@{r.name.toLowerCase()}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{r.bet}</strong>
                        <span className="cell-sub">{r.usd}</span>
                      </td>
                      <td>
                        <span className={`pred-badge${r.win ? "" : " loss"}`}>
                          HIGHER ROLL
                        </span>
                      </td>
                      <td>
                        <span className="dash-roll-pips">
                          <MiniDie value={r.a} tone="purple" />
                          <MiniDie value={r.b} tone="green" />
                        </span>
                      </td>
                      <td className="payout-cell">2.00×</td>
                      <td className={r.win ? "profit-win" : "profit-loss"}>
                        {r.profit}
                      </td>
                    </tr>
                  ))
                : settled.map((r) => {
                  const winnerWallet = r.winnerWallet;
                  const winner =
                    winnerWallet === r.hostWallet
                      ? r.host
                      : winnerWallet === r.challengerWallet
                        ? r.challenger
                        : null;
                  const profit = BigInt(r.wagerLamports);
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="dash-table-player">
                          <WalletBadge
                            label={winner?.username ?? "?"}
                            accent="#8b5cf6"
                          />
                          <div>
                            <strong>
                              {winner?.username ??
                                shortKey(winnerWallet ?? r.id, 4, 4)}
                            </strong>
                            <span>@{winner?.username ?? "player"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{formatEth(r.wagerLamports)}</strong>
                        <span className="cell-sub">
                          {formatUsd(Number(r.wagerLamports) / 1e18, price)}
                        </span>
                      </td>
                      <td>
                        <span className="pred-badge">HIGHER ROLL</span>
                      </td>
                      <td>
                        <span className="dash-roll-pips">
                          <MiniDie value={r.hostRoll} tone="purple" />
                          <MiniDie value={r.challengerRoll} tone="green" />
                        </span>
                      </td>
                      <td className="payout-cell">2.00×</td>
                      <td className="profit-win">
                        +{formatEth(profit.toString())}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
