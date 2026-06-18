// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Threat Bus — unified cross-layer threat escalation events persisted to PostgreSQL.
import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const threatBusEventsTable = pgTable("threat_bus_events", {
  id:           serial("id").primaryKey(),
  // One of: SUSPECT_IP_DETECTED | LURE_TRIGGERED | ENTITY_TRAPPED |
  //         DECEPTION_ROUTE_ACTIVATED | HARD_BLOCK_ENFORCED | MANUAL_ESCALATION
  eventType:    text("event_type").notNull(),
  sourceLayer:  text("source_layer").notNull(), // firewall | ghost_trap | ghost_nodes | manual
  targetLayer:  text("target_layer"),           // ghost_trap | ghost_nodes | firewall | null (terminal)
  attackerIp:   text("attacker_ip").notNull(),
  threatScore:  integer("threat_score"),
  reason:       text("reason"),
  payload:      jsonb("payload"),
  userId:       text("user_id"),
  escalatedAt:  timestamp("escalated_at").defaultNow().notNull(),
});
