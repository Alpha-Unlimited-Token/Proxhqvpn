// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { getAvailableVpnNodes } from "./nodeService";
import { scoreNodeHealth } from "./nodeHealthService";
import { scoreNodeCapacity } from "./nodeCapacityService";
import { getNodeAnalyticsSnapshot } from "./connectionAnalyticsService";

export type SelectNodeInput = {
  preferredRegion?: string | null;
  excludeNodeIds?: string[];
};

function readRegion(node: any): string | null {
  return node.region ?? node.location ?? node.geoRegion ?? null;
}

export async function selectBestVpnNode(input: SelectNodeInput = {}) {
  const nodes = await getAvailableVpnNodes();
  const exclude = new Set(input.excludeNodeIds ?? []);

  const candidates = (nodes as any[])
    .filter(
      (node) =>
        !exclude.has(String(node.id ?? node.nodeId ?? node.node_id)),
    )
    .map((node) => ({
      node,
      health: scoreNodeHealth(node),
      region: readRegion(node),
    }))
    .filter((item) => item.health.score > 25);

  candidates.sort((a, b) => {
    const regionBoostA =
      input.preferredRegion && a.region === input.preferredRegion ? 20 : 0;
    const regionBoostB =
      input.preferredRegion && b.region === input.preferredRegion ? 20 : 0;
    return (
      b.health.score + regionBoostB - (a.health.score + regionBoostA)
    );
  });

  return candidates[0] ?? null;
}

export async function selectLowestLatencyNode(input: SelectNodeInput = {}) {
  const nodes = await getAvailableVpnNodes();
  const exclude = new Set(input.excludeNodeIds ?? []);

  const candidates = await Promise.all(
    (nodes as any[])
      .filter(
        (node) =>
          !exclude.has(String(node.id ?? node.nodeId ?? node.node_id)),
      )
      .map(async (node) => {
        const nodeId = String(node.id ?? node.nodeId ?? node.node_id);
        const health = scoreNodeHealth(node);
        const stats = await getNodeAnalyticsSnapshot(nodeId);
        const latency = Number(
          stats.avg_latency_ms ??
            stats.avgLatencyMs ??
            node.latencyMs ??
            9999,
        );

        return {
          node,
          nodeId,
          health,
          region: readRegion(node),
          latency,
        };
      }),
  );

  const viable = candidates.filter((item) => item.health.score > 50);

  viable.sort((a, b) => {
    const regionBoostA =
      input.preferredRegion && a.region === input.preferredRegion ? -50 : 0;
    const regionBoostB =
      input.preferredRegion && b.region === input.preferredRegion ? -50 : 0;
    return a.latency + regionBoostA - (b.latency + regionBoostB);
  });

  return viable[0] ?? null;
}

export async function selectBestCapacityAwareNode(input: SelectNodeInput = {}) {
  const nodes = await getAvailableVpnNodes();
  const exclude = new Set(input.excludeNodeIds ?? []);

  const candidates = (nodes as any[])
    .filter(
      (node) =>
        !exclude.has(String(node.id ?? node.nodeId ?? node.node_id)),
    )
    .map((node) => {
      const health = scoreNodeHealth(node);
      const capacity = scoreNodeCapacity(node);
      const region = readRegion(node);

      const regionBoost =
        input.preferredRegion && region === input.preferredRegion ? 10 : 0;
      const combinedScore =
        health.score * 0.65 + capacity.capacityScore * 0.35 + regionBoost;

      return { node, health, capacity, region, combinedScore };
    })
    .filter(
      (item) => item.health.score > 40 && item.capacity.capacityScore > 25,
    );

  candidates.sort((a, b) => b.combinedScore - a.combinedScore);

  return candidates[0] ?? null;
}
