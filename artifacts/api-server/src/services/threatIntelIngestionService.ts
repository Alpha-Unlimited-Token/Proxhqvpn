// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent, PlatformEventSeverity } from "../lib/event-bus";

export type ThreatIndicatorType = "ip" | "domain" | "url" | "hash" | "wallet";

function toEventSeverity(
  s?: "low" | "medium" | "high" | "critical" | string,
): PlatformEventSeverity {
  switch (s) {
    case "critical":
      return "critical";
    case "high":
      return "error";
    case "medium":
      return "warn";
    default:
      return "info";
  }
}

export async function ingestThreatIndicator(input: {
  indicatorType: ThreatIndicatorType;
  value: string;
  source: string;
  confidence?: number;
  severity?: "low" | "medium" | "high" | "critical";
  tags?: string[];
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO threat_intel_indicators
      (id, indicator_type, value, source, confidence, severity, tags)
    VALUES
      (${id}, ${input.indicatorType}, ${input.value}, ${input.source}, ${input.confidence ?? 0.5}, ${input.severity ?? "medium"}, ${JSON.stringify(input.tags ?? [])}::jsonb)
    ON CONFLICT (indicator_type, value, source)
    DO UPDATE SET
      confidence = EXCLUDED.confidence,
      severity = EXCLUDED.severity,
      tags = EXCLUDED.tags,
      last_seen = NOW()
  `);

  await publishPlatformEvent({
    type: "threat_intel.indicator.ingested",
    subject: input.value,
    severity: toEventSeverity(input.severity),
    payload: {
      indicatorType: input.indicatorType,
      source: input.source,
      confidence: input.confidence ?? 0.5,
    },
  });

  return { id };
}

export async function bulkIngestThreatIndicators(
  indicators: Array<Parameters<typeof ingestThreatIndicator>[0]>,
) {
  const results = [];

  for (const indicator of indicators) {
    results.push(await ingestThreatIndicator(indicator));
  }

  return { count: results.length, results };
}
