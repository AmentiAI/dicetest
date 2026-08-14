import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  wallet: text("wallet").primaryKey(),
  username: text("username").notNull(),
  demon: text("demon").notNull().default("cinder-wraith"),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  volumeLamports: text("volume_lamports").notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(),
  duelId: text("duel_id").notNull(),
  hostWallet: text("host_wallet").notNull(),
  challengerWallet: text("challenger_wallet"),
  wagerLamports: text("wager_lamports").notNull(),
  status: text("status").notNull().default("waiting"),
  commitSlot: text("commit_slot"),
  revealSlot: text("reveal_slot"),
  hostRoll: integer("host_roll"),
  challengerRoll: integer("challenger_roll"),
  winnerWallet: text("winner_wallet"),
  slotHash: text("slot_hash"),
  createSignature: text("create_signature").notNull(),
  joinSignature: text("join_signature"),
  settleSignature: text("settle_signature"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  wallet: text("wallet").notNull(),
  username: text("username").notNull(),
  body: text("body").notNull(),
  kind: text("kind").notNull().default("chat"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const matchEvents = pgTable("match_events", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  event: text("event").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
