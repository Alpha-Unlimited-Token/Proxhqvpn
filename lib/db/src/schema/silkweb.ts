// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { nodesTable } from "./nodes";

export const silkWebTable = pgTable("silk_web", {
  id: serial("id").primaryKey(),
  generationId: text("generation_id").notNull(),
  totalRoutes: integer("total_routes").notNull().default(0),
  deadEndRoutes: integer("dead_end_routes").notNull().default(0),
  activeHighways: integer("active_highways").notNull().default(0),
  intersections: integer("intersections").notNull().default(0),
  lastCollapsedAt: timestamp("last_collapsed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const silkRoutesTable = pgTable("silk_routes", {
  id: serial("id").primaryKey(),
  webId: integer("web_id").references(() => silkWebTable.id).notNull(),
  fromNodeId: integer("from_node_id").references(() => nodesTable.id).notNull(),
  toNodeId: integer("to_node_id").references(() => nodesTable.id).notNull(),
  routeType: text("route_type").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const trappedAttackersTable = pgTable("trapped_attackers", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull(),
  fingerprint: text("fingerprint").notNull(),
  entryNodeId: integer("entry_node_id").references(() => nodesTable.id).notNull(),
  loopCount: integer("loop_count").notNull().default(0),
  trappedAt: timestamp("trapped_at").defaultNow().notNull(),
  dataCollected: text("data_collected").notNull().default(""),
  honeypotPort: integer("honeypot_port"),
  probeType: text("probe_type").default("port_scan"),
  sqlmapStatus: text("sqlmap_status").default("idle"),
  sqlmapJobId: text("sqlmap_job_id"),
  sqlmapResults: text("sqlmap_results"),
  sqlmapStartedAt: timestamp("sqlmap_started_at"),
  sqlmapFinishedAt: timestamp("sqlmap_finished_at"),
});

export type InsertSilkWeb = typeof silkWebTable.$inferInsert;
export type SilkWeb = typeof silkWebTable.$inferSelect;
export type SilkRoute = typeof silkRoutesTable.$inferSelect;
export type TrappedAttacker = typeof trappedAttackersTable.$inferSelect;
