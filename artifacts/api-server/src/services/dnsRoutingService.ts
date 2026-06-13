// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";

export type DnsUpstream = {
  name: string;
  address: string;
  type: "udp" | "tcp" | "doh" | "dot";
};

export type DnsRoutingRule = {
  match: string;
  upstreamName: string;
};

export async function saveDnsRoutingPolicy(input: {
  userId: string;
  name: string;
  upstreams: DnsUpstream[];
  rules: DnsRoutingRule[];
}) {
  if (input.upstreams.length === 0) {
    throw new Error("At least one DNS upstream is required");
  }

  if (input.upstreams.length > 20) {
    throw new Error("Too many DNS upstreams");
  }

  if (input.rules.length > 1000) {
    throw new Error("Too many DNS routing rules");
  }

  const upstreamNames = new Set(
    input.upstreams.map((upstream) => upstream.name),
  );

  for (const rule of input.rules) {
    if (!upstreamNames.has(rule.upstreamName)) {
      throw new Error(`Unknown upstream in rule: ${rule.upstreamName}`);
    }
  }

  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO dns_routing_policies
      (id, user_id, name, upstreams, rules)
    VALUES
      (${id}, ${input.userId}, ${input.name}, ${JSON.stringify(input.upstreams)}::jsonb, ${JSON.stringify(input.rules)}::jsonb)
  `);

  await publishPlatformEvent({
    type: "dns.policy.saved",
    actor: input.userId,
    severity: "info",
    payload: {
      policyId: id,
      upstreamCount: input.upstreams.length,
      ruleCount: input.rules.length,
    },
  });

  return { id };
}

export async function resolveDnsPolicyForUser(userId: string) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM dns_routing_policies
    WHERE user_id = ${userId}
      AND enabled = TRUE
    ORDER BY updated_at DESC
    LIMIT 1
  `);

  return result.rows?.[0] ?? null;
}
