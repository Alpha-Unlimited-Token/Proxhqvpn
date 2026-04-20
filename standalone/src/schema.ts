import {
  sqliteTable, integer, text, real
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const nodesTable = sqliteTable("nodes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  layer: text("layer").notNull(),
  hopIndex: integer("hop_index").notNull(),
  region: text("region").notNull(),
  ipAddress: text("ip_address").notNull(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  listenPort: integer("listen_port").notNull(),
  status: text("status").notNull().default("active"),
  hasBeacon: integer("has_beacon", { mode: "boolean" }).notNull().default(true),
  hasSpider: integer("has_spider", { mode: "boolean" }).notNull().default(true),
  hasWorm: integer("has_worm", { mode: "boolean" }).notNull().default(true),
  latencyMs: real("latency_ms").notNull().default(0),
  lastSeen: text("last_seen").default(sql`(datetime('now'))`),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const beaconAlertsTable = sqliteTable("beacon_alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nodeId: integer("node_id").notNull(),
  nodeName: text("node_name").notNull(),
  nodeLayer: text("node_layer").notNull(),
  attackerIp: text("attacker_ip").notNull(),
  attackerFingerprint: text("attacker_fingerprint").notNull(),
  probeType: text("probe_type").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("active"),
  silkWebTrapped: integer("silk_web_trapped", { mode: "boolean" }).notNull().default(false),
  rawData: text("raw_data"),
  detectedAt: text("detected_at").notNull().default(sql`(datetime('now'))`),
});

export const silkWebTable = sqliteTable("silk_web", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  generationId: text("generation_id").notNull(),
  totalRoutes: integer("total_routes").notNull().default(0),
  deadEndRoutes: integer("dead_end_routes").notNull().default(0),
  activeHighways: integer("active_highways").notNull().default(0),
  intersections: integer("intersections").notNull().default(0),
  lastCollapsedAt: text("last_collapsed_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const silkRoutesTable = sqliteTable("silk_routes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  webId: integer("web_id").notNull(),
  fromNodeId: integer("from_node_id").notNull(),
  toNodeId: integer("to_node_id").notNull(),
  routeType: text("route_type").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const trappedAttackersTable = sqliteTable("trapped_attackers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ip: text("ip").notNull(),
  fingerprint: text("fingerprint").notNull(),
  entryNodeId: integer("entry_node_id").notNull(),
  loopCount: integer("loop_count").notNull().default(0),
  trappedAt: text("trapped_at").notNull().default(sql`(datetime('now'))`),
  dataCollected: text("data_collected").notNull().default(""),
});

export const firewallRulesTable = sqliteTable("firewall_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  direction: text("direction").notNull(),
  action: text("action").notNull(),
  protocol: text("protocol").notNull(),
  sourceIp: text("source_ip"),
  sourcePort: text("source_port"),
  destIp: text("dest_ip"),
  destPort: text("dest_port"),
  priority: integer("priority").notNull().default(100),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  hitCount: integer("hit_count").notNull().default(0),
  description: text("description"),
  isIspMasquerade: integer("is_isp_masquerade", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const firewallStatusTable = sqliteTable("firewall_status", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  mode: text("mode").notNull().default("stealth"),
  packetsBlocked: integer("packets_blocked").notNull().default(0),
  packetsAllowed: integer("packets_allowed").notNull().default(0),
  ispMasqueradeActive: integer("isp_masquerade_active", { mode: "boolean" }).notNull().default(true),
  localhostHidden: integer("localhost_hidden", { mode: "boolean" }).notNull().default(true),
  dnsMasked: integer("dns_masked", { mode: "boolean" }).notNull().default(true),
  lastUpdated: text("last_updated").notNull().default(sql`(datetime('now'))`),
});

export const blockedIpsTable = sqliteTable("blocked_ips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ip: text("ip").notNull(),
  reason: text("reason").notNull(),
  autoBlocked: integer("auto_blocked", { mode: "boolean" }).notNull().default(false),
  hitCount: integer("hit_count").notNull().default(1),
  blockedAt: text("blocked_at").notNull().default(sql`(datetime('now'))`),
  expiresAt: text("expires_at"),
});

export type Node = typeof nodesTable.$inferSelect;
export type BeaconAlert = typeof beaconAlertsTable.$inferSelect;
export type SilkWeb = typeof silkWebTable.$inferSelect;
export type FirewallRule = typeof firewallRulesTable.$inferSelect;
export type FirewallStatus = typeof firewallStatusTable.$inferSelect;
export type BlockedIp = typeof blockedIpsTable.$inferSelect;
