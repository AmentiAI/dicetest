"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { IdentityModal } from "./IdentityModal";
import { ProfileProvider, useProfile } from "./ProfileProvider";
import { DashboardSidebar } from "./dashboard/DashboardSidebar";
import { DashboardTopbar } from "./dashboard/DashboardTopbar";
import { DashboardRightRail } from "./dashboard/DashboardRightRail";
import { MobileTabBar } from "./dashboard/MobileTabBar";
import { DuelNav } from "./DuelNav";
import { PLAY_LOCKED } from "@/lib/waitlist";
import { useEthWallet } from "@/lib/eth/wallet";

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { address } = useEthWallet();
  const { profile } = useProfile();
  const [navOpen, setNavOpen] = useState(false);
  const needIdentity = Boolean(
    address && !profile && !pathname.startsWith("/admin") && !PLAY_LOCKED,
  );
  const showRail = !PLAY_LOCKED && (pathname === "/" || pathname === "/circles");
  const isDuel = pathname.startsWith("/duel");

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  if (isDuel) {
    return (
      <div className="bd-app">
        <DuelNav />
        <div className="bd-stage">{children}</div>
        {needIdentity ? <IdentityModal /> : null}
      </div>
    );
  }

  return (
    <div className={`dash-app${navOpen ? " nav-open" : ""}`}>
      <div className="dash-layout">
        <button
          type="button"
          className="dash-nav-backdrop"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
        <DashboardSidebar onNavigate={() => setNavOpen(false)} />
        <div className="dash-content">
          <DashboardTopbar onMenu={() => setNavOpen(true)} />
          <div className={`dash-body${showRail ? "" : " no-rail"}`}>
            <main className={`dash-main${showRail ? "" : " dash-main-wide"}`}>
              {children}
            </main>
            {showRail ? <DashboardRightRail /> : null}
          </div>
        </div>
      </div>
      <MobileTabBar />
      {needIdentity ? <IdentityModal /> : null}
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
