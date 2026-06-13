// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { getAvailableVpnNodes } from "./nodeService";
import { scoreNodeHealth } from "./nodeHealthService";
import { scoreNodeCapacity } from "./nodeCapacityService";
import { publishPlatformEvent } from "../lib/event-bus";

export async function optimizeWireGuardMesh() {
  const nodes = await getAvailableVpnNodes();

  const ranked = (nodes as any[])
    .map((node) => {
      const nodeId = String(node.id ?? node.nodeId ?? node.node_id);
      const health = scoreNodeHealth(node);
      const capacity = scoreNodeCapacity(node);

      return {
        nodeId,
        region: node.region ?? node.location ?? null,
        healthScore: health.score,
        capacityScore: capacity.capacityScore,
        meshScore: health.score * 0.7 + capacity.capacityScore * 0.3,
        reasons: [...health.reasons, ...capacity.reasons],
      };
    })
    .sort((a, b) => b.meshScore - a.meshScore);

  await publishPlatformEvent({
    type: "wireguard.mesh.optimized",
    severity: "info",
    payload: {
      nodeCount: ranked.length,
      topNodes: ranked.slice(0, 10),
    },
  });

  return {
    optimizedAt: new Date().toISOString(),
    nodes: ranked,
  };
}
