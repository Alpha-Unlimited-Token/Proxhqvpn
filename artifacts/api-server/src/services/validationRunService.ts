// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { createValidationHash } from "./validationHashChainService";
import { sanitizeOutput } from "./validationSanitizerService";

export interface ValidationRun {
  id: string;
  target_id: string | null;
  run_type: string;
  status: string;
  tool_name: string;
  tool_version: string | null;
  commit_sha: string | null;
  environment: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  score: number;
  max_score: number;
  severity: string;
  summary: string | null;
  raw_output: Record<string, unknown>;
  sanitized_output: Record<string, unknown>;
  finding_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  previous_hash: string | null;
  result_hash: string;
  metadata: Record<string, unknown>;
}

export interface CreateValidationRunInput {
  targetId?: string | null;
  runType: string;
  toolName: string;
  toolVersion?: string;
  commitSha?: string;
  environment?: string;
}

export interface CompleteValidationRunInput {
  runId: string;
  status: "passed" | "failed" | "warning" | "error";
  score?: number;
  maxScore?: number;
  severity?: string;
  summary?: string;
  rawOutput?: Record<string, unknown>;
  findings?: Array<{ severity: string; title: string; [k: string]: unknown }>;
  metadata?: Record<string, unknown>;
}

export async function createValidationRun(input: CreateValidationRunInput): Promise<ValidationRun> {
  const id = randomUUID();
  const startedAt = new Date().toISOString();
  const { hash, previousHash } = await createValidationHash({
    runId: id,
    targetId: input.targetId ?? null,
    runType: input.runType,
    toolName: input.toolName,
    status: "queued",
    score: 0,
    startedAt,
    summary: null,
  });

  await db.execute(sql`
    INSERT INTO validation_runs
      (id, target_id, run_type, status, tool_name, tool_version,
       commit_sha, environment, started_at, result_hash, previous_hash)
    VALUES
      (${id}, ${input.targetId ? sql`${input.targetId}::uuid` : sql`NULL`},
       ${input.runType}, 'queued', ${input.toolName},
       ${input.toolVersion ?? null}, ${input.commitSha ?? null},
       ${input.environment ?? process.env.NODE_ENV ?? "development"},
       NOW(), ${hash}, ${previousHash})
  `);

  return getValidationRun(id) as Promise<ValidationRun>;
}

export async function completeValidationRun(input: CompleteValidationRunInput): Promise<ValidationRun> {
  const completedAt = new Date().toISOString();
  const findings = input.findings ?? [];
  const critical = findings.filter(f => f.severity === "critical").length;
  const high     = findings.filter(f => f.severity === "high").length;
  const medium   = findings.filter(f => f.severity === "medium").length;
  const low      = findings.filter(f => f.severity === "low").length;

  const sanitized = sanitizeOutput(input.rawOutput ?? {});

  const existing = await getValidationRun(input.runId);
  const { hash, previousHash } = await createValidationHash({
    runId: input.runId,
    targetId: existing?.target_id ?? null,
    runType: existing?.run_type ?? "custom",
    toolName: existing?.tool_name ?? "unknown",
    status: input.status,
    score: input.score ?? 0,
    startedAt: existing?.started_at ?? completedAt,
    summary: input.summary ?? null,
  });

  await db.execute(sql`
    UPDATE validation_runs SET
      status           = ${input.status},
      completed_at     = ${completedAt},
      duration_ms      = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
      score            = ${input.score ?? 0},
      max_score        = ${input.maxScore ?? 100},
      severity         = ${input.severity ?? "info"},
      summary          = ${input.summary ?? null},
      raw_output       = ${JSON.stringify(input.rawOutput ?? {})}::jsonb,
      sanitized_output = ${JSON.stringify(sanitized)}::jsonb,
      finding_count    = ${findings.length},
      critical_count   = ${critical},
      high_count       = ${high},
      medium_count     = ${medium},
      low_count        = ${low},
      result_hash      = ${hash},
      previous_hash    = ${previousHash},
      metadata         = ${JSON.stringify(input.metadata ?? {})}::jsonb
    WHERE id = ${input.runId}::uuid
  `);

  return getValidationRun(input.runId) as Promise<ValidationRun>;
}

export async function failValidationRun(runId: string, errorMsg: string): Promise<void> {
  await db.execute(sql`
    UPDATE validation_runs SET
      status       = 'error',
      completed_at = NOW(),
      duration_ms  = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
      summary      = ${errorMsg}
    WHERE id = ${runId}::uuid
  `);
}

export async function listValidationRuns(filters?: {
  runType?: string;
  status?: string;
  limit?: number;
}): Promise<ValidationRun[]> {
  const limit = Math.min(filters?.limit ?? 50, 200);
  const result = await db.execute(sql`
    SELECT * FROM validation_runs
    WHERE
      (${filters?.runType ?? null} IS NULL OR run_type = ${filters?.runType ?? null})
      AND (${filters?.status ?? null} IS NULL OR status = ${filters?.status ?? null})
    ORDER BY started_at DESC
    LIMIT ${limit}
  `);
  return (result as unknown as { rows: ValidationRun[] }).rows;
}

export async function getValidationRun(id: string): Promise<ValidationRun | null> {
  const result = await db.execute(sql`
    SELECT * FROM validation_runs WHERE id = ${id}::uuid LIMIT 1
  `);
  return (result as unknown as { rows: ValidationRun[] }).rows[0] ?? null;
}

export async function summarizeValidationRuns(): Promise<{
  total: number;
  passed: number;
  failed: number;
  warning: number;
  error: number;
  avgScore: number;
}> {
  const result = await db.execute(sql`
    SELECT
      COUNT(*)                                          AS total,
      SUM(CASE WHEN status='passed'  THEN 1 ELSE 0 END) AS passed,
      SUM(CASE WHEN status='failed'  THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN status='warning' THEN 1 ELSE 0 END) AS warning,
      SUM(CASE WHEN status='error'   THEN 1 ELSE 0 END) AS error,
      COALESCE(AVG(score), 0)                           AS avg_score
    FROM validation_runs
    WHERE started_at > NOW() - INTERVAL '7 days'
  `);
  const row = (result as { rows: Record<string, unknown>[] }).rows[0] ?? {};
  return {
    total:    Number(row.total   ?? 0),
    passed:   Number(row.passed  ?? 0),
    failed:   Number(row.failed  ?? 0),
    warning:  Number(row.warning ?? 0),
    error:    Number(row.error   ?? 0),
    avgScore: Math.round(Number(row.avg_score ?? 0)),
  };
}
