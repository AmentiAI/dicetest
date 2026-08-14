"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatSol, shortKey } from "@/lib/format";
import { explorerTx } from "@/lib/solana/constants";
import { Leaderboard } from "@/components/Leaderboard";

type RoomRow = {
  id: string;
  hostWallet: string;
  challengerWallet: string | null;
  wagerLamports: string;
  status: string;
  hostRoll: number | null;
  challengerRoll: number | null;
  winnerWallet: string | null;
  settleSignature: string | null;
  slotHash: string | null;
  host: { username: string } | null;
  challenger: { username: string } | null;
};

export default function HistoryPage() {
  const [rooms, setRooms] = useState<RoomRow[]>([]);

  useEffect(() => {
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((j) => setRooms(j.rooms ?? []));
  }, []);

  const settled = rooms.filter((r) => r.status === "settled");

  return (
    <div>
      <div className="lobby-head">
        <div>
          <p className="kicker">Receipts</p>
          <h1>Match history</h1>
          <p className="muted">
            Settled circles from Neon, each backed by an on-chain PDA and
            explorer transaction.
          </p>
        </div>
      </div>
      <div className="room-list" style={{ marginBottom: 40 }}>
        {settled.length === 0 ? (
          <div className="empty">No verified rolls yet.</div>
        ) : (
          settled.map((r) => (
            <Link href={`/duel/${r.id}`} key={r.id} className="room-card">
              <div className="room-main">
                <div className="room-top">
                  <h3>
                    {r.host?.username ?? shortKey(r.hostWallet)} vs{" "}
                    {r.challenger?.username ??
                      (r.challengerWallet ? shortKey(r.challengerWallet) : "?")}
                  </h3>
                  <span className="badge settled">settled</span>
                </div>
                <p className="muted">
                  {r.hostRoll ?? "—"} – {r.challengerRoll ?? "—"} · pot{" "}
                  {formatSol((BigInt(r.wagerLamports) * 2n).toString())}
                  {r.settleSignature ? (
                    <>
                      {" "}
                      ·{" "}
                      <span
                        onClick={(e) => {
                          e.preventDefault();
                          window.open(explorerTx(r.settleSignature!), "_blank");
                        }}
                      >
                        tx {shortKey(r.settleSignature, 6, 4)}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <span className="join-cta">Proof</span>
            </Link>
          ))
        )}
      </div>
      <Leaderboard />
    </div>
  );
}
