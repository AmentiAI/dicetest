import type { DieTone } from "@/lib/cosmetics";
import { DEMONS } from "@/lib/demons";

export const NFT_TONES: DieTone[] = [
  "ice",
  "chain",
  "burn",
  "black-red",
  "green-purple",
  "orange-blue",
];

export function nftTone(skin: number | string | null | undefined): DieTone {
  const n = Number(skin ?? 0);
  if (!Number.isFinite(n) || n < 0) return NFT_TONES[0]!;
  return NFT_TONES[n % NFT_TONES.length]!;
}

export function nftLabel(skin: number | string | null | undefined) {
  const n = Number(skin ?? 0);
  return DEMONS[n % DEMONS.length]?.name ?? "Block Dice";
}

export function nftImageSrc(tokenId: string | number) {
  return `/api/nft/${tokenId}/image`;
}

export function toneFromDemon(demon?: string | null): DieTone | null {
  const i = DEMONS.findIndex((d) => d.id === demon);
  if (i < 0) return null;
  return NFT_TONES[i % NFT_TONES.length]!;
}

export function characterTone(
  profile: { demon?: string | null; nftTokenId?: string | null } | null | undefined,
  fallback: DieTone,
): DieTone {
  if (profile?.nftTokenId && profile.nftTokenId !== "0") {
    return toneFromDemon(profile.demon) ?? fallback;
  }
  return fallback;
}

export function isNftId(id?: string | null) {
  return Boolean(id && id !== "0");
}
