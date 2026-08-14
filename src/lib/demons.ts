export const DEMONS = [
  {
    id: "cinder-wraith",
    name: "Cinder Wraith",
    blurb: "Smoke with a spine.",
    accent: "#e85d04",
  },
  {
    id: "ash-serpent",
    name: "Ash Serpent",
    blurb: "Coils through slag.",
    accent: "#3dff8a",
  },
  {
    id: "ember-jackal",
    name: "Ember Jackal",
    blurb: "Laughs at the pot.",
    accent: "#e8b86d",
  },
  {
    id: "slag-knight",
    name: "Slag Knight",
    blurb: "Armor poured, not forged.",
    accent: "#7aa2ff",
  },
  {
    id: "night-coil",
    name: "Night Coil",
    blurb: "Quiet until the hash lands.",
    accent: "#c084fc",
  },
  {
    id: "pyre-imp",
    name: "Pyre Imp",
    blurb: "Small. Mean. Lucky.",
    accent: "#ff3b4a",
  },
] as const;

export type DemonId = (typeof DEMONS)[number]["id"];

export function getDemon(id: string) {
  return DEMONS.find((d) => d.id === id) ?? DEMONS[0];
}
