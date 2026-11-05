"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/WalletButton";
import { GameIcon } from "@/components/GameIcon";
import { CHAIN } from "@/lib/eth/constants";

const NAV = [
  { href: "/circles", label: "Play", match: (p: string) => p === "/circles" || p.startsWith("/duel") },
  { href: "/history", label: "History", match: (p: string) => p.startsWith("/history") },
  { href: "/leaderboard", label: "Leaderboard", match: (p: string) => p.startsWith("/leaderboard") },
  { href: "/fair", label: "Fairness", match: (p: string) => p.startsWith("/fair") },
];

export function DuelNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className={`bd-nav${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="bd-menu-btn"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <GameIcon name={open ? "close" : "menu"} size={20} />
      </button>
      <Link href="/" className="bd-nav-brand">
        BLOCK DICE
      </Link>
      <nav className="bd-nav-links">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={item.match(pathname) ? "is-active" : ""}
            onClick={() => setOpen(false)}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="bd-nav-right">
        <span className="bd-net">
          <i />
          {CHAIN.name}
        </span>
        <WalletButton compact />
      </div>
    </header>
  );
}
