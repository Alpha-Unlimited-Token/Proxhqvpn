import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";

export const systemInfoTable = pgTable("omega_system_info", {
  id: serial("id").primaryKey(),
  hostId: integer("host_id").notNull(),
  osName: text("os_name").notNull().default(""),
  osVersion: text("os_version").notNull().default(""),
  cpu: text("cpu").notNull().default(""),
  ramTotalMb: real("ram_total_mb").notNull().default(0),
  ramUsedMb: real("ram_used_mb").notNull().default(0),
  username: text("username").notNull().default(""),
  computerName: text("computer_name").notNull().default(""),
  uptimeSeconds: integer("uptime_seconds").notNull().default(0),
  diskTotalGb: real("disk_total_gb").notNull().default(0),
  diskUsedGb: real("disk_used_gb").notNull().default(0),
  resolution: text("resolution").notNull().default(""),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export type OmegaSystemInfo = typeof systemInfoTable.$inferSelect;
export type InsertOmegaSystemInfo = typeof systemInfoTable.$inferInsert;
