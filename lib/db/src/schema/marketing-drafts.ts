// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const marketingDraftsTable = pgTable("marketing_drafts", {
  id:           serial("id").primaryKey(),
  userId:       text("user_id").notNull(),
  agent:        text("agent").notNull(),
  brief:        text("brief").notNull(),
  output:       text("output").notNull(),
  status:       text("status").notNull().default("draft"),
  scheduledFor: timestamp("scheduled_for"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});

export type MarketingDraft = typeof marketingDraftsTable.$inferSelect;
