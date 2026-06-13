// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import {
  selectBestCapacityAwareNode,
  selectLowestLatencyNode,
} from "./nodeRoutingService";

export type SmartRouteMode = "balanced" | "latency" | "capacity";

export async function selectSmartRoute(input: {
  mode?: SmartRouteMode;
  preferredRegion?: string | null;
  excludeNodeIds?: string[];
}) {
  const mode = input.mode ?? "balanced";

  if (mode === "latency") {
    return selectLowestLatencyNode(input);
  }

  if (mode === "capacity") {
    return selectBestCapacityAwareNode(input);
  }

  const latency = await selectLowestLatencyNode(input);
  const capacity = await selectBestCapacityAwareNode(input);

  if (!latency) return capacity;
  if (!capacity) return latency;

  const latencyNodeId = String(
    latency.node.id ?? latency.node.nodeId ?? latency.node.node_id,
  );

  const capacityNodeId = String(
    capacity.node.id ?? capacity.node.nodeId ?? capacity.node.node_id,
  );

  if (latencyNodeId === capacityNodeId) return latency;

  const latencyScore = latency.health.score - Math.min(latency.latency / 10, 30);
  const capacityScore = capacity.combinedScore;

  return latencyScore >= capacityScore ? latency : capacity;
}
