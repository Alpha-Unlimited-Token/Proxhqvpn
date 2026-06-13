// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// 6-role RBAC model — gap bridge from ChatGPT audit (Top-3 Gap Bridge Package).
// Replaces the coarse admin/user/subscription model with fine-grained permissions.

export type Role =
  | "owner"           // Full platform control — billing, admin, audit export, incident response
  | "security_admin"  // Read VPN/peer config, full audit access, incident write — no config changes
  | "network_admin"   // Read/write VPN and peer config — no audit export, no billing
  | "auditor"         // Read-only VPN + full audit read/export — cannot change anything
  | "support"         // Read-only VPN and peer info — no audit, no billing
  | "user";           // VPN read only — standard subscriber

export type Action =
  | "vpn:read"         // Read tunnel config, status, connected peers
  | "vpn:write"        // Create/modify/revoke tunnels, rotate PSKs
  | "peer:read"        // Read peer device list and posture
  | "peer:write"       // Add/remove/revoke WireGuard peers
  | "audit:read"       // View audit log entries
  | "audit:export"     // Download/export audit log (chain verification)
  | "admin:write"      // User management, role assignment, system config
  | "billing:read"     // View subscription and payment status
  | "incident:write"   // Create/update security incidents and escalations
  | "ztna:posture"     // Submit device posture check
  | "counter_attack"   // Initiate counter-intelligence scans (owner + security_admin only)
  | "silkweb_exploit"  // Run sqlmap/os-cmd/file-read against lab-authorized targets only
  | "ghost_node_admin" // Create/manage Ghost Node decoy infrastructure
  | "honeypot_admin"   // Manage honeypot nodes, IOCs, alerts (CRUD)
  | "deception_admin"  // Manage deception banners, canary tokens, purge events
  | "lab_targets"      // Add/remove/expire authorized lab scan targets
  | "nodes:vultr_sync" // Trigger Vultr instance reconciliation
  | "recon_write";     // OSINT / passive-active recon against external targets (owner, security_admin, network_admin)

const GRANTS: Record<Role, Action[]> = {
  owner: [
    "vpn:read", "vpn:write", "peer:read", "peer:write",
    "audit:read", "audit:export", "admin:write", "billing:read",
    "incident:write", "ztna:posture",
    "counter_attack", "silkweb_exploit", "ghost_node_admin",
    "honeypot_admin", "deception_admin", "lab_targets", "nodes:vultr_sync",
    "recon_write",
  ],
  security_admin: [
    "vpn:read", "peer:read", "audit:read", "audit:export", "incident:write", "ztna:posture",
    "counter_attack", "silkweb_exploit", "ghost_node_admin",
    "honeypot_admin", "deception_admin",
    "recon_write",
  ],
  network_admin: [
    "vpn:read", "vpn:write", "peer:read", "peer:write", "ztna:posture",
    "honeypot_admin",
    "recon_write",
  ],
  auditor: [
    "vpn:read", "peer:read", "audit:read", "audit:export",
  ],
  support: [
    "vpn:read", "peer:read", "ztna:posture",
  ],
  user: [
    "vpn:read", "ztna:posture",
  ],
};

/** Returns true if the given role has permission to perform the action. */
export function can(role: Role, action: Action): boolean {
  return GRANTS[role]?.includes(action) ?? false;
}

/**
 * Throws a 403 Forbidden error if the role does not have permission.
 * Use in route handlers: requirePermission(userRole, "audit:export")
 */
export function requirePermission(role: Role, action: Action): void {
  if (!can(role, action)) {
    const err = new Error(`Forbidden: role '${role}' cannot perform '${action}'`) as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }
}

/** All roles that can perform a given action — useful for UI display. */
export function rolesWithPermission(action: Action): Role[] {
  return (Object.keys(GRANTS) as Role[]).filter(r => can(r, action));
}

/** Parse a role string safely — falls back to "user" for unknown values. */
export function parseRole(raw: string | undefined): Role {
  const valid: Role[] = ["owner", "security_admin", "network_admin", "auditor", "support", "user"];
  return valid.includes(raw as Role) ? (raw as Role) : "user";
}
