// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const userAlertWebhooksTable = pgTable("user_alert_webhooks", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:    text("user_id").notNull(),
  name:      text("name").notNull(),
  url:       text("url").notNull(),
  secret:    text("secret").notNull(),
  events:    text("events").array().notNull().default([]),
  enabled:   boolean("enabled").notNull().default(true),
  lastFired: timestamp("last_fired"),
  fireCount: integer("fire_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertUserAlertWebhook = typeof userAlertWebhooksTable.$inferInsert;
export type UserAlertWebhook       = typeof userAlertWebhooksTable.$inferSelect;
