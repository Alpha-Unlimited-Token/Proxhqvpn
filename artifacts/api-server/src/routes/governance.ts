// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Route Governance API — exposes the full route registry with metadata:
//   GET /api/governance/routes          — full route registry
//   GET /api/governance/health          — per-route health snapshot
//   GET /api/governance/tiers          — platform tier feature map
//   GET /api/governance/gateway        — gateway stats
//   GET /api/governance/risk-matrix    — route distribution by risk level
//   GET /api/governance/approval-gates — routes that require explicit approval

import { Router, type Request, type Response } from "express";
import { routeExposureReport } from "../lib/route-governance";
import { TIER_FEATURES, TIER_LABELS, TIER_COLORS, type Tier } from "../lib/platform-tiers";
import { getGatewayStats } from "../lib/api-gateway";
import { bus } from "../lib/service-bus";

const router = Router();

export type RiskLevel = "low" | "medium" | "high" | "critical";

interface RouteEntry {
  method:          string;
  path:            string;
  exposure:        string;
  tier:            Tier | "admin" | "public";
  auth:            boolean;
  rateLimit:       string;
  tags:            string[];
  owner:           string;
  reason:          string;
  risk:            RiskLevel;
  approvalRequired: boolean;
  tenantAware:     boolean;
}

const ROUTE_REGISTRY: RouteEntry[] = [
  // ── Public ────────────────────────────────────────────────────────────────
  { method: "GET",  path: "/api/healthz",            exposure: "public",       tier: "public",     auth: false, rateLimit: "unlimited", tags: ["health"],             owner: "platform",  reason: "health check",                         risk: "low",      approvalRequired: false, tenantAware: false },
  { method: "GET",  path: "/api/my-ip",              exposure: "public",       tier: "public",     auth: false, rateLimit: "300/min",   tags: ["network"],            owner: "platform",  reason: "client IP detection",                  risk: "low",      approvalRequired: false, tenantAware: false },
  { method: "POST", path: "/api/stripe/webhook",     exposure: "public",       tier: "public",     auth: false, rateLimit: "60/min",    tags: ["billing"],            owner: "billing",   reason: "Stripe signed webhook",                risk: "medium",   approvalRequired: false, tenantAware: false },
  { method: "POST", path: "/api/daemon-inbound",     exposure: "daemon_psk",   tier: "admin",      auth: false, rateLimit: "600/min",   tags: ["daemon"],             owner: "infra",     reason: "daemon PSK auth",                      risk: "medium",   approvalRequired: false, tenantAware: false },
  { method: "GET",  path: "/api/warrant-canary",     exposure: "public",       tier: "public",     auth: false, rateLimit: "60/min",    tags: ["transparency"],       owner: "legal",     reason: "transparency endpoint",                risk: "low",      approvalRequired: false, tenantAware: false },

  // ── Core tier ──────────────────────────────────────────────────────────────
  { method: "*",    path: "/api/wireguard",          exposure: "authenticated", tier: "core",       auth: true,  rateLimit: "60/min",    tags: ["vpn","wireguard"],    owner: "vpn",       reason: "WireGuard config management",          risk: "medium",   approvalRequired: false, tenantAware: true  },
  { method: "*",    path: "/api/killswitch",         exposure: "authenticated", tier: "core",       auth: true,  rateLimit: "60/min",    tags: ["vpn","safety"],       owner: "vpn",       reason: "kill switch control",                  risk: "high",     approvalRequired: true,  tenantAware: true  },
  { method: "*",    path: "/api/leaks",              exposure: "authenticated", tier: "core",       auth: true,  rateLimit: "30/min",    tags: ["vpn","security"],     owner: "vpn",       reason: "DNS/WebRTC leak detection",            risk: "low",      approvalRequired: false, tenantAware: true  },
  { method: "*",    path: "/api/split-tunnel",       exposure: "authenticated", tier: "core",       auth: true,  rateLimit: "60/min",    tags: ["vpn","routing"],      owner: "vpn",       reason: "split tunnel rules",                   risk: "medium",   approvalRequired: false, tenantAware: true  },
  { method: "*",    path: "/api/dns-shield",         exposure: "authenticated", tier: "core",       auth: true,  rateLimit: "60/min",    tags: ["dns","blocking"],     owner: "vpn",       reason: "DNS-level blocking",                   risk: "medium",   approvalRequired: false, tenantAware: true  },
  { method: "*",    path: "/api/devices",            exposure: "authenticated", tier: "core",       auth: true,  rateLimit: "60/min",    tags: ["vpn","devices"],      owner: "vpn",       reason: "WireGuard device registry",            risk: "medium",   approvalRequired: false, tenantAware: true  },
  { method: "*",    path: "/api/obfuscation",        exposure: "authenticated", tier: "core",       auth: true,  rateLimit: "30/min",    tags: ["vpn","privacy"],      owner: "vpn",       reason: "DPI obfuscation config",               risk: "low",      approvalRequired: false, tenantAware: true  },
  { method: "*",    path: "/api/smart-dns",          exposure: "authenticated", tier: "core",       auth: true,  rateLimit: "30/min",    tags: ["dns"],                owner: "vpn",       reason: "Smart DNS routing",                    risk: "low",      approvalRequired: false, tenantAware: true  },
  { method: "*",    path: "/api/router-config",      exposure: "authenticated", tier: "core",       auth: true,  rateLimit: "30/min",    tags: ["vpn","config"],       owner: "vpn",       reason: "router firmware configs",              risk: "low",      approvalRequired: false, tenantAware: true  },
  { method: "*",    path: "/api/vpn-coexist",        exposure: "authenticated", tier: "core",       auth: true,  rateLimit: "30/min",    tags: ["vpn"],                owner: "vpn",       reason: "coexistence profiles",                 risk: "low",      approvalRequired: false, tenantAware: true  },
  { method: "*",    path: "/api/pqc",                exposure: "authenticated", tier: "core",       auth: true,  rateLimit: "30/min",    tags: ["vpn","crypto"],       owner: "vpn",       reason: "post-quantum encryption",              risk: "low",      approvalRequired: false, tenantAware: true  },
  { method: "*",    path: "/api/daita",              exposure: "authenticated", tier: "core",       auth: true,  rateLimit: "30/min",    tags: ["vpn","privacy"],      owner: "vpn",       reason: "AI traffic analysis defense",          risk: "low",      approvalRequired: false, tenantAware: true  },

  // ── Enterprise tier ────────────────────────────────────────────────────────
  { method: "*",    path: "/api/firewall",           exposure: "admin",         tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["firewall"],           owner: "security",  reason: "firewall suite",                       risk: "high",     approvalRequired: true,  tenantAware: false },
  { method: "*",    path: "/api/fw",                 exposure: "command_center",tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["firewall","advanced"],owner: "security",  reason: "advanced firewall (aliases/NAT/QoS)",  risk: "high",     approvalRequired: true,  tenantAware: false },
  { method: "*",    path: "/api/fwn",                exposure: "command_center",tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["firewall","ebpf"],    owner: "security",  reason: "next-gen firewall (eBPF/QUIC/ETA)",    risk: "high",     approvalRequired: true,  tenantAware: false },
  { method: "*",    path: "/api/fwm",                exposure: "command_center",tier: "enterprise", auth: true,  rateLimit: "30/min",    tags: ["firewall","military"],owner: "security",  reason: "military-grade firewall (SELinux/MLS)", risk: "critical", approvalRequired: true,  tenantAware: false },
  { method: "*",    path: "/api/siem",               exposure: "command_center",tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["siem"],               owner: "security",  reason: "SIEM aggregator",                      risk: "medium",   approvalRequired: false, tenantAware: false },
  { method: "*",    path: "/api/ztna",               exposure: "authenticated", tier: "enterprise", auth: true,  rateLimit: "120/min",   tags: ["ztna","zero-trust"],  owner: "security",  reason: "ZTNA posture checks",                  risk: "high",     approvalRequired: false, tenantAware: true  },
  { method: "*",    path: "/api/node-trust",         exposure: "admin",         tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["nodes","trust"],      owner: "infra",     reason: "node trust scoring",                   risk: "high",     approvalRequired: true,  tenantAware: false },
  { method: "*",    path: "/api/drift-monitor",      exposure: "command_center",tier: "enterprise", auth: true,  rateLimit: "30/min",    tags: ["governance","drift"], owner: "platform",  reason: "config drift detection + repair",      risk: "medium",   approvalRequired: false, tenantAware: false },
  { method: "*",    path: "/api/dependency-map",     exposure: "command_center",tier: "enterprise", auth: true,  rateLimit: "30/min",    tags: ["governance","infra"], owner: "platform",  reason: "service dependency graph",             risk: "low",      approvalRequired: false, tenantAware: false },
  { method: "*",    path: "/api/governance",         exposure: "command_center",tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["governance"],         owner: "platform",  reason: "route governance metadata",            risk: "low",      approvalRequired: false, tenantAware: false },
  { method: "*",    path: "/api/events",             exposure: "command_center",tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["events","graph"],     owner: "platform",  reason: "global event correlation",             risk: "low",      approvalRequired: false, tenantAware: false },
  { method: "*",    path: "/api/canary",             exposure: "command_center",tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["deception"],          owner: "security",  reason: "canary tokens",                        risk: "medium",   approvalRequired: false, tenantAware: true  },
  { method: "*",    path: "/api/ghost-trace",        exposure: "command_center",tier: "enterprise", auth: true,  rateLimit: "30/min",    tags: ["behavioral"],         owner: "security",  reason: "outbound behavioral analysis",         risk: "medium",   approvalRequired: false, tenantAware: false },
  { method: "*",    path: "/api/attack-chain",       exposure: "command_center",tier: "enterprise", auth: true,  rateLimit: "30/min",    tags: ["killchain"],          owner: "security",  reason: "kill chain discovery",                 risk: "high",     approvalRequired: true,  tenantAware: false },
  { method: "*",    path: "/api/threat-protection",  exposure: "authenticated", tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["threat"],             owner: "security",  reason: "threat protection suite",              risk: "medium",   approvalRequired: false, tenantAware: false },
  { method: "*",    path: "/api/command-governance", exposure: "command_center",tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["governance"],         owner: "platform",  reason: "command risk governance",              risk: "medium",   approvalRequired: false, tenantAware: false },

  // ── Labs tier — offensive tooling ─────────────────────────────────────────
  { method: "*",    path: "/api/quantum-audit",      exposure: "command_center",tier: "labs",       auth: true,  rateLimit: "20/min",    tags: ["blockchain","labs"],  owner: "labs",      reason: "blockchain security scanning",         risk: "high",     approvalRequired: true,  tenantAware: false },
  { method: "*",    path: "/api/sast",               exposure: "command_center",tier: "labs",       auth: true,  rateLimit: "20/min",    tags: ["code","labs"],        owner: "labs",      reason: "static analysis",                      risk: "medium",   approvalRequired: false, tenantAware: false },

  // ── Admin tier ────────────────────────────────────────────────────────────
  { method: "*",    path: "/api/nodes",              exposure: "admin",         tier: "admin",      auth: true,  rateLimit: "60/min",    tags: ["nodes","admin"],      owner: "infra",     reason: "node CRUD + lifecycle",               risk: "high",     approvalRequired: true,  tenantAware: false },
  { method: "*",    path: "/api/terminal",           exposure: "admin",         tier: "admin",      auth: true,  rateLimit: "20/min",    tags: ["terminal","admin"],   owner: "platform",  reason: "shell exec (allowlist)",               risk: "critical", approvalRequired: true,  tenantAware: false },
  { method: "*",    path: "/api/sql",                exposure: "admin",         tier: "admin",      auth: true,  rateLimit: "30/min",    tags: ["sql","admin"],        owner: "platform",  reason: "SQL interface",                        risk: "high",     approvalRequired: true,  tenantAware: false },
  { method: "*",    path: "/api/admin/users",        exposure: "admin",         tier: "admin",      auth: true,  rateLimit: "60/min",    tags: ["users","admin"],      owner: "platform",  reason: "user management",                     risk: "high",     approvalRequired: true,  tenantAware: false },
];

