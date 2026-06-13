// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function createInvestigationTimeline(input: {
  subject: string;
  title: string;
  createdBy?: string | null;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO investigation_timelines
      (id, subject, title, created_by)
    VALUES
      (${id}, ${input.subject}, ${input.title}, ${input.createdBy ?? null})
  `);

  return { id };
}

export async function addInvestigationTimelineEvent(input: {
  timelineId: string;
  eventType: string;
  title: string;
  description?: string | null;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO investigation_timeline_events
      (id, timeline_id, event_type, title, description, occurred_at, metadata)
    VALUES
      (${id}, ${input.timelineId}, ${input.eventType}, ${input.title}, ${input.description ?? null}, ${(input.occurredAt ?? new Date()).toISOString()}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  return { id };
}

export async function getInvestigationTimeline(timelineId: string) {
  const timeline: any = await db.execute(sql`
    SELECT * FROM investigation_timelines WHERE id = ${timelineId} LIMIT 1
  `);

  const events: any = await db.execute(sql`
    SELECT * FROM investigation_timeline_events
    WHERE timeline_id = ${timelineId}
    ORDER BY occurred_at ASC
  `);

  return {
    timeline: timeline.rows?.[0] ?? null,
    events: events.rows ?? [],
  };
}
