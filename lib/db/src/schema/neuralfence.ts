// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, text, integer, boolean, timestamp, real, jsonb, bigserial } from "drizzle-orm/pg-core";

export const neuralfenceNodesTable = pgTable("neuralfence_nodes", {
  ip:             text("ip").primaryKey(),
  firstSeenAt:    timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt:     timestamp("last_seen_at").defaultNow().notNull(),
  eventCount:     integer("event_count").notNull().default(0),
  suspicionScore: real("suspicion_score").notNull().default(0),
  scoreUpdatedAt: timestamp("score_updated_at"),
  action:         text("action").notNull().default("allow"),
  actionUpdatedAt:timestamp("action_updated_at"),
  manualAction:   text("manual_action"),
  geoCountry:     text("geo_country"),
  geoAsn:         text("geo_asn"),
  isp:            text("isp"),
  isTorExit:      boolean("is_tor_exit").notNull().default(false),
  isDatacenter:   boolean("is_datacenter").notNull().default(false),
});

export const neuralfenceEventsTable = pgTable("neuralfence_events", {
  id:          bigserial("id", { mode: "number" }).primaryKey(),
  ip:          text("ip").notNull(),
  eventType:   text("event_type").notNull(),
  baseWeight:  real("base_weight").notNull(),
  occurredAt:  timestamp("occurred_at").defaultNow().notNull(),
  nodeId:      integer("node_id"),
  rawMetadata: jsonb("raw_metadata"),
});

export const neuralfencePatternsTable = pgTable("neuralfence_patterns", {
  id:          bigserial("id", { mode: "number" }).primaryKey(),
  ip:          text("ip").notNull(),
  patternName: text("pattern_name").notNull(),
  amplifier:   real("amplifier").notNull(),
  eventIds:    integer("event_ids").array().notNull().default([]),
  detectedAt:  timestamp("detected_at").defaultNow().notNull(),
});

export type InsertNeuralFenceNode    = typeof neuralfenceNodesTable.$inferInsert;
export type NeuralFenceNode          = typeof neuralfenceNodesTable.$inferSelect;
export type InsertNeuralFenceEvent   = typeof neuralfenceEventsTable.$inferInsert;
export type NeuralFenceEvent         = typeof neuralfenceEventsTable.$inferSelect;
export type InsertNeuralFencePattern = typeof neuralfencePatternsTable.$inferInsert;
export type NeuralFencePattern       = typeof neuralfencePatternsTable.$inferSelect;
