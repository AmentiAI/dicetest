"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson } from "@/lib/http";
import { SlowRollDie } from "./SlowRollDie";
import { RARITY_ORDER, raritySlug, type SlowRollNft } from "@/lib/slow-roll/die";

type PagePayload = {
  page: number;
  pages: number;
  total: number;
  size: number;
  items: SlowRollNft[];
};

export function NftMysterySlider() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PagePayload | null>(null);

  const load = useCallback(async (next: number) => {
    const json = await getJson<PagePayload>(`/api/nfts?page=${next}`);
    if (json) setData(json);
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  useEffect(() => {
    if (!data?.pages) return;
    const t = setInterval(() => {
      setPage((p) => (p + 1) % data.pages);
    }, 9000);
    return () => clearInterval(t);
  }, [data?.pages]);

  const pages = data?.pages ?? 1;
  const start = (data?.page ?? 0) * (data?.size ?? 12) + 1;
  const end = Math.min(data?.total ?? 0, start + (data?.items.length ?? 0) - 1);

  return (
    <section className="glass-panel nft-reel">
      <header className="nft-reel-head">
        <div>
          <p className="dash-eyebrow">Slow Roll collection</p>
          <h2>2,500 named dice — still classified</h2>
          <p className="muted">
            Join the whitelist to mint one. $1 per die. 5% creator fee. That NFT
            is the dice you roll in-game. Twelve per slide — names still hidden.
          </p>
        </div>
        <p className="nft-reel-range">
          {data ? `#${String(start).padStart(4, "0")}–${String(end).padStart(4, "0")}` : "…"}
        </p>
      </header>
      <ul className="nft-rarity-key" aria-label="Rarity colors">
        {RARITY_ORDER.map((tier) => (
          <li key={tier} className={`rarity-${tier}`}>
            {tier}
          </li>
        ))}
      </ul>
      <div className="nft-reel-grid">
        {(data?.items ?? Array.from({ length: 12 }, (_, i) => i)).map((item, idx) =>
          typeof item === "number" ? (
            <div key={idx} className="nft-mystery is-empty" />
          ) : (
            <article
              key={item.i}
              className={`nft-mystery rarity-${raritySlug(item.r)}`}
            >
              <SlowRollDie nft={item} size={112} sync />
              <div className="nft-mystery-veil" aria-hidden>
                <span>?</span>
              </div>
            </article>
          ),
        )}
      </div>
      <div className="nft-reel-nav">
        <button
          type="button"
          className="chip"
          disabled={!data}
          onClick={() => setPage((p) => (p - 1 + pages) % pages)}
        >
          Prev
        </button>
        <span className="muted">
          Slide {page + 1} / {pages}
        </span>
        <button
          type="button"
          className="chip"
          disabled={!data}
          onClick={() => setPage((p) => (p + 1) % pages)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
