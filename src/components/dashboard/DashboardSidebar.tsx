"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GameIcon } from "@/components/GameIcon";
import { PLAY_LOCKED } from "@/lib/waitlist";

const NAV = [
  {
    href: "/",
    label: "Dashboard",
    icon: "dashboard" as const,
    match: (p: string) => p === "/",
    locked: false,
  },
  {
    href: PLAY_LOCKED ? "/" : "/circles",
    label: "Play Game",
    icon: "play" as const,
    match: (p: string) => p === "/circles" || p.startsWith("/duel"),
    locked: PLAY_LOCKED,
  },
  {
    href: PLAY_LOCKED ? "/" : "/leaderboard",
    label: "Leaderboard",
    icon: "trophy" as const,
    match: (p: string) => p.startsWith("/leaderboard"),
    locked: PLAY_LOCKED,
  },
  {
    href: "/",
    label: "Affiliates",
    icon: "affiliates" as const,
    match: () => false,
    locked: true,
  },
  {
    href: "/",
    label: "Rewards",
    icon: "rewards" as const,
    match: () => false,
    locked: true,
  },
  {
    href: "/fair",
    label: "Provably Fair",
    icon: "shield" as const,
    match: (p: string) => p.startsWith("/fair"),
    locked: false,
  },
  {
    href: PLAY_LOCKED ? "/" : "/history",
    label: "Statistics",
    icon: "stats" as const,
    match: (p: string) => p.startsWith("/history"),
    locked: PLAY_LOCKED,
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();

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
        {NAV.map((item) => {
          const className = `dash-nav-item${item.match(pathname) ? " is-active" : ""}${item.locked ? " is-locked" : ""}`;
          const inner = (
            <>
              <GameIcon name={item.icon} size={18} />
              <span>{item.label}</span>
              {item.locked ? <em className="nav-lock">Locked</em> : null}
            </>
          );
          if (item.locked) {
            return (
              <span key={item.label} className={className} aria-disabled>
                {inner}
              </span>
            );
          }
          return (
            <Link key={item.label} href={item.href} className={className}>
              {inner}
            </Link>
          );
        })}
      </nav>

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
