// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { publishPlatformEvent } from "../lib/event-bus";
import {
  findNodeById,
  listActiveNodes,
  markNodeStatus,
} from "../repositories/nodesRepository";

export type NodeHealthState = "healthy" | "stale" | "offline" | "error";

function getLastSeen(node: any): Date | null {
  const raw =
    node.lastSeenAt ??
    node.last_seen_at ??
    node.updatedAt ??
    node.updated_at ??
    null;

  if (!raw) return null;

  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function classifyNodeHealth(node: any): NodeHealthState {
  if (node.status === "error") return "error";

  const lastSeen = getLastSeen(node);

  if (!lastSeen) return "stale";

  const ageMs = Date.now() - lastSeen.getTime();

  if (ageMs > 15 * 60_000) return "offline";
  if (ageMs > 5 * 60_000) return "stale";

  return "healthy";
}

export async function evaluateNodeLifecycle(nodeId: string) {
  const node = await findNodeById(nodeId);

  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const health = classifyNodeHealth(node);

  if (health === "offline" && node.status !== "inactive") {
    await markNodeStatus({
      nodeId,
      status: "inactive",
      errorMessage: "Node marked inactive by lifecycle evaluator",
    });

    await publishPlatformEvent({
      type: "node.offline",
      subject: nodeId,
      severity: "warn",
      payload: { health },
    });
  }

  return { nodeId, health };
}

export async function evaluateAllActiveNodes() {
  const nodes = await listActiveNodes();
  const results = [];

  for (const node of nodes as any[]) {
    const id = node.id ?? node.nodeId ?? node.node_id;
    if (!id) continue;
    results.push(await evaluateNodeLifecycle(String(id)));
  }

  return results;
}
