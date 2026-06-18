// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Platform Segmentation — Core / Enterprise / Labs tier definitions.
// Every API route and feature belongs to exactly one tier.
// Audit recommendation: split into ProxHQ Core, Enterprise, and Labs.

export const TIERS = {
  CORE:       "core",
  ENTERPRISE: "enterprise",
  LABS:       "labs",
} as const;
export type Tier = (typeof TIERS)[keyof typeof TIERS];

/** Features grouped by tier. Used for entitlement checks and documentation. */
export const TIER_FEATURES: Record<Tier, string[]> = {
  core: [
    "vpn_connect",
    "wireguard_config",
    "kill_switch",
    "dns_shield",
    "split_tunnel",
    "smart_dns",
    "device_manager",
    "leak_detection",
    "obfuscation",
    "vpn_coexist",
    "proxy_browser",
    "pqc",
    "daita",
    "darkweb",
    "altid",
    "ip_rotator",
    "dedicated_ip",
    "gps_spoof",
    "meshnet",
    "port_forward",
    "router_config",
  ],
  enterprise: [
    "firewall_suite",
    "threat_intel",
    "security_audit",
    "siem",
    "ztna",
    "node_management",
    "command_governance",
    "drift_monitor",
    "osint",
    "canary_tokens",
    "ghost_trace",
    "ghost_chain",
    "ghost_trap",
    "network_monitor",
    "dns_sinkhole",
    "waf",
    "data_broker",
    "vpn_tracker",
    "quantum_audit",
    "dependency_map",
    "event_graph",
  ],
  labs: [
    "redteam_scan",
    "sast",
    "ai_security",
    "iac_scan",
    "jwt_analyzer",
    "ssl_tls",
    "api_tester",
    "code_sentinel",
  ],
};

/** Map a Clerk access level to a platform tier. */
export function tierFromAccess(
  isAdmin: boolean,
  isCommandCenter: boolean,
  hasAccess: boolean,
): Tier | null {
  if (isAdmin || isCommandCenter) return TIERS.ENTERPRISE;
  if (hasAccess) return TIERS.CORE;
  return null;
}

/** Check if a feature is available in a given tier or above. */
export function featureAllowedInTier(feature: string, tier: Tier): boolean {
  if (tier === TIERS.ENTERPRISE) {
    return (
      TIER_FEATURES.core.includes(feature) ||
      TIER_FEATURES.enterprise.includes(feature)
    );
  }
  if (tier === TIERS.LABS) return true;
  return TIER_FEATURES.core.includes(feature);
}

/** Return the tier that owns a feature (lowest tier with access). */
export function featureTier(feature: string): Tier | null {
  for (const tier of [TIERS.CORE, TIERS.ENTERPRISE, TIERS.LABS] as Tier[]) {
    if (TIER_FEATURES[tier].includes(feature)) return tier;
  }
  return null;
}

/** Human-readable tier label for UI display. */
export const TIER_LABELS: Record<Tier, string> = {
  core:       "ProxHQ Core",
  enterprise: "ProxHQ Enterprise",
  labs:       "ProxHQ Labs",
};

export const TIER_COLORS: Record<Tier, string> = {
  core:       "#22c55e",
  enterprise: "#3b82f6",
  labs:       "#a855f7",
};
