// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function recordDeviceLifecycleEvent(input: {
  userId: string;
  deviceId: string;
  eventType: string;
  status?: string;
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO device_lifecycle_events
      (id, user_id, device_id, event_type, status, metadata)
    VALUES
      (${id}, ${input.userId}, ${input.deviceId}, ${input.eventType}, ${input.status ?? "active"}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  return { id };
}

export async function listDeviceLifecycleEvents(input: {
  userId: string;
  deviceId: string;
  limit?: number;
}) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM device_lifecycle_events
    WHERE user_id = ${input.userId}
      AND device_id = ${input.deviceId}
    ORDER BY created_at DESC
    LIMIT ${input.limit ?? 50}
  `);

  return result.rows ?? [];
}
