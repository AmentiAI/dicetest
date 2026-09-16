export const PLAY_LOCKED = true;
export const WAITLIST_CAP = 1800;
export const NFT_PAGE_SIZE = 12;

export function waitlistMessage(wallet: string, xHandle: string) {
  return `BLOCK DICE waitlist\nwallet:${wallet}\nx:@${xHandle}`;
}

export function normalizeXHandle(raw: string) {
  let s = raw.trim();
  s = s.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "");
  s = s.replace(/^@/, "").split(/[/?#]/)[0] ?? "";
  if (!/^[A-Za-z0-9_]{1,15}$/.test(s)) return null;
  return s.toLowerCase();
}
