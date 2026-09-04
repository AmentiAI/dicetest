import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { fail, failInternal } from "@/lib/api";
import { identityMessage, verifyWalletSignature } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { DEMONS } from "@/lib/demons";
import { allow, limitOr429 } from "@/lib/rate-limit";
import { isPubkeyString } from "@/lib/solana/keys";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const limited = limitOr429(req, "profile-get", 60);
    if (limited) return limited;
    const wallet = new URL(req.url).searchParams.get("wallet");
    if (!wallet) return fail("wallet required");
    if (!isPubkeyString(wallet)) return fail("invalid wallet");
    const profile = await db().query.profiles.findFirst({
      where: eq(profiles.wallet, wallet),
    });
    return NextResponse.json({ profile: profile ?? null });
  } catch (e) {
    return failInternal("profile-get", e);
  }
}

export async function POST(req: Request) {
  try {
    const limited = limitOr429(req, "profile-post", 10);
    if (limited) return limited;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("invalid json body");

    const wallet = String((body as { wallet?: unknown }).wallet ?? "");
    const username = String((body as { username?: unknown }).username ?? "")
      .trim()
      .slice(0, 20);
    const demon = String((body as { demon?: unknown }).demon ?? "cinder-wraith");
    const signatureBase64 = String(
      (body as { signatureBase64?: unknown }).signatureBase64 ?? "",
    );

    if (!isPubkeyString(wallet) || username.length < 2) {
      return fail("wallet and username required");
    }
    if (!allow(`profile-wallet:${wallet}`, 8)) {
      return fail("too many requests", 429);
    }
    if (!DEMONS.some((d) => d.id === demon)) {
      return fail("unknown demon");
    }
    const message = identityMessage(wallet, username, demon);
    if (!verifyWalletSignature({ wallet, message, signatureBase64 })) {
      return fail("invalid wallet signature", 401);
    }

    const now = new Date();
    await db()
      .insert(profiles)
      .values({ wallet, username, demon, updatedAt: now })
      .onConflictDoUpdate({
        target: profiles.wallet,
        set: { username, demon, updatedAt: now },
      });

    const profile = await db().query.profiles.findFirst({
      where: eq(profiles.wallet, wallet),
    });
    return NextResponse.json({ profile });
  } catch (e) {
    return failInternal("profile-post", e);
  }
}