// GET /api/governance/routes
router.get("/routes", (_req: Request, res: Response) => {
  const exposureRules = routeExposureReport();
  res.json({
    total: ROUTE_REGISTRY.length,
    routes: ROUTE_REGISTRY,
    exposureRules,
    generatedAt: new Date().toISOString(),
  });
});

// GET /api/governance/health
router.get("/health", (_req: Request, res: Response) => {
  const busStats = bus.getStats();
  const recentEvents = bus.getRecent(20);

  const byTier = ROUTE_REGISTRY.reduce<Record<string, number>>((acc, r) => {
    acc[r.tier] = (acc[r.tier] ?? 0) + 1;
    return acc;
  }, {});

  const byOwner = ROUTE_REGISTRY.reduce<Record<string, number>>((acc, r) => {
    acc[r.owner] = (acc[r.owner] ?? 0) + 1;
    return acc;
  }, {});

  res.json({
    status:          "ok",
    totalRoutes:     ROUTE_REGISTRY.length,
    byTier,
    byOwner,
    busStats,
    recentEventCount: recentEvents.length,
    checkedAt:       new Date().toISOString(),
  });
});

// GET /api/governance/tiers
router.get("/tiers", (_req: Request, res: Response) => {
  const tiers = Object.keys(TIER_FEATURES) as Tier[];
  res.json({
    tiers: tiers.map(t => ({
      id:           t,
      label:        TIER_LABELS[t],
      color:        TIER_COLORS[t],
      featureCount: TIER_FEATURES[t].length,
      features:     TIER_FEATURES[t],
    })),
  });
});

