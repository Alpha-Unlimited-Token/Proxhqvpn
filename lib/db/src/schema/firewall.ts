// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const firewallDirectionEnum = pgEnum("firewall_direction", ["inbound", "outbound", "both"]);
export const firewallActionEnum = pgEnum("firewall_action", ["allow", "deny", "drop", "reject", "masquerade", "log"]);
export const firewallProtocolEnum = pgEnum("firewall_protocol", ["tcp", "udp", "icmp", "any"]);
export const firewallModeEnum = pgEnum("firewall_mode", ["stealth", "strict", "standard", "learning"]);

export const firewallRulesTable = pgTable("firewall_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  direction: firewallDirectionEnum("direction").notNull(),
  action: firewallActionEnum("action").notNull(),
  protocol: firewallProtocolEnum("protocol").notNull(),
  sourceIp: text("source_ip"),
  sourcePort: text("source_port"),
  destIp: text("dest_ip"),
  destPort: text("dest_port"),
  priority: integer("priority").notNull().default(100),
  enabled: boolean("enabled").notNull().default(true),
  hitCount: integer("hit_count").notNull().default(0),
  description: text("description"),
  isIspMasquerade: boolean("is_isp_masquerade").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const firewallStatusTable = pgTable("firewall_status", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  mode: firewallModeEnum("mode").notNull().default("stealth"),
  packetsBlocked: integer("packets_blocked").notNull().default(0),
  packetsAllowed: integer("packets_allowed").notNull().default(0),
  ispMasqueradeActive: boolean("isp_masquerade_active").notNull().default(true),
  localhostHidden: boolean("localhost_hidden").notNull().default(true),
  dnsMasked: boolean("dns_masked").notNull().default(true),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const blockedIpsTable = pgTable("blocked_ips", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull(),
  reason: text("reason").notNull(),
  autoBlocked: boolean("auto_blocked").notNull().default(false),
  hitCount: integer("hit_count").notNull().default(1),
  blockedAt: timestamp("blocked_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

// ── IPS Signature Engine ───────────────────────────────────────────────────
export const firewallIpsSignaturesTable = pgTable("firewall_ips_signatures", {
  id: serial("id").primaryKey(),
  sid: text("sid").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  pattern: text("pattern").notNull(),
  patternType: text("pattern_type").notNull().default("signature"),
  description: text("description"),
  cveId: text("cve_id"),
  references: text("references"),
  enabled: boolean("enabled").notNull().default(true),
  hitCount: integer("hit_count").notNull().default(0),
  action: text("action").notNull().default("drop"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Deep Packet Inspection Rules ───────────────────────────────────────────
export const firewallDpiRulesTable = pgTable("firewall_dpi_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pattern: text("pattern").notNull(),
  patternType: text("pattern_type").notNull(),
  action: text("action").notNull().default("block"),
  enabled: boolean("enabled").notNull().default(true),
  hitCount: integer("hit_count").notNull().default(0),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Geo-IP Blocking ────────────────────────────────────────────────────────
export const firewallGeoBlocksTable = pgTable("firewall_geo_blocks", {
  id: serial("id").primaryKey(),
  countryCode: text("country_code").notNull().unique(),
  countryName: text("country_name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  hitCount: integer("hit_count").notNull().default(0),
  blockedAt: timestamp("blocked_at").defaultNow().notNull(),
});

// ── Threat Intelligence Feeds ──────────────────────────────────────────────
export const firewallThreatFeedsTable = pgTable("firewall_threat_feeds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  feedType: text("feed_type").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  autoSync: boolean("auto_sync").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  entryCount: integer("entry_count").notNull().default(0),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Security Zones ─────────────────────────────────────────────────────────
export const firewallZonesTable = pgTable("firewall_zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  trustLevel: text("trust_level").notNull(),
  interfaces: text("interfaces"),
  description: text("description"),
  inboundPolicy: text("inbound_policy").notNull().default("deny"),
  outboundPolicy: text("outbound_policy").notNull().default("allow"),
  color: text("color").notNull().default("#00ff88"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── FQDN / Domain-Based Rules ──────────────────────────────────────────────
export const firewallFqdnRulesTable = pgTable("firewall_fqdn_rules", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull(),
  action: text("action").notNull(),
  direction: text("direction").notNull().default("both"),
  priority: integer("priority").notNull().default(100),
  enabled: boolean("enabled").notNull().default(true),
  hitCount: integer("hit_count").notNull().default(0),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── GhostOS™ ProxhqOS SymScript™ Rules ────────────────────────────────────
// Proprietary symbolic firewall command language — unknown to standard attack tools
export const firewallGhostOsRulesTable = pgTable("firewall_ghostos_rules", {
  id: serial("id").primaryKey(),
  symbolicRule: text("symbolic_rule").notNull(),
  description: text("description"),
  compiledIptables: text("compiled_iptables"),
  compiledNftables: text("compiled_nftables"),
  ruleType: text("rule_type").notNull().default("symscript"),
  enabled: boolean("enabled").notNull().default(true),
  hitCount: integer("hit_count").notNull().default(0),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── GhostOS™ Transcriber Log ───────────────────────────────────────────────
export const firewallTranscriberLogTable = pgTable("firewall_transcriber_log", {
  id: serial("id").primaryKey(),
  inputText: text("input_text").notNull(),
  inputFormat: text("input_format").notNull().default("english"),
  outputSymscript: text("output_symscript").notNull(),
  compiledIptables: text("compiled_iptables"),
  applied: boolean("applied").notNull().default(false),
  appliedAt: timestamp("applied_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Connection Approval Queue ──────────────────────────────────────────────────
// Inbound connections that require user approval before being allowed, blocked, or trapped.
// Populated by the WAF, GhostTrap, or any detection system. The frontend polls this
// table and shows a popup asking the user: Allow | Block | Trap.
export const firewallConnectionQueueTable = pgTable("firewall_connection_queue", {
  id:            serial("id").primaryKey(),
  ip:            text("ip").notNull(),
  sourcePort:    integer("source_port"),
  destPort:      integer("dest_port"),
  protocol:      text("protocol").notNull().default("tcp"),
  detectedFrom:  text("detected_from").notNull().default("waf"),  // waf | ghosttrap | beacon | ips | manual
  attackType:    text("attack_type"),
  anomalyScore:  integer("anomaly_score").notNull().default(0),
  payload:       text("payload"),
  userAgent:     text("user_agent"),
  geoCountry:    text("geo_country"),
  geoIsp:        text("geo_isp"),
  reason:        text("reason"),
  status:        text("status").notNull().default("pending"),  // pending | approved | blocked | trapped | dismissed
  resolvedBy:    text("resolved_by"),
  resolvedAt:    timestamp("resolved_at"),
  expiresAt:     timestamp("expires_at"),  // auto-dismiss after this time if not resolved
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});

export type InsertFirewallRule    = typeof firewallRulesTable.$inferInsert;
export type FirewallRule          = typeof firewallRulesTable.$inferSelect;
export type FirewallStatus        = typeof firewallStatusTable.$inferSelect;
export type BlockedIp             = typeof blockedIpsTable.$inferSelect;
export type IpsSignature          = typeof firewallIpsSignaturesTable.$inferSelect;
export type DpiRule               = typeof firewallDpiRulesTable.$inferSelect;
export type GeoBlock              = typeof firewallGeoBlocksTable.$inferSelect;
export type ThreatFeed            = typeof firewallThreatFeedsTable.$inferSelect;
export type FirewallZone          = typeof firewallZonesTable.$inferSelect;
export type FqdnRule              = typeof firewallFqdnRulesTable.$inferSelect;
export type GhostOsRule           = typeof firewallGhostOsRulesTable.$inferSelect;
export type TranscriberLog        = typeof firewallTranscriberLogTable.$inferSelect;
export type ConnectionQueueEntry  = typeof firewallConnectionQueueTable.$inferSelect;
