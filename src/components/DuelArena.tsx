"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  DUEL_STATUS,
  MAX_WAGER_SOL,
  MIN_WAGER_SOL,
  REVEAL_DELAY_SLOTS,
} from "@/lib/solana/constants";
import { formatSol, formatUsd, shortKey, solToLamports } from "@/lib/format";
import { getJson, postJson } from "@/lib/http";
import { explainChainError, sendIxs } from "@/lib/solana/send";
import { fetchDuel, invalidateDuel } from "@/lib/solana/fetch";
import { DemonPortrait } from "./DemonPortrait";
import { DiceFace } from "./DiceFace";
import { EmoteHolo } from "./EmoteHolo";
import { ChatPanel } from "./ChatPanel";
import { useProfile } from "./ProfileProvider";
import { arenaFor, resultEmote, skinForDemon } from "@/lib/cosmetics";

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

const autoSettled = new Set<string>();

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
  const [revealed, setRevealed] = useState(false);
  const [announced, setAnnounced] = useState(false);
  const [payoutFailed, setPayoutFailed] = useState(false);

  const load = useCallback(async (withPrice = false) => {
    try {
      const room = await getJson<RoomPayload>(`/api/rooms/${pda}`);
      if (room) setData(room);
      const status = room?.room?.status;
      if (status === "locked") {
        const slotJson = await getJson<SlotPayload>(`/api/slot?pda=${pda}`);
        if (slotJson) setSlot(slotJson);
      }
      if (withPrice) {
        const priceJson = await getJson<{ usd: number | null }>("/api/price");
        if (priceJson) setPrice(priceJson.usd ?? null);
      }
      return status ?? null;
    } catch {
      return null;
    }
  }, [pda]);

  useEffect(() => {
    let stop = false;
    let timer = 0;
    const tick = async (withPrice: boolean) => {
      const status = await load(withPrice);
      if (stop) return;
      const ms =
        status === "locked" ? 3_500 : status === "waiting" ? 5_000 : 8_000;
      timer = window.setTimeout(() => void tick(false), ms);
    };
    void tick(true);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
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
  const previewWinner =
    hostRoll && challengerRoll && room && hostRoll !== challengerRoll
      ? hostRoll > challengerRoll
        ? room.hostWallet
        : room.challengerWallet
      : null;
  const showRolls = settled || revealed;

  useEffect(() => {
    if (settled || (room?.hostRoll && room?.challengerRoll)) {
      setRevealed(true);
      return;
    }
    if (hashReady && hostRoll && challengerRoll) {
      const t = window.setTimeout(() => setRevealed(true), 800);
      return () => window.clearTimeout(t);
    }
    setRevealed(false);
  }, [settled, hashReady, hostRoll, challengerRoll, room?.hostRoll, room?.challengerRoll]);

  useEffect(() => {
    if (settled) {
      setAnnounced(true);
      setRevealed(true);
      setPayoutFailed(false);
      setError(null);
      return;
    }
    if (revealed && hostRoll && challengerRoll) {
      const t = window.setTimeout(() => setAnnounced(true), 1650);
      return () => window.clearTimeout(t);
    }
    setAnnounced(false);
  }, [settled, revealed, hostRoll, challengerRoll]);

  useEffect(() => {
    if (!announced || !locked || !hashReady || settled || expired) return;
    if (!inDuel || !publicKey || !room?.challengerWallet) return;
    const key = `${pda}:${room.duelId}`;
    if (autoSettled.has(key)) return;
    const wait = publicKey.toBase58() === room.hostWallet ? 400 : 2200;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled || autoSettled.has(key)) return;
      autoSettled.add(key);
      setPayoutFailed(false);
      void (async () => {
        const sig = await settle();
        if (!sig) {
          autoSettled.delete(key);
          setPayoutFailed(true);
        }
      })();
    }, wait);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // settle reads latest room/wallet from this render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announced, locked, hashReady, settled, expired, inDuel, publicKey, room?.challengerWallet, room?.duelId, pda]);

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
    invalidateDuel(pda);
    const onchain = await fetchDuel(connection, new PublicKey(pda));
    if (onchain && onchain.status === DUEL_STATUS.Settled) {
      await fetch(`/api/rooms/${pda}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      await load();
      return room.settleSignature || "settled";
    }
    if (!onchain || onchain.status !== DUEL_STATUS.Locked) {
      await load();
      return;
    }
    const sig = await sendIx(
      settleIx({
        settler: publicKey,
        host: new PublicKey(room.hostWallet),
        challenger: new PublicKey(room.challengerWallet),
        duelId: BigInt(room.duelId),
      }),
      { settle: "1" },
    );
    if (sig) return sig;
    invalidateDuel(pda);
    const again = await fetchDuel(connection, new PublicKey(pda));
    if (again && again.status === DUEL_STATUS.Settled) {
      setError(null);
      await fetch(`/api/rooms/${pda}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      await load();
      return "settled";
    }
  }

  async function retryPayout() {
    autoSettled.delete(`${pda}:${room?.duelId ?? ""}`);
    setPayoutFailed(false);
    setError(null);
    const sig = await settle();
    if (!sig) setPayoutFailed(true);
    else autoSettled.add(`${pda}:${room?.duelId ?? ""}`);
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
  const winner = room.winnerWallet ?? previewWinner;
  const youWon = winner && me === winner;
  const payingOut = locked && announced && !settled && !expired && !payoutFailed && inDuel;
  const proofHash = room.slotHash || slot?.preview?.slotHash || null;
  const rematchOffer = data.rematch ?? null;
  const canRematch =
    inDuel && Boolean(publicKey && profile) && (settled || room.status === "refunded");
  const lastWagerSol = solInputFromLamports(room.wagerLamports);
  const rematchChips = [...new Set([lastWagerSol, "0.01", "0.05", "0.1", "0.25", "1"])];
  const arena = arenaFor(room.id);
  const emote = resultEmote({
    youWon: Boolean(youWon),
    inDuel,
    waiting,
  });

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
            {locked && hashReady && !announced && !expired && "ROLLING FROM SLOT HASH"}
            {payingOut && "PAYING THE WINNER"}
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
            roll={announced ? hostRoll : null}
            wins={data.host?.wins ?? 0}
            you={isHost}
            winner={winner === room.hostWallet}
          />
          <PlayerCard
            title="Challenger"
            profile={data.challenger}
            wallet={room.challengerWallet}
            roll={announced ? challengerRoll : null}
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
              <li>Higher roll takes the full pot. Ties re-hash. Payout is automatic. No rake.</li>
            </ol>
          </div>
        </section>

        <section className="arena-center">
          <div className={`table env-${arena.id} ${locked && !settled ? "is-hot" : ""} ${announced && winner ? "is-won" : ""}`}>
            <p className="arena-tag">{arena.name}</p>
            <div className="hash-pad" aria-hidden>
              <span>S</span>
            </div>
            {announced && winner ? (
              <div className="winner-banner">
                <EmoteHolo id={emote.id} label={emote.label} />
                <span className="trophy">◆</span>
                <h2>
                  {youWon
                    ? settled
                      ? "You take the pot"
                      : "You win"
                    : "Round winner"}
                </h2>
                <p>
                  {winner === room.hostWallet
                    ? data.host?.username ?? shortKey(winner)
                    : data.challenger?.username ?? shortKey(winner)}{" "}
                  · {formatSol(pot.toString())}
                </p>
                {payingOut ? (
                  <p className="muted">Sending the pot on-chain…</p>
                ) : null}
              </div>
            ) : locked && !hashReady && !expired ? (
              <div className="wait-copy">
                <EmoteHolo id="locked-in" label="Locked In" />
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
                <EmoteHolo id="locked-in" label="Locked In" />
                <h2>Waiting for a challenger</h2>
                <p className="muted">Match the wager to lock the hash window.</p>
              </div>
            ) : hashReady && !announced ? (
              <div className="wait-copy">
                <EmoteHolo id="fist-bump" label="Electric Fist Bump" />
                <h2>Hash landed</h2>
                <p className="muted">Dice are rolling from the slot hash.</p>
              </div>
            ) : null}

            <div className="dice-row">
              <DiceFace
                tone={skinForDemon(data.host?.demon)}
                value={showRolls ? hostRoll : null}
                rolling={!showRolls && (waiting || (locked && !expired))}
                slow={waiting || (locked && !hashReady)}
                trail={!showRolls && (waiting || (locked && !expired))}
                crater={Boolean(showRolls && hostRoll)}
                highlight={isHost}
                label={data.host?.username ?? "Host"}
              />
              <span className={`vs ${locked && !settled ? "is-live" : ""}`}>VS</span>
              <DiceFace
                tone={data.challenger ? skinForDemon(data.challenger.demon) : "chain"}
                value={showRolls ? challengerRoll : null}
                rolling={!showRolls && (waiting || (locked && !expired))}
                slow={waiting || (locked && !hashReady)}
                trail={!showRolls && (waiting || (locked && !expired))}
                crater={Boolean(showRolls && challengerRoll)}
                highlight={isChallenger}
                label={data.challenger?.username ?? "Open seat"}
              />
            </div>

            {announced && (proofHash || hostRoll) ? (
              <div className="proof-box">
                <p className="kicker">Proof</p>
                <dl>
                  <div>
                    <dt>Host roll</dt>
                    <dd>{hostRoll ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Challenger roll</dt>
                    <dd>{challengerRoll ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Reveal slot</dt>
                    <dd>
                      {room.revealSlot ? (
                        <a href={explorerSlot(room.revealSlot)} target="_blank" rel="noreferrer">
                          {room.revealSlot}
                        </a>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Slot hash</dt>
                    <dd className="proof-hash">{proofHash ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Settle tx</dt>
                    <dd>
                      {room.settleSignature ? (
                        <a href={explorerTx(room.settleSignature)} target="_blank" rel="noreferrer">
                          {shortKey(room.settleSignature, 6, 4)}
                        </a>
                      ) : payingOut ? (
                        "sending…"
                      ) : (
                        "pending"
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}

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
              {payoutFailed && inDuel && !settled && announced ? (
                <button className="btn-ghost" disabled={busy} onClick={() => void retryPayout()}>
                  Retry payout
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
