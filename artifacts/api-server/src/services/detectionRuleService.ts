// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";

export async function createDetectionRule(input: {
  name: string;
  description?: string;
  severity: "low" | "medium" | "high" | "critical";
  eventType: string;
  conditions: Record<string, unknown>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO detection_rules
      (id, name, description, severity, event_type, conditions)
    VALUES
      (${id}, ${input.name}, ${input.description ?? null}, ${input.severity}, ${input.eventType}, ${JSON.stringify(input.conditions)}::jsonb)
  `);

  return { id };
}

export async function evaluateDetectionRules(event: any) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM detection_rules
    WHERE enabled = TRUE
      AND event_type = ${event.type}
  `);

  const matches = [];

  for (const rule of result.rows ?? []) {
    const conditions = rule.conditions ?? {};
    let matched = true;

    for (const [key, expected] of Object.entries(conditions)) {
      if (event.payload?.[key] !== expected) {
        matched = false;
        break;
      }
    }

    if (matched) {
      matches.push(rule);

      await publishPlatformEvent({
        type: "detection.rule.matched",
        subject: event.subject ?? event.id,
        severity: rule.severity,
        payload: {
          ruleId: rule.id,
          ruleName: rule.name,
          sourceEventId: event.id,
        },
      });
    }
  }

  return matches;
}
