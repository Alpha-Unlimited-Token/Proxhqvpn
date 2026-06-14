// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import {
  pgTable, text, timestamp, jsonb,
  integer, boolean,
} from "drizzle-orm/pg-core";

// ── Validation targets (validationTargetService.ts) ───────────────────────────
export const validationTargetsTable = pgTable("validation_targets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  targetType: text("target_type").notNull(),
  url: text("url"),
  host: text("host"),
  port: integer("port"),
  region: text("region"),
  environment: text("environment").notNull().default("production"),
  ownedBy: text("owned_by").notNull().default("alpha-unlimited-technologies"),
  allowSecurityScans: boolean("allow_security_scans").notNull().default(false),
  allowLoadTests: boolean("allow_load_tests").notNull().default(false),
  enabled: boolean("enabled").notNull().default(true),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Validation runs (validationRunService.ts) ─────────────────────────────────
export const validationRunsTable = pgTable("validation_runs", {
  id: text("id").primaryKey(),
  targetId: text("target_id"),
  runType: text("run_type").notNull(),
  status: text("status").notNull().default("queued"),
  toolName: text("tool_name").notNull(),
  toolVersion: text("tool_version"),
  commitSha: text("commit_sha"),
  environment: text("environment").notNull().default("development"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  score: integer("score"),
  maxScore: integer("max_score"),
  severity: text("severity"),
  summary: text("summary"),
  rawOutput: text("raw_output"),
  sanitizedOutput: text("sanitized_output"),
  findingCount: integer("finding_count").notNull().default(0),
  criticalCount: integer("critical_count").notNull().default(0),
  highCount: integer("high_count").notNull().default(0),
  mediumCount: integer("medium_count").notNull().default(0),
  lowCount: integer("low_count").notNull().default(0),
  previousHash: text("previous_hash"),
  resultHash: text("result_hash"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Validation findings (validationFindingService.ts) ─────────────────────────
export const validationFindingsTable = pgTable("validation_findings", {
  id: text("id").primaryKey(),
  runId: text("run_id"),
  targetId: text("target_id"),
  title: text("title").notNull(),
  severity: text("severity").notNull(),
  category: text("category"),
  description: text("description"),
  evidence: jsonb("evidence").notNull().default({}),
  remediation: text("remediation"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// ── Validation schedules (validation.ts route) ────────────────────────────────
export const validationSchedulesTable = pgTable("validation_schedules", {
  id: text("id").primaryKey(),
  targetId: text("target_id"),
  runType: text("run_type").notNull(),
  intervalMinutes: integer("interval_minutes"),
  cronExpression: text("cron_expression"),
  enabled: boolean("enabled").notNull().default(true),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
