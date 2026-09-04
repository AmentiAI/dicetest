import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const seen = new Map<string, number>();
let sweeps = 0;

function pruneExpired() {
  sweeps += 1;
  if (sweeps % 200 !== 0 && buckets.size + seen.size < 4_000) return;
  const now = Date.now();
  for (const [key, value] of buckets) {
    if (value.resetAt <= now) buckets.delete(key);
  }
  for (const [key, exp] of seen) {
    if (exp <= now) seen.delete(key);
  }
}

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return (req.headers.get("x-real-ip") ?? "local").slice(0, 64);
}

export function allow(key: string, limit: number, windowMs = 60_000) {
  pruneExpired();
  const now = Date.now();
  const hit = buckets.get(key);
  if (!hit || now >= hit.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (hit.count >= limit) return false;
  hit.count += 1;
  return true;
}

export function consumeNonce(key: string, ttlMs = 180_000) {
  pruneExpired();
  const now = Date.now();
  const exp = seen.get(key);
  if (exp && exp > now) return false;
  seen.set(key, now + ttlMs);
  return true;
}

export function limitOr429(req: Request, bucket: string, limit: number, windowMs = 60_000) {
  const ip = clientIp(req);
  if (allow(`${bucket}:${ip}`, limit, windowMs)) return null;
  return NextResponse.json(
    { error: "too many requests" },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}
