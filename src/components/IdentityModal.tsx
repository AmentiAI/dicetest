"use client";

import { useState } from "react";
import { DEMONS } from "@/lib/demons";
import { DemonPortrait } from "./DemonPortrait";
import { useProfile } from "./ProfileProvider";

export function IdentityModal() {
  const { profile, save } = useProfile();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [demon, setDemon] = useState(profile?.demon ?? DEMONS[0].id);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      await save(username.trim(), demon);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not bind identity");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay">
      <div className="panel identity-panel">
        <p className="kicker">Call sign</p>
        <h2>Name the duelist</h2>
        <p className="muted">
        Signed by your wallet. Stored in Neon. The chain only sees the pubkey
          and the SOL.
        </p>
        <label className="field">
          <span>Your name</span>
          <input
            value={username}
            maxLength={20}
            placeholder="Ashwalker"
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <p className="field-label">Select your shade</p>
        <div className="demon-row">
          {DEMONS.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`demon-pick ${demon === d.id ? "on" : ""}`}
              onClick={() => setDemon(d.id)}
              style={{ color: d.accent }}
            >
              <DemonPortrait id={d.id} size={56} selected={demon === d.id} />
              <span>{d.name}</span>
            </button>
          ))}
        </div>
        {error ? <p className="err">{error}</p> : null}
        <button
          className="btn-ember"
          disabled={busy || username.trim().length < 2}
          onClick={() => void onSave()}
        >
          {busy ? "Signing…" : "Bind identity"}
        </button>
      </div>
    </div>
  );
}
