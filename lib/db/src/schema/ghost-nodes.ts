// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Node — decoy/deception VPN node infrastructure.
// Ghost nodes are fake WireGuard endpoints presented to scanners/attackers.
// They are NEVER connected to real customer VPN tunnels.
import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

// ── ghost_nodes — inventory of decoy nodes ────────────────────────────────────
export const ghostNodesTable = pgTable("ghost_nodes", {
  id:              serial("id").primaryKey(),
  name:            text("name").notNull(),
  region:          text("region").notNull(),
  publicIp:        text("public_ip").notNull(),
  decoyIp:         text("decoy_ip"),             // fake IP shown to scanners
  listenPort:      integer("listen_port").notNull().default(51820),
  decoyPublicKey:  text("decoy_public_key"),     // fake WG public key (not real)
  status:          text("status").notNull().default("active"), // active|quarantined|disabled
  isolationLevel:  text("isolation_level").notNull().default("full"), // full|partial
  enabledAt:       timestamp("enabled_at"),
  disabledAt:      timestamp("disabled_at"),
  quarantinedAt:   timestamp("quarantined_at"),
  createdBy:       text("created_by").notNull(), // Clerk userId
  notes:           text("notes"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});

// ── ghost_node_events — interactions with decoy nodes ────────────────────────
export const ghostNodeEventsTable = pgTable("ghost_node_events", {
  id:           serial("id").primaryKey(),
  ghostNodeId:  integer("ghost_node_id").notNull().references(() => ghostNodesTable.id),
  eventType:    text("event_type").notNull(), // probe|handshake_attempt|port_scan|wg_init
  sourceIp:     text("source_ip").notNull(),
  sourcePort:   integer("source_port"),
  rawPayload:   text("raw_payload"),
  geoCountry:   text("geo_country"),
  geoCity:      text("geo_city"),
  geoAsn:       text("geo_asn"),
  severity:     text("severity").notNull().default("info"), // info|warn|critical
  fedToSiem:    boolean("fed_to_siem").notNull().default(false),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

// ── ghost_node_routes — WG decoy routing rules pushed to real nodes ───────────
export const ghostNodeRoutesTable = pgTable("ghost_node_routes", {
  id:             serial("id").primaryKey(),
  ghostNodeId:    integer("ghost_node_id").notNull().references(() => ghostNodesTable.id),
  realNodeId:     integer("real_node_id"),       // real VPN node that hosts the decoy interface
  decoyInterface: text("decoy_interface").notNull().default("wg-ghost0"),
  allowedIpRange: text("allowed_ip_range").notNull(), // CIDR routed to decoy
  iptablesMarkId: integer("iptables_mark_id").notNull().default(99),
  routingTable:   integer("routing_table").notNull().default(100),
  policyHash:     text("policy_hash"),
  pushedAt:       timestamp("pushed_at"),
  active:         boolean("active").notNull().default(true),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});

// ── vultr_node_deception_state — per-Vultr-instance deception tracking ────────
export const vultrNodeDeceptionStateTable = pgTable("vultr_node_deception_state", {
  id:               serial("id").primaryKey(),
  vultrInstanceId:  text("vultr_instance_id"),
  nodeId:           integer("node_id"),
  ghostNodeId:      integer("ghost_node_id").references(() => ghostNodesTable.id),
  decoyEnabled:     boolean("decoy_enabled").notNull().default(false),
  decoyInterface:   text("decoy_interface"),
  lastPolicyPush:   timestamp("last_policy_push"),
  policyHash:       text("policy_hash"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
});

// ── ghost_node_policies — per-node deception policy config ───────────────────
export const ghostNodePoliciesTable = pgTable("ghost_node_policies", {
  id:                 serial("id").primaryKey(),
  ghostNodeId:        integer("ghost_node_id").notNull().references(() => ghostNodesTable.id),
  policyVersion:      integer("policy_version").notNull().default(1),
  decoyBanners:       text("decoy_banners"),               // JSON array of fake service banners
  portMappings:       text("port_mappings"),               // JSON: { port: fake_service }
  isolationMode:      text("isolation_mode").notNull().default("full"), // full|partial|monitor_only
  allowTarpitting:    boolean("allow_tarpitting").notNull().default(true),
  allowBeacons:       boolean("allow_beacons").notNull().default(true),
  tarpitMaxMs:        integer("tarpit_max_ms").notNull().default(30000),
  rateLimit:          integer("rate_limit").notNull().default(30),  // events/IP/min
  autoBlockThreshold: integer("auto_block_threshold").notNull().default(10),
  siemFanout:         boolean("siem_fanout").notNull().default(true),
  logLevel:           text("log_level").notNull().default("standard"), // minimal|standard|verbose
  policyHash:         text("policy_hash"),
  pushedAt:           timestamp("pushed_at"),
  active:             boolean("active").notNull().default(true),
  createdBy:          text("created_by").notNull(),
  createdAt:          timestamp("created_at").defaultNow().notNull(),
  updatedAt:          timestamp("updated_at").defaultNow().notNull(),
});

// ── ghost_trap_rules — custom detection rules for Ghost Trap ─────────────────
export const ghostTrapRulesTable = pgTable("ghost_trap_rules", {
  id:          serial("id").primaryKey(),
  userId:      text("user_id").notNull(),
  ruleType:    text("rule_type").notNull(),  // path_pattern|ua_pattern|header_pattern|ip_cidr
  pattern:     text("pattern").notNull(),
  action:      text("action").notNull().default("log"), // log|tarpit|block|silk_trap
  priority:    integer("priority").notNull().default(50),
  enabled:     boolean("enabled").notNull().default(true),
  description: text("description"),
  matchCount:  integer("match_count").notNull().default(0),
  lastMatchAt: timestamp("last_match_at"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});
