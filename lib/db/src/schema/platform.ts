// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import {
  pgTable, text, timestamp, jsonb, unique,
  integer, boolean, bigint, serial,
} from "drizzle-orm/pg-core";

// ── Platform events (published by event-bus.ts) ───────────────────────────────
export const platformEventsTable = pgTable("platform_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  actor: text("actor"),
  subject: text("subject"),
  severity: text("severity").notNull().default("info"),
  payload: jsonb("payload").notNull().default({}),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Control plane instances (heartbeat from controlPlaneClusterService.ts) ────
export const controlPlaneInstancesTable = pgTable(
  "control_plane_instances",
  {
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    region: text("region"),
    hostname: text("hostname").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").notNull().default({}),
    lastHeartbeatAt: timestamp("last_heartbeat_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("control_plane_instances_instance_id_key").on(t.instanceId)],
);

// ── Scheduled tasks (scheduler.ts / scheduler-worker.ts) ─────────────────────
export const scheduledTasksTable = pgTable("scheduled_tasks", {
  id: text("id").primaryKey(),
  taskType: text("task_type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  status: text("status").notNull().default("scheduled"),
  runAt: timestamp("run_at").notNull(),
  maxAttempts: integer("max_attempts").notNull().default(3),
  attempts: integer("attempts").notNull().default(0),
  lockedBy: text("locked_by"),
  lockedAt: timestamp("locked_at"),
  completedAt: timestamp("completed_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Data retention policies (dataRetentionService.ts) ─────────────────────────
export const dataRetentionPoliciesTable = pgTable(
  "data_retention_policies",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id"),
    tableName: text("table_name").notNull(),
    retentionDays: integer("retention_days").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("data_retention_policies_tenant_table_key").on(t.tenantId, t.tableName)],
);

export const dataRetentionRunsTable = pgTable("data_retention_runs", {
  id: text("id").primaryKey(),
  policyId: text("policy_id").notNull(),
  deletedCount: integer("deleted_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Terminal jobs (terminalJobsRepository.ts) ─────────────────────────────────
export const terminalJobsTable = pgTable("terminal_jobs", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  command: text("command").notNull(),
  ghostMode: boolean("ghost_mode").notNull().default(false),
  timeoutMs: integer("timeout_ms").notNull().default(30000),
  status: text("status").notNull().default("queued"),
  stdout: text("stdout"),
  stderr: text("stderr"),
  exitCode: integer("exit_code"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

// ── VPN connection events (connectionAnalyticsRepository.ts) ──────────────────
export const vpnConnectionEventsTable = pgTable("vpn_connection_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  deviceId: text("device_id"),
  nodeId: text("node_id"),
  eventType: text("event_type").notNull(),
  region: text("region"),
  latencyMs: integer("latency_ms"),
  bytesIn: bigint("bytes_in", { mode: "number" }),
  bytesOut: bigint("bytes_out", { mode: "number" }),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Security events (securityEventNormalizationService.ts) ────────────────────
export const securityEventsTable = pgTable("security_events", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull().default("info"),
  actor: text("actor"),
  subject: text("subject"),
  normalized: jsonb("normalized").notNull().default({}),
  raw: jsonb("raw").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Account security events (account-security-center.ts) ─────────────────────
export const accountSecurityEventsTable = pgTable("account_security_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull().default("info"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Multi-tenant tables (tenantService.ts) ────────────────────────────────────
export const tenantsTable = pgTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tenantMembershipsTable = pgTable("tenant_memberships", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── RBAC (rbacService.ts) ─────────────────────────────────────────────────────
export const rbacRolesTable = pgTable("rbac_roles", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id"),
  name: text("name").notNull(),
  description: text("description"),
  permissions: jsonb("permissions").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rbacAssignmentsTable = pgTable("rbac_assignments", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id"),
  userId: text("user_id").notNull(),
  roleId: text("role_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Feature flags (featureFlagService.ts) ─────────────────────────────────────
export const featureFlagsTable = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  rolloutPercent: integer("rollout_percent").notNull().default(0),
  rules: jsonb("rules").notNull().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Node enrollment claims (nodeEnrollmentService.ts) ─────────────────────────
export const nodeEnrollmentClaimsTable = pgTable("node_enrollment_claims", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  nodeId: text("node_id").notNull(),
  publicKey: text("public_key").notNull(),
  publicIp: text("public_ip"),
  region: text("region"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
