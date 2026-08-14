export const DEMONS = [
  {
    id: "cinder-wraith",
    name: "Cinder Wraith",
    blurb: "Smoke with a spine.",
    accent: "#e10600",
  },
  {
    id: "ash-serpent",
    name: "Ash Serpent",
    blurb: "Coils through slag.",
    accent: "#ff3b3b",
  },
  {
    id: "ember-jackal",
    name: "Ember Jackal",
    blurb: "Laughs at the pot.",
    accent: "#b91c1c",
  },
  {
    id: "slag-knight",
    name: "Slag Knight",
    blurb: "Armor poured, not forged.",
    accent: "#8b0000",
  },
  {
    id: "night-coil",
    name: "Night Coil",
    blurb: "Quiet until the hash lands.",
    accent: "#ff6b6b",
  },
  {
    id: "pyre-imp",
    name: "Pyre Imp",
    blurb: "Small. Mean. Lucky.",
    accent: "#ff2a2a",
  },
] as const;

export type DemonId = (typeof DEMONS)[number]["id"];

export function getDemon(id: string) {
  return DEMONS.find((d) => d.id === id) ?? DEMONS[0];
}
