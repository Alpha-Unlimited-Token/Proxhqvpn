// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, bigint } from "drizzle-orm/pg-core";

// Persisted daemon-inbound IP ban records.
// The in-memory Map in app.ts is the hot-path; this table is the durable backing
// store so bans survive process restarts and can be inspected/cleared by admins.
export const daemonIpBansTable = pgTable("daemon_ip_bans", {
  id:            serial("id").primaryKey(),
  ip:            text("ip").notNull().unique(),
  failureCount:  integer("failure_count").notNull().default(0),
  windowStart:   bigint("window_start", { mode: "number" }).notNull().default(0),
  bannedUntil:   bigint("banned_until",  { mode: "number" }).notNull().default(0),
  updatedAt:     bigint("updated_at",    { mode: "number" }).notNull().default(0),
});

export type DaemonIpBan   = typeof daemonIpBansTable.$inferSelect;
export type NewDaemonIpBan = typeof daemonIpBansTable.$inferInsert;
