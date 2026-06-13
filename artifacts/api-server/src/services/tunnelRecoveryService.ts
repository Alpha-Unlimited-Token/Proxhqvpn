// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { findFailoverNode } from "./nodeFailoverService";
import { publishPlatformEvent } from "../lib/event-bus";

export async function recoverTunnel(input: {
  userId: string;
  deviceId?: string | null;
  failedNodeId: string;
  preferredRegion?: string | null;
  reason?: string;
}) {
  const recovery = await findFailoverNode({
    failedNodeId: input.failedNodeId,
    preferredRegion: input.preferredRegion,
  });

  const id = randomUUID();

  if (!recovery) {
    await db.execute(sql`
      INSERT INTO tunnel_recovery_events
        (id, user_id, device_id, failed_node_id, status, reason)
      VALUES
        (${id}, ${input.userId}, ${input.deviceId ?? null}, ${input.failedNodeId}, 'failed', ${input.reason ?? "No failover node available"})
    `);

    return { id, status: "failed" as const };
  }

  const recoveryNodeId = String(
    recovery.node.id ?? recovery.node.nodeId ?? recovery.node.node_id,
  );

  await db.execute(sql`
    INSERT INTO tunnel_recovery_events
      (id, user_id, device_id, failed_node_id, recovery_node_id, status, reason, metadata)
    VALUES
      (${id}, ${input.userId}, ${input.deviceId ?? null}, ${input.failedNodeId}, ${recoveryNodeId}, 'completed', ${input.reason ?? null}, ${JSON.stringify({
        recoveryScore: recovery.health.score,
        region: recovery.region,
      })}::jsonb)
  `);

  await publishPlatformEvent({
    type: "vpn.tunnel.recovered",
    actor: input.userId,
    subject: input.deviceId ?? input.failedNodeId,
    severity: "warn",
    payload: {
      recoveryEventId: id,
      failedNodeId: input.failedNodeId,
      recoveryNodeId,
    },
  });

  return {
    id,
    status: "completed" as const,
    recoveryNodeId,
  };
}
