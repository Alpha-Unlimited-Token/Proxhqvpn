// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export type PlatformEventSeverity =
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "critical";

export type PublishPlatformEventInput = {
  type: string;
  actor?: string | null;
  subject?: string | null;
  severity?: PlatformEventSeverity;
  payload?: Record<string, unknown>;
};

export async function publishPlatformEvent(
  input: PublishPlatformEventInput,
) {
  const event = {
    id: randomUUID(),
    type: input.type,
    actor: input.actor ?? null,
    subject: input.subject ?? null,
    severity: input.severity ?? "info",
    payload: input.payload ?? {},
  };

  await db.execute(sql`
    INSERT INTO platform_events
      (id, type, actor, subject, severity, payload)
    VALUES
      (${event.id}, ${event.type}, ${event.actor}, ${event.subject}, ${event.severity}, ${JSON.stringify(event.payload)}::jsonb)
  `);

  logger.info({ event }, "Platform event published");

  return event;
}

export async function listUnprocessedPlatformEvents(limit = 100) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM platform_events
    WHERE processed_at IS NULL
    ORDER BY created_at ASC
    LIMIT ${limit}
  `);

  return result.rows ?? [];
}

export async function markPlatformEventProcessed(eventId: string) {
  await db.execute(sql`
    UPDATE platform_events
    SET processed_at = NOW()
    WHERE id = ${eventId}
  `);
}
