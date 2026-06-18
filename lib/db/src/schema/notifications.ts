// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const notificationsTable = pgTable("notifications", {
  id:        serial("id").primaryKey(),
  userId:    text("user_id").notNull().references(() => usersTable.id),
  type:      text("type").notNull(),
  title:     text("title").notNull(),
  body:      text("body").notNull(),
  data:      jsonb("data"),
  /** Category: 'payment' | 'security' | 'vpn' | 'system' | 'compliance' */
  category:  text("category").notNull().default("system"),
  read:      boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Notification     = typeof notificationsTable.$inferSelect;
export type InsertNotification = typeof notificationsTable.$inferInsert;
