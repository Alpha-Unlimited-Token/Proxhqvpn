// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function appendEvent(input: {
  streamId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  const versionResult: any = await db.execute(sql`
    SELECT COALESCE(MAX(version), 0) + 1 AS next_version
    FROM event_store
    WHERE stream_id = ${input.streamId}
  `);

  const version = Number(versionResult.rows?.[0]?.next_version ?? 1);
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO event_store
      (id, stream_id, event_type, version, payload, metadata)
    VALUES
      (${id}, ${input.streamId}, ${input.eventType}, ${version}, ${JSON.stringify(input.payload ?? {})}::jsonb, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  return { id, version };
}

export async function readStream(streamId: string) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM event_store
    WHERE stream_id = ${streamId}
    ORDER BY version ASC
  `);

  return result.rows ?? [];
}
