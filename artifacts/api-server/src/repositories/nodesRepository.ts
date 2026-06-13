// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { db } from "@workspace/db";
import { nodesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export async function findNodeById(nodeId: number) {
  const [node] = await db
    .select()
    .from(nodesTable)
    .where(eq(nodesTable.id, nodeId))
    .limit(1);

  return node ?? null;
}

export async function listActiveNodes() {
  return db
    .select()
    .from(nodesTable)
    .where(eq(nodesTable.status, "active"));
}

export async function updateNodeHeartbeat(input: {
  nodeId: number;
  publicIp?: string | null;
}) {
  const patch: Partial<typeof nodesTable.$inferInsert> = {
    lastSeen: new Date(),
  };

  if (input.publicIp !== undefined) {
    patch.publicIp = input.publicIp ?? undefined;
  }

  return db
    .update(nodesTable)
    .set(patch)
    .where(eq(nodesTable.id, input.nodeId));
}

/**
 * Valid status values come from nodeStatusEnum:
 * "active" | "inactive" | "rotating" | "trapped"
 * ("error" and "maintenance" are not in the DB enum)
 */
export async function markNodeStatus(input: {
  nodeId: number;
  status: "active" | "inactive" | "rotating" | "trapped";
}) {
  return db
    .update(nodesTable)
    .set({ status: input.status })
    .where(eq(nodesTable.id, input.nodeId));
}
