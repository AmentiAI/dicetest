"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useEthWallet } from "@/lib/eth/wallet";
import { adminAuthMessage } from "@/lib/auth";
import { formatEth, shortKey } from "@/lib/format";
import { postJson, requestJson } from "@/lib/http";
import { explorerAccount, explorerTx } from "@/lib/eth/constants";
import { WalletButton } from "./WalletButton";

type TxKind = "create" | "join" | "settle";
type Tab = "txs" | "circles" | "players" | "events";

type TxRow = {
  id: string;
  kind: TxKind;
  signature: string;
  at: string;
  roomId: string;
  duelId: string;
  status: string;
  hostWallet: string;
  challengerWallet: string | null;
  wagerLamports: string;
  winnerWallet: string | null;
  hostRoll: number | null;
  challengerRoll: number | null;
  slotHash: string | null;
  revealSlot: string | null;
};

type RoomRow = {
  id: string;
  duelId: string;
  hostWallet: string;
  challengerWallet: string | null;
  wagerLamports: string;
  status: string;
  hostRoll: number | null;
  challengerRoll: number | null;
  winnerWallet: string | null;
  slotHash: string | null;
  createSignature: string;
  joinSignature: string | null;
  settleSignature: string | null;
  revealSlot: string | null;
  createdAt: string;
  updatedAt: string;
};

