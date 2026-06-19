// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import {
  pgTable, text, integer, boolean, timestamp, jsonb, uuid, index, real
} from "drizzle-orm/pg-core";

// ── tool_jobs ──────────────────────────────────────────────────────────────────
export const toolJobsTable = pgTable("tool_jobs", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userId:      text("user_id").notNull(),
  toolId:      text("tool_id").notNull(),
  toolName:    text("tool_name").notNull(),
  category:    text("category").notNull(),
  target:      text("target"),
  optsJson:    jsonb("opts_json").$type<Record<string, string>>(),
  status:      text("status").notNull().default("running"),
  exitCode:    integer("exit_code"),
  outputText:  text("output_text"),
  geoJson:     jsonb("geo_json").$type<Record<string, unknown>>(),
  approvalId:  uuid("approval_id"),
  startedAt:   timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("tool_jobs_user_idx").on(t.userId),
  index("tool_jobs_status_idx").on(t.status),
  index("tool_jobs_created_idx").on(t.createdAt),
]);

// ── tool_outputs — chunked streaming output ────────────────────────────────────
export const toolOutputsTable = pgTable("tool_outputs", {
  id:         integer("id").generatedAlwaysAsIdentity().primaryKey(),
  jobId:      uuid("job_id").notNull().references(() => toolJobsTable.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  text:       text("text").notNull(),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("tool_outputs_job_idx").on(t.jobId),
]);

// ── tool_target_scopes — user-declared approved scan targets ───────────────────
export const toolTargetScopesTable = pgTable("tool_target_scopes", {
  id:          integer("id").generatedAlwaysAsIdentity().primaryKey(),
  userId:      text("user_id").notNull(),
  scopeType:   text("scope_type").notNull(),
  scopeValue:  text("scope_value").notNull(),
  notes:       text("notes"),
  approvedBy:  text("approved_by"),
  expiresAt:   timestamp("expires_at"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("tool_scopes_user_idx").on(t.userId),
]);

// ── tool_approvals — pending high-risk scan approvals ─────────────────────────
export const toolApprovalsTable = pgTable("tool_approvals", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userId:      text("user_id").notNull(),
  toolId:      text("tool_id").notNull(),
  toolName:    text("tool_name").notNull(),
  target:      text("target").notNull(),
  optsJson:    jsonb("opts_json").$type<Record<string, string>>(),
  riskReason:  text("risk_reason").notNull(),
  status:      text("status").notNull().default("pending"),
  reviewedBy:  text("reviewed_by"),
  reviewedAt:  timestamp("reviewed_at"),
  notes:       text("notes"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("tool_approvals_user_idx").on(t.userId),
  index("tool_approvals_status_idx").on(t.status),
  index("tool_approvals_created_idx").on(t.createdAt),
]);

// ── node_agent_health — remote Parrot OS node agent check-ins ─────────────────
export const nodeAgentHealthTable = pgTable("node_agent_health", {
  nodeId:      text("node_id").primaryKey(),
  nodeName:    text("node_name").notNull(),
  version:     text("version").notNull(),
  ip:          text("ip").notNull(),
  os:          text("os"),
  arch:        text("arch"),
  toolsJson:   jsonb("tools_json").$type<string[]>(),
  cpuPct:      real("cpu_pct"),
  memPct:      real("mem_pct"),
  diskMb:      integer("disk_mb"),
  status:      text("status").notNull().default("active"),
  lastSeenAt:  timestamp("last_seen_at").notNull().defaultNow(),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("node_agent_health_last_seen_idx").on(t.lastSeenAt),
  index("node_agent_health_status_idx").on(t.status),
]);

// ── tool_schedules — recurring scheduled scan jobs ─────────────────────────
export const toolSchedulesTable = pgTable("tool_schedules", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userId:      text("user_id").notNull(),
  toolId:      text("tool_id").notNull(),
  toolName:    text("tool_name").notNull(),
  target:      text("target"),
  optsJson:    jsonb("opts_json").$type<Record<string, string>>(),
  cronExpr:    text("cron_expr").notNull(),
  enabled:     boolean("enabled").notNull().default(true),
  lastRunAt:   timestamp("last_run_at"),
  nextRunAt:   timestamp("next_run_at"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("tool_schedules_user_idx").on(t.userId),
  index("tool_schedules_enabled_idx").on(t.enabled),
]);

// ── node_agent_events — events reported by remote nodes ───────────────────────
export const nodeAgentEventsTable = pgTable("node_agent_events", {
  id:          integer("id").generatedAlwaysAsIdentity().primaryKey(),
  nodeId:      text("node_id").notNull(),
  eventType:   text("event_type").notNull(),
  payload:     jsonb("payload").$type<Record<string, unknown>>(),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("node_events_node_idx").on(t.nodeId),
  index("node_events_type_idx").on(t.eventType),
  index("node_events_created_idx").on(t.createdAt),
]);
