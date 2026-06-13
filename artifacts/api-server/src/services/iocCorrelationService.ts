// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";

function flattenValues(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string" || typeof value === "number")
    return [String(value)];
  if (Array.isArray(value)) return value.flatMap(flattenValues);
  if (typeof value === "object")
    return Object.values(value as Record<string, unknown>).flatMap(
      flattenValues,
    );
  return [];
}

export async function correlateEventWithIocs(event: {
  id: string;
  type: string;
  payload?: Record<string, unknown>;
}) {
  const values = flattenValues(event.payload ?? {});
  const matches = [];

  for (const value of values) {
    const result: any = await db.execute(sql`
      SELECT *
      FROM threat_intel_indicators
      WHERE value = ${value}
      LIMIT 10
    `);

    for (const indicator of result.rows ?? []) {
      const id = randomUUID();

      await db.execute(sql`
        INSERT INTO ioc_correlations
          (id, indicator_id, event_id, indicator_value, event_type, confidence, severity, metadata)
        VALUES
          (${id}, ${indicator.id}, ${event.id}, ${value}, ${event.type}, ${indicator.confidence}, ${indicator.severity}, ${JSON.stringify({ source: indicator.source })}::jsonb)
      `);

      await publishPlatformEvent({
        type: "ioc.correlation.matched",
        subject: value,
        severity: indicator.severity,
        payload: {
          correlationId: id,
          eventId: event.id,
          indicatorId: indicator.id,
        },
      });

      matches.push({ id, indicator });
    }
  }

  return { matches };
}
