import type { DemonId } from "@/lib/demons";

const PATHS: Record<DemonId, { body: string; eye: string; mark: string }> = {
  "cinder-wraith": {
    body: "M4 28 L16 4 L28 28 L22 28 L16 16 L10 28 Z",
    eye: "M14 14 h4 v3 h-4 Z",
    mark: "M16 20 v6",
  },
  "ash-serpent": {
    body: "M6 26 C6 10 26 10 26 26 L22 26 C22 16 10 16 10 26 Z",
    eye: "M18 14 h4 v3 h-4 Z",
    mark: "M8 22 h16",
  },
  "ember-jackal": {
    body: "M6 28 L8 10 L16 16 L24 10 L26 28 Z",
    eye: "M12 18 h3 v3 h-3 Z",
    mark: "M17 18 h3 v3 h-3 Z",
  },
  "slag-knight": {
    body: "M8 6 h16 v6 L28 28 H4 L8 12 Z",
    eye: "M11 14 h4 v3 h-4 Z",
    mark: "M17 14 h4 v3 h-4 Z",
  },
  "night-coil": {
    body: "M16 4 L28 12 L24 28 H8 L4 12 Z",
    eye: "M14 14 h4 v4 h-4 Z",
    mark: "M10 22 h12",
  },
  "pyre-imp": {
    body: "M10 28 L6 16 L16 2 L26 16 L22 28 Z",
    eye: "M13 14 h6 v3 h-6 Z",
    mark: "M16 20 v5",
  },
};

export function DemonPortrait({
  id,
  size = 72,
  selected = false,
}: {
  id: string;
  size?: number;
  selected?: boolean;
}) {
  const key = (id in PATHS ? id : "cinder-wraith") as DemonId;
  const p = PATHS[key];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={`demon ${selected ? "is-selected" : ""}`}
      aria-hidden
    >
      <rect width="32" height="32" fill="#0c0d12" />
      <path d={p.body} fill="currentColor" opacity="0.9" />
      <path d={p.eye} fill="#fff4d6" />
      <path d={p.mark} stroke="#1a1208" strokeWidth="2" />
    </svg>
  );
}
