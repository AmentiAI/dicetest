export function WalletBadge({
  label,
  accent = "var(--ember)",
}: {
  label: string;
  accent?: string;
}) {
  const clean = label.replace(/[^a-zA-Z0-9]/g, "");
  const initials = (clean.slice(0, 2) || label.slice(0, 2) || "?").toUpperCase();
  return (
    <span className="wallet-badge" style={{ color: accent }}>
      {initials}
    </span>
  );
}
