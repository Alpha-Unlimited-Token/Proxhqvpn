// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const nodeMaintenanceWindowsTable = pgTable("node_maintenance_windows", {
  id:        text("id").primaryKey(),
  nodeId:    text("node_id").notNull(),
  startsAt:  timestamp("starts_at").notNull(),
  endsAt:    timestamp("ends_at").notNull(),
  reason:    text("reason"),
  createdBy: text("created_by"),
  status:    text("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
