// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, boolean, real, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const nodeLayerEnum = pgEnum("node_layer", ["outer", "inner"]);
export const nodeStatusEnum = pgEnum("node_status", ["active", "inactive", "rotating", "trapped"]);

export const nodesTable = pgTable("nodes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  layer: nodeLayerEnum("layer").notNull(),
  hopIndex: integer("hop_index").notNull(),
  region: text("region").notNull(),
  ipAddress: text("ip_address").notNull(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  listenPort: integer("listen_port").notNull(),
  status: nodeStatusEnum("status").notNull().default("active"),
  hasBeacon: boolean("has_beacon").notNull().default(true),
  hasSpider: boolean("has_spider").notNull().default(true),
  hasWorm: boolean("has_worm").notNull().default(true),
  publicIp: text("public_ip"),
  latencyMs: real("latency_ms").notNull().default(0),
  lastSeen: timestamp("last_seen").defaultNow(),
  fwSyncedAt: timestamp("fw_synced_at"),
  fwSyncHash: text("fw_sync_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertNode = typeof nodesTable.$inferInsert;
export type Node = typeof nodesTable.$inferSelect;
