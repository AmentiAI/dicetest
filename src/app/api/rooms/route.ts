import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { fail, failInternal, ROOM_STATUSES } from "@/lib/api";
import { arenasForRooms } from "@/lib/arena-db";
import { parseArenaId } from "@/lib/cosmetics";
import { db } from "@/lib/db";
import { chatMessages, matchEvents, profiles, rooms } from "@/lib/db/schema";
import { limitOr429 } from "@/lib/rate-limit";
import { DUEL_ADDRESS } from "@/lib/eth/constants";
import { publicClient } from "@/lib/eth/client";
import { fetchDuel, statusName } from "@/lib/eth/fetch";
import { isEthAddress, isTxHash, isU256String, normalizeAddress } from "@/lib/eth/keys";
import { proofError, verifyProgramTx } from "@/lib/eth/verify-tx";
import { PLAY_LOCKED } from "@/lib/waitlist";

export const runtime = "nodejs";

async function withProfiles<
  T extends {
    hostWallet: string;
    challengerWallet: string | null;
    seats?: { wallet: string }[] | null;
  },
>(list: T[]) {
  const wallets = [
    ...new Set(
      list.flatMap((r) =>
        [r.hostWallet, r.challengerWallet, ...(r.seats ?? []).map((s) => s.wallet)].filter(
          Boolean,
        ) as string[],
      ),
    ),
  ];
  const people = wallets.length
    ? await db().select().from(profiles).where(inArray(profiles.wallet, wallets))
    : [];
  const map = Object.fromEntries(people.map((p) => [p.wallet, p]));
  return list.map((r) => ({
    ...r,
    host: map[r.hostWallet] ?? null,
    challenger: r.challengerWallet ? map[r.challengerWallet] ?? null : null,
    players: (r.seats ?? []).map((s) => ({
      ...s,
      profile: map[s.wallet] ?? null,
    })),
  }));
}

export async function GET(req: Request) {
  try {
    const limited = limitOr429(req, "rooms-list", 60);
    if (limited) return limited;
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const rawLimit = Number(url.searchParams.get("limit") ?? 80);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 250) : 80;
    const statusFilter =
      status && (ROOM_STATUSES as readonly string[]).includes(status) ? status : null;

    const list = statusFilter
      ? await db()
          .select()
          .from(rooms)
          .where(eq(rooms.status, statusFilter))
          .orderBy(desc(rooms.createdAt))
          .limit(limit)
      : await db().select().from(rooms).orderBy(desc(rooms.createdAt)).limit(limit);
    const enriched = await withProfiles(list);
    const arenas = await arenasForRooms(list.map((r) => r.id));
    const roomsOut = enriched.map((r) => ({
      ...r,
      arena: arenas[r.id] ?? null,
    }));
    const waiting = list.filter((r) => r.status === "waiting").length;
    const locked = list.filter((r) => r.status === "locked").length;
    return NextResponse.json({
      rooms: roomsOut,
      stats: {
        activeRooms: waiting + locked,
        waiting,
        locked,
      },
    });
  } catch (e) {
    return failInternal("rooms-list", e);
  }
}

