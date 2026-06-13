// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function saveBandwidthForecast(input: {
  nodeId: string;
  windowMinutes: number;
  observedBytes: number;
  forecastBytes: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO node_bandwidth_forecasts
      (id, node_id, window_minutes, observed_bytes, forecast_bytes, confidence, metadata)
    VALUES
      (${id}, ${input.nodeId}, ${input.windowMinutes}, ${input.observedBytes}, ${input.forecastBytes}, ${input.confidence}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  return { id };
}
