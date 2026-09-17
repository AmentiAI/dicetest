"use client";

import { useEffect, useState } from "react";
import { CoolBtn } from "@/components/CoolBtn";
import { NftMysterySlider } from "@/components/NftMysterySlider";
import { WalletButton } from "@/components/WalletButton";
import { getJson, postJson } from "@/lib/http";
import { useEthWallet } from "@/lib/eth/wallet";
import { WAITLIST_CAP, normalizeXHandle, waitlistMessage } from "@/lib/waitlist";

type WaitlistState = {
  taken: number;
  cap: number;
  remaining: number;
  full: boolean;
  me: { slot: number; xHandle: string } | null;
};

export function WaitlistHome() {
  const { address, connected, openConnectModal, signMessage } = useEthWallet();
  const [handle, setHandle] = useState("");
  const [state, setState] = useState<WaitlistState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const q = address ? `?wallet=${address}` : "";
      const json = await getJson<WaitlistState>(`/api/waitlist${q}`);
      if (!stop && json) setState(json);
    };
    void tick();
    const t = setInterval(() => void tick(), 12_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [address]);

  const taken = state?.taken ?? 0;
  const remaining = state?.remaining ?? WAITLIST_CAP;
  const pct = Math.min(100, (taken / WAITLIST_CAP) * 100);
  const mine = state?.me;

  async function join() {
    setError(null);
    if (!address || !connected) {
      openConnectModal();
      return;
    }
    const xHandle = normalizeXHandle(handle);
    if (!xHandle) {
      setError("Enter your X handle (e.g. @ashwalker)");
      return;
    }
    setBusy(true);
    try {
      const message = waitlistMessage(address, xHandle);
      const signatureBase64 = await signMessage(message);
      const json = await postJson<{ slot: number; xHandle: string }>("/api/waitlist", {
        wallet: address,
        xHandle,
        signatureBase64,
      });
      setState((prev) =>
        prev
          ? {
              ...prev,
              me: { slot: json.slot, xHandle: json.xHandle },
              taken: prev.me ? prev.taken : prev.taken + 1,
              remaining: Math.max(0, prev.remaining - (prev.me ? 0 : 1)),
            }
          : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join waitlist");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dash-home waitlist-home">
      <section className="glass-panel dash-hero waitlist-hero">
        <div className="waitlist-copy">
          <p className="dash-eyebrow">Slow Roll whitelist</p>
          <h1 className="dash-hero-title">
            ROLL THE <span className="dash-gradient-text">BLOCK</span>
          </h1>
          <p className="dash-hero-sub">
            Join the Slow Roll whitelist to mint your die. {WAITLIST_CAP.toLocaleString()}{" "}
            slots. Connect an ETH or Robinhood wallet, drop your X handle, and
            claim a number.
          </p>
          <ul className="waitlist-play">
            <li>
              <strong>Whitelist first, then mint.</strong>
              A slot is your pass to mint a Slow Roll dice NFT when the drop
              opens.
            </li>
            <li>
              <strong>$1 each. 5% creator fee.</strong>
              One dollar per die. Secondary sales keep a 5% creator fee. All of
              that revenue goes back into the platform.
            </li>
            <li>
              <strong>Your NFT is your game dice.</strong>
              Equip it in a 1v1 or a free-for-all. It rolls on the table and
              shows on the leaderboard. Wager ETH or the die itself.
            </li>
            <li>
              <strong>No house fee on games.</strong>
              1v1 through free-for-all pots pay out in full. We don&apos;t take a
              cut of the match.
            </li>
          </ul>
          <div className="waitlist-meter">
            <div className="waitlist-meter-top">
              <strong>{taken.toLocaleString()}</strong>
              <span>/ {WAITLIST_CAP.toLocaleString()} claimed</span>
              <em>{remaining.toLocaleString()} left</em>
            </div>
            <div className="waitlist-bar" aria-hidden>
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
          {mine ? (
            <div className="waitlist-pass">
              <p className="kicker">You&apos;re in</p>
              <h2>Slot #{mine.slot}</h2>
              <p className="muted">@{mine.xHandle} is locked to this wallet.</p>
            </div>
          ) : (
            <div className="waitlist-form">
              {!connected ? <WalletButton /> : null}
              <label className="field">
                <span>X handle</span>
                <input
                  value={handle}
                  maxLength={32}
                  placeholder="@yourhandle"
                  autoComplete="off"
                  onChange={(e) => setHandle(e.target.value)}
                />
              </label>
              {error ? <p className="err">{error}</p> : null}
              <CoolBtn
                pulse={!busy}
                disabled={busy || state?.full}
                onClick={() => void join()}
              >
                {busy
                  ? "Signing…"
                  : state?.full
                    ? "Waitlist full"
                    : connected
                      ? "Join whitelist"
                      : "Connect & join"}
              </CoolBtn>
            </div>
          )}
        </div>
        <NftMysterySlider />
      </section>
    </div>
  );
}
