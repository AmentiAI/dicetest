import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";

export async function GET() {
  const rows = await db()
    .select()
    .from(profiles)
    .orderBy(desc(profiles.wins), desc(profiles.volumeLamports))
    .limit(50);
  return NextResponse.json({ leaders: rows });
}
