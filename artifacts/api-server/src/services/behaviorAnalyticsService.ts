// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function updateBehaviorProfile(input: {
  subjectId: string;
  subjectType: "user" | "device" | "node";
  signal: Record<string, unknown>;
}) {
  const riskScore = Number(input.signal.riskScore ?? 0);

  await db.execute(sql`
    INSERT INTO behavior_profiles
      (id, subject_id, subject_type, baseline, risk_score)
    VALUES
      (${randomUUID()}, ${input.subjectId}, ${input.subjectType}, ${JSON.stringify(input.signal)}::jsonb, ${riskScore})
    ON CONFLICT (subject_id, subject_type)
    DO UPDATE SET
      baseline = behavior_profiles.baseline || EXCLUDED.baseline,
      risk_score = GREATEST(behavior_profiles.risk_score, EXCLUDED.risk_score),
      updated_at = NOW()
  `);

  return { ok: true };
}

export async function getBehaviorProfile(subjectId: string, subjectType: string) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM behavior_profiles
    WHERE subject_id = ${subjectId}
      AND subject_type = ${subjectType}
    LIMIT 1
  `);

  return result.rows?.[0] ?? null;
}
