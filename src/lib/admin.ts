function splitList(raw: string | undefined) {
  return (raw ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function adminAllowlist() {
  if (typeof window !== "undefined") return [];
  return [...new Set(splitList(process.env.ADMIN_WALLETS).map((s) => s.toLowerCase()))];
}

export function isAdminWallet(wallet: string | null | undefined) {
  if (!wallet) return false;
  return adminAllowlist().includes(wallet.toLowerCase());
}

export function adminConfigured() {
  return adminAllowlist().length > 0 || Boolean(process.env.ADMIN_SECRET);
}
