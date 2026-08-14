"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "./WalletButton";
import { IdentityModal } from "./IdentityModal";
import { ProfileProvider, useProfile } from "./ProfileProvider";
import { formatUsd } from "@/lib/format";
import { getJson } from "@/lib/http";
import { SOLANA_NETWORK } from "@/lib/solana/constants";

const LINKS = [
  { href: "/circles", label: "Play" },
  { href: "/circles", label: "Dice Circles" },
  { href: "/history", label: "Match History" },
  { href: "/how-to-play", label: "How to Play" },
  { href: "/fair", label: "Provably Fair" },
];

function Header() {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { profile } = useProfile();
  const [balance, setBalance] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [sound, setSound] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("blockdice-sound");
    if (stored === "0") setSound(false);
  }, []);

  useEffect(() => {
    void getJson<{ usd: number | null }>("/api/price").then((j) =>
      setPrice(j?.usd ?? null),
    );
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
        /* wallet/extension fetch interceptors sometimes throw here */
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 10000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [publicKey, connection]);

  const sol = balance != null ? balance / LAMPORTS_PER_SOL : null;

  return (
    <header className="topbar">
      <Link href="/" className="logo" onClick={() => setOpen(false)}>
        <span className="logo-die" aria-hidden>
          ⚄
        </span>
        BLOCK DICE
      </Link>

      <nav className={`topnav ${open ? "open" : ""}`}>
        {LINKS.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            className={pathname === l.href || (l.href === "/circles" && pathname.startsWith("/duel")) ? "on" : ""}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="top-actions">
        <span className="net-pill">
          Solana {SOLANA_NETWORK === "mainnet-beta" ? "Mainnet" : "Devnet"}
        </span>
        {sol != null ? (
          <span className="bal-pill" title={formatUsd(sol, price)}>
            {sol.toLocaleString(undefined, { maximumFractionDigits: 3 })} SOL
          </span>
        ) : null}
        {profile ? <span className="name-pill">{profile.username}</span> : null}
        <button
          className={`icon-btn ${sound ? "on" : ""}`}
          aria-label={sound ? "Mute" : "Unmute"}
          onClick={() => {
            const next = !sound;
            setSound(next);
            localStorage.setItem("blockdice-sound", next ? "1" : "0");
          }}
        >
          {sound ? "🔊" : "🔇"}
        </button>
        <WalletButton compact />
        {SOLANA_NETWORK !== "mainnet-beta" && publicKey ? (
          <button
            className="btn-ghost btn-compact"
            onClick={() => void connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL)}
          >
            Airdrop
          </button>
        ) : null}
        <button className="menu-btn" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
          ☰
        </button>
      </div>
    </header>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const { publicKey } = useWallet();
  const { profile } = useProfile();
  const needIdentity = Boolean(publicKey && !profile);

  return (
    <div className="app-frame">
      <SparkField />
      <Header />
      <main className="stage">{children}</main>
      {needIdentity ? <IdentityModal /> : null}
    </div>
  );
}

function SparkField() {
  return (
    <div className="fx-layer" aria-hidden>
      <div className="fx-aurora" />
      <div className="fx-grid" />
      <div className="fx-scan" />
      <div className="fx-sparks">
        {Array.from({ length: 22 }, (_, i) => (
          <i
            key={i}
            style={{
              left: `${(i * 17 + 3) % 98}%`,
              animationDelay: `${(i * 0.41) % 9}s`,
              animationDuration: `${6 + (i % 6)}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <ShellInner>{children}</ShellInner>
    </ProfileProvider>
  );
}
