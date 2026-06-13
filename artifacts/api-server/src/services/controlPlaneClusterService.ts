// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import os from "os";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const INSTANCE_ID =
  process.env.PROXHQ_INSTANCE_ID ??
  `${os.hostname()}-${process.pid}`;

export async function heartbeatControlPlaneInstance() {
  await db.execute(sql`
    INSERT INTO control_plane_instances
      (id, instance_id, region, hostname, role, status, metadata)
    VALUES
      (
        ${randomUUID()},
        ${INSTANCE_ID},
        ${process.env.PROXHQ_REGION ?? null},
        ${os.hostname()},
        ${process.env.PROXHQ_CONTROL_PLANE_ROLE ?? "worker"},
        'active',
        ${JSON.stringify({ pid: process.pid })}::jsonb
      )
    ON CONFLICT (instance_id)
    DO UPDATE SET
      region = EXCLUDED.region,
      hostname = EXCLUDED.hostname,
      role = EXCLUDED.role,
      status = 'active',
      last_heartbeat_at = NOW(),
      metadata = EXCLUDED.metadata
  `);

  return { instanceId: INSTANCE_ID };
}

export async function listControlPlaneInstances() {
  const result: any = await db.execute(sql`
    SELECT *
    FROM control_plane_instances
    ORDER BY last_heartbeat_at DESC
  `);

  return result.rows ?? [];
}
