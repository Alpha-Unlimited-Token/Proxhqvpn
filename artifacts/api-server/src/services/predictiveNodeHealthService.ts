// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { getAvailableVpnNodes } from "./nodeService";

export async function predictNodeHealth() {
  const nodes = await getAvailableVpnNodes();

  return nodes.map((node: any) => {
    const cpu = Number(node.cpuLoad ?? 0);
    const memory = Number(node.memoryUsage ?? 0);
    const peers = Number(node.activePeers ?? 0);

    const risk =
      cpu * 0.4 +
      memory * 0.4 +
      Math.min(1, peers / 1000) * 0.2;

    return {
      nodeId: node.id,
      healthScore: Math.max(0, 100 - risk * 100),
      failureProbability: Math.min(1, risk),
    };
  });
}
