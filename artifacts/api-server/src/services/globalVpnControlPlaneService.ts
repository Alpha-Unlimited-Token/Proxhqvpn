// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { getAvailableVpnNodes } from "./nodeService";
import { scoreNodeHealth } from "./nodeHealthService";
import { scoreNodeCapacity } from "./nodeCapacityService";
import { optimizeWireGuardMesh } from "./wireguardMeshOptimizerService";
import { reconcileWireGuardPeers } from "./wireguardPeerReconciliationService";

export async function getGlobalVpnControlPlaneSnapshot() {
  const nodes = await getAvailableVpnNodes();

  const nodeSnapshots = (nodes as any[]).map((node) => {
    const nodeId = String(node.id ?? node.nodeId ?? node.node_id);
    const health = scoreNodeHealth(node);
    const capacity = scoreNodeCapacity(node);

    return {
      nodeId,
      region: node.region ?? node.location ?? null,
      status: node.status ?? null,
      health,
      capacity,
    };
  });

  const healthy = nodeSnapshots.filter(
    (node) => node.health.score >= 80,
  ).length;
  const degraded = nodeSnapshots.filter(
    (node) => node.health.score < 80 && node.health.score >= 40,
  ).length;
  const offline = nodeSnapshots.filter(
    (node) => node.health.score < 40,
  ).length;

  return {
    generatedAt: new Date().toISOString(),
    totalNodes: nodeSnapshots.length,
    healthy,
    degraded,
    offline,
    regions: Array.from(
      new Set(nodeSnapshots.map((node) => node.region).filter(Boolean)),
    ),
    nodes: nodeSnapshots,
  };
}

export async function runGlobalVpnControlPlaneMaintenance() {
  const [mesh, peers, snapshot] = await Promise.all([
    optimizeWireGuardMesh(),
    reconcileWireGuardPeers(),
    getGlobalVpnControlPlaneSnapshot(),
  ]);

  return {
    maintainedAt: new Date().toISOString(),
    mesh,
    peers,
    snapshot,
  };
}
