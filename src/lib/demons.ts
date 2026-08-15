export const DEMONS = [
  {
    id: "cinder-wraith",
    name: "Black Ice",
    blurb: "Cyan veins in frozen glass.",
    accent: "#00e8ff",
  },
  {
    id: "ash-serpent",
    name: "Chain Reaction",
    blurb: "Lime circuitry under the hash.",
    accent: "#b6ff3b",
  },
  {
    id: "ember-jackal",
    name: "Block Burn",
    blurb: "Purple fire in the cube.",
    accent: "#c084ff",
  },
  {
    id: "slag-knight",
    name: "Hash Trail",
    blurb: "Leaves hex in the air.",
    accent: "#5af0ff",
  },
  {
    id: "night-coil",
    name: "Locked In",
    blurb: "Eyes on the next slot.",
    accent: "#9aff5c",
  },
  {
    id: "pyre-imp",
    name: "Sol Flare",
    blurb: "Small. Bright. Mean.",
    accent: "#e879f9",
  },
] as const;

export type DemonId = (typeof DEMONS)[number]["id"];

export function getDemon(id: string) {
  return DEMONS.find((d) => d.id === id) ?? DEMONS[0];
}
