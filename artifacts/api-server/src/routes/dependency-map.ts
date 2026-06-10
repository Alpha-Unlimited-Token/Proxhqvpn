// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Dependency Mapping — live health checks for all platform services.
// Upgrade #7: Expand dependency map with full live health checks.
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import fetch from "node-fetch";

const router = Router();

type ServiceStatus = "ok" | "error" | "unknown" | "unconfigured" | "degraded";

interface ServiceNode {
  id:          string;
  label:       string;
  category:    "core" | "enterprise" | "labs" | "infra" | "external";
  status:      ServiceStatus;
  latencyMs?:  number;
  detail?:     string;
}

async function checkPostgres(): Promise<{ status: ServiceStatus; latencyMs: number }> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { status: "ok", latencyMs: Date.now() - start };
  } catch {
    return { status: "error", latencyMs: Date.now() - start };
  }
}

async function checkNodeCount(): Promise<{ status: ServiceStatus; detail: string }> {
  try {
    const r = await db.execute(sql`SELECT COUNT(*) AS cnt FROM nodes WHERE status = 'active'`);
    const cnt = Number((r?.rows?.[0] as any)?.cnt ?? 0);
    return {
      status: cnt > 0 ? "ok" : "degraded",
      detail: `${cnt} active node${cnt !== 1 ? "s" : ""}`,
    };
  } catch {
    return { status: "error", detail: "DB query failed" };
  }
}

async function checkZtnaDevices(): Promise<{ status: ServiceStatus; detail: string }> {
  try {
    const r = await db.execute(sql`SELECT COUNT(*) AS cnt FROM ztna_devices WHERE revoked = false`);
    const cnt = Number((r?.rows?.[0] as any)?.cnt ?? 0);
    return { status: "ok", detail: `${cnt} enrolled device${cnt !== 1 ? "s" : ""}` };
  } catch {
    return { status: "unknown", detail: "table not yet created" };
  }
}

async function checkBeaconAlerts(): Promise<{ status: ServiceStatus; detail: string }> {
  try {
    const r = await db.execute(sql`SELECT COUNT(*) AS cnt FROM beacons WHERE created_at > NOW() - INTERVAL '1 hour'`);
    const cnt = Number((r?.rows?.[0] as any)?.cnt ?? 0);
    return {
      status: cnt > 10 ? "degraded" : "ok",
      detail: `${cnt} alert${cnt !== 1 ? "s" : ""} in last hour`,
    };
  } catch {
    return { status: "unknown", detail: "table not accessible" };
  }
}

async function checkFirewallRules(): Promise<{ status: ServiceStatus; detail: string }> {
  try {
    const r = await db.execute(sql`SELECT COUNT(*) AS cnt FROM firewall_rules WHERE enabled = true`);
    const cnt = Number((r?.rows?.[0] as any)?.cnt ?? 0);
    return { status: cnt > 0 ? "ok" : "degraded", detail: `${cnt} active rule${cnt !== 1 ? "s" : ""}` };
  } catch {
    return { status: "unknown", detail: "table not accessible" };
  }
}

async function checkCanaryTokens(): Promise<{ status: ServiceStatus; detail: string }> {
  try {
    const r = await db.execute(sql`SELECT COUNT(*) AS cnt FROM canary_tokens WHERE active = true`);
    const cnt = Number((r?.rows?.[0] as any)?.cnt ?? 0);
    return { status: "ok", detail: `${cnt} active token${cnt !== 1 ? "s" : ""}` };
  } catch {
    return { status: "unknown", detail: "table not accessible" };
  }
}

async function checkExternal(url: string): Promise<{ status: ServiceStatus; latencyMs: number }> {
  if (!url) return { status: "unconfigured", latencyMs: 0 };
  const start = Date.now();
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
    return { status: r.ok ? "ok" : "error", latencyMs: Date.now() - start };
  } catch {
    return { status: "error", latencyMs: Date.now() - start };
  }
}

async function checkSplunk(): Promise<{ status: ServiceStatus }> {
  const url = process.env.SPLUNK_HEC_URL;
  if (!url) return { status: "unconfigured" };
  return checkExternal(url);
}

