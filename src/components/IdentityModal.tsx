"use client";

import { useState } from "react";
import { useProfile } from "./ProfileProvider";
import { CoolBtn } from "./CoolBtn";

export function IdentityModal() {
  const { profile, save } = useProfile();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      await save(username.trim());
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
        {error ? <p className="err">{error}</p> : null}
        <CoolBtn
          fullWidth
          pulse={!busy}
          disabled={busy || username.trim().length < 2}
          onClick={() => void onSave()}
        >
          {busy ? "Signing…" : "Bind identity"}
        </CoolBtn>
      </div>
    </div>
  );
}
