function splitList(raw: string | undefined) {
  return (raw ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function adminAllowlist() {
  if (typeof window !== "undefined") return [];
  return [...new Set(splitList(process.env.ADMIN_WALLETS))];
}

export function isAdminWallet(wallet: string | null | undefined) {
  if (!wallet) return false;
  return adminAllowlist().includes(wallet);
}

export function adminConfigured() {
  return adminAllowlist().length > 0 || Boolean(process.env.ADMIN_SECRET);
}
