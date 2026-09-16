"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatEth, formatUsd, shortKey } from "@/lib/format";
import { getJson } from "@/lib/http";
import { CreateDuel } from "./CreateDuel";
import { useProfile } from "./ProfileProvider";
import { ARENAS, type Arena } from "@/lib/cosmetics";
import { DiceNftBadge } from "./NftPicker";

type RoomRow = {
  id: string;
  hostWallet: string;
  wagerLamports: string;
  status: string;
  hostNftId: string | null;
  arena: Arena | null;
  host: { username: string; nftTokenId: string | null } | null;
};

export function RoomBrowser() {
  const { profile } = useProfile();
  const searchParams = useSearchParams();
  const initialWager = searchParams.get("wager") ?? undefined;
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [q, setQ] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [arenaFilter, setArenaFilter] = useState<"all" | "alley" | "rooftop" | "underpass">("all");
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
      if (arenaFilter !== "all" && r.arena?.id !== arenaFilter) return false;
      if (!needle) return true;
      return (
        r.host?.username.toLowerCase().includes(needle) ||
        r.hostWallet.toLowerCase().includes(needle) ||
        r.id.toLowerCase().includes(needle) ||
        r.arena?.name.toLowerCase().includes(needle)
      );
    });
  }, [rooms, q, filter, arenaFilter]);

  return (
    <div className="dash-page">
      {stats && stats.programDeployed === false ? (
        <div className="notice notice-warn">
          Escrow contracts are not deployed — set NEXT_PUBLIC_DUEL_ADDRESS and
          NEXT_PUBLIC_NFT_ADDRESS after <code>forge script</code>.
        </div>
      ) : null}

      <header className="dash-page-head">
        <div>
          <p className="dash-eyebrow">1v1 lobby</p>
          <h1>Play game</h1>
          <p className="muted">Host or join a 1v1. Bet ETH, a dice NFT, or both.</p>
        </div>
        {profile ? <CreateDuel initialWager={initialWager} /> : <p className="muted">Connect wallet to host.</p>}
      </header>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search host or duel…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="chip-row">
          <button
            type="button"
            className={`chip ${filter === "open" ? "on" : ""}`}
            onClick={() => setFilter("open")}
          >
            Waiting
          </button>
          <button
            type="button"
            className={`chip ${filter === "all" ? "on" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
        </div>
        <div className="chip-row">
          <button
            type="button"
            className={`chip ${arenaFilter === "all" ? "on" : ""}`}
            onClick={() => setArenaFilter("all")}
          >
            All arenas
          </button>
          {ARENAS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`chip env-${a.id} ${arenaFilter === a.id ? "on" : ""}`}
              onClick={() => setArenaFilter(a.id)}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>

      <div className="room-list">
        {shown.length === 0 ? (
          <div className="empty">No circles {filter === "open" ? "waiting" : "yet"}.</div>
        ) : (
          shown.map((r) => {
            const eth = Number(r.wagerLamports) / 1e18;
            const arena = r.arena;
            return (
              <Link
                key={r.id}
                href={`/duel/${r.id}`}
                className={`glass-panel room-card env-${arena?.id ?? "alley"}`}
              >
                <span className="room-arena-chip">{arena?.name ?? "Arena"}</span>
                <div className="room-main">
                  <div className="room-top">
                    <h3>{r.host?.username ?? shortKey(r.hostWallet)}</h3>
                    <span className={`badge ${r.status}`}>{r.status}</span>
                  </div>
                  <p className="muted">{shortKey(r.hostWallet)}</p>
                  <DiceNftBadge tokenId={r.host?.nftTokenId} />
                  {r.hostNftId && r.hostNftId !== r.host?.nftTokenId ? (
                    <DiceNftBadge tokenId={r.hostNftId} staked />
                  ) : null}
                </div>
                <div className="room-wager">
                  <b className="gold">
                    {Number(r.wagerLamports) === 0 && r.hostNftId
                      ? "NFT stake"
                      : formatEth(r.wagerLamports)}
                  </b>
                  <span>{formatUsd(eth, price)}</span>
                </div>
                <span className="join-cta">
                  {r.status === "waiting" ? "Join" : "View"}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
