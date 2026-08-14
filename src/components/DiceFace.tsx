const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 28], [70, 28], [30, 50], [70, 50], [30, 72], [70, 72]],
};

export function DiceFace({
  value,
  rolling = false,
  highlight = false,
  label,
}: {
  value: number | null;
  rolling?: boolean;
  highlight?: boolean;
  label?: string;
}) {
  const pips = value && value >= 1 && value <= 6 ? PIPS[value] : [];
  return (
    <div className={`die-wrap ${highlight ? "is-you" : ""}`}>
      <div className={`die ${rolling ? "is-rolling" : ""} ${value && !rolling ? "is-landed" : ""}`}>
        {rolling || !value ? (
          <span className="die-q">?</span>
        ) : (
          <svg viewBox="0 0 100 100" className="die-face" key={value}>
            {pips.map(([x, y], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="8"
                fill="currentColor"
                style={{ animationDelay: `${i * 0.05}s` }}
              />
            ))}
          </svg>
        )}
      </div>
      {label ? <div className="die-label">{label}</div> : null}
    </div>
  );
}
