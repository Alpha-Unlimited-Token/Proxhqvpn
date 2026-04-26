import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const omnistrikeScansTable = pgTable("omnistrike_scans", {
  id: serial("id").primaryKey(),
  target: text("target").notNull(),
  status: text("status").notNull().default("pending"),
  categories: text("categories").array(),
  threads: integer("threads").notNull().default(3),
  tamperLevel: integer("tamper_level").notNull().default(2),
  stealthMode: boolean("stealth_mode").notNull().default(false),
  findings: jsonb("findings").default([]),
  stats: jsonb("stats"),
  successRate: integer("success_rate"),
  log: text("log").array().default([]),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type OmnistrikeScan = typeof omnistrikeScansTable.$inferSelect;
export type InsertOmnistrikeScan = typeof omnistrikeScansTable.$inferInsert;
