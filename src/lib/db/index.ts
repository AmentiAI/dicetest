import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is missing. Add your Neon connection string to .env");
  }
  return drizzle(neon(url), { schema });
}

let cached: ReturnType<typeof getDb> | null = null;

export function db() {
  if (!cached) cached = getDb();
  return cached;
}
