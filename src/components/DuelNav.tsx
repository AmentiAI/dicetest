"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/WalletButton";
import { SOLANA_NETWORK } from "@/lib/solana/constants";

const NAV = [
  { href: "/circles", label: "Play", match: (p: string) => p === "/circles" || p.startsWith("/duel") },
  { href: "/history", label: "History", match: (p: string) => p.startsWith("/history") },
  { href: "/leaderboard", label: "Leaderboard", match: (p: string) => p.startsWith("/leaderboard") },
  { href: "/fair", label: "Fairness", match: (p: string) => p.startsWith("/fair") },
];

export function DuelNav() {
  const pathname = usePathname();
  return (
    <header className="bd-nav">
      <Link href="/" className="bd-nav-brand">
        BLOCK DICE
      </Link>
      <nav className="bd-nav-links">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={item.match(pathname) ? "is-active" : ""}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="bd-nav-right">
        <span className="bd-net">
          <i />
          {SOLANA_NETWORK === "mainnet-beta" ? "Mainnet" : "Devnet"}
        </span>
        <WalletButton compact />
      </div>
    </header>
  );
}
