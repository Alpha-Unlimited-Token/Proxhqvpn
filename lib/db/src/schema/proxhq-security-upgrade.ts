// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Deep audit security upgrade — new tables for enrollment, config lifecycle, policy versioning
import { pgTable, text, timestamp, jsonb, integer, boolean, uuid } from "drizzle-orm/pg-core";

export const nodeEnrollmentTokensV2 = pgTable("node_enrollment_tokens", {
  id:            uuid("id").defaultRandom().primaryKey(),
  tokenHash:     text("token_hash").notNull().unique(),
  createdBy:     text("created_by").notNull(),
  region:        text("region"),
  expiresAt:     timestamp("expires_at").notNull(),
  usedAt:        timestamp("used_at"),
  claimedNodeId: text("claimed_node_id"),
});

export const nodeDaemonCredentials = pgTable("node_daemon_credentials", {
  id:             uuid("id").defaultRandom().primaryKey(),
  nodeId:         text("node_id").notNull().unique(),
  region:         text("region"),
  publicIp:       text("public_ip"),
  publicKey:      text("public_key"),
  daemonSecretEnc: text("daemon_secret_enc").notNull(),
  enrolledAt:     timestamp("enrolled_at").notNull().defaultNow(),
});

export const vpnConfigLifecycleEvents = pgTable("vpn_config_lifecycle_events", {
  id:        uuid("id").defaultRandom().primaryKey(),
  configId:  text("config_id").notNull(),
  userId:    text("user_id").notNull(),
  deviceId:  text("device_id").notNull(),
  state:     text("state").notNull(),
  metadata:  jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const firewallPolicyVersions = pgTable("firewall_policy_versions", {
  id:         uuid("id").defaultRandom().primaryKey(),
  version:    integer("version").notNull(),
  policy:     jsonb("policy").notNull(),
  compiled:   jsonb("compiled").notNull(),
  simulation: jsonb("simulation"),
  deployedBy: text("deployed_by").notNull(),
  deployedAt: timestamp("deployed_at").notNull().defaultNow(),
  active:     boolean("active").notNull().default(false),
});

export const policyGraphEdges = pgTable("policy_graph_edges", {
  id:         uuid("id").defaultRandom().primaryKey(),
  tenantId:   text("tenant_id"),
  sourceType: text("source_type").notNull(),
  sourceId:   text("source_id").notNull(),
  relation:   text("relation").notNull(),
  targetType: text("target_type").notNull(),
  targetId:   text("target_id").notNull(),
  metadata:   jsonb("metadata"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});
