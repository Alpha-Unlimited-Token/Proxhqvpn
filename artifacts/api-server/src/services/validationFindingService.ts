// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export interface ValidationFinding {
  id: string;
  run_id: string | null;
  target_id: string | null;
  title: string;
  severity: string;
  category: string | null;
  description: string | null;
  evidence: Record<string, unknown>;
  remediation: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

export interface CreateFindingInput {
  runId?: string;
  targetId?: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category?: string;
  description?: string;
  evidence?: Record<string, unknown>;
  remediation?: string;
}

export async function createValidationFinding(input: CreateFindingInput): Promise<ValidationFinding> {
  const id = randomUUID();
  await db.execute(sql`
    INSERT INTO validation_findings
      (id, run_id, target_id, title, severity, category, description, evidence, remediation)
    VALUES
      (${id},
       ${input.runId ? sql`${input.runId}::uuid` : sql`NULL`},
       ${input.targetId ? sql`${input.targetId}::uuid` : sql`NULL`},
       ${input.title}, ${input.severity}, ${input.category ?? null},
       ${input.description ?? null},
       ${JSON.stringify(input.evidence ?? {})}::jsonb,
       ${input.remediation ?? null})
  `);
  const result = await db.execute(sql`SELECT * FROM validation_findings WHERE id = ${id}::uuid`);
  return (result as { rows: ValidationFinding[] }).rows[0];
}

export async function bulkCreateValidationFindings(inputs: CreateFindingInput[]): Promise<void> {
  for (const input of inputs) {
    await createValidationFinding(input);
  }
}

export async function listOpenValidationFindings(filters?: {
  severity?: string;
  limit?: number;
}): Promise<ValidationFinding[]> {
  const limit = Math.min(filters?.limit ?? 100, 500);
  const result = await db.execute(sql`
    SELECT * FROM validation_findings
    WHERE status = 'open'
      AND (${filters?.severity ?? null} IS NULL OR severity = ${filters?.severity ?? null})
    ORDER BY
      CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high'     THEN 2
        WHEN 'medium'   THEN 3
        WHEN 'low'      THEN 4
        ELSE 5
      END,
      created_at DESC
    LIMIT ${limit}
  `);
  return (result as { rows: ValidationFinding[] }).rows;
}

export async function resolveValidationFinding(id: string): Promise<void> {
  await db.execute(sql`
    UPDATE validation_findings
    SET status = 'resolved', resolved_at = NOW()
    WHERE id = ${id}::uuid
  `);
}
