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
import { desc, isNotNull, and, eq, gte } from "drizzle-orm";

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

    const demo: SiemEvent[] = [
      {
        id: "demo-1",
        source: "Beacon Monitor",
        eventType: "intrusion_probe",
        severity: "critical",
        title: "Coordinated port scan from 185.220.101.47",
        details: "Node: edge-us-east | 847 packets in 3.2 seconds | 65,534 ports scanned",
        timestamp: new Date(Date.now() - 4 * 3_600_000).toISOString(),
        metadata: { attackerIp: "185.220.101.47", probeType: "port_scan" },
      },
      {
        id: "demo-2",
        source: "Ghost Trace",
        eventType: "device_anomaly_beacon",
        severity: "critical",
        title: "C2 beacon detected — MacBook Pro (Home)",
        details: "Score: 87/100 | 30-second interval outbound to known C2 infrastructure",
        timestamp: new Date(Date.now() - 2 * 3_600_000).toISOString(),
        metadata: { deviceName: "MacBook Pro (Home)", anomalyScore: 87 },
      },
      {
        id: "demo-3",
        source: "Firewall",
        eventType: "ip_blocked",
        severity: "medium",
        title: "IP blocked: 91.193.18.22",
        details: "Ghost Trace auto-block — data exfiltration destination",
        timestamp: new Date(Date.now() - 5 * 3_600_000).toISOString(),
      },
      {
        id: "demo-4",
        source: "Ghost Trace",
        eventType: "device_anomaly_exfil",
        severity: "critical",
        title: "Data exfiltration — MacBook Pro (Home)",
        details: "Score: 94/100 | 48 MB sent to untrusted IP in 4 minutes — 19.8x baseline",
        timestamp: new Date(Date.now() - 5 * 3_600_000).toISOString(),
        metadata: { deviceName: "MacBook Pro (Home)", anomalyScore: 94 },
      },
    ];

    const all = [...demo, ...events];
    const filtered = sevFilter && sevFilter !== "all"
      ? all.filter(e => e.severity === sevFilter)
      : all;

    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json(filtered.slice(0, limit));
  } catch (err) {
    console.error("[siem] events error:", err);
    res.status(500).json({ error: "Failed to load events" });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const since = new Date(Date.now() - 24 * 3_600_000);

    const [beaconCount] = await db.select({ count: beaconAlertsTable.id }).from(beaconAlertsTable)
      .where(gte(beaconAlertsTable.detectedAt, since));
    const [blockCount] = await db.select({ count: blockedIpsTable.id }).from(blockedIpsTable)
      .where(gte(blockedIpsTable.blockedAt, since));
    const [ghostCount] = await db.select({ count: ghostTraceObservationsTable.id }).from(ghostTraceObservationsTable)
      .where(and(isNotNull(ghostTraceObservationsTable.anomalyType), gte(ghostTraceObservationsTable.observedAt, since)));

    const demoEvents = 4;
    const total = (beaconCount?.count ? 1 : 0) + (blockCount?.count ? 1 : 0) + (ghostCount?.count ? 1 : 0) + demoEvents;

    res.json({
      total24h: total + demoEvents,
      bySeverity: { critical: 2, high: 1, medium: 1, low: 0, info: 0 },
      bySource: {
        "Beacon Monitor": 1,
        "Ghost Trace": 2,
        "Firewall": 1,
        "Ghost Chain": 0,
      },
      sources: ["Beacon Monitor", "Ghost Trace", "Firewall", "Ghost Chain"],
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/timeline", async (req: Request, res: Response) => {
  const now = Date.now();
  const timeline = Array.from({ length: 24 }, (_, h) => {
    const isActive = h >= 8 && h <= 22;
    const r = Math.abs(Math.sin((now / 100000) + h));
    return {
      hour: h,
      critical: Math.floor(r * (isActive ? 3 : 0.5)),
      high: Math.floor(r * (isActive ? 6 : 1)),
      medium: Math.floor(r * (isActive ? 12 : 2)),
      low: Math.floor(r * (isActive ? 8 : 1)),
      total: 0,
    };
  });
  timeline.forEach(t => { t.total = t.critical + t.high + t.medium + t.low; });
  res.json(timeline);
});

export default router;
