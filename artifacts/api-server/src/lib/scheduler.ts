// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import os from "os";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const WORKER_ID = `${os.hostname()}-${process.pid}`;

export async function scheduleTask(input: {
  taskType: string;
  payload?: Record<string, unknown>;
  runAt: Date;
  maxAttempts?: number;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO scheduled_tasks
      (id, task_type, payload, status, run_at, max_attempts)
    VALUES
      (${id}, ${input.taskType}, ${JSON.stringify(input.payload ?? {})}::jsonb, 'scheduled', ${input.runAt.toISOString()}, ${input.maxAttempts ?? 3})
  `);

  return { id };
}

export async function claimDueTasks(limit = 25) {
  const result: any = await db.execute(sql`
    UPDATE scheduled_tasks
    SET
      status = 'running',
      locked_by = ${WORKER_ID},
      locked_at = NOW(),
      attempts = attempts + 1
    WHERE id IN (
      SELECT id
      FROM scheduled_tasks
      WHERE status = 'scheduled'
        AND run_at <= NOW()
      ORDER BY run_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);

  return result.rows ?? [];
}

export async function completeTask(taskId: string) {
  await db.execute(sql`
    UPDATE scheduled_tasks
    SET status = 'completed', completed_at = NOW()
    WHERE id = ${taskId}
  `);
}

export async function failTask(task: any, error: string) {
  const shouldRetry =
    Number(task.attempts ?? 0) < Number(task.max_attempts ?? 3);

  await db.execute(sql`
    UPDATE scheduled_tasks
    SET
      status = ${shouldRetry ? "scheduled" : "failed"},
      run_at = ${new Date(Date.now() + 60_000).toISOString()},
      last_error = ${error},
      locked_by = NULL,
      locked_at = NULL
    WHERE id = ${task.id}
  `);
}