type EventRow = {
  id: number;
  roomId: string;
  event: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

type ProfileRow = {
  wallet: string;
  username: string;
  demon: string;
  wins: number;
  losses: number;
  volumeLamports: string;
  createdAt: string;
  updatedAt: string;
};

type AdminPayload = {
  stats: {
    rooms: number;
    waiting: number;
    locked: number;
    settled: number;
    cancelled: number;
    refunded: number;
    players: number;
    creates: number;
    joins: number;
    settles: number;
    txs: number;
    waitingLamports: string;
    lockedLamports: string;
    settledLamports: string;
  };
  txs: TxRow[];
  rooms: RoomRow[];
  events: EventRow[];
  profiles: ProfileRow[];
};

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AdminDesk() {
  const { address, signMessage } = useEthWallet();
  const me = address;
  const [data, setData] = useState<AdminPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<Tab>("txs");
  const [kind, setKind] = useState<"all" | TxKind>("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!me) {
      setData(null);
      setDenied(false);
      setError(null);
      return;
    }
    if (!signMessage) {
      setData(null);
      setDenied(false);
      setError("This wallet cannot sign messages, so the admin desk cannot authenticate.");
      return;
    }
    let stop = false;
    let giveUp = false;
    let inFlight = false;
    const storageKey = `bd-admin-session:${me}`;

    const ensureToken = async (force = false) => {
      if (!force) {
        const cached = sessionStorage.getItem(storageKey);
        if (cached) return cached;
      }
      const ts = Date.now();
      const message = adminAuthMessage(me, ts);
      const sig = await signMessage(message);
      const json = await postJson<{ token: string }>("/api/admin", {
        wallet: me,
        ts,
        signatureBase64: sig,
      });
      sessionStorage.setItem(storageKey, json.token);
      return json.token;
    };

    const tick = async () => {
      if (giveUp || inFlight) return;
      inFlight = true;
      try {
        let token = await ensureToken();
        if (stop) return;
        let { status: httpStatus, json } = await requestJson<AdminPayload>("GET", "/api/admin", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (stop) return;
        if (httpStatus === 401) {
          sessionStorage.removeItem(storageKey);
          token = await ensureToken(true);
          if (stop) return;
          ({ status: httpStatus, json } = await requestJson<AdminPayload>("GET", "/api/admin", {
            headers: { Authorization: `Bearer ${token}` },
          }));
        }
        if (httpStatus === 403) {
          giveUp = true;
          setDenied(true);
          setError("This wallet is not on the server admin allowlist.");
          return;
        }
        if (httpStatus === 503) {
          giveUp = true;
          setError("Admin is not configured. Set ADMIN_WALLETS on the server.");
          return;
        }
        if (!json || httpStatus >= 300) {
          setError(json?.error || "The admin feed failed to load.");
          return;
        }
        setDenied(false);
        setError(null);
        setData(json);
      } catch (e) {
        if (stop) return;
        giveUp = true;
        const message = e instanceof Error ? e.message : "Admin authentication failed.";
        if (/forbidden/i.test(message)) {
          setDenied(true);
          setError("This wallet is not on the server admin allowlist.");
          return;
        }
        setError(message);
      } finally {
        inFlight = false;
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 8_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [me, signMessage]);

  const needle = q.trim().toLowerCase();

  const txs = useMemo(() => {
    if (!data) return [];
    return data.txs.filter((tx) => {
      if (kind !== "all" && tx.kind !== kind) return false;
      if (status !== "all" && tx.status !== status) return false;
      if (!needle) return true;
      return [
        tx.signature,
        tx.roomId,
        tx.hostWallet,
        tx.challengerWallet,
        tx.winnerWallet,
        tx.kind,
        tx.slotHash,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [data, kind, status, needle]);

  const circles = useMemo(() => {
    if (!data) return [];
    return data.rooms.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!needle) return true;
      return [
        r.id,
        r.hostWallet,
        r.challengerWallet,
        r.winnerWallet,
        r.createSignature,
        r.joinSignature,
        r.settleSignature,
        r.slotHash,
        r.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [data, status, needle]);

  const people = useMemo(() => {
    if (!data) return [];
    return data.profiles.filter((p) => {
      if (!needle) return true;
      return `${p.wallet} ${p.username} ${p.demon}`.toLowerCase().includes(needle);
    });
  }, [data, needle]);

  const events = useMemo(() => {
    if (!data) return [];
    return data.events.filter((e) => {
      if (!needle) return true;
      return `${e.event} ${e.roomId} ${JSON.stringify(e.payload ?? {})}`
        .toLowerCase()
        .includes(needle);
    });
  }, [data, needle]);

  if (!me) {
    return (
      <div className="admin-gate">
        <p className="kicker">Staff</p>
        <h1>Admin</h1>
        <p className="muted">Connect an allowlisted wallet to monitor every on-chain tx.</p>
        <WalletButton />
      </div>
    );
  }

  if (denied && !data) {
    return (
      <div className="admin-gate">
        <p className="kicker">Staff</p>
        <h1>Locked</h1>
        <p className="muted">
          {shortKey(me)} is not on the server admin allowlist. Set{" "}
          <code>ADMIN_WALLETS</code> to a comma-separated list of pubkeys. Do not
          put that list in any <code>NEXT_PUBLIC_</code> variable.
        </p>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="admin">
      <div className="lobby-head">
        <div>
          <p className="kicker">Live ops</p>
          <h1>Transaction desk</h1>
          <p className="muted">
            Every create, join, and settle signature from Neon, with explorer
            receipts. Refreshes every 4s.
          </p>
        </div>
        <div className="admin-head-actions">
          <button
            className="btn-ghost btn-compact"
            type="button"
            disabled={!data}
            onClick={() => data && downloadCsv(data.txs)}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="admin-kpis">
        <Kpi label="Transactions" value={stats?.txs ?? "—"} />
        <Kpi label="Creates" value={stats?.creates ?? "—"} />
        <Kpi label="Joins" value={stats?.joins ?? "—"} />
        <Kpi label="Settles" value={stats?.settles ?? "—"} />
        <Kpi label="Waiting" value={stats?.waiting ?? "—"} />
        <Kpi label="Locked pot" value={stats ? formatEth(stats.lockedLamports) : "—"} />
        <Kpi label="Settled volume" value={stats ? formatEth(stats.settledLamports) : "—"} />
        <Kpi label="Players" value={stats?.players ?? "—"} />
      </div>

      <div className="admin-toolbar">
        <div className="admin-tabs">
          {(
            [
              ["txs", `Txs ${txs.length}`],
              ["circles", `Circles ${circles.length}`],
              ["players", `Players ${people.length}`],
              ["events", `Events ${events.length}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`chip${tab === id ? " is-on" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          className="admin-search"
          placeholder="Search wallet, signature, duel id, hash…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {tab === "txs" ? (
        <div className="admin-filters">
          {(["all", "create", "join", "settle"] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`chip${kind === k ? " is-on" : ""}`}
              onClick={() => setKind(k)}
            >
              {k}
            </button>
          ))}
          {["all", "waiting", "locked", "settled", "cancelled", "refunded"].map((s) => (
            <button
              key={s}
              type="button"
              className={`chip${status === s ? " is-on" : ""}`}
              onClick={() => setStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "circles" ? (
        <div className="admin-filters">
          {["all", "waiting", "locked", "settled", "cancelled", "refunded"].map((s) => (
            <button
              key={s}
              type="button"
              className={`chip${status === s ? " is-on" : ""}`}
              onClick={() => setStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="err">{error}</p> : null}
      {!data && !error ? <div className="empty">Loading admin feed…</div> : null}

      {tab === "txs" && data ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Kind</th>
                <th>Signature</th>
                <th>Circle</th>
                <th>Wager</th>
                <th>Host</th>
                <th>Challenger</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {txs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    No matching transactions.
                  </td>
                </tr>
              ) : (
                txs.map((tx) => (
                  <tr key={tx.id}>
                    <td className="mono">{when(tx.at)}</td>
                    <td>
                      <span className={`badge ${tx.kind}`}>{tx.kind}</span>
                    </td>
                    <td className="mono">
                      <a href={explorerTx(tx.signature)} target="_blank" rel="noreferrer">
                        {shortKey(tx.signature, 8, 8)}
                      </a>
                    </td>
                    <td>
                      <Link href={`/duel/${tx.roomId}`}>{shortKey(tx.roomId, 4, 4)}</Link>
                      <div>
                        <span className={`badge ${tx.status}`}>{tx.status}</span>
                      </div>
                    </td>
                    <td>{formatEth(tx.wagerLamports)}</td>
                    <td className="mono">
                      <a href={explorerAccount(tx.hostWallet)} target="_blank" rel="noreferrer">
                        {shortKey(tx.hostWallet)}
                      </a>
                    </td>
                    <td className="mono">
                      {tx.challengerWallet ? (
                        <a
                          href={explorerAccount(tx.challengerWallet)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shortKey(tx.challengerWallet)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="mono">
                      {tx.kind === "settle" && tx.hostRoll && tx.challengerRoll ? (
                        <>
                          {tx.hostRoll}–{tx.challengerRoll}
                          {tx.winnerWallet ? (
                            <>
                              <br />
                              {shortKey(tx.winnerWallet)}
                            </>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "circles" && data ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Updated</th>
                <th>Status</th>
                <th>Duel</th>
                <th>Wager</th>
                <th>Host</th>
                <th>Challenger</th>
                <th>Rolls</th>
                <th>Txs</th>
              </tr>
            </thead>
            <tbody>
              {circles.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{when(r.updatedAt)}</td>
                  <td>
                    <span className={`badge ${r.status}`}>{r.status}</span>
                  </td>
                  <td className="mono">
                    <Link href={`/duel/${r.id}`}>{shortKey(r.id, 6, 6)}</Link>
                  </td>
                  <td>{formatEth(r.wagerLamports)}</td>
                  <td className="mono">{shortKey(r.hostWallet)}</td>
                  <td className="mono">
                    {r.challengerWallet ? shortKey(r.challengerWallet) : "—"}
                  </td>
                  <td>
                    {r.hostRoll && r.challengerRoll ? `${r.hostRoll}–${r.challengerRoll}` : "—"}
                  </td>
                  <td className="mono">
                    <a href={explorerTx(r.createSignature)} target="_blank" rel="noreferrer">
                      c
                    </a>
                    {r.joinSignature ? (
                      <>
                        {" "}
                        <a href={explorerTx(r.joinSignature)} target="_blank" rel="noreferrer">
                          j
                        </a>
                      </>
                    ) : null}
                    {r.settleSignature ? (
                      <>
                        {" "}
                        <a href={explorerTx(r.settleSignature)} target="_blank" rel="noreferrer">
                          s
                        </a>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "players" && data ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Wallet</th>
                <th>Demon</th>
                <th>W</th>
                <th>L</th>
                <th>Volume</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.wallet}>
                  <td>{p.username}</td>
                  <td className="mono">
                    <a href={explorerAccount(p.wallet)} target="_blank" rel="noreferrer">
                      {shortKey(p.wallet, 6, 6)}
                    </a>
                  </td>
                  <td>{p.demon}</td>
                  <td>{p.wins}</td>
                  <td>{p.losses}</td>
                  <td>{formatEth(p.volumeLamports)}</td>
                  <td className="mono">{when(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "events" && data ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Circle</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{when(e.createdAt)}</td>
                  <td>
                    <span className={`badge ${e.event}`}>{e.event}</span>
                  </td>
                  <td className="mono">
                    <Link href={`/duel/${e.roomId}`}>{shortKey(e.roomId, 6, 6)}</Link>
                  </td>
                  <td className="mono proof-hash">
                    {e.payload ? JSON.stringify(e.payload) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="admin-kpi">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function downloadCsv(txs: TxRow[]) {
  const header = [
    "time",
    "kind",
    "signature",
    "room",
    "status",
    "host",
    "challenger",
    "wager_lamports",
    "winner",
    "host_roll",
    "challenger_roll",
    "slot_hash",
  ];
  const lines = txs.map((tx) =>
    [
      tx.at,
      tx.kind,
      tx.signature,
      tx.roomId,
      tx.status,
      tx.hostWallet,
      tx.challengerWallet ?? "",
      tx.wagerLamports,
      tx.winnerWallet ?? "",
      tx.hostRoll ?? "",
      tx.challengerRoll ?? "",
      tx.slotHash ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `blockdice-txs-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
