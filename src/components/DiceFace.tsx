import { CubeDie } from "./CubeDie";
import type { DieSkin } from "@/lib/cosmetics";

export function DiceFace({
  value,
  rolling = false,
  highlight = false,
  label,
  tone = "ice",
  slow = false,
  trail = false,
  crater = false,
}: {
  value: number | null;
  rolling?: boolean;
  highlight?: boolean;
  label?: string;
  tone?: DieSkin | "black" | "red";
  slow?: boolean;
  trail?: boolean;
  crater?: boolean;
}) {
  return (
    <div
      className={`die-wrap skin-${tone === "black" ? "ice" : tone === "red" ? "chain" : tone} ${highlight ? "is-you" : ""} ${trail ? "has-trail" : ""} ${crater ? "has-crater" : ""}`}
    >
      {trail ? <span className="hash-trail" aria-hidden /> : null}
      {crater ? <span className="block-crater" aria-hidden /> : null}
      <CubeDie tone={tone} value={value} rolling={rolling} slow={slow} />
      {label ? <div className="die-label">{label}</div> : null}
    </div>
  );
}
