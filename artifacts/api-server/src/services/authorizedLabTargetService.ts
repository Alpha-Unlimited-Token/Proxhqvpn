// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Asserts that `target` is listed as an enabled internal-lab target.
 * Throws a 403-intended error if not found.
 */
export async function assertAuthorizedLabTarget(target: string): Promise<void> {
  const result: any = await db.execute(sql`
    SELECT id FROM authorized_lab_targets
    WHERE target = ${target}
      AND enabled = TRUE
      AND target_scope = 'internal_lab'
    LIMIT 1
  `);
  if (!result.rows?.[0]) {
    throw Object.assign(
      new Error(`Target "${target}" is not an authorized internal lab target`),
      { statusCode: 403 },
    );
  }
}

export async function listAuthorizedLabTargets(): Promise<{ id: string; target: string; targetScope: string }[]> {
  const result: any = await db.execute(sql`
    SELECT id, target, target_scope FROM authorized_lab_targets
    WHERE enabled = TRUE ORDER BY target
  `);
  return (result.rows ?? []).map((r: any) => ({
    id: r.id,
    target: r.target,
    targetScope: r.target_scope,
  }));
}
