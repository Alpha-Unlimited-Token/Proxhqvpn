// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function markOnboardingStep(input: {
  userId: string;
  step: string;
  completed?: boolean;
  metadata?: Record<string, unknown>;
}) {
  await db.execute(sql`
    INSERT INTO onboarding_progress
      (id, user_id, step, completed, completed_at, metadata)
    VALUES
      (${randomUUID()}, ${input.userId}, ${input.step}, ${input.completed ?? true}, NOW(), ${JSON.stringify(input.metadata ?? {})}::jsonb)
    ON CONFLICT (user_id, step)
    DO UPDATE SET
      completed = EXCLUDED.completed,
      completed_at = CASE WHEN EXCLUDED.completed THEN NOW() ELSE NULL END,
      metadata = onboarding_progress.metadata || EXCLUDED.metadata
  `);

  return { ok: true };
}

export async function getOnboardingProgress(userId: string) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM onboarding_progress
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
  `);

  return result.rows ?? [];
}
