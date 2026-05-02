// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";

export const processesTable = pgTable("omega_processes", {
  id: serial("id").primaryKey(),
  hostId: integer("host_id").notNull(),
  pid: integer("pid").notNull(),
  name: text("name").notNull(),
  cpuPct: real("cpu_pct").notNull().default(0),
  memMb: real("mem_mb").notNull().default(0),
  status: text("status").notNull().default("running"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OmegaProcess = typeof processesTable.$inferSelect;
export type InsertOmegaProcess = typeof processesTable.$inferInsert;
