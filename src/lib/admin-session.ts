import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isAdminWallet } from "./admin";
import { isEthAddress } from "./eth/keys";

let memorySecret: string | null = null;

function sessionSecret() {
  const env =
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_SECRET ||
    process.env.SESSION_SECRET;
  if (env) return env;
  if (!memorySecret) memorySecret = randomBytes(32).toString("hex");
  return memorySecret;
}

function hmac(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function issueAdminToken(wallet: string, ttlMs = 12 * 60 * 60 * 1000) {
  const exp = Date.now() + ttlMs;
  const payload = `${wallet}.${exp}`;
  return { token: `${payload}.${hmac(payload)}`, expiresAt: exp };
}

export function verifyAdminToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [wallet, expStr, mac] = parts;
  if (!wallet || !expStr || !mac || !isEthAddress(wallet)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  const payload = `${wallet}.${expStr}`;
  const expected = hmac(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!isAdminWallet(wallet)) return null;
  return wallet;
}
