// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";

export async function normalizeSecurityEvent(input: {
  source: string;
  eventType: string;
  severity?: string;
  actor?: string | null;
  subject?: string | null;
  raw: Record<string, unknown>;
}) {
  const id = randomUUID();

  const normalized = {
    source: input.source,
    eventType: input.eventType,
    severity: input.severity ?? "info",
    actor: input.actor ?? null,
    subject: input.subject ?? null,
    observedAt: new Date().toISOString(),
  };

  await db.execute(sql`
    INSERT INTO security_events
      (id, source, event_type, severity, actor, subject, normalized, raw)
    VALUES
      (${id}, ${input.source}, ${input.eventType}, ${input.severity ?? "info"}, ${input.actor ?? null}, ${input.subject ?? null}, ${JSON.stringify(normalized)}::jsonb, ${JSON.stringify(input.raw)}::jsonb)
  `);

  await publishPlatformEvent({
    type: `security.event.${input.eventType}`,
    actor: input.actor ?? undefined,
    subject: input.subject ?? undefined,
    severity: input.severity === "critical" ? "critical" : "info",
    payload: { securityEventId: id, normalized },
  });

  return { id, normalized };
}
