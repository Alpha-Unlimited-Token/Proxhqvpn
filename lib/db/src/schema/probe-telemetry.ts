// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Passive probe telemetry — records what attackers send TO our honeypot servers.
// Legal basis: server-side logging of inbound connections to our own infrastructure.
// No data is collected from attacker systems; all records originate from packets/
// requests sent to us.  Equivalent to standard firewall / IDS logging.
import { pgTable, serial, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const probeTelemetryTable = pgTable("probe_telemetry", {
  id:            serial("id").primaryKey(),
  sourceIp:      varchar("source_ip",      { length: 45  }).notNull(),
  sourcePort:    integer("source_port"),
  destPort:      integer("dest_port").notNull(),
  protocol:      varchar("protocol",       { length: 10  }).notNull().default("udp"),
  probeClass:    varchar("probe_class",    { length: 80  }),
  toolSignature: varchar("tool_signature", { length: 120 }),
  fingerprint:   jsonb("fingerprint"),
  nodeId:        varchar("node_id",        { length: 100 }),
  portLabel:     varchar("port_label",     { length: 60  }),
  tarpitApplied: boolean("tarpit_applied").default(false),
  tarpitMs:      integer("tarpit_ms"),
  // Explicit legal basis stored on every row for auditability.
  // honeypot_passive_self_defense — logging packets sent TO our own server.
  legalBasis:    varchar("legal_basis",    { length: 120 })
                   .notNull()
                   .default("honeypot_passive_self_defense"),
  capturedAt:    timestamp("captured_at").defaultNow().notNull(),
});

export type ProbeTelemetry    = typeof probeTelemetryTable.$inferSelect;
export type NewProbeTelemetry = typeof probeTelemetryTable.$inferInsert;
