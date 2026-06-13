// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import {
  findNodeById,
  listActiveNodes,
  markNodeStatus,
  updateNodeHeartbeat,
} from "../repositories/nodesRepository";

export async function getNodeOrThrow(nodeId: string | number) {
  const node = await findNodeById(nodeId);

  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  return node;
}

export async function getAvailableVpnNodes() {
  return listActiveNodes();
}

export async function recordNodeHeartbeat(input: {
  nodeId: string | number;
  publicIp?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const node = await findNodeById(input.nodeId);

  if (!node) {
    throw new Error(`Unknown node heartbeat: ${input.nodeId}`);
  }

  await updateNodeHeartbeat(input);

  return {
    ok: true,
    nodeId: input.nodeId,
  };
}

/**
 * Toggles a node between "active" and "inactive".
 * ("maintenance" maps to "inactive" in the DB enum.)
 */
export async function setNodeInactive(
  nodeId: string | number,
  inactive: boolean,
) {
  const status = inactive ? "inactive" : "active";

  await markNodeStatus({ nodeId, status });

  return { ok: true, nodeId, status };
}
