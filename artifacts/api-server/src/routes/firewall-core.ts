// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Firewall Core — unified overview API for the consolidated Firewall Core dashboard
//   GET /api/firewall-core/overview      — aggregate stats (rules, IPs, events, traffic)
//   GET /api/firewall-core/top-blocked   — top blocked IPs
//   GET /api/firewall-core/recent-events — recent firewall security events
//   GET /api/firewall-core/subsystems    — status of each firewall subsystem
//   GET /api/firewall-core/manifest      — full capability manifest (all 5 subsystems)

import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getFirewallManifest, getFirewallCapabilityCount, getFirewallTableCount } from "../lib/firewall-surface";

const router = Router();

async function safeQuery(query: any, fallback: any) {
  try { const r = await db.execute(query); return r.rows ?? fallback; }
  catch { return fallback; }
}

router.get("/overview", async (_req: Request, res: Response) => {
  const [rules, blocked, events, traffic] = await Promise.all([
    safeQuery(sql`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE enabled = true) AS active
      FROM firewall_rules
    `, [{ total: 0, active: 0 }]),

    safeQuery(sql`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE permanent = true)  AS permanent,
             COUNT(*) FILTER (WHERE expires_at < NOW()) AS expired
      FROM firewall_blacklist
    `, [{ total: 0, permanent: 0, expired: 0 }]),

    safeQuery(sql`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE severity IN ('high','critical')) AS high_count,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS last1h
      FROM firewall_security_events
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `, [{ total: 0, high_count: 0, last1h: 0 }]),

    safeQuery(sql`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE action = 'block') AS blocked_count,
             COUNT(*) FILTER (WHERE action = 'allow') AS allowed_count
      FROM firewall_traffic_decisions
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `, [{ total: 0, blocked_count: 0, allowed_count: 0 }]),
  ]);

  const r = rules[0] ?? {};
  const b = blocked[0] ?? {};
  const e = events[0] ?? {};
  const t = traffic[0] ?? {};

  const blockRatePct = Number(t.total) > 0
    ? Math.round((Number(t.blocked_count) / Number(t.total)) * 100)
    : 0;

  res.json({
    rules:       { total: Number(r.total ?? 0), active: Number(r.active ?? 0) },
    blockedIps:  { total: Number(b.total ?? 0), permanent: Number(b.permanent ?? 0), expired: Number(b.expired ?? 0) },
    events24h:   { total: Number(e.total ?? 0), high: Number(e.high_count ?? 0), last1h: Number(e.last1h ?? 0) },
    traffic1h:   { total: Number(t.total ?? 0), blocked: Number(t.blocked_count ?? 0), allowed: Number(t.allowed_count ?? 0), blockRatePct },
    timestamp:   new Date().toISOString(),
  });
});

router.get("/top-blocked", async (_req: Request, res: Response) => {
  const rows = await safeQuery(sql`
    SELECT ip, reason, created_at, expires_at, permanent
    FROM firewall_blacklist
    ORDER BY created_at DESC
    LIMIT 15
  `, []);
  res.json({ items: rows });
});

router.get("/recent-events", async (_req: Request, res: Response) => {
  const rows = await safeQuery(sql`
    SELECT event_type, severity, source_ip, description, created_at
    FROM firewall_security_events
    ORDER BY created_at DESC
    LIMIT 25
  `, []);
  res.json({ events: rows });
});

router.get("/subsystems", async (_req: Request, res: Response) => {
  const [ruleCount, blacklistCount, policyCount] = await Promise.all([
    safeQuery(sql`SELECT COUNT(*) AS n FROM firewall_rules WHERE enabled = true`, [{ n: 0 }]),
    safeQuery(sql`SELECT COUNT(*) AS n FROM firewall_blacklist WHERE (expires_at IS NULL OR expires_at > NOW())`, [{ n: 0 }]),
    safeQuery(sql`SELECT COUNT(*) AS n FROM firewall_policy_versions WHERE status = 'active'`, [{ n: 0 }]),
  ]);

  res.json({
    subsystems: [
      { name: "Rule Engine",        status: Number(ruleCount[0]?.n ?? 0) > 0 ? "active" : "idle",    count: Number(ruleCount[0]?.n ?? 0),      path: "/firewall" },
      { name: "IP Blacklist",       status: Number(blacklistCount[0]?.n ?? 0) > 0 ? "active" : "idle", count: Number(blacklistCount[0]?.n ?? 0),  path: "/firewall" },
      { name: "Policy Compiler",    status: Number(policyCount[0]?.n ?? 0) > 0 ? "active" : "idle",   count: Number(policyCount[0]?.n ?? 0),     path: "/firewall-compiler" },
      { name: "Drift Monitor",      status: "active",   count: null,  path: "/drift-monitor" },
      { name: "Event Correlator",   status: "active",   count: null,  path: "/event-graph" },
      { name: "DNS Sinkhole",       status: "active",   count: null,  path: "/dns-sinkhole" },
      { name: "Threat Intelligence",status: "active",   count: null,  path: "/threat-intel" },
      { name: "ZTNA Posture",       status: "active",   count: null,  path: "/device-trust" },
    ],
    timestamp: new Date().toISOString(),
  });
});

// GET /api/firewall-core/manifest — full subsystem capability manifest
router.get("/manifest", async (_req: Request, res: Response) => {
  const manifest = getFirewallManifest();

  const [ruleCounts] = await Promise.all([
    Promise.all(manifest.subsystems.map(async (sub) => {
      const table = sub.tableGroups[0];
      const row = await safeQuery(
        sql.raw(`SELECT COUNT(*) AS n FROM ${table} LIMIT 1`),
        [{ n: 0 }]
      );
      return { id: sub.id, liveRows: Number(row[0]?.n ?? 0) };
    })),
  ]);

  const subsystemsWithLiveData = manifest.subsystems.map((sub) => {
    const live = ruleCounts.find(r => r.id === sub.id);
    return {
      ...sub,
      liveRows: live?.liveRows ?? 0,
    };
  });

  res.json({
    version:            manifest.version,
    totalSubsystems:    manifest.subsystems.length,
    totalCapabilities:  getFirewallCapabilityCount(),
    totalTables:        getFirewallTableCount(),
    subsystems:         subsystemsWithLiveData,
    generatedAt:        manifest.generatedAt,
  });
});

export default router;
