// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { selectBestCapacityAwareNode } from "./nodeRoutingService";
import { publishPlatformEvent } from "../lib/event-bus";

export async function createMultiHopRoute(input: {
  userId: string;
  deviceId?: string | null;
  preferredEntryRegion?: string | null;
  preferredExitRegion?: string | null;
}) {
  const entry = await selectBestCapacityAwareNode({
    preferredRegion: input.preferredEntryRegion,
  });

  if (!entry) throw new Error("No entry node available");

  const entryNodeId = String(
    entry.node.id ?? entry.node.nodeId ?? entry.node.node_id,
  );

  const exit = await selectBestCapacityAwareNode({
    preferredRegion: input.preferredExitRegion,
    excludeNodeIds: [entryNodeId],
  });

  if (!exit) throw new Error("No exit node available");

  const exitNodeId = String(
    exit.node.id ?? exit.node.nodeId ?? exit.node.node_id,
  );
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO multihop_routes
      (id, user_id, device_id, entry_node_id, exit_node_id, region_policy)
    VALUES
      (${id}, ${input.userId}, ${input.deviceId ?? null}, ${entryNodeId}, ${exitNodeId}, ${JSON.stringify({
        preferredEntryRegion: input.preferredEntryRegion ?? null,
        preferredExitRegion: input.preferredExitRegion ?? null,
      })}::jsonb)
  `);

  await publishPlatformEvent({
    type: "vpn.multihop.created",
    actor: input.userId,
    subject: input.deviceId ?? undefined,
    severity: "info",
    payload: { routeId: id, entryNodeId, exitNodeId },
  });

  return { id, entryNodeId, exitNodeId };
}
