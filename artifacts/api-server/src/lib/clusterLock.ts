// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import os from "os";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const OWNER_ID =
  process.env.PROXHQ_INSTANCE_ID ??
  `${os.hostname()}-${process.pid}`;

export async function acquireClusterLock(input: {
  key: string;
  ttlMs: number;
  metadata?: Record<string, unknown>;
}) {
  const expiresAt = new Date(Date.now() + input.ttlMs);

  const result: any = await db.execute(sql`
    INSERT INTO cluster_locks
      (lock_key, owner_id, expires_at, metadata)
    VALUES
      (${input.key}, ${OWNER_ID}, ${expiresAt.toISOString()}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
    ON CONFLICT (lock_key)
    DO UPDATE SET
      owner_id = EXCLUDED.owner_id,
      expires_at = EXCLUDED.expires_at,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    WHERE cluster_locks.expires_at < NOW()
       OR cluster_locks.owner_id = ${OWNER_ID}
    RETURNING *
  `);

  return !!result.rows?.[0];
}

export async function releaseClusterLock(key: string) {
  await db.execute(sql`
    DELETE FROM cluster_locks
    WHERE lock_key = ${key}
      AND owner_id = ${OWNER_ID}
  `);
}
