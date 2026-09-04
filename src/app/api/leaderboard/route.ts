import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { failInternal } from "@/lib/api";
import { limitOr429 } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const limited = limitOr429(req, "leaderboard", 40);
    if (limited) return limited;
    const rows = await db()
      .select()
      .from(profiles)
      .orderBy(desc(profiles.wins), desc(profiles.volumeLamports))
      .limit(50);
    return NextResponse.json({ leaders: rows });
  } catch (e) {
    return failInternal("leaderboard", e);
  }
}
