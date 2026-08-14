"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  cancelIx,
  createDuelIx,
  joinDuelIx,
  refundExpiredIx,
  settleIx,
} from "@/lib/solana/instructions";
import {
  explorerAccount,
  explorerSlot,
  explorerTx,
  MAX_WAGER_SOL,
  MIN_WAGER_SOL,
  REVEAL_DELAY_SLOTS,
} from "@/lib/solana/constants";
import { formatSol, formatUsd, shortKey, solToLamports } from "@/lib/format";
import { getJson, postJson } from "@/lib/http";
import { explainChainError, sendIxs } from "@/lib/solana/send";
import { DemonPortrait } from "./DemonPortrait";
import { DiceFace } from "./DiceFace";
import { ChatPanel } from "./ChatPanel";
import { useProfile } from "./ProfileProvider";

type RoomPayload = {
  room: {
    id: string;
    duelId: string;
    hostWallet: string;
    challengerWallet: string | null;
    wagerLamports: string;
    status: string;
    commitSlot: string | null;
    revealSlot: string | null;
    hostRoll: number | null;
    challengerRoll: number | null;
    winnerWallet: string | null;
    slotHash: string | null;
    createSignature: string;
    joinSignature: string | null;
    settleSignature: string | null;
  };
  host: { username: string; demon: string; wins: number; losses: number } | null;
  challenger: { username: string; demon: string; wins: number; losses: number } | null;
  rematch?: {
    pda: string;
    hostWallet: string;
    duelId: string;
    wagerLamports: string;
    status: string;
  } | null;
};

type SlotPayload = {
  slot: number;
  revealSlot?: string;
  hashReady?: boolean;
  expired?: boolean;
  preview?: { hostRoll: number; challengerRoll: number; slotHash: string } | null;
  winner?: string | null;
  hostRoll?: number | null;
  challengerRoll?: number | null;
};

