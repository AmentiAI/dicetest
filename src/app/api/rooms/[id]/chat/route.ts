import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatMessages, profiles, rooms } from "@/lib/db/schema";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const messages = await db()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.roomId, id))
    .orderBy(desc(chatMessages.createdAt))
    .limit(80);
  return NextResponse.json({ messages: messages.reverse() });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json();
  const wallet = String(body.wallet ?? "");
  const text = String(body.body ?? "").trim().slice(0, 240);
  if (!wallet || !text) {
    return NextResponse.json({ error: "wallet and body required" }, { status: 400 });
  }
  const room = await db().query.rooms.findFirst({ where: eq(rooms.id, id) });
  if (!room) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }
  const allowed =
    wallet === room.hostWallet ||
    wallet === room.challengerWallet;
  if (!allowed) {
    return NextResponse.json({ error: "only duelists can chat" }, { status: 403 });
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
}
