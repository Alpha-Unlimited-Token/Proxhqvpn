// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Per-user persistent firewall rules — survive restart, logoff, and reconnection.
// Rules are stored in Postgres and reloaded into nftables on every server boot.
import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const userFwProtocolEnum  = pgEnum("fw_protocol",  ["tcp", "udp", "both"]);
export const userFwDirectionEnum = pgEnum("fw_direction", ["inbound", "outbound", "both"]);
export const userFwActionEnum    = pgEnum("fw_action",    ["allow", "block"]);

export const userFirewallRulesTable = pgTable("user_firewall_rules", {
  id:           serial("id").primaryKey(),

  // ── Identity ──────────────────────────────────────────────────────────────
  userId:       text("user_id").notNull(),
  /** Human-readable label set by the user — e.g. "Minecraft server", "Block BitTorrent" */
  label:        text("label").notNull().default(""),

  // ── Rule definition ───────────────────────────────────────────────────────
  protocol:     userFwProtocolEnum("protocol").notNull().default("tcp"),
  direction:    userFwDirectionEnum("direction").notNull().default("inbound"),
  action:       userFwActionEnum("action").notNull().default("allow"),

  /** Port on the public-facing server (the port the outside world hits) */
  externalPort: integer("external_port").notNull(),

  /** Port on the user's device inside the WireGuard tunnel (defaults to externalPort) */
  internalPort: integer("internal_port"),

  /** Restrict this rule to a specific source IP or CIDR. Null = any source */
  sourceIp:     text("source_ip"),

  /** The user's WireGuard tunnel IP (e.g. 10.8.0.7). Resolved from devices table at sync time. */
  tunnelIp:     text("tunnel_ip"),

  /** Optional notes — user can document why this rule exists */
  notes:        text("notes"),

  // ── State ─────────────────────────────────────────────────────────────────
  /** Master on/off toggle — rule stays in DB but nftables won't apply it when false */
  enabled:      boolean("enabled").notNull().default(true),

  /** Whether this rule has been synced to nftables on the server */
  synced:       boolean("synced").notNull().default(false),

  // ── Activity tracking ────────────────────────────────────────────────────
  /** Total times this rule has been matched (incremented by the log parser) */
  hitCount:     integer("hit_count").notNull().default(0),
  lastHitAt:    timestamp("last_hit_at"),

  // ── Timestamps ────────────────────────────────────────────────────────────
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});

export type InsertUserFirewallRule = typeof userFirewallRulesTable.$inferInsert;
export type UserFirewallRule       = typeof userFirewallRulesTable.$inferSelect;
