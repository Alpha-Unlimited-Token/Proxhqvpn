// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const hostsTable = pgTable("omega_hosts", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull(),
  port: integer("port").notNull().default(54896),
  label: text("label").notNull(),
  comments: text("comments"),
  status: text("status").notNull().default("unknown"),
  os: text("os"),
  lastSeen: text("last_seen"),
  latencyMs: integer("latency_ms"),
  ownerUserId: text("owner_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type OmegaHost = typeof hostsTable.$inferSelect;
export type InsertOmegaHost = typeof hostsTable.$inferInsert;
