// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Feature registry — metadata for every commercial feature key.
import type { FeatureKey } from "./productCatalog";

export type FeatureDefinition = {
  key: FeatureKey;
  label: string;
  description: string;
  category: "vpn" | "security" | "business" | "developer" | "enterprise";
  dangerous?: boolean;
  consumerVisible?: boolean;
};

export const FEATURE_REGISTRY: Record<FeatureKey, FeatureDefinition> = {
  vpn:              { key: "vpn",              label: "VPN",              description: "Core VPN access.",                            category: "vpn",        consumerVisible: true },
  vpn_pro:          { key: "vpn_pro",          label: "VPN Pro",          description: "Advanced VPN features.",                      category: "vpn",        consumerVisible: true },
  firewall:         { key: "firewall",         label: "Firewall",         description: "Firewall rules and traffic policy.",          category: "security",   consumerVisible: true },
  privacy:          { key: "privacy",          label: "Privacy",          description: "Privacy and tracker protection.",             category: "vpn",        consumerVisible: true },
  developer:        { key: "developer",        label: "Developer",        description: "Developer tools and APIs.",                   category: "developer",  consumerVisible: true },
  api_access:       { key: "api_access",       label: "API Access",       description: "Programmatic API access.",                    category: "developer" },
  device_management:{ key: "device_management",label: "Device Management",description: "Managed device inventory.",                  category: "business" },
  rbac:             { key: "rbac",             label: "RBAC",             description: "Role-based access control.",                  category: "business" },
  zero_trust:       { key: "zero_trust",       label: "Zero Trust",       description: "ZTNA and policy decisions.",                  category: "enterprise" },
  command_center:   { key: "command_center",   label: "Command Center",   description: "Security operations command center.",         category: "enterprise", dangerous: true },
  siem:             { key: "siem",             label: "SIEM",             description: "Security events and correlation.",            category: "enterprise", dangerous: true },
  ghost_nodes:      { key: "ghost_nodes",      label: "Ghost Nodes",      description: "Defensive deception nodes.",                  category: "enterprise", dangerous: true },
  ghost_trap:       { key: "ghost_trap",       label: "Ghost Trap",       description: "Defensive honeypot/trap events.",             category: "enterprise", dangerous: true },
  audit_chain:      { key: "audit_chain",      label: "Audit Chain",      description: "Tamper-evident audit trail.",                 category: "enterprise" },
  compliance:       { key: "compliance",       label: "Compliance",       description: "Compliance evidence and controls.",           category: "enterprise" },
  trust_center:     { key: "trust_center",     label: "Trust Center",     description: "Public trust center.",                        category: "enterprise", consumerVisible: true },
  node_management:  { key: "node_management",  label: "Node Management",  description: "VPN/server node operations.",                 category: "enterprise", dangerous: true },
  security_console: { key: "security_console", label: "Security Console", description: "Advanced security console.",                  category: "enterprise", dangerous: true },
};

export function isKnownFeature(key: string): key is FeatureKey {
  return key in FEATURE_REGISTRY;
}
