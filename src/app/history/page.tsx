"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { formatSol, shortKey } from "@/lib/format";
import { getJson } from "@/lib/http";
import {
  explorerAccount,
  explorerSlot,
  explorerTx,
} from "@/lib/solana/constants";
import { deriveRolls } from "@/lib/solana/dice";
import { fromHex } from "@/lib/solana/bytes";
import { Leaderboard } from "@/components/Leaderboard";

type RoomRow = {
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
  host: { username: string } | null;
  challenger: { username: string } | null;
};

function proofCheck(r: RoomRow): "ok" | "fail" | "incomplete" {
  if (
    !r.slotHash ||
    !r.challengerWallet ||
    !r.revealSlot ||
    r.hostRoll == null ||
    r.challengerRoll == null
  ) {
    return "incomplete";
  }
  try {
    const derived = deriveRolls({
      slotHash: fromHex(r.slotHash),
      duel: new PublicKey(r.id),
      host: new PublicKey(r.hostWallet),
      challenger: new PublicKey(r.challengerWallet),
      wagerLamports: r.wagerLamports,
      revealSlot: r.revealSlot,
    });
    return derived.hostRoll === r.hostRoll && derived.challengerRoll === r.challengerRoll
      ? "ok"
      : "fail";
  } catch {
    return "fail";
  }
}

function Tx({ sig }: { sig: string | null }) {
  if (!sig) return <>—</>;
  return (
    <a href={explorerTx(sig)} target="_blank" rel="noreferrer" title={sig}>
      {sig}
    </a>
  );
}

export default function HistoryPage() {
  const [rooms, setRooms] = useState<RoomRow[]>([]);

  useEffect(() => {
    void getJson<{ rooms: RoomRow[] }>("/api/rooms?status=settled&limit=200").then(
      (j) => setRooms(j?.rooms ?? []),
    );
  }, []);

  return (
    <div>
      <div className="lobby-head">
        <div>
          <p className="kicker">Receipts</p>
          <h1>Match history</h1>
          <p className="muted">
            Every settled circle with the slot hash, rolls, PDA, and explorer
            transactions used to prove the result.
          </p>
        </div>
      </div>
      <div className="history-list">
        {rooms.length === 0 ? (
          <div className="empty">No verified rolls yet.</div>
        ) : (
          rooms.map((r) => {
            const pot = (BigInt(r.wagerLamports) * 2n).toString();
            const winnerName =
              r.winnerWallet === r.hostWallet
                ? r.host?.username ?? shortKey(r.winnerWallet)
                : r.winnerWallet === r.challengerWallet
                  ? r.challenger?.username ??
                    (r.winnerWallet ? shortKey(r.winnerWallet) : "?")
                  : r.winnerWallet
                    ? shortKey(r.winnerWallet)
                    : "—";
            const check = proofCheck(r);
            return (
              <article key={r.id} className="history-card">
                <header className="history-head">
                  <div>
                    <h3>
                      {r.host?.username ?? shortKey(r.hostWallet)} vs{" "}
                      {r.challenger?.username ??
                        (r.challengerWallet ? shortKey(r.challengerWallet) : "?")}
                    </h3>
                    <p className="muted">
                      {r.hostRoll ?? "—"} – {r.challengerRoll ?? "—"} · {winnerName}{" "}
                      takes {formatSol(pot)}
                    </p>
                  </div>
                  <div className="history-head-actions">
                    <span className={`badge settled`}>{r.status}</span>
                    <span className={`proof-flag is-${check}`}>
                      {check === "ok"
                        ? "Hash recomputed"
                        : check === "fail"
                          ? "Hash mismatch"
                          : "Incomplete"}
                    </span>
                    <Link href={`/duel/${r.id}`} className="btn-ghost btn-compact">
                      Open circle
                    </Link>
                  </div>
                </header>
                <div className="proof-box history-proof">
                  <p className="kicker">Proof</p>
                  <dl>
                    <div>
                      <dt>Host roll</dt>
                      <dd>{r.hostRoll ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Challenger roll</dt>
                      <dd>{r.challengerRoll ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Winner</dt>
                      <dd>
                        {r.winnerWallet ? (
                          <a
                            href={explorerAccount(r.winnerWallet)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {winnerName} · {r.winnerWallet}
                          </a>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Each wager</dt>
                      <dd>{formatSol(r.wagerLamports)}</dd>
                    </div>
                    <div>
                      <dt>Pot</dt>
                      <dd>{formatSol(pot)}</dd>
                    </div>
                    <div>
                      <dt>PDA</dt>
                      <dd className="proof-hash">
                        <a href={explorerAccount(r.id)} target="_blank" rel="noreferrer">
                          {r.id}
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt>Duel id</dt>
                      <dd>{r.duelId}</dd>
                    </div>
                    <div>
                      <dt>Host</dt>
                      <dd className="proof-hash">
                        <a
                          href={explorerAccount(r.hostWallet)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {r.hostWallet}
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt>Challenger</dt>
                      <dd className="proof-hash">
                        {r.challengerWallet ? (
                          <a
                            href={explorerAccount(r.challengerWallet)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {r.challengerWallet}
                          </a>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Commit slot</dt>
                      <dd>
                        {r.commitSlot ? (
                          <a href={explorerSlot(r.commitSlot)} target="_blank" rel="noreferrer">
                            {r.commitSlot}
                          </a>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Reveal slot</dt>
                      <dd>
                        {r.revealSlot ? (
                          <a href={explorerSlot(r.revealSlot)} target="_blank" rel="noreferrer">
                            {r.revealSlot}
                          </a>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Slot hash</dt>
                      <dd className="proof-hash">{r.slotHash ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Create tx</dt>
                      <dd className="proof-hash">
                        <Tx sig={r.createSignature} />
                      </dd>
                    </div>
                    <div>
                      <dt>Join tx</dt>
                      <dd className="proof-hash">
                        <Tx sig={r.joinSignature} />
                      </dd>
                    </div>
                    <div>
                      <dt>Settle tx</dt>
                      <dd className="proof-hash">
                        <Tx sig={r.settleSignature} />
                      </dd>
                    </div>
                    <div>
                      <dt>Mix</dt>
                      <dd className="proof-hash">
                        SHA-256(slot_hash ∥ pda ∥ host ∥ challenger ∥ wager ∥
                        reveal_slot ∥ counter)
                      </dd>
                    </div>
                  </dl>
                </div>
              </article>
            );
          })
        )}
      </div>
      <Leaderboard />
    </div>
  );
}
