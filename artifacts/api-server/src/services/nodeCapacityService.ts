// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.

export type NodeCapacitySnapshot = {
  nodeId: string;
  capacityScore: number;
  reasons: string[];
};

export function scoreNodeCapacity(node: any): NodeCapacitySnapshot {
  const nodeId = String(node.id ?? node.nodeId ?? node.node_id);
  const reasons: string[] = [];
  let score = 100;

  const activePeers = Number(node.activePeers ?? node.active_peers ?? 0);
  const maxPeers = Number(node.maxPeers ?? node.max_peers ?? 250);

  if (maxPeers > 0) {
    const peerRatio = activePeers / maxPeers;

    if (peerRatio > 0.9) {
      score -= 60;
      reasons.push("peer_capacity_gt_90");
    } else if (peerRatio > 0.75) {
      score -= 30;
      reasons.push("peer_capacity_gt_75");
    }
  }

  const cpu = Number(node.cpuLoad ?? node.cpu_load ?? node.load ?? 0);
  if (cpu > 0.9) {
    score -= 40;
    reasons.push("cpu_gt_90");
  } else if (cpu > 0.75) {
    score -= 20;
    reasons.push("cpu_gt_75");
  }

  const memory = Number(node.memoryUsage ?? node.memory_usage ?? 0);
  if (memory > 0.9) {
    score -= 30;
    reasons.push("memory_gt_90");
  }

  return {
    nodeId,
    capacityScore: Math.max(0, Math.min(100, score)),
    reasons,
  };
}
