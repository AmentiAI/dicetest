import { NextResponse } from "next/server";
import { failInternal } from "@/lib/api";
import { rtbUsd } from "@/lib/price";
import { limitOr429 } from "@/lib/rate-limit";

export async function GET(req: Request) {
  try {
    const limited = limitOr429(req, "price", 40);
    if (limited) return limited;
    const quote = await rtbUsd();
    return NextResponse.json(quote);
  } catch (e) {
    return failInternal("price", e);
  }
}
