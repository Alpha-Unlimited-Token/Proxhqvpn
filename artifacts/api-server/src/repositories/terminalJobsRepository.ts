// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { TerminalJobStatus } from "../lib/terminal-jobs";

export type PersistedTerminalJob = {
  id: string;
  ownerUserId: string;
  command: string;
  ghostMode: boolean;
  timeout: number;
  status: TerminalJobStatus;
  stdout: string;
  stderr: string;
  exitCode?: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};

function normalize(row: any): PersistedTerminalJob {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    command: row.command,
    ghostMode: !!row.ghost_mode,
    timeout: row.timeout_ms,
    status: row.status,
    stdout: row.stdout ?? "",
    stderr: row.stderr ?? "",
    exitCode: row.exit_code ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at?.toISOString?.() ?? String(row.created_at),
    startedAt: row.started_at?.toISOString?.() ?? row.started_at ?? undefined,
    completedAt:
      row.completed_at?.toISOString?.() ?? row.completed_at ?? undefined,
  };
}

export async function insertTerminalJob(input: {
  id: string;
  ownerUserId: string;
  command: string;
  ghostMode: boolean;
  timeout: number;
}) {
  await db.execute(sql`
    INSERT INTO terminal_jobs
      (id, owner_user_id, command, ghost_mode, timeout_ms, status)
    VALUES
      (${input.id}, ${input.ownerUserId}, ${input.command}, ${input.ghostMode}, ${input.timeout}, 'queued')
  `);
}

export async function markTerminalJobRunning(jobId: string) {
  await db.execute(sql`
    UPDATE terminal_jobs
    SET status = 'running', started_at = NOW()
    WHERE id = ${jobId}
  `);
}

export async function completeTerminalJob(input: {
  jobId: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}) {
  await db.execute(sql`
    UPDATE terminal_jobs
    SET
      status = ${input.exitCode === 0 ? "completed" : "failed"},
      stdout = ${input.stdout},
      stderr = ${input.stderr},
      exit_code = ${input.exitCode},
      completed_at = NOW()
    WHERE id = ${input.jobId}
  `);
}

export async function failTerminalJob(input: { jobId: string; error: string }) {
  await db.execute(sql`
    UPDATE terminal_jobs
    SET status = 'failed', error = ${input.error}, completed_at = NOW()
    WHERE id = ${input.jobId}
  `);
}

export async function getTerminalJobByOwner(
  ownerUserId: string,
  jobId: string,
): Promise<PersistedTerminalJob | null> {
  const result: any = await db.execute(sql`
    SELECT * FROM terminal_jobs
    WHERE id = ${jobId} AND owner_user_id = ${ownerUserId}
    LIMIT 1
  `);

  const row = result.rows?.[0];
  return row ? normalize(row) : null;
}

export async function listTerminalJobsByOwner(
  ownerUserId: string,
): Promise<PersistedTerminalJob[]> {
  const result: any = await db.execute(sql`
    SELECT * FROM terminal_jobs
    WHERE owner_user_id = ${ownerUserId}
    ORDER BY created_at DESC
    LIMIT 100
  `);

  return (result.rows ?? []).map(normalize);
}
