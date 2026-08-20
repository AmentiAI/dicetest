"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
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
import { ArenaTable } from "./ArenaTable";
import { DiceFace } from "./DiceFace";
import { WalletBadge } from "./WalletBadge";
import { ChatPanel } from "./ChatPanel";
import { ArenaPicker } from "./ArenaPicker";
import { SlotCountdown } from "./SlotCountdown";
import { AnimatedNumber } from "./AnimatedNumber";
import { GameIcon } from "./GameIcon";
import { WalletButton } from "./WalletButton";
import { useProfile } from "./ProfileProvider";
import { arenaForSeed, type Arena, type ArenaId } from "@/lib/cosmetics";
import { stagger, motion as motionTokens } from "@/lib/motion";

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
  arena?: Arena;
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
  const { setVisible: openWallet } = useWalletModal();
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
  const [rematchArena, setRematchArena] = useState<ArenaId>("alley");
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
      const t = window.setTimeout(() => setRevealed(true), 2000);
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

  function requestJoin() {
    if (!publicKey) {
      openWallet(true);
      return;
    }
    if (!profile) {
      setError("Pick a username in the popup, then join.");
      return;
    }
    void join();
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
        arena: rematchArena,
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
  const arena = data?.arena ?? arenaForSeed(room?.id ?? pda);

  function openRematch() {
    setError(null);
    setRematchWager(lastWagerSol);
    setRematchArena(arena.id);
    setRematchOpen(true);
  }

  return (
    <>
    <div className="arena-v2-wrap bd-duel">
      <div className="arena-v2-grid">
        <aside className="arena-v2-side">
          <Link href="/circles" className="bd-back">
            ← Circles
          </Link>
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger.container}
            className="arena-v2-side-stack"
          >
          <PlayerCard
            title="Host"
            profile={data.host}
            wallet={room.hostWallet}
            roll={announced ? hostRoll : null}
            wins={data.host?.wins ?? 0}
            you={isHost}
            winner={winner === room.hostWallet}
            accent={arena.hostAccent}
            dieTone={arena.hostSkin}
          />
          <PlayerCard
            title="Challenger"
            profile={data.challenger}
            wallet={room.challengerWallet}
            roll={announced ? challengerRoll : null}
            wins={data.challenger?.wins ?? 0}
            you={isChallenger}
            winner={Boolean(winner && winner === room.challengerWallet)}
            accent={arena.guestAccent}
            dieTone={arena.guestSkin}
            vacant={!data.challenger}
          />

          <motion.div className="panel bet-box arena-v2-panel" variants={stagger.item}>
            <p className="kicker">Escrow</p>
            <dl>
              <div>
                <dt>Each wager</dt>
                <dd className="gold">{formatSol(room.wagerLamports)}</dd>
              </div>
              <div>
                <dt>Pot</dt>
                <dd className="gold pot-value">
                  <AnimatedNumber
                    value={waiting ? Number(room.wagerLamports) / 1e9 : Number(pot) / 1e9}
                    format={(n) => `${n.toFixed(4)} SOL`}
                  />
                </dd>
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
            <a
              className="bd-pda"
              href={explorerAccount(room.id)}
              target="_blank"
              rel="noreferrer"
            >
              PDA {shortKey(room.id, 4, 4)}
            </a>
          </motion.div>
          </motion.div>
        </aside>

        <section className="arena-v2-main">
          <ArenaTable
            arena={arena}
            hot={locked && !settled}
            won={Boolean(announced && winner)}
            potLabel={
              waiting
                ? formatSol(room.wagerLamports)
                : `${(Number(pot) / 1e9).toFixed(4)} SOL`
            }
          >
            {announced && winner ? (
              <motion.div
                className="winner-banner arena-winner-pop"
                initial={{ opacity: 0, scale: 0.85, y: -16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.34, 1.4, 0.64, 1] }}
              >
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
              </motion.div>
            ) : locked && !hashReady && !expired ? (
              <div className="wait-copy">
                <p className="kicker">Reveal in</p>
                <SlotCountdown
                  slotsLeft={slotsLeft ?? REVEAL_DELAY_SLOTS}
                  total={REVEAL_DELAY_SLOTS}
                />
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
                <p className="muted">Lock the hash window to start the battle.</p>
              </div>
            ) : hashReady && !announced ? (
              <div className="wait-copy">
                <h2>Hash landed</h2>
                <p className="muted">Dice are rolling from the slot hash.</p>
              </div>
            ) : null}

            <div className="duel-dice-grid">
              <div
                className={`duel-die-slot accent-host${isHost ? " is-you" : ""}${locked && !showRolls && !expired ? " is-rolling" : ""}${announced && winner === room.hostWallet ? " is-winner-slot" : ""}`}
              >
                <DiceFace
                  tone={arena.hostSkin}
                  value={showRolls ? hostRoll : null}
                  idle={waiting}
                  rolling={!showRolls && locked && !expired}
                  slow={locked && !hashReady}
                  highlight={isHost}
                  winner={Boolean(announced && winner === room.hostWallet)}
                  label={data.host?.username ?? "Host"}
                  large
                />
              </div>
              <div className="duel-vs-col">
                <span className={`vs ${locked && !settled ? "is-live" : ""}`}>VS</span>
              </div>
              <div
                className={`duel-die-slot accent-guest${!data.challenger ? " is-vacant" : ""}${isChallenger ? " is-you" : ""}${!showRolls && data.challenger && locked && !expired ? " is-rolling" : ""}${announced && winner === room.challengerWallet ? " is-winner-slot" : ""}`}
              >
                {data.challenger ? (
                  <DiceFace
                    tone={arena.guestSkin}
                    value={showRolls ? challengerRoll : null}
                    idle={waiting}
                    rolling={!showRolls && locked && !expired}
                    slow={locked && !hashReady}
                    highlight={isChallenger}
                    winner={Boolean(announced && winner === room.challengerWallet)}
                    label={data.challenger?.username ?? "Challenger"}
                    large
                  />
                ) : (
                  <button
                    type="button"
                    className="duel-vacant"
                    disabled={busy || isHost}
                    onClick={requestJoin}
                  >
                    <span className="duel-vacant-plus">+</span>
                    <span className="die-label">
                      {isHost
                        ? "Open seat"
                        : `Join · match ${formatSol(room.wagerLamports)}`}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {announced && (proofHash || hostRoll) ? (
              <div className="proof-box arena-v2-proof">
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

            <div className="table-actions arena-v2-actions">
              {waiting && !isHost ? (
                publicKey && profile ? (
                  <button
                    className="btn-ember btn-join"
                    disabled={busy}
                    onClick={() => void join()}
                  >
                    {busy
                      ? "Matching on-chain…"
                      : `Join & wager ${formatSol(room.wagerLamports)}`}
                  </button>
                ) : publicKey ? (
                  <p className="muted">Pick a username to lock your wager.</p>
                ) : (
                  <WalletButton />
                )
              ) : null}
              {waiting && isHost ? (
                <p className="muted">Share this page — opponent matches {formatSol(room.wagerLamports)} to start.</p>
              ) : null}
            </div>

            <div className="bd-fair-badge">
              <GameIcon name="shield" size={14} />
              <span>Provably Fair</span>
              <em>All results verifiable on-chain</em>
            </div>
            <div className="bd-spectators">
              <span>◎ 0 Spectators</span>
              <span>View All</span>
            </div>
          </ArenaTable>
        </section>

        <aside className="bd-right">
          <div className="bd-status-row">
            <span className={`bd-chip gold ${waiting ? "on" : ""}`}>
              {waiting ? "WAITING" : room.status.toUpperCase()}
            </span>
            <span className="bd-chip">
              {waiting && "WAITING FOR CHALLENGER"}
              {locked && !hashReady && "HASH LOCKED"}
              {locked && hashReady && !announced && "ROLLING"}
              {payingOut && "PAYING OUT"}
              {settled && "SETTLED"}
              {expired && !settled && "EXPIRED"}
              {room.status === "cancelled" && "CANCELLED"}
              {room.status === "refunded" && "REFUNDED"}
            </span>
          </div>
          <ChatPanel roomId={pda} />
        </aside>
      </div>

      <nav className="bd-dock">
        <Link href="/circles" className="bd-dock-item">
          Create Circle
        </Link>
        <button
          type="button"
          className={`bd-dock-item${waiting && !isHost ? " is-active" : ""}`}
          disabled={busy || !waiting || isHost}
          onClick={requestJoin}
        >
          {busy && waiting && !isHost
            ? "Joining…"
            : `Join · ${formatSol(room.wagerLamports)}`}
        </button>
        <button
          type="button"
          className={`bd-dock-item${payoutFailed || (announced && locked && !settled) ? " is-active" : ""}`}
          disabled={busy || settled || (!payoutFailed && !(announced && inDuel && locked && !expired))}
          onClick={() => void (payoutFailed ? retryPayout() : settle())}
        >
          <span className="bd-lock">{settled || (!announced && !payoutFailed) ? "🔒 " : ""}</span>
          Settle
        </button>
      </nav>

      {waiting && isHost ? (
        <div className="bd-host-tools">
          <button className="btn-ghost" disabled={busy} onClick={() => void cancel()}>
            Cancel & refund
          </button>
        </div>
      ) : null}
      {expired && !settled && room.challengerWallet ? (
        <div className="bd-host-tools">
          <button className="btn-ghost" disabled={busy} onClick={() => void refund()}>
            Refund both
          </button>
        </div>
      ) : null}
      {canRematch ? (
        <div className="bd-host-tools">
          {rematchOffer && rematchOffer.hostWallet === me ? (
            <Link href={`/duel/${rematchOffer.pda}`} className="btn-ember">
              Go to rematch
            </Link>
          ) : null}
          {rematchOffer && rematchOffer.hostWallet !== me ? (
            <>
              <button className="btn-ember" disabled={busy} onClick={() => void joinRematch()}>
                {busy ? "Joining…" : `Join rematch · ${formatSol(rematchOffer.wagerLamports)}`}
              </button>
              <button className="btn-ghost" disabled={busy} onClick={openRematch}>
                Different wager
              </button>
            </>
          ) : null}
          {!rematchOffer ? (
            <button className="btn-ember" disabled={busy} onClick={openRematch}>
              Rematch
            </button>
          ) : null}
        </div>
      ) : null}
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
          <ArenaPicker value={rematchArena} onChange={setRematchArena} />
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

function PlayerCard({
  title,
  profile,
  wallet,
  roll,
  wins,
  you,
  winner,
  accent = "var(--ember)",
  dieTone,
  vacant = false,
}: {
  title: string;
  profile: { username: string } | null;
  wallet: string | null;
  roll: number | null;
  wins: number;
  you?: boolean;
  winner?: boolean;
  accent?: string;
  dieTone?: string;
  vacant?: boolean;
}) {
  const name = profile?.username ?? (wallet ? shortKey(wallet) : "Empty");
  return (
    <motion.div
      variants={stagger.item}
      className={`panel player-card arena-v2-player ${you ? "you" : ""} ${winner ? "winner" : ""}${vacant ? " vacant" : ""}`}
      style={{ "--player-accent": accent } as CSSProperties}
      whileHover={{ y: -4, transition: motionTokens.spring }}
    >
      <div className="player-top">
        <WalletBadge label={name} accent={accent} />
        <div>
          <p className="you-name">
            {profile?.username ?? (wallet ? shortKey(wallet) : "Empty")}
            {you ? <span className="bd-you-tag">you</span> : null}
          </p>
          {wallet ? (
            <a href={explorerAccount(wallet)} target="_blank" rel="noreferrer">
              {shortKey(wallet)}
            </a>
          ) : (
            <span className="muted">Waiting for challenger…</span>
          )}
        </div>
        {winner ? <span className="bd-crown">♛</span> : null}
      </div>
      {vacant ? (
        <div className="bd-open-seat">
          <span>+</span>
          OPEN SEAT
        </div>
      ) : (
        <>
          {dieTone ? (
            <span className="player-die-chip" style={{ borderColor: accent, color: accent }}>
              {dieTone.replace("-", " / ")}
            </span>
          ) : null}
          <p className="muted">{wins} wins on record</p>
        </>
      )}
    </motion.div>
  );
}
