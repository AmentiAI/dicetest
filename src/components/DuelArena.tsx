"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  DUEL_ADDRESS,
  DUEL_STATUS,
  MAX_WAGER_ETH,
  MIN_WAGER_ETH,
  REVEAL_DELAY_BLOCKS,
  explorerAccount,
  explorerBlock,
  explorerTx,
} from "@/lib/eth/constants";
import { ethInputFromWei, ethToWei, formatEth, formatUsd, shortKey } from "@/lib/format";
import { getJson, postJson } from "@/lib/http";
import { explainChainError } from "@/lib/eth/errors";
import { fetchDuel, invalidateDuel } from "@/lib/eth/fetch";
import { publicClient } from "@/lib/eth/client";
import { useDuelActions } from "@/lib/eth/useDuelActions";
import { useEthWallet } from "@/lib/eth/wallet";
import { TABLE_PHASE, tableModeLabel, type TableSeat } from "@/lib/eth/table";
import { ArenaTable } from "./ArenaTable";
import { DiceFace } from "./DiceFace";
import { WalletBadge } from "./WalletBadge";
import { ChatPanel } from "./ChatPanel";
import { ArenaPicker } from "./ArenaPicker";
import { SlotCountdown } from "./SlotCountdown";
import { AnimatedNumber } from "./AnimatedNumber";
import { GameIcon } from "./GameIcon";
import { WalletButton } from "./WalletButton";
import { CoolBtn } from "./CoolBtn";
import { DiceNftBadge, NftPicker } from "./NftPicker";
import { useProfile } from "./ProfileProvider";
import { characterTone, isNftId } from "@/lib/eth/nft";
import { arenaForSeed, type Arena, type ArenaId, type DieTone } from "@/lib/cosmetics";
import { stagger, motion as motionTokens } from "@/lib/motion";

type ProfileBit = {
  username: string;
  demon: string;
  nftTokenId: string | null;
  wins: number;
  losses: number;
};

type PlayerView = TableSeat & { profile: ProfileBit | null };

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
    hostNftId: string | null;
    challengerNftId: string | null;
    maxPlayers?: number | null;
    playerCount?: number | null;
    phase?: number | null;
    seats?: TableSeat[] | null;
  };
  host: ProfileBit | null;
  challenger: ProfileBit | null;
  players?: PlayerView[];
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
  phase?: number;
  preview?: { seats: { wallet: string; roll: number }[]; slotHash: string } | null;
  winner?: string | null;
  hostRoll?: number | null;
  challengerRoll?: number | null;
};

const autoSettled = new Set<string>();

