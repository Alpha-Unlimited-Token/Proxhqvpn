// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// WireGuard Deception Layer — per-server configuration for decoy port / ghost daemon.
import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const wgDeceptionConfigTable = pgTable("wg_deception_config", {
  id:               serial("id").primaryKey(),
  userId:           text("user_id").notNull(),
  /** Real (hidden) WireGuard listen port. Keep this secret. Default: 51280 */
  realWgPort:       integer("real_wg_port").notNull().default(51280),
  /** Decoy port left open for scanners. This is what attackers see. Default: 51820 */
  decoyPort:        integer("decoy_port").notNull().default(51820),
  /** Internal port the ghost daemon binds to (nftables redirects decoyPort → this). Default: 51821 */
  ghostDaemonPort:  integer("ghost_daemon_port").notNull().default(51821),
  /** WireGuard interface name (e.g. wg0) */
  wgInterface:      text("wg_interface").notNull().default("wg0"),
  /** Firewall backend: nftables or iptables */
  firewallBackend:  text("firewall_backend").notNull().default("nftables"),
  /** Whether to isolate the ghost daemon in a network namespace */
  useNetns:         boolean("use_netns").notNull().default(true),
  /** Ghost daemon loop iterations before disconnect (wastes attacker's time) */
  loopCount:        integer("loop_count").notNull().default(8),
  /** Ghost daemon tarpit delay per loop (ms) */
  tarpitMs:         integer("tarpit_ms").notNull().default(3000),
  /** ProxhqVPN API base URL for daemon callbacks */
  apiCallbackUrl:   text("api_callback_url"),
  /** Callback PSK / HONEYPOT_PSK value for ghost daemon API calls */
  callbackPskHint:  text("callback_psk_hint"),
  /** Ghost node ID to attribute events to */
  ghostNodeId:      integer("ghost_node_id"),
  /** Extra CIDRs to add to the authorized_peers nftables set */
  authorizedPeerCidrs: jsonb("authorized_peer_cidrs"),
  enabled:          boolean("enabled").notNull().default(false),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
  updatedAt:        timestamp("updated_at").defaultNow().notNull(),
});

export type WgDeceptionConfig    = typeof wgDeceptionConfigTable.$inferSelect;
export type InsertWgDeceptionConfig = typeof wgDeceptionConfigTable.$inferInsert;
