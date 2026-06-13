// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function createRuntimePolicy(input: {
  name: string;
  policyType: string;
  rules: Record<string, unknown>;
  effect: "allow" | "deny" | "warn";
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO runtime_policies
      (id, name, policy_type, rules, effect)
    VALUES
      (${id}, ${input.name}, ${input.policyType}, ${JSON.stringify(input.rules)}::jsonb, ${input.effect})
  `);

  return { id };
}

export async function evaluateRuntimePolicies(input: {
  policyType: string;
  context: Record<string, unknown>;
}) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM runtime_policies
    WHERE enabled = TRUE
      AND policy_type = ${input.policyType}
    ORDER BY created_at ASC
  `);

  for (const policy of result.rows ?? []) {
    const rules = policy.rules ?? {};
    const matched = Object.entries(rules).every(
      ([key, value]) => input.context[key] === value,
    );

    if (matched) {
      return {
        effect: policy.effect,
        policyId: policy.id,
        policyName: policy.name,
      };
    }
  }

  return { effect: "allow" as const };
}
