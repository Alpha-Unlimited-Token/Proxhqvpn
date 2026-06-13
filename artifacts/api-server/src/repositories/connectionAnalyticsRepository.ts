// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function recordVpnConnectionEvent(input: {
  userId: string;
  deviceId?: string | null;
  nodeId?: string | null;
  eventType: string;
  region?: string | null;
  latencyMs?: number | null;
  bytesIn?: number | null;
  bytesOut?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO vpn_connection_events
      (id, user_id, device_id, node_id, event_type, region, latency_ms, bytes_in, bytes_out, metadata)
    VALUES
      (${id}, ${input.userId}, ${input.deviceId ?? null}, ${input.nodeId ?? null}, ${input.eventType}, ${input.region ?? null}, ${input.latencyMs ?? null}, ${input.bytesIn ?? null}, ${input.bytesOut ?? null}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  return { id };
}

export async function getNodeConnectionStats(nodeId: string, minutes = 60) {
  const result: any = await db.execute(sql`
    SELECT
      COUNT(*)::int AS event_count,
      AVG(latency_ms)::int AS avg_latency_ms,
      SUM(COALESCE(bytes_in, 0))::bigint AS bytes_in,
      SUM(COALESCE(bytes_out, 0))::bigint AS bytes_out
    FROM vpn_connection_events
    WHERE node_id = ${nodeId}
      AND created_at >= NOW() - (${minutes} || ' minutes')::interval
  `);

  return (
    result.rows?.[0] ?? {
      event_count: 0,
      avg_latency_ms: null,
      bytes_in: 0,
      bytes_out: 0,
    }
  );
}
