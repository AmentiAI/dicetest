import { CubeDie } from "./CubeDie";

export function DiceFace({
  value,
  rolling = false,
  highlight = false,
  label,
  tone = "black",
}: {
  value: number | null;
  rolling?: boolean;
  highlight?: boolean;
  label?: string;
  tone?: "black" | "red";
}) {
  return (
    <div className={`die-wrap ${highlight ? "is-you" : ""}`}>
      <CubeDie tone={tone} value={value} rolling={rolling} />
      {label ? <div className="die-label">{label}</div> : null}
    </div>
  );
}
