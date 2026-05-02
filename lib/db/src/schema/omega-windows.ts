// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const windowsListTable = pgTable("omega_windows_list", {
  id: serial("id").primaryKey(),
  hostId: integer("host_id").notNull(),
  windowHandle: text("window_handle").notNull(),
  title: text("title").notNull(),
  processName: text("process_name").notNull().default(""),
  isActive: boolean("is_active").notNull().default(false),
  isClosed: boolean("is_closed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OmegaWindowEntry = typeof windowsListTable.$inferSelect;
export type InsertOmegaWindowEntry = typeof windowsListTable.$inferInsert;
