// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { markNodeStatus } from "../repositories/nodesRepository";
import { publishPlatformEvent } from "../lib/event-bus";

export async function scheduleNodeMaintenance(input: {
  nodeId: string;
  startsAt: Date;
  endsAt: Date;
  reason?: string;
  createdBy?: string;
}) {
  if (input.endsAt <= input.startsAt) {
    throw new Error("Maintenance window end must be after start");
  }

  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO node_maintenance_windows
      (id, node_id, starts_at, ends_at, reason, created_by)
    VALUES
      (${id}, ${input.nodeId}, ${input.startsAt.toISOString()}, ${input.endsAt.toISOString()}, ${input.reason ?? null}, ${input.createdBy ?? null})
  `);

  await publishPlatformEvent({
    type: "node.maintenance.scheduled",
    subject: input.nodeId,
    severity: "info",
    payload: { id, startsAt: input.startsAt, endsAt: input.endsAt },
  });

  return { id };
}

export async function applyDueMaintenanceWindows() {
  const result: any = await db.execute(sql`
    SELECT *
    FROM node_maintenance_windows
    WHERE status = 'scheduled'
      AND starts_at <= NOW()
      AND ends_at > NOW()
  `);

  for (const window of result.rows ?? []) {
    await markNodeStatus({
      nodeId: window.node_id,
      status: "maintenance",
      errorMessage: window.reason ?? "Scheduled maintenance",
    });

    await db.execute(sql`
      UPDATE node_maintenance_windows
      SET status = 'active'
      WHERE id = ${window.id}
    `);
  }

  const expired: any = await db.execute(sql`
    SELECT *
    FROM node_maintenance_windows
    WHERE status = 'active'
      AND ends_at <= NOW()
  `);

  for (const window of expired.rows ?? []) {
    await markNodeStatus({
      nodeId: window.node_id,
      status: "active",
      errorMessage: null,
    });

    await db.execute(sql`
      UPDATE node_maintenance_windows
      SET status = 'completed'
      WHERE id = ${window.id}
    `);
  }

  return {
    activated: result.rows?.length ?? 0,
    completed: expired.rows?.length ?? 0,
  };
}
