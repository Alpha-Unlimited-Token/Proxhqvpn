// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const privilegedCommandApprovalsTable = pgTable("privileged_command_approvals", {
  id:          text("id").primaryKey(),
  requestedBy: text("requested_by").notNull(),
  command:     text("command").notNull(),
  targetHost:  text("target_host").notNull().default("local"),
  reason:      text("reason").notNull(),
  status:      text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  expiresAt:   timestamp("expires_at").notNull(),
  approvedBy:  text("approved_by"),
  approvedAt:  timestamp("approved_at"),
});

export type InsertPrivilegedCommandApproval = typeof privilegedCommandApprovalsTable.$inferInsert;
export type PrivilegedCommandApproval       = typeof privilegedCommandApprovalsTable.$inferSelect;
