// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent, PlatformEventSeverity } from "../lib/event-bus";

function toEventSeverity(
  s?: "low" | "medium" | "high" | "critical",
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

export async function recordSessionAnomaly(input: {
  userId: string;
  deviceId?: string | null;
  anomalyType: string;
  severity?: "low" | "medium" | "high" | "critical";
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO session_anomalies
      (id, user_id, device_id, anomaly_type, severity, metadata)
    VALUES
      (${id}, ${input.userId}, ${input.deviceId ?? null}, ${input.anomalyType}, ${input.severity ?? "medium"}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  await publishPlatformEvent({
    type: "session.anomaly.detected",
    actor: input.userId,
    subject: input.deviceId ?? undefined,
    severity: toEventSeverity(input.severity),
    payload: {
      anomalyId: id,
      anomalyType: input.anomalyType,
      ...input.metadata,
    },
  });

  return { id };
}
