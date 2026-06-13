// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent, PlatformEventSeverity } from "../lib/event-bus";

function toEventSeverity(
  s: "low" | "medium" | "high" | "critical",
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

function severityPriority(severity: string): number {
  switch (severity) {
    case "critical":
      return 100;
    case "high":
      return 80;
    case "medium":
      return 50;
    case "low":
      return 20;
    default:
      return 10;
  }
}

export async function createSecurityAlert(input: {
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  sourceEventId?: string | null;
  subject?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();
  const basePriority = severityPriority(input.severity);
  const confidenceBoost = Number(input.metadata?.confidence ?? 0) * 10;
  const priority = Math.min(100, Math.round(basePriority + confidenceBoost));

  await db.execute(sql`
    INSERT INTO security_alerts
      (id, title, severity, priority, source_event_id, subject, metadata)
    VALUES
      (${id}, ${input.title}, ${input.severity}, ${priority}, ${input.sourceEventId ?? null}, ${input.subject ?? null}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  await publishPlatformEvent({
    type: "security.alert.created",
    subject: input.subject ?? id,
    severity: toEventSeverity(input.severity),
    payload: { alertId: id, priority },
  });

  return { id, priority };
}

export async function listOpenSecurityAlerts(limit = 100) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM security_alerts
    WHERE status = 'open'
    ORDER BY priority DESC, created_at DESC
    LIMIT ${limit}
  `);

  return result.rows ?? [];
}
