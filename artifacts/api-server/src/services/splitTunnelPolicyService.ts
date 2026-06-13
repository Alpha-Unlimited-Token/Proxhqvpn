// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";

export type SplitTunnelRule = {
  type: "domain" | "cidr" | "app" | "process";
  value: string;
};

export function validateSplitTunnelRules(rules: SplitTunnelRule[]) {
  if (rules.length > 500) {
    throw new Error("Split tunnel policy cannot exceed 500 rules");
  }

  for (const rule of rules) {
    if (!["domain", "cidr", "app", "process"].includes(rule.type)) {
      throw new Error(`Unsupported split tunnel rule type: ${rule.type}`);
    }

    if (!rule.value || rule.value.length > 512) {
      throw new Error("Invalid split tunnel rule value");
    }
  }
}

export async function saveSplitTunnelPolicy(input: {
  userId: string;
  deviceId?: string | null;
  name: string;
  mode: "include" | "exclude";
  rules: SplitTunnelRule[];
}) {
  validateSplitTunnelRules(input.rules);

  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO split_tunnel_policies
      (id, user_id, device_id, name, mode, rules)
    VALUES
      (${id}, ${input.userId}, ${input.deviceId ?? null}, ${input.name}, ${input.mode}, ${JSON.stringify(input.rules)}::jsonb)
  `);

  await publishPlatformEvent({
    type: "split_tunnel.policy.saved",
    actor: input.userId,
    subject: input.deviceId ?? undefined,
    severity: "info",
    payload: {
      policyId: id,
      mode: input.mode,
      ruleCount: input.rules.length,
    },
  });

  return { id };
}

export async function listSplitTunnelPolicies(userId: string) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM split_tunnel_policies
    WHERE user_id = ${userId}
      AND enabled = TRUE
    ORDER BY updated_at DESC
  `);

  return result.rows ?? [];
}
