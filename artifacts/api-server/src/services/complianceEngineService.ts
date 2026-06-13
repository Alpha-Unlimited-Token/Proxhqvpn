// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function upsertComplianceControl(input: {
  framework: string;
  controlId: string;
  title: string;
  description?: string | null;
  status?: "not_started" | "in_progress" | "implemented" | "verified" | "gap";
  evidence?: Array<Record<string, unknown>>;
  owner?: string | null;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO compliance_controls
      (id, framework, control_id, title, description, status, evidence, owner)
    VALUES
      (${id}, ${input.framework}, ${input.controlId}, ${input.title}, ${input.description ?? null}, ${input.status ?? "not_started"}, ${JSON.stringify(input.evidence ?? [])}::jsonb, ${input.owner ?? null})
    ON CONFLICT (framework, control_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      evidence = EXCLUDED.evidence,
      owner = EXCLUDED.owner,
      updated_at = NOW()
  `);

  return { id };
}

export async function assessComplianceFramework(framework: string) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM compliance_controls
    WHERE framework = ${framework}
  `);

  const controls = result.rows ?? [];
  const maxScore = controls.length;
  const score = controls.filter((control: any) =>
    ["implemented", "verified"].includes(control.status),
  ).length;

  const status =
    maxScore === 0
      ? "no_controls"
      : score / maxScore >= 0.9
        ? "ready"
        : score / maxScore >= 0.7
          ? "needs_review"
          : "gap";

  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO compliance_assessments
      (id, framework, score, max_score, status, details)
    VALUES
      (${id}, ${framework}, ${score}, ${maxScore}, ${status}, ${JSON.stringify({ controls })}::jsonb)
  `);

  return { id, framework, score, maxScore, status };
}
