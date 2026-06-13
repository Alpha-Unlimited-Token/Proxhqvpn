// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { getAvailableVpnNodes } from "./nodeService";
import { scoreNodeHealth } from "./nodeHealthService";

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
