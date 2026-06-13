// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { db } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  assertNodesSchemaConfigured,
  getNodeColumns,
  nodesTable,
} from "./nodesSchemaAdapter";

// Valid status values from the actual nodeStatusEnum:
// "active" | "inactive" | "rotating" | "trapped"
// Adapter accepts the superset so higher layers can use logical names.
export type NodeStatus =
  | "active"
  | "inactive"
  | "rotating"
  | "trapped"
  | "error"
  | "maintenance";

function tableAndColumns() {
  assertNodesSchemaConfigured();

  const table = nodesTable as any;
  const columns = getNodeColumns(table);

  if (!columns.id || !columns.status) {
    throw new Error(
      "Nodes table is missing required id/status columns. Update nodesSchemaAdapter.ts.",
    );
  }

  return { table, columns };
}

export async function findNodeById(nodeId: string | number) {
  const { table, columns } = tableAndColumns();

  const [node] = await db
    .select()
    .from(table)
    .where(eq(columns.id, nodeId))
    .limit(1);

  return node ?? null;
}

export async function listActiveNodes() {
  const { table, columns } = tableAndColumns();

  return db
    .select()
    .from(table)
    .where(eq(columns.status, "active"));
}

export async function updateNodeHeartbeat(input: {
  nodeId: string | number;
  publicIp?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { table, columns } = tableAndColumns();

  const patch: Record<string, unknown> = {};

  if (columns.lastSeenAt) patch[columns.lastSeenAt.name ?? "last_seen_at"] = new Date();
  if (columns.updatedAt) patch[columns.updatedAt.name ?? "updated_at"] = new Date();

  if (input.publicIp !== undefined && columns.publicIp) {
    patch[columns.publicIp.name ?? "public_ip"] = input.publicIp;
  }

  if (input.metadata !== undefined && columns.metadata) {
    patch[columns.metadata.name ?? "metadata"] = input.metadata;
  }

  return db
    .update(table)
    .set(patch)
    .where(eq(columns.id, input.nodeId));
}

export async function markNodeStatus(input: {
  nodeId: string | number;
  status: NodeStatus;
  errorMessage?: string | null;
}) {
  const { table, columns } = tableAndColumns();

  const patch: Record<string, unknown> = {
    [columns.status.name ?? "status"]: input.status,
  };

  if (columns.errorMessage) {
    patch[columns.errorMessage.name ?? "error_message"] =
      input.errorMessage ?? null;
  }

  if (columns.updatedAt) {
    patch[columns.updatedAt.name ?? "updated_at"] = new Date();
  }

  return db
    .update(table)
    .set(patch)
    .where(eq(columns.id, input.nodeId));
}
