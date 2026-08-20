"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { IdentityModal } from "./IdentityModal";
import { ProfileProvider, useProfile } from "./ProfileProvider";
import { DashboardSidebar } from "./dashboard/DashboardSidebar";
import { DashboardTopbar } from "./dashboard/DashboardTopbar";
import { DashboardRightRail } from "./dashboard/DashboardRightRail";
import { DuelNav } from "./DuelNav";
import { useWallet } from "@solana/wallet-adapter-react";

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const { profile } = useProfile();
  const needIdentity = Boolean(
    publicKey && !profile && !pathname.startsWith("/admin"),
  );
  const showRail = pathname === "/" || pathname === "/circles";
  const isDuel = pathname.startsWith("/duel");

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
    <div className="dash-app">
      <div className="dash-layout">
        <DashboardSidebar />
        <div className="dash-content">
          <DashboardTopbar />
          <div className={`dash-body${showRail ? "" : " no-rail"}`}>
            <main className={`dash-main${showRail ? "" : " dash-main-wide"}`}>
              {children}
            </main>
            {showRail ? <DashboardRightRail /> : null}
          </div>
        </div>
      </div>
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
