// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Route Governance API — exposes the full route registry with metadata:
//   GET /api/governance/routes    — full route registry
//   GET /api/governance/health    — per-route health snapshot
//   GET /api/governance/tiers     — platform tier feature map
//   GET /api/governance/gateway   — gateway stats
// Audit recommendation: expand route governance metadata.

import { Router, type Request, type Response } from "express";
import { routeExposureReport } from "../lib/route-governance";
import { TIER_FEATURES, TIER_LABELS, TIER_COLORS, type Tier } from "../lib/platform-tiers";
import { getGatewayStats } from "../lib/api-gateway";
import { bus } from "../lib/service-bus";

const router = Router();

// Full route registry with extended metadata
interface RouteEntry {
  method:    string;
  path:      string;
  exposure:  string;
  tier:      Tier | "admin" | "public";
  auth:      boolean;
  rateLimit: string;
  tags:      string[];
  owner:     string;
  reason:    string;
}

const ROUTE_REGISTRY: RouteEntry[] = [
  // Public
  { method: "GET",  path: "/api/healthz",                  exposure: "public",         tier: "public",     auth: false, rateLimit: "unlimited", tags: ["health"],             owner: "platform",   reason: "health check" },
  { method: "GET",  path: "/api/my-ip",                    exposure: "public",         tier: "public",     auth: false, rateLimit: "300/min",   tags: ["network"],            owner: "platform",   reason: "client IP detection" },
  { method: "POST", path: "/api/stripe/webhook",           exposure: "public",         tier: "public",     auth: false, rateLimit: "60/min",    tags: ["billing"],            owner: "billing",    reason: "Stripe signed webhook" },
  { method: "POST", path: "/api/daemon-inbound",           exposure: "daemon_psk",     tier: "admin",      auth: false, rateLimit: "600/min",   tags: ["daemon"],             owner: "infra",      reason: "daemon PSK auth" },
  { method: "GET",  path: "/api/warrant-canary",           exposure: "public",         tier: "public",     auth: false, rateLimit: "60/min",    tags: ["transparency"],       owner: "legal",      reason: "transparency endpoint" },
  // Core tier
  { method: "*",    path: "/api/wireguard",                exposure: "authenticated",  tier: "core",       auth: true,  rateLimit: "60/min",    tags: ["vpn","wireguard"],    owner: "vpn",        reason: "WireGuard config management" },
  { method: "*",    path: "/api/killswitch",               exposure: "authenticated",  tier: "core",       auth: true,  rateLimit: "60/min",    tags: ["vpn","safety"],       owner: "vpn",        reason: "kill switch control" },
  { method: "*",    path: "/api/leaks",                    exposure: "authenticated",  tier: "core",       auth: true,  rateLimit: "30/min",    tags: ["vpn","security"],     owner: "vpn",        reason: "DNS/WebRTC leak detection" },
  { method: "*",    path: "/api/split-tunnel",             exposure: "authenticated",  tier: "core",       auth: true,  rateLimit: "60/min",    tags: ["vpn","routing"],      owner: "vpn",        reason: "split tunnel rules" },
  { method: "*",    path: "/api/dns-shield",               exposure: "authenticated",  tier: "core",       auth: true,  rateLimit: "60/min",    tags: ["dns","blocking"],     owner: "vpn",        reason: "DNS-level blocking" },
  { method: "*",    path: "/api/devices",                  exposure: "authenticated",  tier: "core",       auth: true,  rateLimit: "60/min",    tags: ["vpn","devices"],      owner: "vpn",        reason: "WireGuard device registry" },
  { method: "*",    path: "/api/obfuscation",              exposure: "authenticated",  tier: "core",       auth: true,  rateLimit: "30/min",    tags: ["vpn","privacy"],      owner: "vpn",        reason: "DPI obfuscation config" },
  { method: "*",    path: "/api/smart-dns",                exposure: "authenticated",  tier: "core",       auth: true,  rateLimit: "30/min",    tags: ["dns"],                owner: "vpn",        reason: "Smart DNS routing" },
  { method: "*",    path: "/api/router-config",            exposure: "authenticated",  tier: "core",       auth: true,  rateLimit: "30/min",    tags: ["vpn","config"],       owner: "vpn",        reason: "router firmware configs" },
  { method: "*",    path: "/api/vpn-coexist",              exposure: "authenticated",  tier: "core",       auth: true,  rateLimit: "30/min",    tags: ["vpn"],                owner: "vpn",        reason: "coexistence profiles" },
  { method: "*",    path: "/api/pqc",                      exposure: "authenticated",  tier: "core",       auth: true,  rateLimit: "30/min",    tags: ["vpn","crypto"],       owner: "vpn",        reason: "post-quantum encryption" },
  { method: "*",    path: "/api/daita",                    exposure: "authenticated",  tier: "core",       auth: true,  rateLimit: "30/min",    tags: ["vpn","privacy"],      owner: "vpn",        reason: "AI traffic analysis defense" },
  // Enterprise tier
  { method: "*",    path: "/api/firewall",                 exposure: "admin",          tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["firewall"],           owner: "security",   reason: "firewall suite" },
  { method: "*",    path: "/api/siem",                     exposure: "command_center", tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["siem"],               owner: "security",   reason: "SIEM aggregator" },
  { method: "*",    path: "/api/ztna",                     exposure: "authenticated",  tier: "enterprise", auth: true,  rateLimit: "120/min",   tags: ["ztna","zero-trust"],  owner: "security",   reason: "ZTNA posture checks" },
  { method: "*",    path: "/api/node-trust",               exposure: "admin",          tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["nodes","trust"],      owner: "infra",      reason: "node trust scoring" },
  { method: "*",    path: "/api/drift-monitor",            exposure: "command_center", tier: "enterprise", auth: true,  rateLimit: "30/min",    tags: ["governance","drift"], owner: "platform",   reason: "config drift detection + repair" },
  { method: "*",    path: "/api/dependency-map",           exposure: "command_center", tier: "enterprise", auth: true,  rateLimit: "30/min",    tags: ["governance","infra"], owner: "platform",   reason: "service dependency graph" },
  { method: "*",    path: "/api/governance",               exposure: "command_center", tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["governance"],         owner: "platform",   reason: "route governance metadata" },
  { method: "*",    path: "/api/events",                   exposure: "command_center", tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["events","graph"],     owner: "platform",   reason: "global event correlation" },
  { method: "*",    path: "/api/canary",                   exposure: "command_center", tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["deception"],          owner: "security",   reason: "canary tokens" },
  { method: "*",    path: "/api/ghost-trace",              exposure: "command_center", tier: "enterprise", auth: true,  rateLimit: "30/min",    tags: ["behavioral"],         owner: "security",   reason: "outbound behavioral analysis" },
  { method: "*",    path: "/api/attack-chain",             exposure: "command_center", tier: "enterprise", auth: true,  rateLimit: "30/min",    tags: ["killchain"],          owner: "security",   reason: "kill chain discovery" },
  { method: "*",    path: "/api/threat-protection",        exposure: "authenticated",  tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["threat"],             owner: "security",   reason: "threat protection suite" },
  { method: "*",    path: "/api/command-governance",       exposure: "command_center", tier: "enterprise", auth: true,  rateLimit: "60/min",    tags: ["governance"],         owner: "platform",   reason: "command risk governance" },
  // Labs tier
  { method: "*",    path: "/api/quantum-audit",            exposure: "command_center", tier: "labs",       auth: true,  rateLimit: "20/min",    tags: ["blockchain","labs"],  owner: "labs",       reason: "blockchain security scanning" },
  { method: "*",    path: "/api/omnistrike",               exposure: "command_center", tier: "labs",       auth: true,  rateLimit: "10/min",    tags: ["redteam","labs"],     owner: "labs",       reason: "multi-vector attack orchestration" },
  { method: "*",    path: "/api/redteam-scan",             exposure: "command_center", tier: "labs",       auth: true,  rateLimit: "10/min",    tags: ["redteam","labs"],     owner: "labs",       reason: "red team scanning" },
  { method: "*",    path: "/api/sast",                     exposure: "command_center", tier: "labs",       auth: true,  rateLimit: "20/min",    tags: ["code","labs"],        owner: "labs",       reason: "static analysis" },
  { method: "*",    path: "/api/sqli-scanner",             exposure: "command_center", tier: "labs",       auth: true,  rateLimit: "10/min",    tags: ["injection","labs"],   owner: "labs",       reason: "SQL injection scanner" },
  { method: "*",    path: "/api/waf-bypass",               exposure: "command_center", tier: "labs",       auth: true,  rateLimit: "10/min",    tags: ["waf","labs"],         owner: "labs",       reason: "WAF bypass testing" },
  // Admin
  { method: "*",    path: "/api/nodes",                    exposure: "admin",          tier: "admin",      auth: true,  rateLimit: "60/min",    tags: ["nodes","admin"],      owner: "infra",      reason: "node CRUD + lifecycle" },
  { method: "*",    path: "/api/terminal",                 exposure: "admin",          tier: "admin",      auth: true,  rateLimit: "20/min",    tags: ["terminal","admin"],   owner: "platform",   reason: "shell exec (allowlist)" },
  { method: "*",    path: "/api/sql",                      exposure: "admin",          tier: "admin",      auth: true,  rateLimit: "30/min",    tags: ["sql","admin"],        owner: "platform",   reason: "SQL interface" },
  { method: "*",    path: "/api/admin/users",              exposure: "admin",          tier: "admin",      auth: true,  rateLimit: "60/min",    tags: ["users","admin"],      owner: "platform",   reason: "user management" },
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
    status:       "ok",
    totalRoutes:  ROUTE_REGISTRY.length,
    byTier,
    byOwner,
    busStats,
    recentEventCount: recentEvents.length,
    checkedAt:    new Date().toISOString(),
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

export default router;
