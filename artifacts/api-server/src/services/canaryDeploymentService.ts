// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";

export async function startCanaryRelease(input: {
  name: string;
  version: string;
  trafficPercent: number;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO canary_releases
      (id, name, version, traffic_percent)
    VALUES
      (${id}, ${input.name}, ${input.version}, ${input.trafficPercent})
  `);

  await publishPlatformEvent({
    type: "deployment.canary.started",
    subject: input.name,
    severity: "info",
    payload: { version: input.version, trafficPercent: input.trafficPercent },
  });

  return { id };
}

export async function updateCanaryTraffic(input: {
  releaseId: string;
  trafficPercent: number;
}) {
  await db.execute(sql`
    UPDATE canary_releases
    SET traffic_percent = ${input.trafficPercent},
        updated_at = NOW()
    WHERE id = ${input.releaseId}
  `);

  return { ok: true };
}

export async function completeCanaryRelease(input: {
  releaseId: string;
  status: "completed" | "rolled_back" | "failed";
  metrics?: Record<string, unknown>;
}) {
  await db.execute(sql`
    UPDATE canary_releases
    SET status = ${input.status},
        metrics = metrics || ${JSON.stringify(input.metrics ?? {})}::jsonb,
        updated_at = NOW()
    WHERE id = ${input.releaseId}
  `);

  return { ok: true };
}