// GET /api/governance/gateway
router.get("/gateway", (_req: Request, res: Response) => {
  res.json({
    ...getGatewayStats(),
    routeCount:  ROUTE_REGISTRY.length,
    busChannels: bus.getStats(),
    timestamp:   new Date().toISOString(),
  });
});

// GET /api/governance/risk-matrix
router.get("/risk-matrix", (_req: Request, res: Response) => {
  const levels: RiskLevel[] = ["low", "medium", "high", "critical"];
  const matrix = levels.map(level => {
    const routes = ROUTE_REGISTRY.filter(r => r.risk === level);
    return {
      level,
      count: routes.length,
      approvalRequired: routes.filter(r => r.approvalRequired).length,
      tenantAware:      routes.filter(r => r.tenantAware).length,
      owners:           [...new Set(routes.map(r => r.owner))],
      routes:           routes.map(r => ({ path: r.path, method: r.method, owner: r.owner, approvalRequired: r.approvalRequired })),
    };
  });

  const totalApprovalGated = ROUTE_REGISTRY.filter(r => r.approvalRequired).length;
  const totalTenantScoped  = ROUTE_REGISTRY.filter(r => r.tenantAware).length;

  res.json({
    total:              ROUTE_REGISTRY.length,
    totalApprovalGated,
    totalTenantScoped,
    matrix,
    generatedAt:        new Date().toISOString(),
  });
});

// GET /api/governance/approval-gates
router.get("/approval-gates", (_req: Request, res: Response) => {
  const gated = ROUTE_REGISTRY.filter(r => r.approvalRequired);

  const byOwner = gated.reduce<Record<string, typeof gated>>((acc, r) => {
    (acc[r.owner] ??= []).push(r);
    return acc;
  }, {});

  const byRisk = gated.reduce<Record<RiskLevel, typeof gated>>((acc, r) => {
    (acc[r.risk] ??= []).push(r);
    return acc;
  }, {} as Record<RiskLevel, typeof gated>);

  res.json({
    totalGated: gated.length,
    routes:     gated.map(r => ({
      path:            r.path,
      method:          r.method,
      risk:            r.risk,
      owner:           r.owner,
      tier:            r.tier,
      reason:          r.reason,
      tenantAware:     r.tenantAware,
    })),
    byOwner:  Object.fromEntries(Object.entries(byOwner).map(([k, v]) => [k, v.length])),
    byRisk:   Object.fromEntries(Object.entries(byRisk).map(([k, v]) => [k, v.length])),
    generatedAt: new Date().toISOString(),
  });
});

export { ROUTE_REGISTRY };
export type { RouteEntry };
export default router;
