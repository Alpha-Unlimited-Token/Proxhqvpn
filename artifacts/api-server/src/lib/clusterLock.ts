// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

interface ClusterLockOptions {
  key: string;
  ttlMs: number;
}

/**
 * Acquires a cluster-wide advisory lock using PostgreSQL pg_try_advisory_lock.
 * Returns true if the lock was acquired (this instance should proceed), false
 * if another cluster member already holds it (skip this run).
 */
export async function acquireClusterLock({ key }: ClusterLockOptions): Promise<boolean> {
  try {
    // Derive a stable int8 from the string key via hashtext (PostgreSQL built-in)
    const result = await db.execute(
      sql`SELECT pg_try_advisory_lock(hashtext(${key})::bigint) AS acquired`
    );
    const rows: any[] = Array.isArray(result) ? result : ((result as any).rows ?? []);
    return rows[0]?.acquired === true;
  } catch (err) {
    logger.warn({ err, key }, "acquireClusterLock: failed, proceeding without lock");
    return true;
  }
}

/**
 * Releases the advisory lock so it can be acquired again on the next cycle.
 */
export async function releaseClusterLock({ key }: ClusterLockOptions): Promise<void> {
  try {
    await db.execute(
      sql`SELECT pg_advisory_unlock(hashtext(${key})::bigint)`
    );
  } catch (err) {
    logger.warn({ err, key }, "releaseClusterLock: failed");
  }
}