export function DuelArena({ pda }: { pda: string }) {
  const { address, openConnectModal } = useEthWallet();
  const duel = useDuelActions();
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
  const [joinNft, setJoinNft] = useState("0");
  const [payoutFailed, setPayoutFailed] = useState(false);

  useEffect(() => {
    if (profile?.nftTokenId) setJoinNft(profile.nftTokenId);
  }, [profile?.nftTokenId]);

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

  const me = address;
  const room = data?.room;
  const players: PlayerView[] = useMemo(() => {
    if (data?.players?.length) return data.players;
    const seats = room?.seats ?? [];
    if (seats.length) {
      return seats.map((s) => ({
        ...s,
        profile:
          s.wallet === room?.hostWallet
            ? data?.host ?? null
            : s.wallet === room?.challengerWallet
              ? data?.challenger ?? null
              : null,
      }));
    }
    if (!room) return [];
    const out: PlayerView[] = [
      {
        wallet: room.hostWallet,
        tokenId: room.hostNftId ?? "0",
        round1: room.hostRoll ?? 0,
        final: 0,
        advanced: false,
        index: 0,
        profile: data?.host ?? null,
      },
    ];
    if (room.challengerWallet) {
      out.push({
        wallet: room.challengerWallet,
        tokenId: room.challengerNftId ?? "0",
        round1: room.challengerRoll ?? 0,
        final: 0,
        advanced: false,
        index: 1,
        profile: data?.challenger ?? null,
      });
    }
    return out;
  }, [data, room]);

  const maxPlayers = room?.maxPlayers ?? 2;
  const playerCount = room?.playerCount ?? players.length;
  const phase = slot?.phase ?? room?.phase ?? TABLE_PHASE.Lobby;
  const isHost = Boolean(me && room && me === room.hostWallet);
  const seated = Boolean(me && players.some((p) => p.wallet === me));
  const inDuel = seated;
  const tableFull = playerCount >= maxPlayers;

  const hashReady = Boolean(slot?.hashReady);
  const expired = Boolean(slot?.expired);
  const settled = room?.status === "settled";
  const waiting = room?.status === "waiting";
  const locked = room?.status === "locked";
  const inFinal = phase === TABLE_PHASE.Final;
  const showRolls = settled || revealed;

  function rollFor(wallet: string) {
    const preview = slot?.preview?.seats.find((s) => s.wallet === wallet);
    const seat = players.find((p) => p.wallet === wallet);
    if (inFinal) {
      if (seat?.final && seat.final > 0) return seat.final;
      return preview?.roll ?? null;
    }
    if (seat?.round1 && seat.round1 > 0) return seat.round1;
    return preview?.roll ?? null;
  }

  const previewWinner =
    hashReady && slot?.preview?.seats.length
      ? [...slot.preview.seats].sort((a, b) => b.roll - a.roll)[0]?.wallet ?? null
      : null;
  const winner = room?.winnerWallet ?? (announced ? previewWinner : null);
  const showRollsReady =
    players.length >= 2 &&
    players
      .filter((p) => !inFinal || p.advanced || playerCount <= 5)
      .every((p) => (rollFor(p.wallet) ?? 0) > 0);

  const chainRollsReady =
    players.length >= 2 &&
    players
      .filter((p) => !inFinal || p.advanced || playerCount <= 5)
      .every((p) => (inFinal ? p.final : p.round1) > 0);

  useEffect(() => {
    setRevealed(false);
    setAnnounced(false);
  }, [phase]);

  useEffect(() => {
    if (settled || chainRollsReady) {
      setRevealed(true);
      return;
    }
    if (hashReady && showRollsReady) {
      const t = window.setTimeout(() => setRevealed(true), 2000);
      return () => window.clearTimeout(t);
    }
    setRevealed(false);
  }, [settled, hashReady, showRollsReady, chainRollsReady, phase]);

  useEffect(() => {
    if (settled) {
      setAnnounced(true);
      setRevealed(true);
      setPayoutFailed(false);
      setError(null);
      return;
    }
    if (revealed && showRollsReady) {
      const t = window.setTimeout(() => setAnnounced(true), 1650);
      return () => window.clearTimeout(t);
    }
    setAnnounced(false);
  }, [settled, revealed, showRollsReady, phase]);

  useEffect(() => {
    if (!announced || !locked || !hashReady || settled || expired) return;
    if (!inDuel || !address || playerCount < 2) return;
    const key = `${pda}:${room?.duelId}:${phase}`;
    if (autoSettled.has(key)) return;
    const wait = isHost ? 400 : 2200;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announced, locked, hashReady, settled, expired, inDuel, address, playerCount, room?.duelId, pda, phase]);

  const slotsLeft = useMemo(() => {
    if (!slot?.slot || !room?.revealSlot) return null;
    const left = Number(room.revealSlot) - slot.slot;
    return left > 0 ? left : 0;
  }, [slot?.slot, room?.revealSlot]);

  async function reportSig(sig: string, after?: { join?: boolean; settle?: boolean }) {
    await fetch(`/api/rooms/${pda}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        joinSignature: after?.join ? sig : undefined,
        settleSignature: after?.settle ? sig : undefined,
      }),
    });
    await load();
  }

  async function join() {
    if (!address || !room) return;
    setBusy(true);
    setError(null);
    try {
      const tokenId =
        room.hostNftId && room.hostNftId !== "0" ? BigInt(joinNft || profile?.nftTokenId || "0") : 0n;
      if (room.hostNftId && room.hostNftId !== "0" && tokenId === 0n) {
        throw new Error("This table is staking dice NFTs. Equip or pick one first.");
      }
      const sig = await duel.joinDuel({
        duelId: BigInt(room.duelId),
        tokenId,
        wagerWei: BigInt(room.wagerLamports),
      });
      await reportSig(sig, { join: true });
    } catch (e) {
      setError(explainChainError(e));
    } finally {
      setBusy(false);
    }
  }

  function requestJoin() {
    if (!address) {
      openConnectModal();
      return;
    }
    if (!profile) {
      setError("Pick a username in the popup, then join.");
      return;
    }
    void join();
  }

  async function startMatch() {
    if (!address || !room) return;
    setBusy(true);
    setError(null);
    try {
      await duel.start(BigInt(room.duelId));
      invalidateDuel(pda);
      await load();
    } catch (e) {
      setError(explainChainError(e));
    } finally {
      setBusy(false);
    }
  }

  async function leaveTable() {
    if (!address || !room) return;
    setBusy(true);
    setError(null);
    try {
      await duel.leave(BigInt(room.duelId));
      invalidateDuel(pda);
      await load();
    } catch (e) {
      setError(explainChainError(e));
    } finally {
      setBusy(false);
    }
  }

  async function settle() {
    if (!address || playerCount < 2) return;
    invalidateDuel(pda);
    const client = publicClient();
    const onchain = await fetchDuel(client, pda);
    if (onchain && onchain.status === DUEL_STATUS.Settled) {
      await fetch(`/api/rooms/${pda}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      await load();
      return room?.settleSignature || "settled";
    }
    if (!onchain || onchain.status !== DUEL_STATUS.Locked) {
      await load();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sig = await duel.settle(BigInt(room!.duelId));
      await reportSig(sig, { settle: true });
      return sig;
    } catch (e) {
      setError(explainChainError(e));
    } finally {
      setBusy(false);
    }
    invalidateDuel(pda);
    const again = await fetchDuel(client, pda);
    if (again && (again.status === DUEL_STATUS.Settled || again.phase === TABLE_PHASE.Final)) {
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
    autoSettled.delete(`${pda}:${room?.duelId ?? ""}:${phase}`);
    setPayoutFailed(false);
    setError(null);
    const sig = await settle();
    if (!sig) setPayoutFailed(true);
    else autoSettled.add(`${pda}:${room?.duelId ?? ""}:${phase}`);
  }

  async function cancel() {
    if (!address || !room) return;
    setBusy(true);
    setError(null);
    try {
      await duel.cancel(BigInt(room.duelId));
      await load();
    } catch (e) {
      setError(explainChainError(e));
    } finally {
      setBusy(false);
    }
  }

  async function refund() {
    if (!address || playerCount < 2) return;
    setBusy(true);
    setError(null);
    try {
      await duel.refundExpired(BigInt(room!.duelId));
      await load();
    } catch (e) {
      setError(explainChainError(e));
    } finally {
      setBusy(false);
    }
  }

  async function rematch() {
    if (!address || !room) return;
    if (!profile) {
      setError("Bind your identity first");
      return;
    }
    const n = Number(rematchWager);
    if (!Number.isFinite(n) || n < MIN_WAGER_ETH || n > MAX_WAGER_ETH) {
      setError(`Wager must be ${MIN_WAGER_ETH}–${MAX_WAGER_ETH} ETH`);
      return;
    }
    const wei = ethToWei(n);
    setBusy(true);
    setError(null);
    try {
      const { hash, id } = await duel.createDuel({
        wagerWei: wei,
        tokenId: 0n,
        maxPlayers,
      });
      const json = await postJson<{ room?: { id: string } }>("/api/rooms", {
        pda: id,
        duelId: id,
        hostWallet: address,
        wagerLamports: wei.toString(),
        createSignature: hash,
        rematchOf: room.id,
        arena: rematchArena,
      });
      if (!json.room) throw new Error("Rematch record failed");
      setRematchOpen(false);
      router.push(`/duel/${id}`);
    } catch (e) {
      setError(explainChainError(e));
    } finally {
      setBusy(false);
    }
  }

  async function joinRematch() {
    if (!address || !data?.rematch) return;
    const next = data.rematch;
    setBusy(true);
    setError(null);
    try {
      const sig = await duel.joinDuel({
        duelId: BigInt(next.duelId),
        tokenId: 0n,
        wagerWei: BigInt(next.wagerLamports),
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
    return <div className="empty">Loading table from Neon + chain…</div>;
  }

  const wagerEth = Number(room.wagerLamports) / 1e18;
  const pot = BigInt(room.wagerLamports) * BigInt(Math.max(playerCount, 1));
  const youWon = winner && me === winner;
  const payingOut = locked && announced && !settled && !expired && !payoutFailed && inDuel && !inFinal;
  const advancing = locked && announced && inFinal === false && playerCount > 5 && !settled;
  const proofHash = room.slotHash || slot?.preview?.slotHash || null;
  const rematchOffer = data.rematch ?? null;
  const canRematch =
    inDuel && Boolean(address && profile) && (settled || room.status === "refunded");
  const lastWagerEth = ethInputFromWei(room.wagerLamports);
  const rematchChips = [...new Set([lastWagerEth, "0.01", "0.05", "0.1", "0.25", "1"])];
  const arena = data?.arena ?? arenaForSeed(room?.id ?? pda);
  const nftStake = isNftId(room.hostNftId);
  const ethStake = BigInt(room.wagerLamports) > 0n;
  const duo = maxPlayers === 2;
  const vacant = Math.max(0, maxPlayers - playerCount);
  const guestTones: DieTone[] = [arena.guestSkin, arena.hostSkin, "orange-blue"];

  function toneFor(p: PlayerView, i: number): DieTone {
    return characterTone(p.profile, i === 0 ? arena.hostSkin : guestTones[i % guestTones.length]!);
  }

  function openRematch() {
    setError(null);
    setRematchWager(lastWagerEth);
    setRematchArena(arena.id);
    setRematchOpen(true);
  }

  const roundLabel = waiting
    ? `${playerCount}/${maxPlayers} seated`
    : inFinal
      ? "Final — winner takes the pot"
      : playerCount > 5
        ? "Round 1 — top 5 advance"
        : "Highest roll takes the pot";

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
          {players.map((p, i) => (
            <PlayerCard
              key={p.wallet}
              title={i === 0 ? "Host" : `Seat ${i + 1}`}
              profile={p.profile}
              wallet={p.wallet}
              roll={announced ? rollFor(p.wallet) : null}
              wins={p.profile?.wins ?? 0}
              you={me === p.wallet}
              winner={winner === p.wallet}
              accent={i === 0 ? arena.hostAccent : arena.guestAccent}
              dieTone={toneFor(p, i)}
              nftTokenId={p.profile?.nftTokenId}
              stakedNftId={p.tokenId !== "0" ? p.tokenId : null}
              advanced={inFinal || p.advanced}
              eliminated={inFinal && !p.advanced && playerCount > 5}
            />
          ))}
          {waiting
            ? Array.from({ length: vacant }, (_, i) => (
                <PlayerCard
                  key={`vacant-${i}`}
                  title="Open"
                  profile={null}
                  wallet={null}
                  roll={null}
                  wins={0}
                  vacant
                  accent={arena.guestAccent}
                />
              ))
            : null}

          <motion.div className="panel bet-box arena-v2-panel" variants={stagger.item}>
            <p className="kicker">Escrow</p>
            <dl>
              <div>
                <dt>Each wager</dt>
                <dd className="gold">{formatEth(room.wagerLamports)}</dd>
              </div>
              <div>
                <dt>Pot</dt>
                <dd className="gold pot-value">
                  <AnimatedNumber
                    value={Number(pot) / 1e18}
                    format={(n) => `${n.toFixed(4)} ETH`}
                  />
                </dd>
              </div>
              <div>
                <dt>Table</dt>
                <dd>
                  {playerCount}/{maxPlayers} · {tableModeLabel(maxPlayers)}
                </dd>
              </div>
              <div>
                <dt>USD each</dt>
                <dd>{formatUsd(wagerEth, price)}</dd>
              </div>
              <div>
                <dt>House fee</dt>
                <dd>0%</dd>
              </div>
            </dl>
            <a
              className="bd-pda"
              href={explorerAccount(DUEL_ADDRESS)}
              target="_blank"
              rel="noreferrer"
            >
              Table #{room.id}
            </a>
          </motion.div>
          </motion.div>
        </aside>

        <section className="arena-v2-main">
          <ArenaTable
            arena={arena}
            hot={locked && !settled}
            won={Boolean(announced && winner && settled)}
            potLabel={`${(Number(pot) / 1e18).toFixed(4)} ETH`}
          >
            {announced && winner && (settled || !inFinal) ? (
              <motion.div
                className="winner-banner arena-winner-pop"
                initial={{ opacity: 0, scale: 0.85, y: -16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.34, 1.4, 0.64, 1] }}
              >
                <span className="trophy">◆</span>
                <h2>
                  {advancing
                    ? "Top 5 advance"
                    : youWon
                      ? settled
                        ? "You take the pot"
                        : "You win"
                      : "Round winner"}
                </h2>
                <p>
                  {advancing
                    ? "Finalists roll next for the whole pot"
                    : `${players.find((p) => p.wallet === winner)?.profile?.username ?? shortKey(winner)} · ${formatEth(pot.toString())}`}
                </p>
                {payingOut ? (
                  <p className="muted">Sending the pot on-chain…</p>
                ) : null}
              </motion.div>
            ) : locked && !hashReady && !expired ? (
              <div className="wait-copy">
                <p className="kicker">{inFinal ? "Final reveal in" : "Reveal in"}</p>
                <SlotCountdown
                  slotsLeft={slotsLeft ?? REVEAL_DELAY_BLOCKS}
                  total={REVEAL_DELAY_BLOCKS}
                />
                <p className="muted">
                  Current block {slot?.slot?.toLocaleString()} · reveal{" "}
                  {room.revealSlot ? (
                    <a href={explorerBlock(room.revealSlot)} target="_blank" rel="noreferrer">
                      {room.revealSlot}
                    </a>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
            ) : waiting ? (
              <div className="wait-copy">
                <h2>{roundLabel}</h2>
                <p className="muted">
                  {isHost
                    ? playerCount >= 2
                      ? "You can start now, or wait for more seats."
                      : "Waiting for at least one more player."
                    : "Match the stake to sit. Host starts the table."}
                </p>
              </div>
            ) : hashReady && !announced ? (
              <div className="wait-copy">
                <h2>Hash landed</h2>
                <p className="muted">Dice are rolling from the reveal blockhash.</p>
              </div>
            ) : null}

            <div className={`duel-dice-grid${duo ? "" : " is-table"}`}>
              {duo ? (
                <>
                  {players[0] ? (
                    <div
                      className={`duel-die-slot accent-host${me === players[0].wallet ? " is-you" : ""}${!showRolls && locked && !expired ? " is-rolling" : ""}${announced && winner === players[0].wallet ? " is-winner-slot" : ""}`}
                    >
                      <DiceFace
                        tone={toneFor(players[0], 0)}
                        value={showRolls ? rollFor(players[0].wallet) : null}
                        idle={waiting}
                        rolling={!showRolls && locked && !expired}
                        slow={locked && !hashReady}
                        highlight={me === players[0].wallet}
                        winner={Boolean(announced && winner === players[0].wallet)}
                        label={players[0].profile?.username ?? "Host"}
                        large
                      />
                    </div>
                  ) : null}
                  <div className="duel-vs-col">
                    <span className={`vs ${locked && !settled ? "is-live" : ""}`}>VS</span>
                  </div>
                  {players[1] ? (
                    <div
                      className={`duel-die-slot accent-guest${me === players[1].wallet ? " is-you" : ""}${!showRolls && locked && !expired ? " is-rolling" : ""}${announced && winner === players[1].wallet ? " is-winner-slot" : ""}`}
                    >
                      <DiceFace
                        tone={toneFor(players[1], 1)}
                        value={showRolls ? rollFor(players[1].wallet) : null}
                        idle={waiting}
                        rolling={!showRolls && locked && !expired}
                        slow={locked && !hashReady}
                        highlight={me === players[1].wallet}
                        winner={Boolean(announced && winner === players[1].wallet)}
                        label={players[1].profile?.username ?? "Challenger"}
                        large
                      />
                    </div>
                  ) : (
                    <div className="duel-die-slot accent-guest is-vacant">
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
                            : nftStake && !ethStake
                              ? "Join · match NFT"
                              : `Join · match ${formatEth(room.wagerLamports)}`}
                        </span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {players.map((p, i) => {
                    const rolling =
                      !showRolls &&
                      locked &&
                      !expired &&
                      (!inFinal || p.advanced || playerCount <= 5);
                    const dim = inFinal && playerCount > 5 && !p.advanced;
                    return (
                      <div
                        key={p.wallet}
                        className={`duel-die-slot ${i === 0 ? "accent-host" : "accent-guest"}${me === p.wallet ? " is-you" : ""}${rolling ? " is-rolling" : ""}${announced && winner === p.wallet ? " is-winner-slot" : ""}${dim ? " is-out" : ""}`}
                      >
                        <DiceFace
                          tone={toneFor(p, i)}
                          value={showRolls && !dim ? rollFor(p.wallet) : dim ? p.round1 || null : null}
                          idle={waiting}
                          rolling={rolling}
                          slow={locked && !hashReady}
                          highlight={me === p.wallet}
                          winner={Boolean(announced && winner === p.wallet)}
                          label={p.profile?.username ?? shortKey(p.wallet)}
                        />
                      </div>
                    );
                  })}
                  {waiting
                    ? Array.from({ length: vacant }, (_, i) => (
                        <div key={`open-${i}`} className="duel-die-slot accent-guest is-vacant">
                          <button
                            type="button"
                            className="duel-vacant"
                            disabled={busy || seated || isHost}
                            onClick={requestJoin}
                          >
                            <span className="duel-vacant-plus">+</span>
                            <span className="die-label">Open</span>
                          </button>
                        </div>
                      ))
                    : null}
                </>
              )}
            </div>

            {announced && (proofHash || showRollsReady) ? (
              <div className="proof-box arena-v2-proof">
                <p className="kicker">Proof</p>
                <dl>
                  {players.map((p) => (
                    <div key={`proof-${p.wallet}`}>
                      <dt>{p.profile?.username ?? shortKey(p.wallet)}</dt>
                      <dd>
                        {inFinal && p.final
                          ? `R1 ${p.round1 || "—"} · F ${p.final}`
                          : (rollFor(p.wallet) ?? "—")}
                        {p.advanced ? " · finalist" : ""}
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt>Reveal block</dt>
                    <dd>
                      {room.revealSlot ? (
                        <a href={explorerBlock(room.revealSlot)} target="_blank" rel="noreferrer">
                          {room.revealSlot}
                        </a>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Blockhash</dt>
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
              {waiting && !seated ? (
                address && profile ? (
                  <>
                    {nftStake ? (
                      <NftPicker
                        value={joinNft}
                        onChange={setJoinNft}
                        allowNone={false}
                        label="Stake your matching dice NFT"
                      />
                    ) : null}
                    <CoolBtn
                      variant="join"
                      pulse={!busy}
                      disabled={busy || tableFull}
                      onClick={() => void join()}
                    >
                      {busy
                        ? "Matching on-chain…"
                        : tableFull
                          ? "Table full"
                          : nftStake && !ethStake
                            ? "Join · stake a matching dice NFT"
                            : `Join · ${formatEth(room.wagerLamports)}`}
                    </CoolBtn>
                  </>
                ) : address ? (
                  <p className="muted">Pick a username to lock your wager.</p>
                ) : (
                  <WalletButton />
                )
              ) : null}
              {waiting && isHost ? (
                <CoolBtn
                  pulse={!busy && playerCount >= 2}
                  disabled={busy || playerCount < 2}
                  onClick={() => void startMatch()}
                >
                  {busy
                    ? "Starting…"
                    : playerCount < 2
                      ? "Need at least 2 players"
                      : `Start with ${playerCount} ${playerCount === 1 ? "player" : "players"}`}
                </CoolBtn>
              ) : null}
              {waiting && seated && !isHost ? (
                <CoolBtn variant="ghost" disabled={busy} onClick={() => void leaveTable()}>
                  Leave & refund
                </CoolBtn>
              ) : null}
            </div>

            <div className="bd-fair-badge">
              <GameIcon name="shield" size={14} />
              <span>Provably Fair</span>
              <em>All results verifiable on-chain</em>
            </div>
            <div className="bd-spectators">
              <span>{roundLabel}</span>
              <span>No house fee</span>
            </div>
          </ArenaTable>
        </section>

        <aside className="bd-right">
          <div className="bd-status-row">
            <span className={`bd-chip gold ${waiting ? "on" : ""}`}>
              {waiting ? "LOBBY" : inFinal ? "FINAL" : room.status.toUpperCase()}
            </span>
            <span className="bd-chip">
              {waiting && `${playerCount}/${maxPlayers}`}
              {locked && !hashReady && (inFinal ? "FINAL HASH" : "HASH LOCKED")}
              {locked && hashReady && !announced && "ROLLING"}
              {advancing && "ADVANCING"}
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
          className={`bd-dock-item${waiting && !seated ? " is-active" : ""}`}
          disabled={busy || !waiting || seated || tableFull}
          onClick={requestJoin}
        >
          {busy && waiting && !seated
            ? "Joining…"
            : `Join · ${formatEth(room.wagerLamports)}`}
        </button>
        <button
          type="button"
          className={`bd-dock-item${waiting && isHost && playerCount >= 2 ? " is-active" : ""}`}
          disabled={busy || !waiting || !isHost || playerCount < 2}
          onClick={() => void startMatch()}
        >
          Start
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
            Cancel & refund all
          </button>
        </div>
      ) : null}
      {expired && !settled && playerCount >= 2 ? (
        <div className="bd-host-tools">
          <button className="btn-ghost" disabled={busy} onClick={() => void refund()}>
            Refund table
          </button>
        </div>
      ) : null}
      {canRematch ? (
        <div className="bd-host-tools">
          {rematchOffer && rematchOffer.hostWallet === me ? (
            <CoolBtn href={`/duel/${rematchOffer.pda}`}>Go to rematch</CoolBtn>
          ) : null}
          {rematchOffer && rematchOffer.hostWallet !== me ? (
            <>
              <CoolBtn disabled={busy} pulse={!busy} onClick={() => void joinRematch()}>
                {busy ? "Joining…" : `Join rematch · ${formatEth(rematchOffer.wagerLamports)}`}
              </CoolBtn>
              <CoolBtn variant="ghost" disabled={busy} onClick={openRematch}>
                Different wager
              </CoolBtn>
            </>
          ) : null}
          {!rematchOffer ? (
            <CoolBtn disabled={busy} pulse={!busy} onClick={openRematch}>
              Rematch
            </CoolBtn>
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
            Same table size ({maxPlayers}). Last round was {formatEth(room.wagerLamports)}.
          </p>
          <label className="field">
            <span>Wager (ETH)</span>
            <input
              type="number"
              min={MIN_WAGER_ETH}
              max={MAX_WAGER_ETH}
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
                {v} ETH{v === lastWagerEth ? " · last" : ""}
              </button>
            ))}
          </div>
          {error ? <p className="err">{error}</p> : null}
          <div className="row-actions">
            <CoolBtn variant="ghost" disabled={busy} onClick={() => setRematchOpen(false)}>
              Back
            </CoolBtn>
            <CoolBtn disabled={busy} pulse={!busy} onClick={() => void rematch()}>
              {busy ? "Opening…" : `Lock ${rematchWager || "—"} ETH`}
            </CoolBtn>
          </div>
        </div>
      </div>
    ) : null}
    </>
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
  accent = "var(--ember)",
  dieTone,
  vacant = false,
  nftTokenId,
  stakedNftId,
  advanced = false,
  eliminated = false,
}: {
  title: string;
  profile: { username: string; nftTokenId?: string | null } | null;
  wallet: string | null;
  roll: number | null;
  wins: number;
  you?: boolean;
  winner?: boolean;
  accent?: string;
  dieTone?: string;
  vacant?: boolean;
  nftTokenId?: string | null;
  stakedNftId?: string | null;
  advanced?: boolean;
  eliminated?: boolean;
}) {
  const name = profile?.username ?? (wallet ? shortKey(wallet) : "Empty");
  const characterId = nftTokenId ?? profile?.nftTokenId ?? null;
  return (
    <motion.div
      variants={stagger.item}
      className={`panel player-card arena-v2-player ${you ? "you" : ""} ${winner ? "winner" : ""}${vacant ? " vacant" : ""}${eliminated ? " is-out" : ""}`}
      style={{ "--player-accent": accent } as CSSProperties}
      whileHover={{ y: -4, transition: motionTokens.spring }}
    >
      <div className="player-top">
        <WalletBadge label={name} accent={accent} />
        <div>
          <p className="kicker">{title}</p>
          <p className="you-name">
            {profile?.username ?? (wallet ? shortKey(wallet) : "Empty")}
            {you ? <span className="bd-you-tag">you</span> : null}
            {advanced && !eliminated ? <span className="bd-you-tag">final</span> : null}
          </p>
          {wallet ? (
            <a href={explorerAccount(wallet)} target="_blank" rel="noreferrer">
              {shortKey(wallet)}
            </a>
          ) : (
            <span className="muted">Open seat</span>
          )}
        </div>
        {winner ? <span className="bd-crown">♛</span> : null}
      </div>
      <DiceNftBadge tokenId={characterId} staked={Boolean(stakedNftId && stakedNftId === characterId)} />
      {stakedNftId && stakedNftId !== characterId ? (
        <DiceNftBadge tokenId={stakedNftId} staked />
      ) : null}
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
          <p className="muted">
            {wins} wins{roll != null ? ` · roll ${roll}` : ""}
          </p>
        </>
      )}
    </motion.div>
  );
}
