"use client";

import { useCallback, useEffect, useState } from "react";
import { CoolBtn } from "@/components/CoolBtn";
import { GIVEAWAY_USD, rtbUiAmount } from "@/lib/giveaway";
import { getJson, postJson } from "@/lib/http";
import {
  connectSolanaWallet,
  hasSolanaWallet,
  payRtbToDev,
} from "@/lib/solana/pay";
import { shortKey } from "@/lib/format";
import { solscanAccount, solscanTx } from "@/lib/solana/explorer";
import { TOKEN } from "@/lib/token";

type Entry = {
  wallet: string;
  signature: string;
  amount: string;
  usdAtJoin: string;
  createdAt: string;
};

type Quote = {
  usd: number;
  priceUsd: number | null;
  amount: string;
  uiAmount: string;
  dest: string | null;
  configured: boolean;
  me: Entry | null;
};

export function GiveawayPage() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSig, setPendingSig] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);

  const load = useCallback(async (sol?: string | null) => {
    const q = sol ? `?wallet=${sol}` : "";
    const json = await getJson<Quote>(`/api/giveaway${q}`);
    if (json) setQuote(json);
  }, []);

  useEffect(() => {
    setHasWallet(hasSolanaWallet());
    void load(wallet);
    const t = setInterval(() => void load(wallet), 15_000);
    return () => clearInterval(t);
  }, [load, wallet]);

  async function ensureWallet() {
    const next = await connectSolanaWallet();
    setWallet(next);
    setHasWallet(true);
    await load(next);
    return next;
  }

  async function verify(sol: string, signature: string) {
    const json = await postJson<{ me: Entry; already?: boolean }>(
      "/api/giveaway",
      { wallet: sol, signature },
    );
    setQuote((prev) => (prev ? { ...prev, me: json.me } : prev));
    setPendingSig(null);
  }

  async function join() {
    setError(null);
    setBusy(true);
    try {
      const sol = wallet ?? (await ensureWallet());
      if (!quote?.configured || !quote.dest) {
        throw new Error("Giveaway payments are not configured yet");
      }
      if (quote.priceUsd == null || quote.amount === "0") {
        throw new Error(`Could not quote $${TOKEN.symbol} right now. Try again in a moment.`);
      }
      const { signature, wallet: payer } = await payRtbToDev(
        quote.dest,
        BigInt(quote.amount),
      );
      setWallet(payer);
      setPendingSig(signature);
      await verify(payer, signature);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join giveaway");
    } finally {
      setBusy(false);
    }
  }

  async function retryVerify() {
    if (!wallet || !pendingSig) return;
    setError(null);
    setBusy(true);
    try {
      await verify(wallet, pendingSig);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm payment");
    } finally {
      setBusy(false);
    }
  }

  const mine = quote?.me;
  const dest = quote?.dest;
  const priceReady = quote?.priceUsd != null && quote.amount !== "0";

  return (
    <div className="dash-home waitlist-home">
      <section className="glass-panel dash-hero waitlist-hero">
        <div className="waitlist-copy">
          <p className="dash-eyebrow">SOL giveaway</p>
          <h1 className="dash-hero-title">
            JOIN FOR <span className="dash-gradient-text">${GIVEAWAY_USD}</span>
          </h1>
          <p className="dash-hero-sub">
            Pay the project wallet ${GIVEAWAY_USD} worth of ${TOKEN.symbol} from
            Phantom. One entry per Solana wallet. You also need a little SOL
            for network fees.
          </p>
          <ul className="waitlist-play">
            <li>
              <strong>Entry fee is ${GIVEAWAY_USD} in ${TOKEN.symbol}.</strong>
              The live quote updates with the token price. Send that amount
              and you&apos;re in.
            </li>
            <li>
              <strong>Paid to the dev wallet.</strong>
              The transfer is a normal SPL send. We confirm it on-chain before
              locking your seat.
            </li>
            <li>
              <strong>Buy ${TOKEN.symbol} first if you need it.</strong>
              {` `}
              <a href={TOKEN.pumpUrl} target="_blank" rel="noreferrer">
                Open pump.fun
              </a>
            </li>
          </ul>

          <div className="giveaway-meta">
            <div>
              <span>Entry</span>
              <strong>${GIVEAWAY_USD} USD</strong>
            </div>
            <div>
              <span>{`$${TOKEN.symbol} to send`}</span>
              <strong className="giveaway-quote">
                {priceReady ? `${quote?.uiAmount} ${TOKEN.symbol}` : "—"}
              </strong>
            </div>
            <div>
              <span>Dev wallet</span>
              {dest ? (
                <a
                  className="giveaway-dest"
                  href={solscanAccount(dest)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortKey(dest, 6, 6)}
                </a>
              ) : (
                <strong>Not set</strong>
              )}
            </div>
          </div>

          {mine ? (
            <div className="waitlist-pass">
              <p className="kicker">You&apos;re in</p>
              <h2>Giveaway entry locked</h2>
              <p className="muted">
                {rtbUiAmount(BigInt(mine.amount))} ${TOKEN.symbol} from{" "}
                {shortKey(mine.wallet, 4, 4)}.{" "}
                <a href={solscanTx(mine.signature)} target="_blank" rel="noreferrer">
                  View payment
                </a>
              </p>
            </div>
          ) : (
            <div className="waitlist-form">
              {wallet ? (
                <p className="muted">
                  Paying from {shortKey(wallet, 4, 4)}
                </p>
              ) : null}
              {error ? <p className="err">{error}</p> : null}
              {quote && !quote.configured ? (
                <p className="warn">
                  Entry payments aren&apos;t configured yet. Check back soon.
                </p>
              ) : null}
              {pendingSig ? (
                <CoolBtn
                  pulse={!busy}
                  disabled={busy}
                  onClick={() => void retryVerify()}
                >
                  {busy ? "Confirming…" : "I already paid — confirm"}
                </CoolBtn>
              ) : (
                <CoolBtn
                  pulse={!busy}
                  disabled={busy || !quote?.configured || !priceReady}
                  onClick={() => void join()}
                >
                  {busy
                    ? "Paying…"
                    : !quote
                      ? "Loading quote…"
                      : !hasWallet && !wallet
                        ? "Connect Phantom & pay"
                        : `Pay ${priceReady ? quote.uiAmount : "—"} $${TOKEN.symbol}`}
                </CoolBtn>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
