import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { fail, failInternal } from "@/lib/api";
import { arenaForRoom } from "@/lib/arena-db";
import { db } from "@/lib/db";
import { matchEvents, profiles, rooms } from "@/lib/db/schema";
import { limitOr429 } from "@/lib/rate-limit";
import { isPubkeyString, isTxSignature } from "@/lib/solana/keys";
import { proofError, verifyProgramTx } from "@/lib/solana/verify-tx";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const limited = limitOr429(req, "room-get", 45);
    if (limited) return limited;
    const { id } = await ctx.params;
    if (!isPubkeyString(id)) return fail("invalid room");
    const { PublicKey } = await import("@solana/web3.js");
    const { syncRoomFromChain } = await import("@/lib/sync");
    const { room, onchain } = await syncRoomFromChain(id);
    if (!room) {
      return fail("room not found", 404);
    }
    const host = await db().query.profiles.findFirst({
      where: eq(profiles.wallet, room.hostWallet),
    });
    const challenger = room.challengerWallet
      ? await db().query.profiles.findFirst({
          where: eq(profiles.wallet, room.challengerWallet),
        })
      : null;

    let rematch: {
      pda: string;
      hostWallet: string;
      duelId: string;
      wagerLamports: string;
      status: string;
    } | null = null;
    const [ev] = await db()
      .select()
      .from(matchEvents)
      .where(and(eq(matchEvents.roomId, id), eq(matchEvents.event, "rematch")))
      .orderBy(desc(matchEvents.id))
      .limit(1);
    const rematchPda =
      ev?.payload && typeof ev.payload.rematchPda === "string" ? ev.payload.rematchPda : null;
    if (rematchPda && isPubkeyString(rematchPda)) {
      const next = await db().query.rooms.findFirst({ where: eq(rooms.id, rematchPda) });
      if (next && next.status === "waiting") {
        rematch = {
          pda: next.id,
          hostWallet: next.hostWallet,
          duelId: next.duelId,
          wagerLamports: next.wagerLamports,
          status: next.status,
        };
      }
    }

    const arena = await arenaForRoom(id);

    return NextResponse.json({
      room,
      arena,
      host: host ?? null,
      challenger: challenger ?? null,
      rematch,
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
    return failInternal("room-get", e);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const limited = limitOr429(req, "room-update", 20);
    if (limited) return limited;
    const { id } = await ctx.params;
    if (!isPubkeyString(id)) return fail("invalid room");
    const body = await req.json().catch(() => ({}));
    const joinSignature =
      typeof (body as { joinSignature?: unknown }).joinSignature === "string"
        ? String((body as { joinSignature: string }).joinSignature)
        : "";
    const settleSignature =
      typeof (body as { settleSignature?: unknown }).settleSignature === "string"
        ? String((body as { settleSignature: string }).settleSignature)
        : "";

    const { syncRoomFromChain } = await import("@/lib/sync");
    const { room } = await syncRoomFromChain(id);
    if (!room) {
      return fail("room not found", 404);
    }

    const { serverConnection } = await import("@/lib/solana/connection");
    const connection = serverConnection();
    const patch: { joinSignature?: string; settleSignature?: string; updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (joinSignature) {
      if (!isTxSignature(joinSignature)) return fail("invalid join signature");
      const proof = await verifyProgramTx({ connection, signature: joinSignature, pda: id });
      if (proof !== "ok") {
        const { error, status } = proofError(proof);
        return fail(error, status);
      }
      patch.joinSignature = joinSignature;
    }
    if (settleSignature) {
      if (!isTxSignature(settleSignature)) return fail("invalid settle signature");
      const proof = await verifyProgramTx({ connection, signature: settleSignature, pda: id });
      if (proof !== "ok") {
        const { error, status } = proofError(proof);
        return fail(error, status);
      }
      patch.settleSignature = settleSignature;
    }

    if (patch.joinSignature || patch.settleSignature) {
      await db().update(rooms).set(patch).where(eq(rooms.id, id));
    }

    const { invalidateDuel } = await import("@/lib/solana/fetch");
    invalidateDuel(id);
    const synced = await syncRoomFromChain(id, { force: true });
    return NextResponse.json({ room: synced.room });
  } catch (e) {
    return failInternal("room-update", e);
  }
}