export async function POST(req: Request) {
  try {
    if (PLAY_LOCKED) return fail("play is locked", 403);
    const limited = limitOr429(req, "rooms-create", 12);
    if (limited) return limited;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return fail("invalid json body");
    }
    const pda = String((body as { pda?: unknown }).pda ?? "");
    const duelId = String((body as { duelId?: unknown }).duelId ?? "");
    const hostWallet = String((body as { hostWallet?: unknown }).hostWallet ?? "");
    const wagerLamports = String((body as { wagerLamports?: unknown }).wagerLamports ?? "");
    const createSignature = String(
      (body as { createSignature?: unknown }).createSignature ?? "",
    );
    const rematchOf = String((body as { rematchOf?: unknown }).rematchOf ?? "");
    const arena = parseArenaId((body as { arena?: unknown }).arena);

    if (!pda || !duelId || !hostWallet || !wagerLamports || !createSignature) {
      return fail("missing fields");
    }
    if (!isU256String(pda) || pda !== duelId || !isEthAddress(hostWallet) || !isU256String(duelId)) {
      return fail("invalid duel identifiers");
    }
    if (!isTxHash(createSignature)) return fail("invalid create signature");
    if (rematchOf && !isU256String(rematchOf)) return fail("invalid rematch room");
    const host = normalizeAddress(hostWallet);

    const existing = await db().query.rooms.findFirst({ where: eq(rooms.id, pda) });
    if (existing) {
      return NextResponse.json({ room: existing });
    }

    const client = publicClient();
    const proof = await verifyProgramTx({ client, signature: createSignature, pda });
    if (proof !== "ok") {
      const { error, status } = proofError(proof);
      return fail(error, status);
    }
    const onchain = await fetchDuel(client, pda);
    if (!onchain) {
      return fail("duel account not found on chain — wait for confirmation and retry");
    }
    if (onchain.host.toLowerCase() !== host) {
      return fail("host mismatch");
    }

    await db()
      .insert(rooms)
      .values({
        id: pda,
        duelId,
        hostWallet: host,
        wagerLamports: onchain.wagerWei.toString(),
        hostNftId: onchain.hostTokenId > 0n ? onchain.hostTokenId.toString() : null,
        status: statusName(onchain.status),
        createSignature,
        maxPlayers: onchain.maxPlayers,
        playerCount: onchain.playerCount,
        phase: onchain.phase,
        seats: onchain.seats,
      })
      .onConflictDoNothing();

    const roomAfterInsert = await db().query.rooms.findFirst({ where: eq(rooms.id, pda) });
    if (!roomAfterInsert) {
      return fail("room create failed", 500);
    }
    if (roomAfterInsert.createSignature !== createSignature) {
      return NextResponse.json({ room: roomAfterInsert });
    }

    const createdAlready = await db()
      .select({ id: matchEvents.id })
      .from(matchEvents)
      .where(eq(matchEvents.roomId, pda))
      .limit(1);
    if (createdAlready.length === 0) {
      await db().insert(matchEvents).values({
        roomId: pda,
        event: "created",
        payload: {
          hostWallet: host,
          wagerLamports: onchain.wagerWei.toString(),
          program: DUEL_ADDRESS,
          arena,
          hostNftId: onchain.hostTokenId.toString(),
          maxPlayers: onchain.maxPlayers,
        },
      });
      const mode =
        onchain.maxPlayers <= 2
          ? "1v1"
          : onchain.maxPlayers <= 5
            ? `${onchain.maxPlayers}-player table`
            : "free-for-all (up to 10)";
      await db().insert(chatMessages).values({
        roomId: pda,
        wallet: "system",
        username: "SYS",
        kind: "system",
        body: rematchOf
          ? `Rematch ${mode}. Host starts when ready. Winner takes the pot.`
          : `${mode[0]!.toUpperCase()}${mode.slice(1)} opened. Others can join until the host starts. Winner takes the pot.`,
      });
    }

    if (rematchOf) {
      const prior = await db().query.rooms.findFirst({ where: eq(rooms.id, rematchOf) });
      const allowed =
        prior &&
        (prior.hostWallet.toLowerCase() === host ||
          prior.challengerWallet?.toLowerCase() === host ||
          (prior.seats ?? []).some((s) => s.wallet.toLowerCase() === host));
      if (allowed) {
        const already = await db()
          .select()
          .from(matchEvents)
          .where(eq(matchEvents.roomId, rematchOf));
        const rematchLogged = already.some(
          (ev) => ev.event === "rematch" && ev.payload?.rematchPda === pda,
        );
        if (!rematchLogged) {
          await db().insert(matchEvents).values({
            roomId: rematchOf,
            event: "rematch",
            payload: {
              rematchPda: pda,
              hostWallet: host,
              duelId,
              wagerLamports: onchain.wagerWei.toString(),
            },
          });
          await db().insert(chatMessages).values({
            roomId: rematchOf,
            wallet: "system",
            username: "SYS",
            kind: "system",
            body: "Rematch opened. Join from this circle or set a different wager.",
          });
        }
      }
    }

    const room = await db().query.rooms.findFirst({ where: eq(rooms.id, pda) });
    return NextResponse.json({ room });
  } catch (e) {
    return failInternal("rooms-create", e);
  }
}
