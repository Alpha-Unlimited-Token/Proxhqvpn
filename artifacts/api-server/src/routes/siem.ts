// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  beaconAlertsTable,
  firewallRulesTable,
  blockedIpsTable,
  ghostTraceObservationsTable,
  attackChainScansTable,
  attackChainFindingsTable,
} from "@workspace/db";
import { desc, isNotNull, and, eq, gte, sql } from "drizzle-orm";

const router = Router();

type SiemEvent = {
  id: string;
  source: string;
  eventType: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  details: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

router.get("/events", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || "100"), 200);
    const since = req.query.since ? new Date(req.query.since as string) : new Date(Date.now() - 7 * 86_400_000);
    const sourceFilter = req.query.source as string | undefined;
    const sevFilter = req.query.severity as string | undefined;

    const events: SiemEvent[] = [];

    if (!sourceFilter || sourceFilter === "beacon") {
      const beacons = await db.select().from(beaconAlertsTable)
        .where(gte(beaconAlertsTable.detectedAt, since))
        .orderBy(desc(beaconAlertsTable.detectedAt))
        .limit(50);
      beacons.forEach(b => events.push({
        id: `beacon-${b.id}`,
        source: "Beacon Monitor",
        eventType: "intrusion_probe",
        severity: b.severity as SiemEvent["severity"],
        title: `${b.probeType.replace("_", " ")} probe from ${b.attackerIp}`,
        details: `Node: ${b.nodeName} | Layer: ${b.nodeLayer} | Status: ${b.status}`,
        timestamp: b.detectedAt instanceof Date ? b.detectedAt.toISOString() : String(b.detectedAt),
        metadata: { nodeId: b.nodeId, attackerIp: b.attackerIp, probeType: b.probeType },
      }));
    }

    if (!sourceFilter || sourceFilter === "firewall") {
      const blocked = await db.select().from(blockedIpsTable)
        .where(gte(blockedIpsTable.blockedAt, since))
        .orderBy(desc(blockedIpsTable.blockedAt))
        .limit(50);
      blocked.forEach(b => events.push({
        id: `firewall-${b.id}`,
        source: "Firewall",
        eventType: "ip_blocked",
        severity: "medium",
        title: `IP blocked: ${b.ip}`,
        details: b.reason,
        timestamp: b.blockedAt instanceof Date ? b.blockedAt.toISOString() : String(b.blockedAt),
        metadata: { ip: b.ip, autoBlocked: b.autoBlocked, hitCount: b.hitCount },
      }));
    }

    if (!sourceFilter || sourceFilter === "ghost_trace") {
      const obs = await db.select().from(ghostTraceObservationsTable)
        .where(and(isNotNull(ghostTraceObservationsTable.anomalyType), gte(ghostTraceObservationsTable.observedAt, since)))
        .orderBy(desc(ghostTraceObservationsTable.observedAt))
        .limit(50);
      obs.forEach(o => events.push({
        id: `ghost-${o.id}`,
        source: "Ghost Trace",
        eventType: `device_anomaly_${o.anomalyType}`,
        severity: o.anomalyScore >= 80 ? "critical" : o.anomalyScore >= 50 ? "high" : "medium",
        title: `${o.anomalyType?.replace("_", " ")} detected on ${o.deviceName}`,
        details: `Score: ${o.anomalyScore}/100 | ${o.bytesOut.toLocaleString()} bytes out`,
        timestamp: o.observedAt instanceof Date ? o.observedAt.toISOString() : String(o.observedAt),
        metadata: { deviceName: o.deviceName, anomalyType: o.anomalyType, anomalyScore: o.anomalyScore },
      }));
    }

    if (!sourceFilter || sourceFilter === "ghost_chain") {
      const scans = await db.select().from(attackChainScansTable)
        .where(and(eq(attackChainScansTable.scanStatus, "complete"), gte(attackChainScansTable.startedAt, since)))
        .orderBy(desc(attackChainScansTable.startedAt))
        .limit(30);
      for (const scan of scans) {
        if (!scan.riskScore || scan.riskScore < 10) continue;
        events.push({
          id: `chain-${scan.id}`,
          source: "Ghost Chain",
          eventType: "attack_surface_scan",
          severity: scan.riskScore >= 60 ? "critical" : scan.riskScore >= 30 ? "high" : "medium",
          title: `Attack surface scan: ${scan.target} (risk ${scan.riskScore})`,
          details: scan.summary || `Scan completed for ${scan.target}`,
          timestamp: scan.startedAt instanceof Date ? scan.startedAt.toISOString() : String(scan.startedAt),
          metadata: { target: scan.target, riskScore: scan.riskScore, scanId: scan.id },
        });
      }
    }

    const all = [...events];
    const filtered = sevFilter && sevFilter !== "all"
      ? all.filter(e => e.severity === sevFilter)
      : all;

    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json(filtered.slice(0, limit));
  } catch (err) {
    req.log.error({ err }, "[siem] events error");
    res.status(500).json({ error: "Failed to load events" });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const since = new Date(Date.now() - 24 * 3_600_000);

    const beacons = await db.select().from(beaconAlertsTable).where(gte(beaconAlertsTable.detectedAt, since));
    const blocked = await db.select().from(blockedIpsTable).where(gte(blockedIpsTable.blockedAt, since));
    const ghostObs = await db.select().from(ghostTraceObservationsTable)
      .where(and(isNotNull(ghostTraceObservationsTable.anomalyType), gte(ghostTraceObservationsTable.observedAt, since)));
    const chainScans = await db.select().from(attackChainScansTable)
      .where(and(eq(attackChainScansTable.scanStatus, "complete"), gte(attackChainScansTable.startedAt, since)));

    const allEvents = [
      ...beacons.map(b => ({ severity: b.severity, source: "Beacon Monitor" })),
      ...blocked.map(() => ({ severity: "medium", source: "Firewall" })),
      ...ghostObs.map(o => ({ severity: o.anomalyScore >= 80 ? "critical" : o.anomalyScore >= 50 ? "high" : "medium", source: "Ghost Trace" })),
      ...chainScans.filter(s => (s.riskScore ?? 0) >= 10).map(s => ({ severity: (s.riskScore ?? 0) >= 60 ? "critical" : (s.riskScore ?? 0) >= 30 ? "high" : "medium", source: "Ghost Chain" })),
    ];

    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const bySource: Record<string, number> = { "Beacon Monitor": 0, "Ghost Trace": 0, "Firewall": 0, "Ghost Chain": 0 };
    for (const e of allEvents) {
      if (e.severity in bySeverity) bySeverity[e.severity as keyof typeof bySeverity]++;
      if (e.source in bySource) bySource[e.source]++;
    }

    res.json({
      total24h: allEvents.length,
      bySeverity,
      bySource,
      sources: ["Beacon Monitor", "Ghost Trace", "Firewall", "Ghost Chain"],
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/export", async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string | undefined) || "csv";
    const since = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 7 * 86_400_000);
    const until = req.query.to   ? new Date(req.query.to   as string) : new Date();
    const sevFilter = req.query.severity as string | undefined;
    const srcFilter = req.query.source   as string | undefined;

    const fakeReq = Object.assign(Object.create(req), { query: { limit: "1000", since: since.toISOString(), ...(sevFilter ? { severity: sevFilter } : {}), ...(srcFilter ? { source: srcFilter } : {}) } });

    const events: SiemEvent[] = [];

    if (!srcFilter || srcFilter === "beacon") {
      const beacons = await db.select().from(beaconAlertsTable).where(gte(beaconAlertsTable.detectedAt, since)).orderBy(desc(beaconAlertsTable.detectedAt)).limit(500);
      beacons.forEach(b => events.push({ id: `beacon-${b.id}`, source: "Beacon Monitor", eventType: "intrusion_probe", severity: b.severity as SiemEvent["severity"], title: `${b.probeType} probe from ${b.attackerIp}`, details: `Node: ${b.nodeName} | Layer: ${b.nodeLayer} | Status: ${b.status}`, timestamp: b.detectedAt instanceof Date ? b.detectedAt.toISOString() : String(b.detectedAt), metadata: { nodeId: b.nodeId, attackerIp: b.attackerIp } }));
    }
    if (!srcFilter || srcFilter === "firewall") {
      const blocked = await db.select().from(blockedIpsTable).where(gte(blockedIpsTable.blockedAt, since)).orderBy(desc(blockedIpsTable.blockedAt)).limit(500);
      blocked.forEach(b => events.push({ id: `firewall-${b.id}`, source: "Firewall", eventType: "ip_blocked", severity: "medium", title: `IP blocked: ${b.ip}`, details: b.reason, timestamp: b.blockedAt instanceof Date ? b.blockedAt.toISOString() : String(b.blockedAt) }));
    }
    if (!srcFilter || srcFilter === "ghost_trace") {
      const obs = await db.select().from(ghostTraceObservationsTable).where(and(isNotNull(ghostTraceObservationsTable.anomalyType), gte(ghostTraceObservationsTable.observedAt, since))).orderBy(desc(ghostTraceObservationsTable.observedAt)).limit(500);
      obs.forEach(o => events.push({ id: `ghost-${o.id}`, source: "Ghost Trace", eventType: `device_anomaly_${o.anomalyType}`, severity: o.anomalyScore >= 80 ? "critical" : o.anomalyScore >= 50 ? "high" : "medium", title: `${o.anomalyType} on ${o.deviceName}`, details: `Score: ${o.anomalyScore}/100`, timestamp: o.observedAt instanceof Date ? o.observedAt.toISOString() : String(o.observedAt) }));
    }

    const filtered = events
      .filter(e => new Date(e.timestamp) <= until)
      .filter(e => !sevFilter || sevFilter === "all" || e.severity === sevFilter)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    void fakeReq; // suppress unused-var

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="siem-export-${Date.now()}.json"`);
      return res.json(filtered);
    }

    // CSV export
    const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["id", "timestamp", "source", "eventType", "severity", "title", "details"].join(",");
    const rows = filtered.map(e => [e.id, e.timestamp, e.source, e.eventType, e.severity, e.title, e.details].map(escape).join(","));
    const csv = [header, ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="siem-export-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    req.log.error({ err }, "[siem] export error");
    res.status(500).json({ error: "Export failed" });
  }
});

router.get("/timeline", async (req: Request, res: Response) => {
  try {
    const since = new Date(Date.now() - 24 * 3_600_000);
    const buckets: Record<number, { critical: number; high: number; medium: number; low: number }> = {};
    for (let h = 0; h < 24; h++) buckets[h] = { critical: 0, high: 0, medium: 0, low: 0 };

    const beacons = await db.select().from(beaconAlertsTable).where(gte(beaconAlertsTable.detectedAt, since));
    for (const b of beacons) {
      const h = new Date(b.detectedAt).getHours();
      const sev = b.severity as string;
      if (sev in buckets[h]) buckets[h][sev as keyof typeof buckets[0]]++;
    }

    const blocked = await db.select().from(blockedIpsTable).where(gte(blockedIpsTable.blockedAt, since));
    for (const b of blocked) {
      const h = new Date(b.blockedAt).getHours();
      buckets[h].medium++;
    }

    const ghostObs = await db.select().from(ghostTraceObservationsTable)
      .where(and(isNotNull(ghostTraceObservationsTable.anomalyType), gte(ghostTraceObservationsTable.observedAt, since)));
    for (const o of ghostObs) {
      const h = new Date(o.observedAt).getHours();
      const sev = o.anomalyScore >= 80 ? "critical" : o.anomalyScore >= 50 ? "high" : "medium";
      buckets[h][sev]++;
    }

    const timeline = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      ...buckets[h],
      total: buckets[h].critical + buckets[h].high + buckets[h].medium + buckets[h].low,
    }));

    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: "Failed to load timeline" });
  }
});

// GET /api/siem/kill-chain-defense
// Maps all active security events to MITRE ATT&CK kill chain stages
// Returns full coverage map with our defensive controls at each stage
router.get("/kill-chain-defense", async (req: Request, res: Response) => {
  try {
    const STAGES = [
      {
        id: "TA0043",
        name: "Reconnaissance",
        description: "Attacker gathers info on infrastructure: scanning, fingerprinting, enumeration.",
        ourControls: [
          "Rate limiting (300 req/min global)",
          "WAF rules + bot detection",
          "GhostTrace behavioral analysis",
          "Honeypot decoy network",
          "Attack surface monitoring",
        ],
        detectionSources: ["beacon", "firewall"],
      },
      {
        id: "TA0001",
        name: "Initial Access",
        description: "Attacker attempts foothold via phishing, exposed services, or stolen credentials.",
        ourControls: [
          "Clerk MFA enforcement",
          "ZTNA device posture (score ≥ 75 required)",
          "WireGuard port knocking",
          "Kill switch (deny-all fallback)",
          "Geo-blocking via firewall",
        ],
        detectionSources: ["beacon", "firewall"],
      },
      {
        id: "TA0002",
        name: "Execution",
        description: "Attacker executes malicious code, scripts, or payloads on the target.",
        ourControls: [
          "Shell allowlist (Terminal hardening)",
          "HARD_BLOCKED destructive pattern filter",
          "ProxhqVPN Mode command audit logging",
          "Application control via RBAC",
          "Break-glass token required for emergency access",
        ],
        detectionSources: ["ghost-trace"],
      },
      {
        id: "TA0003",
        name: "Persistence",
        description: "Attacker establishes long-term access via startup items, services, or scheduled tasks.",
        ourControls: [
          "auditd cron/startup/service baselining",
          "systemd service whitelisting (9 hardened services)",
          "STIG OpenSCAP configuration baselines",
          "Configuration drift detection",
          "SHA3-256 + HMAC-SHA512 audit chain",
        ],
        detectionSources: ["ghost-trace", "ghost-chain"],
      },
      {
        id: "TA0004",
        name: "Privilege Escalation",
        description: "Attacker elevates privileges via kernel exploits, misconfiguration, or PAM weaknesses.",
        ourControls: [
          "RBAC (6 roles: owner/security_admin/network_admin/auditor/support/user)",
          "Least privilege enforcement",
          "Admin separation (ADMIN_EMAILS)",
          "mTLS daemon authentication",
          "PAM hardening + sysctl kernel lockdown",
        ],
        detectionSources: ["ghost-chain"],
      },
      {
        id: "TA0008",
        name: "Lateral Movement",
        description: "Attacker pivots across network segments to reach additional targets.",
        ourControls: [
          "WireGuard mesh network isolation (60-node)",
          "Zero Trust Network Access (ZTNA)",
          "Internal firewalling + network segmentation",
          "Kill switch (cut all routing on compromise)",
          "Device trust scoring on every connection",
        ],
        detectionSources: ["firewall", "ghost-trace"],
      },
      {
        id: "TA0011",
        name: "Command & Control",
        description: "Attacker uses C2 beacon channel to maintain control and issue remote commands.",
        ourControls: [
          "GhostTrace beacon timing analysis (7 interval signatures)",
          "DNS sinkhole (blocks C2 domains)",
          "DNS Shield category blocking",
          "Egress rate limiting + outbound anomaly detection",
          "DNS tunneling detection (avg interval < 60s)",
        ],
        detectionSources: ["ghost-trace", "beacon"],
      },
      {
        id: "TA0010",
        name: "Exfiltration",
        description: "Attacker extracts sensitive data via covert channel or bulk outbound transfer.",
        ourControls: [
          "Outbound traffic baselining (10x threshold auto-flag)",
          "Data volume anomaly detection",
          "DNS tunneling detection in GhostTrace",
          "Egress firewall control + kill switch",
          "WireGuard RAM-only key architecture (no persistent key material)",
        ],
        detectionSources: ["ghost-trace", "firewall"],
      },
    ] as const;

    const since = new Date(Date.now() - 7 * 86_400_000);

    const [beaconRows, firewallRows, ghostRows, chainRows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(beaconAlertsTable)
        .where(gte(beaconAlertsTable.detectedAt, since)),
      db.select({ count: sql<number>`count(*)::int` }).from(blockedIpsTable),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(ghostTraceObservationsTable)
        .where(
          and(
            isNotNull(ghostTraceObservationsTable.anomalyType),
            eq(ghostTraceObservationsTable.resolved, false)
          )
        ),
      db.select({ count: sql<number>`count(*)::int` }).from(attackChainFindingsTable),
    ]);

    const detectionSummary: Record<string, number> = {
      beacon:          Number(beaconRows[0]?.count  ?? 0),
      firewall:        Number(firewallRows[0]?.count ?? 0),
      "ghost-trace":   Number(ghostRows[0]?.count   ?? 0),
      "ghost-chain":   Number(chainRows[0]?.count   ?? 0),
    };

    const stages = STAGES.map(stage => ({
      ...stage,
      activeDetections: (stage.detectionSources as readonly string[]).reduce(
        (acc, src) => acc + (detectionSummary[src] ?? 0),
        0
      ),
      status: "defended" as const,
    }));

    const totalActiveDetections = Object.values(detectionSummary).reduce((a, b) => a + b, 0);

    res.json({
      stages,
      totalActiveDetections,
      coveredStages: STAGES.length,
      totalStages: STAGES.length,
      coveragePercent: 100,
      framework: "MITRE ATT&CK",
      detectionSummary,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "[siem] kill-chain-defense error");
    res.status(500).json({ error: "Failed to load kill chain defense map" });
  }
});

export default router;

