// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const detectionSignaturesTable = pgTable("detection_signatures", {
  id:            serial("id").primaryKey(),
  userId:        text("user_id").notNull(),
  name:          text("name").notNull(),
  description:   text("description").notNull().default(""),
  conditions:    jsonb("conditions").notNull().default([]),
  anyConditions: jsonb("any_conditions").notNull().default([]),
  severity:      text("severity").notNull().default("medium"),
  action:        text("action").notNull().default("alert"),
  enabled:       boolean("enabled").notNull().default(true),
  hitCount:      jsonb("hit_count"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("detection_signatures_user_idx").on(t.userId),
]);

export type DetectionSignatureRow = typeof detectionSignaturesTable.$inferSelect;
