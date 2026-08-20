"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GameIcon } from "@/components/GameIcon";
import { useWeeklyCountdown } from "./useWeeklyCountdown";

const NAV = [
  { href: "/", label: "Dashboard", icon: "dashboard" as const, match: (p: string) => p === "/" },
  {
    href: "/circles",
    label: "Play Game",
    icon: "play" as const,
    match: (p: string) => p === "/circles" || p.startsWith("/duel"),
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: "trophy" as const,
    match: (p: string) => p.startsWith("/leaderboard"),
  },
  {
    href: "/circles",
    label: "Affiliates",
    icon: "affiliates" as const,
    match: () => false,
  },
  {
    href: "/circles",
    label: "Rewards",
    icon: "rewards" as const,
    match: () => false,
  },
  {
    href: "/fair",
    label: "Provably Fair",
    icon: "shield" as const,
    match: (p: string) => p.startsWith("/fair"),
  },
  {
    href: "/history",
    label: "Statistics",
    icon: "stats" as const,
    match: (p: string) => p.startsWith("/history"),
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const countdown = useWeeklyCountdown();

  return (
    <aside className="dash-sidebar">
      <Link href="/" className="dash-brand">
        <span className="dash-brand-icon">
          <GameIcon name="dice" size={22} />
        </span>
        <span className="dash-brand-text">
          ROLL THE <strong>BLOCK</strong>
        </span>
      </Link>

      <nav className="dash-nav">
        {NAV.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`dash-nav-item${item.match(pathname) ? " is-active" : ""}`}
          >
            <GameIcon name={item.icon} size={18} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="dash-race-card">
        <p className="dash-race-tag">Weekly race</p>
        <h3 className="dash-race-pool">250 SOL</h3>
        <p className="dash-race-sub">Prize pool · winner takes leaderboard</p>
        <div className="dash-countdown">
          <div>
            <strong>{countdown.d}</strong>
            <span>Days</span>
          </div>
          <div>
            <strong>{String(countdown.h).padStart(2, "0")}</strong>
            <span>Hours</span>
          </div>
          <div>
            <strong>{String(countdown.m).padStart(2, "0")}</strong>
            <span>Min</span>
          </div>
          <div>
            <strong>{String(countdown.s).padStart(2, "0")}</strong>
            <span>Sec</span>
          </div>
        </div>
        <div className="dash-race-cubes" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <Link href="/leaderboard" className="btn-race">
          View Leaderboard
        </Link>
      </div>

      <div className="dash-sidebar-foot">
        <div className="dash-social">
          <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="Twitter">
            𝕏
          </a>
          <a href="https://discord.com" target="_blank" rel="noreferrer" aria-label="Discord">
            ◎
          </a>
          <a href="https://telegram.org" target="_blank" rel="noreferrer" aria-label="Telegram">
            ✈
          </a>
        </div>
        <button type="button" className="dash-theme-btn" aria-label="Theme">
          ☾
        </button>
      </div>
    </aside>
  );
}
