import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hostsTable = pgTable("omega_hosts", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull(),
  port: integer("port").notNull().default(54896),
  label: text("label").notNull(),
  comments: text("comments"),
  status: text("status").notNull().default("unknown"),
  os: text("os"),
  lastSeen: text("last_seen"),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHostSchema = createInsertSchema(hostsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type OmegaHost = typeof hostsTable.$inferSelect;
export type InsertOmegaHost = z.infer<typeof insertHostSchema>;
