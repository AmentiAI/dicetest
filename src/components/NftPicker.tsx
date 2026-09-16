"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/http";
import { nftImageSrc } from "@/lib/eth/nft";
import { useEthWallet } from "@/lib/eth/wallet";

type Token = { id: string; skin: number; name: string };

export function NftPicker({
  value,
  onChange,
  allowNone = true,
  label = "Dice NFT",
  noneLabel = "None",
}: {
  value: string;
  onChange: (id: string) => void;
  allowNone?: boolean;
  label?: string;
  noneLabel?: string;
}) {
  const { address } = useEthWallet();
  const [tokens, setTokens] = useState<Token[]>([]);

  useEffect(() => {
    if (!address) {
      setTokens([]);
      return;
    }
    let stop = false;
    void getJson<{ tokens: Token[] }>(`/api/nft?wallet=${address}`).then((json) => {
      if (!stop) setTokens(json?.tokens ?? []);
    });
    return () => {
      stop = true;
    };
  }, [address]);

  if (!address) {
    return <p className="muted">Connect a wallet to load your dice NFTs.</p>;
  }

  return (
    <label className="field">
      <span>{label}</span>
      <div className="nft-picker">
        {allowNone ? (
          <button
            type="button"
            className={`nft-pick${value === "0" || !value ? " is-on" : ""}`}
            onClick={() => onChange("0")}
          >
            {noneLabel}
          </button>
        ) : null}
        {tokens.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`nft-pick${value === t.id ? " is-on" : ""}`}
            onClick={() => onChange(t.id)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={nftImageSrc(t.id)} alt="" width={28} height={28} />
            {t.name} #{t.id}
          </button>
        ))}
        {tokens.length === 0 ? (
          <p className="muted">No Block Dice NFTs in this wallet yet.</p>
        ) : null}
      </div>
    </label>
  );
}

export function DiceNftBadge({
  tokenId,
  name,
  staked = false,
}: {
  tokenId?: string | null;
  name?: string | null;
  staked?: boolean;
}) {
  if (!tokenId || tokenId === "0") return null;
  return (
    <span className={`nft-badge${staked ? " is-staked" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={nftImageSrc(tokenId)} alt="" width={22} height={22} />
      {name ? `${name} ` : ""}#{tokenId}
      {staked ? <em>staked</em> : null}
    </span>
  );
}
