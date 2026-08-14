import { CubeDie } from "./CubeDie";

export function DiceFace({
  value,
  rolling = false,
  highlight = false,
  label,
  tone = "black",
  slow = false,
}: {
  value: number | null;
  rolling?: boolean;
  highlight?: boolean;
  label?: string;
  tone?: "black" | "red";
  slow?: boolean;
}) {
  return (
    <div className={`die-wrap ${highlight ? "is-you" : ""}`}>
      <CubeDie tone={tone} value={value} rolling={rolling} slow={slow} />
      {label ? <div className="die-label">{label}</div> : null}
    </div>
  );
}
