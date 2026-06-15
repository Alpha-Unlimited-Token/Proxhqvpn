// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Product catalog — commercial plan definitions aligned to the pricing matrix.

export type ProductKey =
  | "vpn_personal"
  | "vpn_pro"
  | "firewall"
  | "privacy"
  | "developer"
  | "business"
  | "enterprise"
  | "security_operations";

export type FeatureKey =
  | "vpn"
  | "vpn_pro"
  | "firewall"
  | "privacy"
  | "developer"
  | "api_access"
  | "device_management"
  | "rbac"
  | "zero_trust"
  | "command_center"
  | "siem"
  | "ghost_nodes"
  | "ghost_trap"
  | "audit_chain"
  | "compliance"
  | "trust_center"
  | "node_management"
  | "security_console";

export type ProductDefinition = {
  key: ProductKey;
  name: string;
  type: "base" | "addon" | "bundle" | "enterprise";
  monthlyPriceCents?: number;
  yearlyPriceCents?: number;
  perUserMonthlyCents?: number;
  minUsers?: number;
  features: FeatureKey[];
  limits?: Record<string, unknown>;
};

export const PRODUCT_CATALOG: ProductDefinition[] = [
  {
    key: "vpn_personal",
    name: "ProxhqVPN Personal",
    type: "base",
    monthlyPriceCents: 999,
    yearlyPriceCents: 8999,
    features: ["vpn", "privacy", "trust_center"],
    limits: { devices: 5, bandwidth: "fair_use" },
  },
  {
    key: "vpn_pro",
    name: "ProxhqVPN Pro",
    type: "base",
    monthlyPriceCents: 1999,
    yearlyPriceCents: 17999,
    features: ["vpn", "vpn_pro", "privacy", "trust_center"],
    limits: { devices: 10, advancedRouting: true },
  },
  {
    key: "firewall",
    name: "Proxhq Firewall Add-On",
    type: "addon",
    monthlyPriceCents: 499,
    yearlyPriceCents: 4999,
    features: ["firewall"],
  },
  {
    key: "privacy",
    name: "Proxhq Privacy Add-On",
    type: "addon",
    monthlyPriceCents: 499,
    yearlyPriceCents: 4999,
    features: ["privacy"],
  },
  {
    key: "developer",
    name: "Proxhq Developer",
    type: "base",
    monthlyPriceCents: 4900,
    yearlyPriceCents: 49000,
    features: ["developer", "api_access", "trust_center"],
    limits: { apiRequestsPerMonth: 100000 },
  },
  {
    key: "business",
    name: "Proxhq Business",
    type: "bundle",
    perUserMonthlyCents: 1500,
    minUsers: 10,
    features: ["vpn", "vpn_pro", "firewall", "privacy", "device_management", "rbac", "trust_center"],
  },
  {
    key: "enterprise",
    name: "Proxhq Enterprise",
    type: "enterprise",
    features: [
      "vpn", "vpn_pro", "firewall", "privacy", "device_management", "rbac",
      "zero_trust", "audit_chain", "compliance", "node_management", "trust_center",
    ],
  },
  {
    key: "security_operations",
    name: "Proxhq Security Operations",
    type: "enterprise",
    features: [
      "command_center", "siem", "ghost_nodes", "ghost_trap",
      "security_console", "audit_chain", "node_management",
    ],
  },
];

export function getProduct(key: ProductKey): ProductDefinition | null {
  return PRODUCT_CATALOG.find((p) => p.key === key) ?? null;
}

export function getProductFeatures(key: ProductKey): FeatureKey[] {
  return getProduct(key)?.features ?? [];
}
