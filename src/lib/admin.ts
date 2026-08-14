function splitList(raw: string | undefined) {
  return (raw ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function adminAllowlist() {
  const pub = splitList(process.env.NEXT_PUBLIC_ADMIN_WALLETS);
  const srv =
    typeof window === "undefined" ? splitList(process.env.ADMIN_WALLETS) : [];
  return [...new Set([...pub, ...srv])];
}

export function isAdminWallet(wallet: string | null | undefined) {
  if (!wallet) return false;
  return adminAllowlist().includes(wallet);
}

export function adminConfigured() {
  return adminAllowlist().length > 0 || Boolean(process.env.ADMIN_SECRET);
}
