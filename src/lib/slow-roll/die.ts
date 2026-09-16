import type { CSSProperties } from "react";

export type SlowRollSkin = {
  face: string;
  shade: string;
  light: string;
  shift: string;
  sheen: string | number;
  pip: string;
  rim: string;
  felt: string;
  bg2: string;
  bg3: string;
  pipScale: number;
  texA: string;
  texO: number;
  texZ: string;
  bga: string;
  bpx: string;
  bpy: string;
  grad: number;
  dur: number;
  delay: number;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
};

export type SlowRollNft = {
  i: number;
  n: string;
  r: string;
  bg: string;
  tex: string;
  fin: string;
  pip: string;
  s: SlowRollSkin;
};

export const RARITY_ORDER = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
] as const;

export type SlowRollRarity = (typeof RARITY_ORDER)[number];

export function raritySlug(r: string): SlowRollRarity {
  const s = r.trim().toLowerCase();
  return (RARITY_ORDER as readonly string[]).includes(s)
    ? (s as SlowRollRarity)
    : "common";
}

const FACE_PIPS: number[][] = [
  [4],
  [0, 4, 8],
  [0, 2, 3, 5, 6, 8],
  [0, 2, 6, 8],
  [0, 8],
  [0, 2, 4, 6, 8],
];

export function pipOn(face: number, cell: number) {
  return FACE_PIPS[face]?.includes(cell) ?? false;
}

export function dieVars(s: SlowRollSkin, sizePx: number): CSSProperties {
  const half = sizePx / 2;
  return {
    "--size": `${sizePx}px`,
    "--half": `${half}px`,
    "--face": s.face,
    "--shade": s.shade,
    "--light": s.light,
    "--shift": s.shift,
    "--sheen": String(s.sheen),
    "--pip": s.pip,
    "--rim": s.rim,
    "--felt": s.felt,
    "--bg2": s.bg2,
    "--bg3": s.bg3,
    "--grad": `${s.grad}deg`,
    "--ps": String(s.pipScale),
    "--ta": s.texA,
    "--to": String(s.texO),
    "--tz": s.texZ,
    "--bga": s.bga,
    "--bpx": s.bpx,
    "--bpy": s.bpy,
    "--dur": `${s.dur}s`,
    "--delay": `${s.delay}s`,
    "--rx": `${s.x}deg`,
    "--ry": `${s.y}deg`,
    "--rz": `${s.z}deg`,
    "--sx": `${s.sx}deg`,
    "--sy": `${s.sy}deg`,
    "--sz": `${s.sz}deg`,
  } as CSSProperties;
}
