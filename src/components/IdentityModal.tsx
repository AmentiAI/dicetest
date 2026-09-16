"use client";

import { useState } from "react";
import { useProfile } from "./ProfileProvider";
import { CoolBtn } from "./CoolBtn";
import { NftPicker } from "./NftPicker";

export function IdentityModal() {
  const { profile, save } = useProfile();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [nftId, setNftId] = useState(profile?.nftTokenId ?? "0");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      await save(username.trim(), nftId);
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
          Signed by your ETH wallet. If you hold a Block Dice NFT, equip it as
          your character. Betting it is optional — you choose that when you open
          a circle.
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
        <NftPicker
          value={nftId}
          onChange={setNftId}
          noneLabel="Default die"
          label="Equip a dice NFT (optional)"
        />
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
