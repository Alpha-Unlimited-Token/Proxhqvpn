// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { markNodeStatus } from "../repositories/nodesRepository";
import { publishPlatformEvent } from "../lib/event-bus";

export async function quarantineNode(input: {
  nodeId: string;
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO node_quarantine_events
      (id, node_id, reason, metadata)
    VALUES
      (${id}, ${input.nodeId}, ${input.reason}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  await markNodeStatus({
    nodeId: input.nodeId,
    status: "error",
    errorMessage: `Quarantined: ${input.reason}`,
  });

  await publishPlatformEvent({
    type: "node.quarantined",
    subject: input.nodeId,
    severity: "critical",
    payload: { quarantineId: id, reason: input.reason },
  });

  return { id };
}

export async function releaseNodeFromQuarantine(input: {
  nodeId: string;
  reason?: string;
}) {
  await db.execute(sql`
    UPDATE node_quarantine_events
    SET status = 'released', released_at = NOW()
    WHERE node_id = ${input.nodeId}
      AND status = 'quarantined'
  `);

  await markNodeStatus({
    nodeId: input.nodeId,
    status: "active",
    errorMessage: null,
  });

  await publishPlatformEvent({
    type: "node.quarantine.released",
    subject: input.nodeId,
    severity: "warn",
    payload: { reason: input.reason ?? null },
  });

  return { ok: true };
}
