// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function recordUsage(input: {
  tenantId?: string | null;
  userId?: string | null;
  metric: string;
  quantity?: number;
  unit?: string;
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO usage_meter_events
      (id, tenant_id, user_id, metric, quantity, unit, metadata)
    VALUES
      (${id}, ${input.tenantId ?? null}, ${input.userId ?? null}, ${input.metric}, ${input.quantity ?? 1}, ${input.unit ?? "count"}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  return { id };
}

export async function summarizeUsage(input: {
  tenantId?: string | null;
  userId?: string | null;
  metric: string;
  days?: number;
}) {
  const result: any = await db.execute(sql`
    SELECT COALESCE(SUM(quantity), 0)::numeric AS total
    FROM usage_meter_events
    WHERE metric = ${input.metric}
      AND created_at >= NOW() - (${input.days ?? 30} || ' days')::interval
      AND (${input.userId ?? null} IS NULL OR user_id = ${input.userId ?? null})
      AND (${input.tenantId ?? null} IS NULL OR tenant_id = ${input.tenantId ?? null})
  `);

  return {
    metric: input.metric,
    total: Number(result.rows?.[0]?.total ?? 0),
    days: input.days ?? 30,
  };
}
