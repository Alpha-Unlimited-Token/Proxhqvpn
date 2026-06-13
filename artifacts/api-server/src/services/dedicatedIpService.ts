// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";

export async function registerDedicatedIp(input: {
  ipAddress: string;
  region?: string | null;
  nodeId?: string | null;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO dedicated_ips
      (id, ip_address, region, node_id, status)
    VALUES
      (${id}, ${input.ipAddress}, ${input.region ?? null}, ${input.nodeId ?? null}, 'available')
    ON CONFLICT (ip_address) DO NOTHING
  `);

  return { id };
}

export async function assignDedicatedIp(input: {
  userId: string;
  preferredRegion?: string | null;
}) {
  const result: any = await db.execute(sql`
    UPDATE dedicated_ips
    SET status = 'assigned',
        assigned_user_id = ${input.userId},
        assigned_at = NOW()
    WHERE id = (
      SELECT id
      FROM dedicated_ips
      WHERE status = 'available'
        AND (${input.preferredRegion ?? null} IS NULL OR region = ${input.preferredRegion ?? null})
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);

  const ip = result.rows?.[0];

  if (!ip) {
    throw new Error("No dedicated IP available");
  }

  await publishPlatformEvent({
    type: "dedicated_ip.assigned",
    actor: input.userId,
    subject: ip.ip_address,
    severity: "info",
    payload: {
      dedicatedIpId: ip.id,
      region: ip.region,
      nodeId: ip.node_id,
    },
  });

  return ip;
}
