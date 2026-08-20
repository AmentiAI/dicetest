export const DIE_SKINS = ["ice", "chain", "burn"] as const;
export type DieSkin = (typeof DIE_SKINS)[number];

/** Two-tone dice pairs used in arenas and on the homepage. */
export const HERO_DIE_TONES = ["black-red", "green-purple", "orange-blue"] as const;
export type HeroDieTone = (typeof HERO_DIE_TONES)[number];

export type GlassDieTone = "glass-purple" | "glass-green" | "glass-orange";
export type DieTone = DieSkin | "black" | "red" | HeroDieTone | GlassDieTone;

export const ARENAS = [
  {
    id: "alley",
    name: "Rain Alley",
    tagline: "Wet pavement · street lamps · steady rain",
    accent: "#94a3b8",
    hostSkin: "black-red" as HeroDieTone,
    guestSkin: "green-purple" as HeroDieTone,
    hostAccent: "#ef4444",
    guestAccent: "#9333ea",
  },
  {
    id: "rooftop",
    name: "Snow Summit",
    tagline: "Alpine ridge · cold air · drifting snowfall",
    accent: "#cbd5e1",
    hostSkin: "green-purple" as HeroDieTone,
    guestSkin: "orange-blue" as HeroDieTone,
    hostAccent: "#22c55e",
    guestAccent: "#2563eb",
  },
  {
    id: "underpass",
    name: "Forest Glen",
    tagline: "Mossy stone · canopy light · morning mist",
    accent: "#86efac",
    hostSkin: "orange-blue" as HeroDieTone,
    guestSkin: "black-red" as HeroDieTone,
    hostAccent: "#f97316",
    guestAccent: "#ef4444",
  },
] as const;

export type ArenaId = (typeof ARENAS)[number]["id"];
export type Arena = (typeof ARENAS)[number];

export function parseArenaId(raw: unknown): ArenaId {
  if (typeof raw === "string" && ARENAS.some((a) => a.id === raw)) {
    return raw as ArenaId;
  }
  return "alley";
}

export function getArena(id: ArenaId | string): Arena {
  return ARENAS.find((a) => a.id === id) ?? ARENAS[0]!;
}

/** Fallback when a room has no stored arena (legacy circles). */
export function arenaForSeed(seed: string): Arena {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n + seed.charCodeAt(i) * (i + 1)) % 997;
  return ARENAS[n % ARENAS.length]!;
}

export function toneAccent(tone: HeroDieTone): string {
  if (tone === "black-red") return "#ef4444";
  if (tone === "green-purple") return "#22c55e";
  return "#f97316";
}
