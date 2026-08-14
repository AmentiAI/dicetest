import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profiles, rooms } from "@/lib/db/schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { PublicKey } = await import("@solana/web3.js");
    const { syncRoomFromChain } = await import("@/lib/sync");
    const { room, onchain } = await syncRoomFromChain(id);
    if (!room) {
      return NextResponse.json({ error: "room not found" }, { status: 404 });
    }
    const host = await db().query.profiles.findFirst({
      where: eq(profiles.wallet, room.hostWallet),
    });
    const challenger = room.challengerWallet
      ? await db().query.profiles.findFirst({
          where: eq(profiles.wallet, room.challengerWallet),
        })
      : null;
    return NextResponse.json({
      room,
      host: host ?? null,
      challenger: challenger ?? null,
      onchain: onchain
        ? {
            status: onchain.status,
            wagerLamports: onchain.wagerLamports.toString(),
            commitSlot: onchain.commitSlot.toString(),
            revealSlot: onchain.revealSlot.toString(),
            hostRoll: onchain.hostRoll,
            challengerRoll: onchain.challengerRoll,
            winner: onchain.winner.equals(PublicKey.default)
              ? null
              : onchain.winner.toBase58(),
            host: onchain.host.toBase58(),
            challenger: onchain.challenger.equals(PublicKey.default)
              ? null
              : onchain.challenger.toBase58(),
            slotHash: Array.from(onchain.slotHash, (b) =>
              b.toString(16).padStart(2, "0"),
            ).join(""),
            createdSlot: onchain.createdSlot.toString(),
          }
        : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "room lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { syncRoomFromChain } = await import("@/lib/sync");
    const { room } = await syncRoomFromChain(id);
    if (!room) {
      return NextResponse.json({ error: "room not found" }, { status: 404 });
    }
    if (body.joinSignature) {
      await db()
        .update(rooms)
        .set({ joinSignature: String(body.joinSignature), updatedAt: new Date() })
        .where(eq(rooms.id, id));
    }
    if (body.settleSignature) {
      await db()
        .update(rooms)
        .set({ settleSignature: String(body.settleSignature), updatedAt: new Date() })
        .where(eq(rooms.id, id));
    }
    const synced = await syncRoomFromChain(id);
    return NextResponse.json({ room: synced.room });
  } catch (e) {
    const message = e instanceof Error ? e.message : "room update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
