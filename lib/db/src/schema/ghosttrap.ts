// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const ghostTrapProbesTable = pgTable("ghost_trap_probes", {
  id:            serial("id").primaryKey(),
  probeId:       text("probe_id").notNull().unique(),
  attackerIp:    text("attacker_ip").notNull(),
  attackerUa:    text("attacker_ua"),
  method:        text("method").notNull(),
  endpoint:      text("endpoint").notNull(),
  rawPayload:    text("raw_payload"),
  probeType:     text("probe_type").notNull(), // sql_injection | xss | cmd_injection | path_traversal | auth_brute | recon | other
  attackVector:  text("attack_vector"),        // the specific pattern that matched
  fakeResponse:  text("fake_response"),        // what poisoned data we fed back
  tarpitMs:      integer("tarpit_ms").notNull().default(0),
  autoBlocked:   boolean("auto_blocked").notNull().default(false),
  silkTrapped:   boolean("silk_trapped").notNull().default(false),
  country:       text("country"),
  referer:       text("referer"),
  probeHeaders:  text("probe_headers"),
  probedAt:      timestamp("probed_at").defaultNow().notNull(),
});

export const ghostTrapConfigTable = pgTable("ghost_trap_config", {
  id:              serial("id").primaryKey(),
  enabled:         boolean("enabled").notNull().default(true),
  tarpitMinMs:     integer("tarpit_min_ms").notNull().default(1500),
  tarpitMaxMs:     integer("tarpit_max_ms").notNull().default(8000),
  autoBlockAfter:  integer("auto_block_after").notNull().default(5),
  silkTrapAfter:   integer("silk_trap_after").notNull().default(3),
  fakeSiteName:    text("fake_site_name").notNull().default("AdminPanel v2.1"),
  fakeDbVersion:   text("fake_db_version").notNull().default("MySQL 5.7.39-log"),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});

export type GhostTrapProbe = typeof ghostTrapProbesTable.$inferSelect;
export type GhostTrapConfig = typeof ghostTrapConfigTable.$inferSelect;
