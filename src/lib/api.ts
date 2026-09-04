import { NextResponse } from "next/server";

export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export function failInternal(scope: string, err: unknown) {
  console.error(`[${scope}]`, err);
  return NextResponse.json({ error: "internal error" }, { status: 500 });
}

export const ROOM_STATUSES = [
  "waiting",
  "locked",
  "settled",
  "cancelled",
  "refunded",
] as const;
