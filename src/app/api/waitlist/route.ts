import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { fail, failInternal } from "@/lib/api";
import { verifyWalletSignature } from "@/lib/auth";
import { db } from "@/lib/db";
import { waitlist } from "@/lib/db/schema";
import { isEthAddress, normalizeAddress } from "@/lib/eth/keys";
import { allow, limitOr429 } from "@/lib/rate-limit";
import { WAITLIST_CAP, normalizeXHandle, waitlistMessage } from "@/lib/waitlist";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const limited = limitOr429(req, "waitlist-get", 40);
    if (limited) return limited;
    const walletRaw = new URL(req.url).searchParams.get("wallet");
    const countRows = await db().select({ n: count() }).from(waitlist);
    const taken = Number(countRows[0]?.n ?? 0);
    let me: { slot: number; xHandle: string } | null = null;
    if (walletRaw && isEthAddress(walletRaw)) {
    const [row] = await db()
      .select()
      .from(waitlist)
      .where(eq(waitlist.wallet, normalizeAddress(walletRaw)))
      .limit(1);
      if (row) me = { slot: row.slot, xHandle: row.xHandle };
    }
    return NextResponse.json({
      taken,
      cap: WAITLIST_CAP,
      remaining: Math.max(0, WAITLIST_CAP - taken),
      full: taken >= WAITLIST_CAP,
      me,
    });
  } catch (e) {
    return failInternal("waitlist-get", e);
  }
}

export async function POST(req: Request) {
  try {
    const limited = limitOr429(req, "waitlist-post", 8);
    if (limited) return limited;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("invalid json body");

    const walletRaw = String((body as { wallet?: unknown }).wallet ?? "");
    const handleRaw = String((body as { xHandle?: unknown }).xHandle ?? "");
    const signatureBase64 = String(
      (body as { signatureBase64?: unknown }).signatureBase64 ?? "",
    );
    if (!isEthAddress(walletRaw)) return fail("connect an ETH wallet first");
    const xHandle = normalizeXHandle(handleRaw);
    if (!xHandle) return fail("enter a valid X handle");
    const wallet = normalizeAddress(walletRaw);
    if (!allow(`waitlist-wallet:${wallet}`, 6)) return fail("too many requests", 429);

    const message = waitlistMessage(walletRaw, xHandle);
    if (!(await verifyWalletSignature({ wallet: walletRaw, message, signatureBase64 }))) {
      return fail("invalid wallet signature", 401);
    }

    const [existing] = await db()
      .select()
      .from(waitlist)
      .where(eq(waitlist.wallet, wallet))
      .limit(1);
    if (existing) {
      return NextResponse.json({
        ok: true,
        slot: existing.slot,
        xHandle: existing.xHandle,
        already: true,
      });
    }

    const countRows = await db().select({ n: count() }).from(waitlist);
    if (Number(countRows[0]?.n ?? 0) >= WAITLIST_CAP) return fail("waitlist is full", 409);

    const [handleTaken] = await db()
      .select()
      .from(waitlist)
      .where(eq(waitlist.xHandle, xHandle))
      .limit(1);
    if (handleTaken) return fail("that X handle is already on the list", 409);

    const inserted = await db()
      .insert(waitlist)
      .values({ wallet, xHandle })
      .returning();
    const row = inserted[0];
    if (!row) return fail("could not join waitlist", 500);
    if (row.slot > WAITLIST_CAP) {
      await db().delete(waitlist).where(eq(waitlist.slot, row.slot));
      return fail("waitlist is full", 409);
    }
    return NextResponse.json({ ok: true, slot: row.slot, xHandle: row.xHandle });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return fail("wallet or X handle is already waitlisted", 409);
    }
    return failInternal("waitlist-post", e);
  }
}
