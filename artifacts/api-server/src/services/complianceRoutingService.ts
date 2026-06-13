// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.

export type ComplianceRoutingPolicy = {
  userRegion?: string | null;
  blockedRegions?: string[];
  requiredRegions?: string[];
};

export function isNodeAllowedByCompliance(
  node: any,
  policy: ComplianceRoutingPolicy,
): boolean {
  const nodeRegion = String(node.region ?? node.location ?? "").toLowerCase();

  const blocked = new Set(
    (policy.blockedRegions ?? []).map((region) => region.toLowerCase()),
  );

  const required = new Set(
    (policy.requiredRegions ?? []).map((region) => region.toLowerCase()),
  );

  if (blocked.has(nodeRegion)) return false;
  if (required.size > 0 && !required.has(nodeRegion)) return false;

  return true;
}

export function filterNodesByCompliance(
  nodes: any[],
  policy: ComplianceRoutingPolicy,
) {
  return nodes.filter((node) => isNodeAllowedByCompliance(node, policy));
}
