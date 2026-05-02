// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";

export const ghostTraceObservationsTable = pgTable("ghost_trace_observations", {
  id: serial("id").primaryKey(),
  peerPublicKey: text("peer_public_key").notNull(),
  deviceName: text("device_name").notNull(),
  nodeId: integer("node_id").notNull(),
  observedAt: timestamp("observed_at").defaultNow().notNull(),
  bytesOut: integer("bytes_out").notNull().default(0),
  bytesIn: integer("bytes_in").notNull().default(0),
  destIpCount: integer("dest_ip_count").notNull().default(0),
  uniqueNewDests: integer("unique_new_dests").notNull().default(0),
  avgIntervalMs: real("avg_interval_ms"),
  anomalyType: text("anomaly_type"),
  anomalyScore: integer("anomaly_score").notNull().default(0),
  anomalyDetails: text("anomaly_details"),
  resolved: boolean("resolved").notNull().default(false),
});

export const ghostTraceBaselineTable = pgTable("ghost_trace_baselines", {
  id: serial("id").primaryKey(),
  peerPublicKey: text("peer_public_key").notNull().unique(),
  deviceName: text("device_name").notNull(),
  baselineBytesOutPerHour: integer("baseline_bytes_out_per_hour").notNull().default(0),
  baselineDestCount: integer("baseline_dest_count").notNull().default(0),
  activeHoursJson: text("active_hours_json").notNull().default("[]"),
  knownDestinationsJson: text("known_destinations_json").notNull().default("[]"),
  beaconEnabled: boolean("beacon_enabled").notNull().default(true),
  exfilEnabled: boolean("exfil_enabled").notNull().default(true),
  maliciousDestEnabled: boolean("malicious_dest_enabled").notNull().default(true),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type GhostTraceObservation = typeof ghostTraceObservationsTable.$inferSelect;
export type GhostTraceBaseline = typeof ghostTraceBaselineTable.$inferSelect;
export type InsertGhostTraceObservation = typeof ghostTraceObservationsTable.$inferInsert;
