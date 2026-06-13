// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type ZeroTrustDecision = {
  effect: "allow" | "deny" | "step_up";
  matchedPolicyId?: string;
  reasons: string[];
};

export async function createZeroTrustPolicy(input: {
  name: string;
  description?: string;
  priority?: number;
  conditions: Record<string, unknown>;
  effect: "allow" | "deny" | "step_up";
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO zero_trust_policies
      (id, name, description, priority, conditions, effect)
    VALUES
      (${id}, ${input.name}, ${input.description ?? null}, ${input.priority ?? 100}, ${JSON.stringify(input.conditions)}::jsonb, ${input.effect})
  `);

  return { id };
}

function matchesConditions(
  context: Record<string, unknown>,
  conditions: Record<string, unknown>,
): boolean {
  for (const [key, expected] of Object.entries(conditions)) {
    if (context[key] !== expected) return false;
  }
  return true;
}

export async function evaluateZeroTrustPolicy(context: {
  userId: string;
  deviceTrustLevel?: string;
  identityRiskLevel?: string;
  requestedCapability?: string;
  region?: string | null;
}): Promise<ZeroTrustDecision> {
  const result: any = await db.execute(sql`
    SELECT *
    FROM zero_trust_policies
    WHERE enabled = TRUE
    ORDER BY priority ASC
  `);

  for (const policy of result.rows ?? []) {
    if (matchesConditions(context, policy.conditions ?? {})) {
      return {
        effect: policy.effect,
        matchedPolicyId: policy.id,
        reasons: [`matched_policy:${policy.name}`],
      };
    }
  }

  if (context.identityRiskLevel === "critical") {
    return { effect: "deny", reasons: ["critical_identity_risk"] };
  }

  if (context.deviceTrustLevel === "blocked") {
    return { effect: "deny", reasons: ["blocked_device"] };
  }

  if (
    context.identityRiskLevel === "high" ||
    context.deviceTrustLevel === "risky"
  ) {
    return { effect: "step_up", reasons: ["risk_requires_step_up"] };
  }

  return { effect: "allow", reasons: ["default_allow"] };
}
