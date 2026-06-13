// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const ALLOWED_TABLES = new Set([
  "platform_events",
  "security_events",
  "vpn_connection_events",
  "terminal_jobs",
  "security_alerts",
]);

export async function createDataRetentionPolicy(input: {
  tenantId?: string | null;
  tableName: string;
  retentionDays: number;
}) {
  if (!ALLOWED_TABLES.has(input.tableName)) {
    throw new Error("Table is not allowed for retention automation");
  }

  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO data_retention_policies
      (id, tenant_id, table_name, retention_days)
    VALUES
      (${id}, ${input.tenantId ?? null}, ${input.tableName}, ${input.retentionDays})
    ON CONFLICT (tenant_id, table_name)
    DO UPDATE SET retention_days = EXCLUDED.retention_days, enabled = TRUE
  `);

  return { id };
}

export async function runDataRetentionPolicy(policyId: string) {
  const result: any = await db.execute(sql`
    SELECT * FROM data_retention_policies
    WHERE id = ${policyId} AND enabled = TRUE
    LIMIT 1
  `);

  const policy = result.rows?.[0];
  if (!policy) throw new Error("Retention policy not found");

  if (!ALLOWED_TABLES.has(policy.table_name)) {
    throw new Error("Unsafe retention table");
  }

  const deleted: any = await db.execute(sql.raw(`
    DELETE FROM ${policy.table_name}
    WHERE created_at < NOW() - INTERVAL '${Number(policy.retention_days)} days'
    RETURNING id
  `));

  const runId = randomUUID();

  await db.execute(sql`
    INSERT INTO data_retention_runs
      (id, policy_id, deleted_count)
    VALUES
      (${runId}, ${policyId}, ${deleted.rows?.length ?? 0})
  `);

  return { runId, deletedCount: deleted.rows?.length ?? 0 };
}
