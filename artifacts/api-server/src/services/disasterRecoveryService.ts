// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";

export async function startDisasterRecoveryRun(input: {
  runType: "backup_restore_test" | "region_failover" | "database_recovery";
  startedBy?: string | null;
  details?: Record<string, unknown>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO disaster_recovery_runs
      (id, run_type, started_by, details)
    VALUES
      (${id}, ${input.runType}, ${input.startedBy ?? null}, ${JSON.stringify(input.details ?? {})}::jsonb)
  `);

  await publishPlatformEvent({
    type: "dr.run.started",
    actor: input.startedBy ?? undefined,
    subject: id,
    severity: "warn",
    payload: { runType: input.runType },
  });

  return { id };
}

export async function completeDisasterRecoveryRun(input: {
  runId: string;
  status: "completed" | "failed";
  details?: Record<string, unknown>;
}) {
  await db.execute(sql`
    UPDATE disaster_recovery_runs
    SET status = ${input.status},
        details = details || ${JSON.stringify(input.details ?? {})}::jsonb,
        completed_at = NOW()
    WHERE id = ${input.runId}
  `);

  return { ok: true };
}