export function DuelArena({ pda }: { pda: string }) {
  const wallet = useWallet();
  const { publicKey } = wallet;
  const { connection } = useConnection();
  const { profile } = useProfile();
  const router = useRouter();
  const [data, setData] = useState<RoomPayload | null>(null);
  const [slot, setSlot] = useState<SlotPayload | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rematchOpen, setRematchOpen] = useState(false);
  const [rematchWager, setRematchWager] = useState("0.05");

  const load = useCallback(async () => {
    try {
      const [room, slotJson, priceJson] = await Promise.all([
        getJson<RoomPayload>(`/api/rooms/${pda}`),
        getJson<SlotPayload>(`/api/slot?pda=${pda}`),
        getJson<{ usd: number | null }>("/api/price"),
      ]);
      if (room) setData(room);
      if (slotJson) setSlot(slotJson);
      if (priceJson) setPrice(priceJson.usd ?? null);
    } catch {
      /* ignore extension-intercepted fetch */
    }
  }, [pda]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 2000);
    return () => clearInterval(t);
  }, [load]);

  const me = publicKey?.toBase58();
  const room = data?.room;
  const isHost = Boolean(me && room && me === room.hostWallet);
  const isChallenger = Boolean(me && room && me === room.challengerWallet);
  const inDuel = isHost || isChallenger;

  const hostRoll = room?.hostRoll ?? slot?.preview?.hostRoll ?? null;
  const challengerRoll = room?.challengerRoll ?? slot?.preview?.challengerRoll ?? null;
  const hashReady = Boolean(slot?.hashReady);
  const expired = Boolean(slot?.expired);
  const settled = room?.status === "settled";
  const waiting = room?.status === "waiting";
  const locked = room?.status === "locked";

  const slotsLeft = useMemo(() => {
    if (!slot?.slot || !room?.revealSlot) return null;
    const left = Number(room.revealSlot) - slot.slot;
    return left > 0 ? left : 0;
  }, [slot?.slot, room?.revealSlot]);

  async function sendIx(
    ix: Parameters<typeof sendIxs>[0]["ixs"][number],
    after?: { join?: string; settle?: string },
  ) {
    if (!publicKey) throw new Error("Connect wallet");
    setBusy(true);
    setError(null);
    try {
      const sig = await sendIxs({ connection, wallet, ixs: [ix] });
      await fetch(`/api/rooms/${pda}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          joinSignature: after?.join ? sig : undefined,
          settleSignature: after?.settle ? sig : undefined,
        }),
      });
      await load();
      return sig;
    } catch (e) {
      setError(explainChainError(e));
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!publicKey || !room) return;
    await sendIx(
      joinDuelIx({
        challenger: publicKey,
        host: new PublicKey(room.hostWallet),
        duelId: BigInt(room.duelId),
      }),
      { join: "1" },
    );
  }

  async function settle() {
    if (!publicKey || !room?.challengerWallet) return;
    await sendIx(
      settleIx({
        settler: publicKey,
        host: new PublicKey(room.hostWallet),
        challenger: new PublicKey(room.challengerWallet),
        duelId: BigInt(room.duelId),
      }),
      { settle: "1" },
    );
  }

  async function cancel() {
    if (!publicKey || !room) return;
    await sendIx(
      cancelIx({ host: publicKey, duelId: BigInt(room.duelId) }),
    );
  }

  async function refund() {
    if (!publicKey || !room?.challengerWallet) return;
    await sendIx(
      refundExpiredIx({
        crank: publicKey,
        host: new PublicKey(room.hostWallet),
        challenger: new PublicKey(room.challengerWallet),
        duelId: BigInt(room.duelId),
      }),
    );
  }

  async function rematch() {
    if (!publicKey || !room) return;
    if (!profile) {
      setError("Bind your identity first");
      return;
    }
    const n = Number(rematchWager);
    if (!Number.isFinite(n) || n < MIN_WAGER_SOL || n > MAX_WAGER_SOL) {
      setError(`Wager must be ${MIN_WAGER_SOL}–${MAX_WAGER_SOL} SOL`);
      return;
    }
    const lamports = solToLamports(n);
    setBusy(true);
    setError(null);
    try {
      const duelId =
        BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
      const { duel, ix } = createDuelIx({
        host: publicKey,
        duelId,
        wagerLamports: lamports,
      });
      const sig = await sendIxs({ connection, wallet, ixs: [ix] });
      const json = await postJson<{ room?: { id: string } }>("/api/rooms", {
        pda: duel.toBase58(),
        duelId: duelId.toString(),
        hostWallet: publicKey.toBase58(),
        wagerLamports: lamports.toString(),
        createSignature: sig,
        rematchOf: room.id,
      });
      if (!json.room) throw new Error("Rematch record failed");
      setRematchOpen(false);
      router.push(`/duel/${duel.toBase58()}`);
    } catch (e) {
      setError(explainChainError(e));
    } finally {
      setBusy(false);
    }
  }

  async function joinRematch() {
    if (!publicKey || !data?.rematch) return;
    const next = data.rematch;
    setBusy(true);
    setError(null);
    try {
      const sig = await sendIxs({
        connection,
        wallet,
        ixs: [
          joinDuelIx({
            challenger: publicKey,
            host: new PublicKey(next.hostWallet),
            duelId: BigInt(next.duelId),
          }),
        ],
      });
      try {
        await fetch(`/api/rooms/${next.pda}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ joinSignature: sig }),
        });
      } catch {
        /* chain join already landed */
      }
      router.push(`/duel/${next.pda}`);
    } catch (e) {
      setError(explainChainError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!room || !data) {
    return <div className="empty">Loading duel from Neon + chain…</div>;
  }

  const wagerSol = Number(room.wagerLamports) / 1e9;
  const pot = BigInt(room.wagerLamports) * 2n;
  const winner = room.winnerWallet;
  const youWon = winner && me === winner;
  const showRolls = settled || (hashReady && hostRoll && challengerRoll);
  const rematchOffer = data.rematch ?? null;
  const canRematch =
    inDuel && Boolean(publicKey && profile) && (settled || room.status === "refunded");
  const lastWagerSol = solInputFromLamports(room.wagerLamports);
  const rematchChips = [...new Set([lastWagerSol, "0.01", "0.05", "0.1", "0.25", "1"])];

  function openRematch() {
    setError(null);
    setRematchWager(lastWagerSol);
    setRematchOpen(true);
  }

  return (
    <>
    <div className="arena">
      <header className="arena-head">
        <Link href="/circles" className="back">
          ← Leave
        </Link>
        <div>
          <h1>Circle</h1>
          <p className="status-line">
            {waiting && "WAITING FOR CHALLENGER"}
            {locked && !hashReady && !expired && "HASH LOCKED — WAITING ON SLOT"}
            {locked && hashReady && !settled && "SLOT HASH READY — SETTLE TO PAY"}
            {expired && !settled && "HASH EXPIRED — REFUND BOTH"}
            {settled && "SETTLED · WINNER TAKES ALL"}
            {room.status === "cancelled" && "CANCELLED"}
            {room.status === "refunded" && "REFUNDED"}
          </p>
        </div>
        <span className={`badge ${room.status}`}>{room.status}</span>
      </header>

      <div className="arena-grid">
        <section className="arena-side">
          <PlayerCard
            title="Host"
            profile={data.host}
            wallet={room.hostWallet}
            roll={showRolls ? hostRoll : null}
            wins={data.host?.wins ?? 0}
            you={isHost}
            winner={winner === room.hostWallet}
          />
          <PlayerCard
            title="Challenger"
            profile={data.challenger}
            wallet={room.challengerWallet}
            roll={showRolls ? challengerRoll : null}
            wins={data.challenger?.wins ?? 0}
            you={isChallenger}
            winner={Boolean(winner && winner === room.challengerWallet)}
          />

          <div className="panel bet-box">
            <p className="kicker">Escrow</p>
            <dl>
              <div>
                <dt>Each wager</dt>
                <dd className="gold">{formatSol(room.wagerLamports)}</dd>
              </div>
              <div>
                <dt>Pot</dt>
                <dd className="gold">{waiting ? formatSol(room.wagerLamports) : formatSol(pot.toString())}</dd>
              </div>
              <div>
                <dt>USD each</dt>
                <dd>{formatUsd(wagerSol, price)}</dd>
              </div>
              <div>
                <dt>House fee</dt>
                <dd>0%</dd>
              </div>
            </dl>
            <a href={explorerAccount(room.id)} target="_blank" rel="noreferrer">
              PDA {shortKey(room.id, 6, 6)}
            </a>
          </div>

          <div className="panel rules">
            <p className="kicker">Rules</p>
            <ol>
              <li>Host locks SOL in the duel PDA.</li>
              <li>Challenger matches the wager. Join commits a future slot.</li>
              <li>Dice = SHA-256 of that slot hash + PDA + both wallets.</li>
              <li>Higher roll takes the full pot. Ties re-hash. No rake.</li>
            </ol>
          </div>
        </section>

        <section className="arena-center">
          <div className={`table ${locked && !settled ? "is-hot" : ""} ${settled ? "is-won" : ""}`}>
            {settled && winner ? (
              <div className="winner-banner">
                <span className="trophy">◆</span>
                <h2>{youWon ? "You take the pot" : "Round winner"}</h2>
                <p>
                  {winner === room.hostWallet
                    ? data.host?.username ?? shortKey(winner)
                    : data.challenger?.username ?? shortKey(winner)}{" "}
                  · {formatSol(pot.toString())}
                </p>
              </div>
            ) : locked && !hashReady && !expired ? (
              <div className="wait-copy">
                <p className="kicker">Reveal in</p>
                <h2>{slotsLeft ?? REVEAL_DELAY_SLOTS} slots</h2>
                <p className="muted">
                  Current slot {slot?.slot?.toLocaleString()} · committed{" "}
                  {room.revealSlot ? (
                    <a href={explorerSlot(room.revealSlot)} target="_blank" rel="noreferrer">
                      {room.revealSlot}
                    </a>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
            ) : waiting ? (
              <div className="wait-copy">
                <h2>Waiting for a challenger</h2>
                <p className="muted">Match the wager to lock the hash window.</p>
              </div>
            ) : hashReady && !settled ? (
              <div className="wait-copy">
                <h2>Hash is in the sysvar</h2>
                <p className="muted">
                  Outcome is determined. Settle pays the winner on-chain.
                </p>
              </div>
            ) : null}

            <div className="dice-row">
              <DiceFace
                tone="black"
                value={showRolls ? hostRoll : null}
                rolling={locked && !expired && !showRolls}
                highlight={isHost}
                label={data.host?.username ?? "Host"}
              />
              <span className={`vs ${locked && !settled ? "is-live" : ""}`}>VS</span>
              <DiceFace
                tone="red"
                value={showRolls ? challengerRoll : null}
                rolling={(locked && !expired && !showRolls) || waiting}
                highlight={isChallenger}
                label={data.challenger?.username ?? "Open seat"}
              />
            </div>

            {(room.slotHash || slot?.preview?.slotHash) && (
              <p className="hash-line">
                slot hash {room.slotHash || slot?.preview?.slotHash}
              </p>
            )}

            {error ? <p className="err">{error}</p> : null}

            <div className="table-actions">
              {waiting && !isHost && publicKey && profile ? (
                <button className="btn-ember" disabled={busy} onClick={() => void join()}>
                  {busy ? "Joining…" : `Match ${formatSol(room.wagerLamports)}`}
                </button>
              ) : null}
              {waiting && isHost ? (
                <button className="btn-ghost" disabled={busy} onClick={() => void cancel()}>
                  Cancel & refund
                </button>
              ) : null}
              {locked && hashReady && !settled ? (
                <button className="btn-ember" disabled={busy} onClick={() => void settle()}>
                  {busy ? "Settling…" : "Settle on-chain"}
                </button>
              ) : null}
              {expired && !settled && room.challengerWallet ? (
                <button className="btn-ghost" disabled={busy} onClick={() => void refund()}>
                  Refund both
                </button>
              ) : null}
              {canRematch && rematchOffer && rematchOffer.hostWallet === me ? (
                <Link href={`/duel/${rematchOffer.pda}`} className="btn-ember">
                  Go to rematch
                </Link>
              ) : null}
              {canRematch && rematchOffer && rematchOffer.hostWallet !== me ? (
                <button className="btn-ember" disabled={busy} onClick={() => void joinRematch()}>
                  {busy ? "Joining…" : `Join rematch · ${formatSol(rematchOffer.wagerLamports)}`}
                </button>
              ) : null}
              {canRematch && rematchOffer && rematchOffer.hostWallet !== me ? (
                <button className="btn-ghost" disabled={busy} onClick={openRematch}>
                  Different wager
                </button>
              ) : null}
              {canRematch && !rematchOffer ? (
                <button className="btn-ember" disabled={busy} onClick={openRematch}>
                  Rematch
                </button>
              ) : null}
            </div>
          </div>

          <div className="you-bar">
            <DemonPortrait id={profile?.demon ?? "cinder-wraith"} size={36} />
            <span>{profile?.username ?? "Spectator"}</span>
            <span className="muted">{me ? shortKey(me) : "wallet disconnected"}</span>
          </div>

          <div className="sig-row">
            <TxLink label="Create" sig={room.createSignature} />
            <TxLink label="Join" sig={room.joinSignature} />
            <TxLink label="Settle" sig={room.settleSignature} />
          </div>
        </section>

        <ChatPanel roomId={pda} />
      </div>
    </div>
    {rematchOpen ? (
      <div className="overlay" onClick={() => !busy && setRematchOpen(false)}>
        <div className="panel create-panel" onClick={(e) => e.stopPropagation()}>
          <p className="kicker">Rematch</p>
          <h2>Set the wager</h2>
          <p className="muted">
            Last round was {formatSol(room.wagerLamports)}. Keep it or lock a
            different amount. Opponent matches whatever you set.
          </p>
          <label className="field">
            <span>Wager (SOL)</span>
            <input
              type="number"
              min={MIN_WAGER_SOL}
              max={MAX_WAGER_SOL}
              step="0.001"
              value={rematchWager}
              onChange={(e) => setRematchWager(e.target.value)}
            />
          </label>
          <div className="chip-row">
            {rematchChips.map((v) => (
              <button
                key={v}
                type="button"
                className={`chip${v === rematchWager ? " is-on" : ""}`}
                onClick={() => setRematchWager(v)}
              >
                {v} SOL{v === lastWagerSol ? " · last" : ""}
              </button>
            ))}
          </div>
          {error ? <p className="err">{error}</p> : null}
          <div className="row-actions">
            <button className="btn-ghost" disabled={busy} onClick={() => setRematchOpen(false)}>
              Back
            </button>
            <button className="btn-ember" disabled={busy} onClick={() => void rematch()}>
              {busy ? "Opening…" : `Lock ${rematchWager || "—"} SOL`}
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}

function solInputFromLamports(lamports: string) {
  const n = Number(lamports) / 1e9;
  if (!Number.isFinite(n) || n <= 0) return "0.05";
  return n.toFixed(6).replace(/\.?0+$/, "");
}

function TxLink({ label, sig }: { label: string; sig: string | null }) {
  if (!sig) return <span className="muted">{label} —</span>;
  return (
    <a href={explorerTx(sig)} target="_blank" rel="noreferrer">
      {label} {shortKey(sig, 6, 4)}
    </a>
  );
}

function PlayerCard({
  title,
  profile,
  wallet,
  roll,
  wins,
  you,
  winner,
}: {
  title: string;
  profile: { username: string; demon: string } | null;
  wallet: string | null;
  roll: number | null;
  wins: number;
  you?: boolean;
  winner?: boolean;
}) {
  return (
    <div className={`panel player-card ${you ? "you" : ""} ${winner ? "winner" : ""}`}>
      <div className="player-top">
        <DemonPortrait id={profile?.demon ?? "cinder-wraith"} size={44} />
        <div>
          <p className="kicker">{title}{you ? " · you" : ""}{winner ? " · winner" : ""}</p>
          <p className="you-name">{profile?.username ?? (wallet ? shortKey(wallet) : "Empty")}</p>
          {wallet ? (
            <a href={explorerAccount(wallet)} target="_blank" rel="noreferrer">
              {shortKey(wallet)}
            </a>
          ) : (
            <span className="muted">Waiting</span>
          )}
        </div>
        <div className="roll-mini">{roll ?? "—"}</div>
      </div>
      <p className="muted">{wins} wins on record</p>
    </div>
  );
}
