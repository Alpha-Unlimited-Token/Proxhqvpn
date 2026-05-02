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

export type InsertFirewallRule = typeof firewallRulesTable.$inferInsert;
export type FirewallRule = typeof firewallRulesTable.$inferSelect;
export type FirewallStatus = typeof firewallStatusTable.$inferSelect;
export type BlockedIp = typeof blockedIpsTable.$inferSelect;
