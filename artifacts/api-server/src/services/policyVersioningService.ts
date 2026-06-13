// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function savePolicyVersion(input: {
  policyType: string;
  policyId: string;
  snapshot: Record<string, unknown>;
  createdBy?: string | null;
}) {
  const result: any = await db.execute(sql`
    SELECT COALESCE(MAX(version), 0) + 1 AS next_version
    FROM policy_versions
    WHERE policy_type = ${input.policyType}
      AND policy_id = ${input.policyId}
  `);

  const version = Number(result.rows?.[0]?.next_version ?? 1);
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO policy_versions
      (id, policy_type, policy_id, version, snapshot, created_by)
    VALUES
      (${id}, ${input.policyType}, ${input.policyId}, ${version}, ${JSON.stringify(input.snapshot)}::jsonb, ${input.createdBy ?? null})
  `);

  return { id, version };
}

export async function listPolicyVersions(policyType: string, policyId: string) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM policy_versions
    WHERE policy_type = ${policyType}
      AND policy_id = ${policyId}
    ORDER BY version DESC
  `);

  return result.rows ?? [];
}
