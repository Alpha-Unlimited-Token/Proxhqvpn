// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { selectLowestLatencyNode } from "./nodeRoutingService";
import { forecastNodeCapacity } from "./capacityForecastingService";

export async function recommendOptimalRoute(preferredRegion?: string) {
  const node = await selectLowestLatencyNode({ preferredRegion });

  if (!node) return null;

  const nodeId = String(
    node.node.id ??
    node.node.nodeId ??
    node.node.node_id,
  );

  const forecast = await forecastNodeCapacity(nodeId);

  return {
    nodeId,
    region: node.region,
    latency: node.latency,
    projectedTraffic: forecast.projectedTraffic,
    recommendationScore: Math.max(
      0,
      100 -
        node.latency / 5 -
        forecast.projectedTraffic / 100000000,
    ),
  };
}
