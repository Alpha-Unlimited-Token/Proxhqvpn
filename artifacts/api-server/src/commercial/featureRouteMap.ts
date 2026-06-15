// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Maps API route prefixes to the feature key that protects them.
import type { FeatureKey } from "./productCatalog";

export const ROUTE_FEATURE_MAP: Array<{ prefix: string; feature: FeatureKey }> = [
  { prefix: "/api/vpn",              feature: "vpn" },
  { prefix: "/api/servers",          feature: "vpn" },
  { prefix: "/api/devices",          feature: "device_management" },
  { prefix: "/api/firewall",         feature: "firewall" },
  { prefix: "/api/developer",        feature: "developer" },
  { prefix: "/api/api-keys",         feature: "api_access" },
  { prefix: "/api/ghost-nodes",      feature: "ghost_nodes" },
  { prefix: "/api/ghost-trap",       feature: "ghost_trap" },
  { prefix: "/api/siem",             feature: "siem" },
  { prefix: "/api/compliance",       feature: "compliance" },
  { prefix: "/api/audit-chain",      feature: "audit_chain" },
  { prefix: "/api/nodes",            feature: "node_management" },
];

export function featureForPath(path: string): FeatureKey | null {
  const match = ROUTE_FEATURE_MAP
    .filter((entry) => path === entry.prefix || path.startsWith(`${entry.prefix}/`))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match?.feature ?? null;
}
