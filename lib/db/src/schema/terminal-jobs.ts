// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const terminalJobsTable = pgTable("terminal_jobs", {
  id:          text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  command:     text("command").notNull(),
  ghostMode:   boolean("ghost_mode").notNull().default(false),
  status:      text("status").notNull().default("pending"),
  stdout:      text("stdout"),
  stderr:      text("stderr"),
  exitCode:    integer("exit_code"),
  timeoutMs:   integer("timeout_ms").notNull().default(30000),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  startedAt:   timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  expiresAt:   timestamp("expires_at").notNull(),
});

export type InsertTerminalJob = typeof terminalJobsTable.$inferInsert;
export type TerminalJob       = typeof terminalJobsTable.$inferSelect;
