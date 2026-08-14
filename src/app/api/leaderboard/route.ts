import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  try {
    const rows = await db()
      .select()
      .from(profiles)
      .orderBy(desc(profiles.wins), desc(profiles.volumeLamports))
      .limit(50);
    return NextResponse.json({ leaders: rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "leaderboard failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
