"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatSol, formatUsd, shortKey } from "@/lib/format";
import { getJson } from "@/lib/http";
import { CreateDuel } from "./CreateDuel";
import { DemonPortrait } from "./DemonPortrait";
import { useProfile } from "./ProfileProvider";

type RoomRow = {
  id: string;
  duelId: string;
  hostWallet: string;
  challengerWallet: string | null;
  wagerLamports: string;
  status: string;
  host: { username: string; demon: string } | null;
  challenger: { username: string; demon: string } | null;
};

export function RoomBrowser() {
  const { profile } = useProfile();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [q, setQ] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const [stats, setStats] = useState<{ programDeployed?: boolean } | null>(null);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const [roomsRes, priceRes, statsRes] = await Promise.all([
        getJson<{ rooms: RoomRow[] }>("/api/rooms"),
        getJson<{ usd: number | null }>("/api/price"),
        getJson<{ programDeployed?: boolean }>("/api/stats"),
      ]);
      if (stop) return;
      setRooms(roomsRes?.rooms ?? []);
      setPrice(priceRes?.usd ?? null);
      setStats(statsRes);
    };
    void tick();
    const t = setInterval(() => void tick(), 8_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rooms.filter((r) => {
      if (filter === "open" && r.status !== "waiting") return false;
      if (!needle) return true;
      return (
        r.host?.username.toLowerCase().includes(needle) ||
        r.hostWallet.toLowerCase().includes(needle) ||
        r.id.toLowerCase().includes(needle)
      );
    });
  }, [rooms, q, filter]);

  return (
    <div className="lobby">
      <div className="notice">
        Real SOL. 1v1 circles. Winner takes the full pot. Dice come from a
        future Solana slot hash after both wagers lock.
      </div>
      {stats && stats.programDeployed === false ? (
        <div className="notice">
          On-chain program is in <code>program/</code> but not on this cluster
          yet. Circles, Neon, and wallets work. Escrow lands after{" "}
          <code>anchor deploy</code> — see README.
        </div>
      ) : null}
      <header className="lobby-head">
        <div>
          <p className="kicker">1v1 · winner takes all</p>
          <h1>Dice circles</h1>
          <p className="muted">
            Two wallets, one pot, dice from a future Solana slot hash. No
            operator key. No rake.
          </p>
        </div>
        {profile ? <CreateDuel /> : <p className="muted">Connect + bind a name to host.</p>}
      </header>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search host or PDA…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="chip-row">
          <button className={`chip ${filter === "open" ? "on" : ""}`} onClick={() => setFilter("open")}>
            Waiting
          </button>
          <button className={`chip ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>
            All
          </button>
        </div>
      </div>

      <div className="room-list">
        {shown.length === 0 ? (
          <div className="empty">
            No circles {filter === "open" ? "waiting" : "yet"}. Open one and the
            wager lands in a PDA on Solana.
          </div>
        ) : (
          shown.map((r, i) => {
            const sol = Number(r.wagerLamports) / 1e9;
            return (
              <Link
                href={`/duel/${r.id}`}
                key={r.id}
                className="room-card"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <DemonPortrait id={r.host?.demon ?? "cinder-wraith"} size={52} />
                <div className="room-main">
                  <div className="room-top">
                    <h3>{r.host?.username ?? shortKey(r.hostWallet)}</h3>
                    <span className={`badge ${r.status}`}>{r.status}</span>
                  </div>
                  <p className="muted">
                    {shortKey(r.hostWallet)} · 1 / 2 · PDA {shortKey(r.id, 6, 4)}
                  </p>
                </div>
                <div className="room-wager">
                  <b className="gold">{formatSol(r.wagerLamports)}</b>
                  <span>{formatUsd(sol, price)} each</span>
                </div>
                <span className="join-cta">
                  {r.status === "waiting" ? "Enter" : "Watch"}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
