import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { DEMONS } from "@/lib/demons";
import { identityMessage, verifyWalletSignature } from "@/lib/auth";

export const runtime = "nodejs";

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function GET(req: Request) {
  try {
    const wallet = new URL(req.url).searchParams.get("wallet");
    if (!wallet) return fail("wallet required");
    const profile = await db().query.profiles.findFirst({
      where: eq(profiles.wallet, wallet),
    });
    return NextResponse.json({ profile: profile ?? null });
  } catch (e) {
    const message = e instanceof Error ? e.message : "profile lookup failed";
    return fail(message, 500);
  }
}

export async function POST(req: Request) {
  try {
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

    if (!wallet || username.length < 2) {
      return fail("wallet and username required");
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
    const message = e instanceof Error ? e.message : "profile save failed";
    return fail(message, 500);
  }
}
