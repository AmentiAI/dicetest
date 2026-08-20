import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { matchEvents } from "@/lib/db/schema";
import { arenaForSeed, getArena, parseArenaId, type Arena, type ArenaId } from "@/lib/cosmetics";

export async function arenaForRoom(roomId: string): Promise<Arena> {
  const [ev] = await db()
    .select()
    .from(matchEvents)
    .where(and(eq(matchEvents.roomId, roomId), eq(matchEvents.event, "created")))
    .orderBy(desc(matchEvents.id))
    .limit(1);
  const id = parseArenaId(ev?.payload?.arena);
  return getArena(id);
}

export async function arenasForRooms(roomIds: string[]): Promise<Record<string, Arena>> {
  if (!roomIds.length) return {};
  const events = await db()
    .select()
    .from(matchEvents)
    .where(and(inArray(matchEvents.roomId, roomIds), eq(matchEvents.event, "created")));
  const map: Record<string, Arena> = {};
  for (const id of roomIds) {
    const ev = events.find((e) => e.roomId === id);
    map[id] = ev ? getArena(parseArenaId(ev.payload?.arena)) : arenaForSeed(id);
  }
  return map;
}

export function isArenaId(raw: unknown): raw is ArenaId {
  return typeof raw === "string" && ["alley", "rooftop", "underpass"].includes(raw);
}
