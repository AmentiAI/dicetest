"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ethToWei } from "@/lib/format";
import { postJson } from "@/lib/http";
import { MIN_WAGER_ETH, MAX_WAGER_ETH } from "@/lib/eth/constants";
import { useDuelActions } from "@/lib/eth/useDuelActions";
import { useEthWallet } from "@/lib/eth/wallet";
import { useProfile } from "./ProfileProvider";
import { ArenaPicker } from "./ArenaPicker";
import { CoolBtn } from "./CoolBtn";
import { NftPicker } from "./NftPicker";
import type { ArenaId } from "@/lib/cosmetics";

export function CreateDuel({ initialWager }: { initialWager?: string } = {}) {
  const { address, openConnectModal } = useEthWallet();
  const duel = useDuelActions();
  const { profile, save } = useProfile();
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(initialWager));
  const [wager, setWager] = useState(initialWager ?? "0.05");
  const [arena, setArena] = useState<ArenaId>("alley");
  const [nftId, setNftId] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wei = useMemo(() => {
    const n = Number(wager);
    if (!Number.isFinite(n) || n < 0) return 0n;
    return ethToWei(n);
  }, [wager]);

  async function create() {
    if (!address) {
      openConnectModal();
      return;
    }
    if (!profile) {
      setError("Bind your identity first");
      return;
    }
    const n = Number(wager);
    const bettingNft = nftId !== "0" && nftId !== "";
    if (!bettingNft && (n < MIN_WAGER_ETH || n > MAX_WAGER_ETH)) {
      setError(`Wager must be ${MIN_WAGER_ETH}–${MAX_WAGER_ETH} ETH, or stake a dice NFT`);
      return;
    }
    if (bettingNft && n > 0 && (n < MIN_WAGER_ETH || n > MAX_WAGER_ETH)) {
      setError(`ETH side-bet must be ${MIN_WAGER_ETH}–${MAX_WAGER_ETH} ETH`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (bettingNft && (!profile.nftTokenId || profile.nftTokenId === "0")) {
        await save(profile.username, nftId);
      }
      const tokenId = bettingNft ? BigInt(nftId) : 0n;
      const { hash, id } = await duel.createDuel({
        wagerWei: bettingNft && n === 0 ? 0n : wei,
        tokenId,
      });
      const json = await postJson<{ room?: { id: string } }>("/api/rooms", {
        pda: id,
        duelId: id,
        hostWallet: address,
        wagerLamports: (bettingNft && n === 0 ? 0n : wei).toString(),
        createSignature: hash,
        arena,
      });
      if (!json.room) throw new Error("Room record failed");
      router.push(`/duel/${id}`);
    } catch (e) {
      setError(duel.explain(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <CoolBtn className="btn-compact" pulse onClick={() => setOpen(true)}>
        + Open a circle
      </CoolBtn>
      {open ? (
        <div className="overlay" onClick={() => !busy && setOpen(false)}>
          <div className="panel create-panel" onClick={(e) => e.stopPropagation()}>
            <p className="kicker">New 1v1</p>
            <h2>Lock a wager</h2>
            <p className="muted">
              Stake ETH, your Block Dice NFT, or both. A challenger matches it.
              After three blocks, the reveal blockhash rolls both dice. Winner
              takes the pot. No house cut.
            </p>
            <label className="field">
              <span>Wager (ETH)</span>
              <input
                type="number"
                min={0}
                max={MAX_WAGER_ETH}
                step="0.0001"
                value={wager}
                onChange={(e) => setWager(e.target.value)}
              />
            </label>
            <NftPicker
              value={nftId}
              onChange={setNftId}
              noneLabel="Don't stake NFT"
              label="Bet a dice NFT (optional — winner takes both dice)"
            />
            <ArenaPicker value={arena} onChange={setArena} />
            <div className="chip-row">
              {["0", "0.01", "0.05", "0.1", "0.25", "1"].map((v) => (
                <button key={v} type="button" className="chip" onClick={() => setWager(v)}>
                  {v === "0" ? "NFT only" : `${v} ETH`}
                </button>
              ))}
            </div>
            {error ? <p className="err">{error}</p> : null}
            <div className="row-actions">
              <CoolBtn variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
                Back
              </CoolBtn>
              <CoolBtn disabled={busy} pulse={!busy} onClick={() => void create()}>
                {busy ? "Sending…" : "Lock wager on-chain"}
              </CoolBtn>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
