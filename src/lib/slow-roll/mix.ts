import { raritySlug, type SlowRollNft } from "./die";

const TIER_ORDER = ["legendary", "epic", "rare", "uncommon", "common"] as const;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], seed: number) {
  const next = mulberry32(seed);
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const a = out[i]!;
    out[i] = out[j]!;
    out[j] = a;
  }
  return out;
}

/** Spread rarities evenly so every slide of 20 is a mix, not a rarity block. */
export function mixByRarity(items: SlowRollNft[]) {
  const buckets = new Map<string, SlowRollNft[]>();
  for (const item of items) {
    const key = raritySlug(item.r);
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }

  const total = items.length;
  const slots: Array<SlowRollNft | null> = Array.from({ length: total }, () => null);

  TIER_ORDER.forEach((tier, tierIdx) => {
    const pile = shuffle(buckets.get(tier) ?? [], 1109 + tierIdx * 7919);
    const n = pile.length;
    if (!n) return;
    for (let i = 0; i < n; i++) {
      let slot = (Math.floor((i * total) / n) + tierIdx * 5) % total;
      while (slots[slot]) slot = (slot + 1) % total;
      slots[slot] = pile[i]!;
    }
  });

  return slots.filter((item): item is SlowRollNft => item != null);
}
