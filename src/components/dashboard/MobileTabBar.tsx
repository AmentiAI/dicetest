"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GameIcon } from "@/components/GameIcon";
import { PLAY_LOCKED } from "@/lib/waitlist";

const TABS = [
  { href: "/", label: "Home", icon: "dashboard" as const, match: (p: string) => p === "/" },
  {
    href: PLAY_LOCKED ? "/" : "/circles",
    label: "Play",
    icon: "play" as const,
    match: (p: string) => p === "/circles" || p.startsWith("/duel"),
    locked: PLAY_LOCKED,
  },
  { href: "/fair", label: "Fair", icon: "shield" as const, match: (p: string) => p.startsWith("/fair") },
  {
    href: PLAY_LOCKED ? "/" : "/history",
    label: "Stats",
    icon: "stats" as const,
    match: (p: string) => p.startsWith("/history") || p.startsWith("/leaderboard"),
    locked: PLAY_LOCKED,
  },
];

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="mobile-tabbar" aria-label="Primary">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        const className = `mobile-tab${active ? " is-active" : ""}${tab.locked ? " is-locked" : ""}`;
        if (tab.locked) {
          return (
            <span key={tab.label} className={className} aria-disabled>
              <GameIcon name={tab.icon} size={20} />
              <em>{tab.label}</em>
            </span>
          );
        }
        return (
          <Link key={tab.label} href={tab.href} className={className}>
            <GameIcon name={tab.icon} size={20} />
            <em>{tab.label}</em>
          </Link>
        );
      })}
    </nav>
  );
}
