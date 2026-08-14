"use client";

import "@/lib/polyfill";
import { useMemo, useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { createDuelIx } from "@/lib/solana/instructions";
import { MIN_WAGER_SOL, MAX_WAGER_SOL } from "@/lib/solana/constants";
import { explainChainError, sendIxs } from "@/lib/solana/send";
import { postJson } from "@/lib/http";
import { useProfile } from "./ProfileProvider";

export function CreateDuel() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { profile } = useProfile();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [wager, setWager] = useState("0.05");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lamports = useMemo(() => {
    const n = Number(wager);
    if (!Number.isFinite(n)) return 0n;
    return BigInt(Math.round(n * LAMPORTS_PER_SOL));
  }, [wager]);

  async function create() {
    if (!wallet.publicKey) {
      setError("Connect a wallet first");
      return;
    }
    if (!profile) {
      setError("Bind your identity first");
      return;
    }
    const n = Number(wager);
    if (n < MIN_WAGER_SOL || n > MAX_WAGER_SOL) {
      setError(`Wager must be ${MIN_WAGER_SOL}–${MAX_WAGER_SOL} SOL`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const duelId =
        BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
      const { duel, ix } = createDuelIx({
        host: wallet.publicKey,
        duelId,
        wagerLamports: lamports,
      });
      const sig = await sendIxs({ connection, wallet, ixs: [ix] });
      const json = await postJson<{ room?: { id: string } }>("/api/rooms", {
        pda: duel.toBase58(),
        duelId: duelId.toString(),
        hostWallet: wallet.publicKey.toBase58(),
        wagerLamports: lamports.toString(),
        createSignature: sig,
      });
      if (!json.room) throw new Error("Room record failed");
      router.push(`/duel/${duel.toBase58()}`);
    } catch (e) {
      setError(explainChainError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn-ember btn-compact" onClick={() => setOpen(true)}>
        + Open a circle
      </button>
      {open ? (
        <div className="overlay" onClick={() => !busy && setOpen(false)}>
          <div className="panel create-panel" onClick={(e) => e.stopPropagation()}>
            <p className="kicker">New 1v1</p>
            <h2>Lock a wager</h2>
            <p className="muted">
              Your SOL goes into the circle PDA. A challenger matches it. After
              four slots, SlotHashes rolls both dice. Winner takes the full pot.
              No house cut.
            </p>
            <label className="field">
              <span>Wager (SOL)</span>
              <input
                type="number"
                min={MIN_WAGER_SOL}
                max={MAX_WAGER_SOL}
                step="0.001"
                value={wager}
                onChange={(e) => setWager(e.target.value)}
              />
            </label>
            <div className="chip-row">
              {["0.01", "0.05", "0.1", "0.25", "1"].map((v) => (
                <button key={v} type="button" className="chip" onClick={() => setWager(v)}>
                  {v} SOL
                </button>
              ))}
            </div>
            {error ? <p className="err">{error}</p> : null}
            <div className="row-actions">
              <button className="btn-ghost" disabled={busy} onClick={() => setOpen(false)}>
                Back
              </button>
              <button className="btn-ember" disabled={busy} onClick={() => void create()}>
                {busy ? "Sending…" : "Lock wager on-chain"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
