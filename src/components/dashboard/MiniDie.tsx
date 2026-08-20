export function MiniDie({
  value,
  tone,
}: {
  value: number | null;
  tone: "purple" | "green" | "orange";
}) {
  return (
    <span className={`mini-die tone-${tone}`} aria-hidden>
      {value ?? "·"}
    </span>
  );
}
