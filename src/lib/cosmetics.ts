export const DIE_SKINS = ["ice", "chain", "burn"] as const;
export type DieSkin = (typeof DIE_SKINS)[number];

export const ARENAS = [
  { id: "alley", name: "Neon Alley", vibe: "cyan rain, wet pavement, hash pad" },
  { id: "rooftop", name: "Validator Rooftop", vibe: "purple grid over the city" },
  { id: "underpass", name: "Deadnet Underpass", vibe: "lime graffiti, concrete" },
] as const;
export type ArenaId = (typeof ARENAS)[number]["id"];

export function arenaFor(seed: string): (typeof ARENAS)[number] {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n + seed.charCodeAt(i) * (i + 1)) % 997;
  return ARENAS[n % ARENAS.length]!;
}

export function skinForDemon(id?: string | null): DieSkin {
  if (id === "ash-serpent" || id === "night-coil") return "chain";
  if (id === "ember-jackal" || id === "pyre-imp") return "burn";
  return "ice";
}

export const EMOTES = [
  { id: "hot-streak", label: "Hot Streak", glyph: "♛" },
  { id: "bad-beat", label: "Bad Beat", glyph: "💥" },
  { id: "locked-in", label: "Locked In", glyph: "◉" },
  { id: "laughing-skull", label: "Laughing Skull", glyph: "☠" },
  { id: "fist-bump", label: "Electric Fist Bump", glyph: "🤜" },
  { id: "gg", label: "GG", glyph: "✌" },
] as const;

export function resultEmote(args: { youWon?: boolean; inDuel?: boolean; waiting?: boolean }) {
  if (args.waiting) return EMOTES.find((e) => e.id === "locked-in")!;
  if (args.youWon) return EMOTES.find((e) => e.id === "hot-streak")!;
  if (args.inDuel) return EMOTES.find((e) => e.id === "bad-beat")!;
  return EMOTES.find((e) => e.id === "gg")!;
}
