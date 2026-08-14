"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getJson } from "@/lib/http";
import { SOLANA_NETWORK } from "@/lib/solana/constants";

type Stats = {
  players: number;
  waiting: number;
  locked: number;
  settled: number;
  programDeployed: boolean;
};

export function LandingPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const json = await getJson<Stats>("/api/stats");
      if (!stop && json) setStats(json);
    };
    void tick();
    const t = setInterval(() => void tick(), 8000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const circles = (stats?.waiting ?? 0) + (stats?.locked ?? 0);

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <h1 className="hero-title">
            {"BLOCK DICE".split("").map((ch, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.06}s` }}>
                {ch === " " ? "\u00a0" : ch}
              </span>
            ))}
          </h1>
          <p className="tagline">
            STREET DICE. ON-CHAIN PROOF. NO HIDDEN ROLLS.
          </p>
          <p className="lede">
            Enter the circle, lock a 1v1 SOL wager, and verify every result
            through a future Solana slot hash. Winner takes the full pot. No
            house cut.
          </p>
          <div className="hero-actions">
            <Link href="/circles" className="btn-ember btn-wide">
              Enter the Circle
            </Link>
            <Link href="/fair" className="btn-ghost btn-wide">
              Verify a Roll
            </Link>
          </div>
          <div className="hero-stats">
            <div>
              <span>Online</span>
              <b>{stats?.players ?? "—"}</b>
            </div>
            <div>
              <span>Circles</span>
              <b>{stats ? circles : "—"}</b>
            </div>
            <div>
              <span>Verified rolls</span>
              <b>{stats?.settled ?? "—"}</b>
            </div>
            <div>
              <span>Network</span>
              <b className="ok">
                <i className="live-dot" /> {SOLANA_NETWORK === "mainnet-beta" ? "Mainnet" : "Live"}
              </b>
            </div>
          </div>
        </div>
        <HeroDice />
      </section>

      <section className="feature-grid">
        <article>
          <div className="feat-icon">⬡</div>
          <h3>Provably fair rolls</h3>
          <p>Every roll is derived from Solana SlotHashes after both wagers lock.</p>
        </article>
        <article>
          <div className="feat-icon">☰</div>
          <h3>1v1 winner takes all</h3>
          <p>Two wallets, one pot. Higher die wins. Zero rake. Ties re-hash.</p>
        </article>
        <article>
          <div className="feat-icon">◎</div>
          <h3>Public dice circles</h3>
          <p>Join a live circle or open a private match with a SOL wager.</p>
        </article>
        <article>
          <div className="feat-icon">▣</div>
          <h3>On-chain receipts</h3>
          <p>Inspect the PDA, slot, hash, and explorer tx behind every settle.</p>
        </article>
      </section>
    </div>
  );
}

function HeroDice() {
  const [left, setLeft] = useState(5);
  const [right, setRight] = useState(2);
  const [flip, setFlip] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setLeft(1 + Math.floor(Math.random() * 6));
      setRight(1 + Math.floor(Math.random() * 6));
      setFlip((v) => !v);
    }, 1600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="hero-art" aria-hidden>
      <div className="orbit orbit-a">
        <span>HASH · SLOT</span>
        <span>NO HOUSE</span>
      </div>
      <div className="orbit orbit-b">
        <span>BLOCK</span>
        <span>1V1 POT</span>
      </div>
      <div className="hero-burst" />
      <div className={`glow-dice ${flip ? "is-flip" : ""}`}>
        <div className="gd gd-left">
          <span key={left}>{left}</span>
        </div>
        <div className="vs-flash">VS</div>
        <div className="gd gd-right">
          <span key={right}>{right}</span>
        </div>
      </div>
    </div>
  );
}
