import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PLAY_LOCKED } from "@/lib/waitlist";

export function middleware(req: NextRequest) {
  if (!PLAY_LOCKED) return NextResponse.next();
  const path = req.nextUrl.pathname;
  if (
    path.startsWith("/circles") ||
    path.startsWith("/duel") ||
    path.startsWith("/leaderboard") ||
    path.startsWith("/history") ||
    path.startsWith("/how-to-play")
  ) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/circles",
    "/circles/:path*",
    "/duel/:path*",
    "/leaderboard",
    "/leaderboard/:path*",
    "/history",
    "/history/:path*",
    "/how-to-play",
  ],
};
