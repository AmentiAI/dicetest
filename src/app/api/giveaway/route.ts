import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { fail, failInternal } from "@/lib/api";
import { db } from "@/lib/db";
import { giveawayEntries } from "@/lib/db/schema";
import {
  GIVEAWAY_USD,
  minAcceptUnits,
  quoteRtbUnits,
  rtbUiAmount,
} from "@/lib/giveaway";
import { rtbUsd } from "@/lib/price";
import { allow, limitOr429 } from "@/lib/rate-limit";
import {
  devWallet,
  isSolanaPubkey,
  isSolanaSignature,
  solanaPubkey,
} from "@/lib/solana/keys";
import { solanaConnection } from "@/lib/solana/rpc";
import { TOKEN } from "@/lib/token";

export const runtime = "nodejs";

type TokenBal = {
  accountIndex?: number;
  mint: string;
  owner?: string;
  uiTokenAmount?: { amount?: string };
};

function readAmount(raw: string | undefined) {
  if (!raw) return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

function amountFor(
  balances: TokenBal[] | null | undefined,
  keys: string[],
  dest: string,
  destAta: string,
  mint: string,
) {
  let total = 0n;
  for (const b of balances ?? []) {
    if (b.mint !== mint) continue;
    const account = keys[b.accountIndex ?? -1];
    if (b.owner !== dest && account !== destAta) continue;
    total += readAmount(b.uiTokenAmount?.amount);
  }
  return total;
}

async function receivedRtb(
  signature: string,
  payer: string,
  dest: string,
): Promise<bigint> {
  const [{ TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress }, connection] =
    await Promise.all([
      import("@solana/spl-token"),
      Promise.resolve(solanaConnection("server")),
    ]);
  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx) throw new Error("transaction not found yet");
  if (tx.meta?.err) throw new Error("transaction failed on chain");

  const keys = tx.transaction.message.accountKeys.map((k) =>
    typeof k === "string" ? k : k.pubkey.toBase58(),
  );
  if (!keys.includes(payer)) {
    throw new Error("this transaction was not signed by that wallet");
  }

  const mint = solanaPubkey(TOKEN.mint);
  const destKey = solanaPubkey(dest);
  const mintInfo = await connection.getAccountInfo(mint);
  const tokenProgram = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;
  const destAta = (
    await getAssociatedTokenAddress(mint, destKey, false, tokenProgram)
  ).toBase58();
  const mintStr = mint.toBase58();
  const pre = amountFor(
    tx.meta?.preTokenBalances as TokenBal[],
    keys,
    dest,
    destAta,
    mintStr,
  );
  const post = amountFor(
    tx.meta?.postTokenBalances as TokenBal[],
    keys,
    dest,
    destAta,
    mintStr,
  );
  const gained = post - pre;
  if (gained > 0n) return gained;

  throw new Error("no $RTB arrived at the giveaway wallet");
}

async function entryFor(wallet: string | null) {
  if (!wallet) return null;
  const [row] = await db()
    .select()
    .from(giveawayEntries)
    .where(eq(giveawayEntries.wallet, wallet))
    .limit(1);
  if (!row) return null;
  return {
    wallet: row.wallet,
    signature: row.signature,
    amount: row.amount,
    usdAtJoin: row.usdAtJoin,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET(req: Request) {
  try {
    const limited = limitOr429(req, "giveaway-get", 40);
    if (limited) return limited;
    const walletRaw = new URL(req.url).searchParams.get("wallet") ?? "";
    const wallet = isSolanaPubkey(walletRaw) ? walletRaw : null;
    const dest = devWallet();
    const { usd, source } = await rtbUsd();
    let amount = "0";
    let uiAmount = "0";
    if (usd != null) {
      const units = quoteRtbUnits(usd);
      amount = units.toString();
      uiAmount = rtbUiAmount(units);
    }
    return NextResponse.json({
      usd: GIVEAWAY_USD,
      priceUsd: usd,
      source,
      amount,
      uiAmount,
      mint: TOKEN.mint,
      decimals: TOKEN.decimals,
      dest,
      configured: Boolean(dest),
      me: await entryFor(wallet),
    });
  } catch (e) {
    return failInternal("giveaway-get", e);
  }
}

export async function POST(req: Request) {
  try {
    const limited = limitOr429(req, "giveaway-post", 10);
    if (limited) return limited;
    const dest = devWallet();
    if (!dest) return fail("giveaway payments are not configured yet", 503);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("invalid json body");
    const wallet = String((body as { wallet?: unknown }).wallet ?? "");
    const signature = String((body as { signature?: unknown }).signature ?? "");
    if (!isSolanaPubkey(wallet)) return fail("connect a Solana wallet first");
    if (!isSolanaSignature(signature)) return fail("missing transaction signature");
    if (!allow(`giveaway-wallet:${wallet}`, 8)) return fail("too many requests", 429);

    const existing = await entryFor(wallet);
    if (existing) {
      return NextResponse.json({ ok: true, already: true, me: existing });
    }

    const [sigTaken] = await db()
      .select()
      .from(giveawayEntries)
      .where(eq(giveawayEntries.signature, signature))
      .limit(1);
    if (sigTaken) return fail("that transaction was already used", 409);

    const { usd } = await rtbUsd();
    if (usd == null) return fail("could not quote $RTB right now", 503);

    let received: bigint;
    try {
      received = await receivedRtb(signature, wallet, dest);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "transaction not found yet") {
        return fail("transaction not confirmed yet — wait a few seconds and retry", 409);
      }
      return fail(msg || "could not verify $RTB transfer");
    }

    const min = minAcceptUnits(usd);
    if (received < min) {
      return fail(
        `transfer is short of $${GIVEAWAY_USD} in $${TOKEN.symbol}`,
      );
    }

    const inserted = await db()
      .insert(giveawayEntries)
      .values({
        wallet,
        signature,
        amount: received.toString(),
        usdAtJoin: usd.toString(),
      })
      .returning();
    const row = inserted[0];
    if (!row) return fail("could not save entry", 500);
    return NextResponse.json({
      ok: true,
      already: false,
      me: {
        wallet: row.wallet,
        signature: row.signature,
        amount: row.amount,
        usdAtJoin: row.usdAtJoin,
        createdAt: row.createdAt.toISOString(),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return fail("this wallet is already in the giveaway", 409);
    }
    return failInternal("giveaway-post", e);
  }
}
