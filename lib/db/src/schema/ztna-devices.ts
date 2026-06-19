// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// ZTNA device posture table — tracks trust scores and device signals per user.
// Separate from the WireGuard devices table (schema/devices.ts).
import { pgTable, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

export const ztnaDevicesTable = pgTable("ztna_devices", {
  id:               text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:           text("user_id").notNull(),
  certFingerprint:  text("cert_fingerprint").notNull().unique(),
  trustScore:       integer("trust_score").notNull().default(0),
  posture:          jsonb("posture").notNull().default({}),
  revoked:          boolean("revoked").notNull().default(false),
  lastSeenAt:       timestamp("last_seen_at"),
  expiresAt:        timestamp("expires_at"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
});

export type InsertZtnaDevice = typeof ztnaDevicesTable.$inferInsert;
export type ZtnaDevice = typeof ztnaDevicesTable.$inferSelect;
