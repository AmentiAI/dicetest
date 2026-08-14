import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { DEMONS } from "@/lib/demons";
import { identityMessage, verifyWalletSignature } from "@/lib/auth";

export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet required" }, { status: 400 });
  }
  const profile = await db().query.profiles.findFirst({
    where: eq(profiles.wallet, wallet),
  });
  return NextResponse.json({ profile: profile ?? null });
}

export async function POST(req: Request) {
  const body = await req.json();
  const wallet = String(body.wallet ?? "");
  const username = String(body.username ?? "").trim().slice(0, 20);
  const demon = String(body.demon ?? "cinder-wraith");
  const signatureBase64 = String(body.signatureBase64 ?? "");

  if (!wallet || username.length < 2) {
    return NextResponse.json({ error: "wallet and username required" }, { status: 400 });
  }
  if (!DEMONS.some((d) => d.id === demon)) {
    return NextResponse.json({ error: "unknown demon" }, { status: 400 });
  }
  const message = identityMessage(wallet, username, demon);
  if (!verifyWalletSignature({ wallet, message, signatureBase64 })) {
    return NextResponse.json({ error: "invalid wallet signature" }, { status: 401 });
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
}
