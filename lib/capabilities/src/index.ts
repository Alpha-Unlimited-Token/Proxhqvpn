// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.

export type Capability =
  | "public.read"
  | "auth.read"
  | "vpn.read"
  | "vpn.write"
  | "command_center.read"
  | "command_center.write"
  | "admin.read"
  | "admin.write"
  | "security_lab.admin"
  | "terminal.exec"
  | "sql.exec";

export type CapabilityRisk = "low" | "medium" | "high" | "critical";

export type CapabilityMeta = {
  capability: Capability;
  label: string;
  description: string;
  risk: CapabilityRisk;
};

export const capabilityRegistry: Record<Capability, CapabilityMeta> = {
  "public.read": {
    capability: "public.read",
    label: "Public Read",
    description: "Public unauthenticated read-only access.",
    risk: "low",
  },
  "auth.read": {
    capability: "auth.read",
    label: "Authenticated Read",
    description: "Signed-in user access.",
    risk: "low",
  },
  "vpn.read": {
    capability: "vpn.read",
    label: "VPN Read",
    description: "Active VPN subscription read access.",
    risk: "low",
  },
  "vpn.write": {
    capability: "vpn.write",
    label: "VPN Write",
    description: "Active VPN subscription write access.",
    risk: "medium",
  },
  "command_center.read": {
    capability: "command_center.read",
    label: "Command Center Read",
    description: "Command Center subscription read access.",
    risk: "medium",
  },
  "command_center.write": {
    capability: "command_center.write",
    label: "Command Center Write",
    description: "Command Center write or scan execution access.",
    risk: "high",
  },
  "admin.read": {
    capability: "admin.read",
    label: "Admin Read",
    description: "Owner or staff administrative read access.",
    risk: "high",
  },
  "admin.write": {
    capability: "admin.write",
    label: "Admin Write",
    description: "Owner or staff administrative mutation access.",
    risk: "critical",
  },
  "security_lab.admin": {
    capability: "security_lab.admin",
    label: "Security Lab Admin",
    description: "Access to isolated security-lab tooling.",
    risk: "critical",
  },
  "terminal.exec": {
    capability: "terminal.exec",
    label: "Terminal Execution",
    description: "Server-side terminal or SSH execution.",
    risk: "critical",
  },
  "sql.exec": {
    capability: "sql.exec",
    label: "SQL Execution",
    description: "Direct SQL console access.",
    risk: "critical",
  },
};

export function getCapabilityMeta(capability: Capability): CapabilityMeta {
  return capabilityRegistry[capability];
}
