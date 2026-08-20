import { ARENAS, type ArenaId } from "@/lib/cosmetics";

export function ArenaPicker({
  value,
  onChange,
}: {
  value: ArenaId;
  onChange: (id: ArenaId) => void;
}) {
  return (
    <div className="arena-picker">
      <p className="field-label">Pick the arena</p>
      <div className="arena-options">
        {ARENAS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`arena-opt env-${a.id}${value === a.id ? " on" : ""}`}
            onClick={() => onChange(a.id)}
          >
            <span className="arena-opt-glow" aria-hidden />
            <span className="arena-opt-name">{a.name}</span>
            <span className="arena-opt-vibe">{a.tagline}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
