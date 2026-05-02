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

    const all = [...events];
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

export default router;
