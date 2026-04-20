import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { nodesTable } from "./nodes";

export const probeTypeEnum = pgEnum("probe_type", ["ping", "port_scan", "traceroute", "packet_sniff", "tunnel_probe"]);
export const severityEnum = pgEnum("severity", ["low", "medium", "high", "critical"]);
export const alertStatusEnum = pgEnum("alert_status", ["active", "dismissed"]);

export const beaconAlertsTable = pgTable("beacon_alerts", {
  id: serial("id").primaryKey(),
  nodeId: integer("node_id").references(() => nodesTable.id).notNull(),
  nodeName: text("node_name").notNull(),
  nodeLayer: text("node_layer").notNull(),
  attackerIp: text("attacker_ip").notNull(),
  attackerFingerprint: text("attacker_fingerprint").notNull(),
  probeType: probeTypeEnum("probe_type").notNull(),
  severity: severityEnum("severity").notNull(),
  status: alertStatusEnum("status").notNull().default("active"),
  silkWebTrapped: boolean("silk_web_trapped").notNull().default(false),
  rawData: text("raw_data"),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
});

export const insertBeaconAlertSchema = createInsertSchema(beaconAlertsTable).omit({ id: true });
export type InsertBeaconAlert = z.infer<typeof insertBeaconAlertSchema>;
export type BeaconAlert = typeof beaconAlertsTable.$inferSelect;
