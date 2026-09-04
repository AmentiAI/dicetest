import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { fail, failInternal } from "@/lib/api";
import {
  chatAuthMessage,
  parseAuthTimestamp,
  verifyWalletSignature,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { chatMessages, profiles, rooms } from "@/lib/db/schema";
import { allow, consumeNonce, limitOr429 } from "@/lib/rate-limit";
import { isPubkeyString } from "@/lib/solana/keys";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const limited = limitOr429(req, "chat-get", 60);
    if (limited) return limited;
    const { id } = await ctx.params;
    if (!isPubkeyString(id)) return fail("invalid room");
    const messages = await db()
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.roomId, id))
      .orderBy(desc(chatMessages.createdAt))
      .limit(80);
    return NextResponse.json({ messages: messages.reverse() });
  } catch (e) {
    return failInternal("chat-get", e);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const limited = limitOr429(req, "chat-post", 20);
    if (limited) return limited;
    const { id } = await ctx.params;
    if (!isPubkeyString(id)) return fail("invalid room");

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("invalid json body");

    const wallet = String((body as { wallet?: unknown }).wallet ?? "");
    const text = String((body as { body?: unknown }).body ?? "").trim().slice(0, 240);
    const signatureBase64 = String(
      (body as { signatureBase64?: unknown }).signatureBase64 ?? "",
    );
    const ts = parseAuthTimestamp((body as { ts?: unknown }).ts);
    if (!isPubkeyString(wallet) || !text || !ts) {
      return fail("wallet, body, and fresh timestamp required");
    }
    if (!allow(`chat-wallet:${wallet}`, 12)) {
      return fail("too many requests", 429);
    }

    const room = await db().query.rooms.findFirst({ where: eq(rooms.id, id) });
    if (!room) return fail("room not found", 404);
    const allowed =
      wallet === room.hostWallet || wallet === room.challengerWallet;
    if (!allowed) return fail("only duelists can chat", 403);

    const message = chatAuthMessage(id, wallet, text, ts);
    if (!verifyWalletSignature({ wallet, message, signatureBase64 })) {
      return fail("invalid wallet signature", 401);
    }
    if (!consumeNonce(`chat:${wallet}:${id}:${ts}:${text}`)) {
      return fail("replayed signature", 401);
    }

    const profile = await db().query.profiles.findFirst({
      where: eq(profiles.wallet, wallet),
    });
    const [row] = await db()
      .insert(chatMessages)
      .values({
        roomId: id,
        wallet,
        username: profile?.username ?? wallet.slice(0, 4),
        body: text,
        kind: "chat",
      })
      .returning();
    return NextResponse.json({ message: row });
  } catch (e) {
    return failInternal("chat-post", e);
  }
}