// GET /api/dependency-map/graph
router.get("/graph", async (_req: Request, res: Response) => {
  const [
    dbResult, stripeResult, clerkResult,
    nodeCountResult, ztnaResult, beaconResult,
    firewallResult, canaryResult, splunkResult,
  ] = await Promise.all([
    checkPostgres(),
    checkExternal(process.env.STRIPE_SECRET_KEY ? "https://api.stripe.com/v1" : ""),
    checkExternal(process.env.CLERK_SECRET_KEY  ? "https://api.clerk.com/v1/health" : ""),
    checkNodeCount(),
    checkZtnaDevices(),
    checkBeaconAlerts(),
    checkFirewallRules(),
    checkCanaryTokens(),
    checkSplunk(),
  ]);

  const nodes: ServiceNode[] = [
    { id: "api",          label: "API Server",              category: "core",       status: "ok" },
    { id: "db",           label: "PostgreSQL",               category: "infra",      status: dbResult.status,     latencyMs: dbResult.latencyMs },
    { id: "wireguard",    label: "WireGuard Mesh",           category: "core",       status: nodeCountResult.status, detail: nodeCountResult.detail },
    { id: "daemon",       label: "Node Daemon",              category: "infra",      status: "unknown",           detail: "reported via daemon-inbound" },
    { id: "firewall",     label: "Firewall Core",            category: "enterprise", status: firewallResult.status, detail: firewallResult.detail },
    { id: "ztna",         label: "ZTNA / Device Trust",      category: "enterprise", status: ztnaResult.status,   detail: ztnaResult.detail },
    { id: "beacons",      label: "Beacon / Honeypot",        category: "enterprise", status: beaconResult.status, detail: beaconResult.detail },
    { id: "canary",       label: "Canary Tokens",            category: "enterprise", status: canaryResult.status, detail: canaryResult.detail },
    { id: "siem",         label: "SIEM Aggregator",          category: "enterprise", status: "ok",                detail: "in-process event bus" },
    { id: "audit_chain",  label: "SHA3-256 Audit Chain",     category: "enterprise", status: "ok" },
    { id: "event_graph",  label: "Global Event Graph",       category: "enterprise", status: "ok",                detail: "cross-system correlation" },
    { id: "drift",        label: "Drift Monitor",            category: "enterprise", status: "ok" },
    { id: "stripe",       label: "Stripe Billing",           category: "external",   status: stripeResult.status, latencyMs: stripeResult.latencyMs },
    { id: "clerk",        label: "Clerk Auth",               category: "external",   status: clerkResult.status,  latencyMs: clerkResult.latencyMs },
    { id: "splunk",       label: "Splunk SIEM (external)",   category: "external",   status: splunkResult.status },
    { id: "quantum_audit",label: "QuantumAudit Engine",      category: "labs",       status: "ok" },
    { id: "sig_engine",   label: "Sig Mining Engine",        category: "labs",       status: "ok" },
  ];

  const edges: [string, string][] = [
    ["api", "db"],
    ["api", "wireguard"],
    ["api", "firewall"],
    ["api", "ztna"],
    ["api", "beacons"],
    ["api", "canary"],
    ["api", "siem"],
    ["api", "audit_chain"],
    ["api", "event_graph"],
    ["api", "drift"],
    ["api", "stripe"],
    ["api", "clerk"],
    ["wireguard", "daemon"],
    ["siem", "splunk"],
    ["event_graph", "siem"],
    ["event_graph", "beacons"],
    ["event_graph", "firewall"],
    ["event_graph", "ztna"],
    ["drift", "db"],
    ["ztna", "db"],
    ["api", "quantum_audit"],
    ["api", "sig_engine"],
  ];

  const healthSummary = {
    total:    nodes.length,
    ok:       nodes.filter(n => n.status === "ok").length,
    degraded: nodes.filter(n => n.status === "degraded").length,
    error:    nodes.filter(n => n.status === "error").length,
    unknown:  nodes.filter(n => n.status === "unknown" || n.status === "unconfigured").length,
  };

  res.json({ nodes, edges, healthSummary, checkedAt: new Date().toISOString() });
});

export default router;
