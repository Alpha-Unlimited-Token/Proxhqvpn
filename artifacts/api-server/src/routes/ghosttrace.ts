// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  ghostTraceObservationsTable,
  ghostTraceBaselineTable,
  blockedIpsTable,
} from "@workspace/db";
import { eq, desc, and, isNotNull, sql } from "drizzle-orm";

const router = Router();

router.get("/devices", async (req: Request, res: Response) => {
  try {
    const baselines = await db.select().from(ghostTraceBaselineTable).limit(50);
    const obs = await db.select().from(ghostTraceObservationsTable)
      .where(and(isNotNull(ghostTraceObservationsTable.anomalyType), eq(ghostTraceObservationsTable.resolved, false)))
      .orderBy(desc(ghostTraceObservationsTable.observedAt))
      .limit(100);

    const devices = baselines.map(b => {
      const myObs = obs.filter(o => o.peerPublicKey === b.peerPublicKey);
      const maxScore = myObs.length ? Math.max(...myObs.map(o => o.anomalyScore)) : 0;
      return {
        peerPublicKey: b.peerPublicKey,
        deviceName: b.deviceName,
        nodeId: 0,
        status: maxScore >= 80 ? "critical" : maxScore >= 50 ? "warning" : "clean",
        activeAnomalies: myObs.length,
        anomalyScore: maxScore,
        baseline: { bytesOutPerHour: b.baselineBytesOutPerHour, destCount: b.baselineDestCount },
        lastSeen: b.lastUpdated instanceof Date ? b.lastUpdated.toISOString() : new Date().toISOString(),
      };
    });

    res.json(devices);
  } catch (err) {
    req.log.error({ err }, "[ghost-trace] devices error");
    res.status(500).json({ error: "Failed to load devices" });
  }
});

router.get("/timeline/:key", async (req: Request, res: Response) => {
  try {
    const key = String(req.params.key);
    const since = new Date(Date.now() - 7 * 24 * 3_600_000);
    const rows = await db.select().from(ghostTraceObservationsTable)
      .where(and(eq(ghostTraceObservationsTable.peerPublicKey, key)))
      .orderBy(desc(ghostTraceObservationsTable.observedAt))
      .limit(200);

    const data = rows.filter(r => new Date(r.observedAt) >= since).map(r => ({
      hour: r.observedAt instanceof Date ? r.observedAt.toISOString() : String(r.observedAt),
      bytesOut: r.bytesOut,
      bytesIn: r.bytesIn,
      anomaly: r.anomalyType || null,
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to load timeline" });
  }
});

router.get("/anomalies", async (req: Request, res: Response) => {
  try {
    const dbAnomalies = await db
      .select()
      .from(ghostTraceObservationsTable)
      .where(and(isNotNull(ghostTraceObservationsTable.anomalyType), eq(ghostTraceObservationsTable.resolved, false)))
      .orderBy(desc(ghostTraceObservationsTable.observedAt))
      .limit(50);

    res.json(dbAnomalies.map(a => ({
      ...a,
      observedAt: a.observedAt instanceof Date ? a.observedAt.toISOString() : String(a.observedAt),
      anomalyDetails: a.anomalyDetails || null,
    })));
  } catch (err) {
    req.log.error({ err }, "[ghost-trace] anomalies error");
    res.status(500).json({ error: "Failed to load anomalies" });
  }
});

router.post("/anomalies/:id/resolve", async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  try {
    await db
      .update(ghostTraceObservationsTable)
      .set({ resolved: true })
      .where(eq(ghostTraceObservationsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to resolve anomaly" });
  }
});

router.post("/block/:key", async (req: Request, res: Response) => {
  const { key } = req.params;
  const { ip, reason } = req.body as { ip: string; reason: string };
  if (!ip) return res.status(400).json({ error: "ip required" });

  try {
    await db.insert(blockedIpsTable).values({
      ip,
      reason: reason || `Ghost Trace auto-block — device: ${key.slice(0, 12)}...`,
      autoBlocked: true,
      hitCount: 1,
    }).onConflictDoNothing();
    res.json({ ok: true, ip, message: `${ip} added to firewall block list` });
  } catch (err) {
    res.status(500).json({ error: "Failed to block IP" });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const baselines = await db.select().from(ghostTraceBaselineTable);
    const activeAnomalies = await db.select().from(ghostTraceObservationsTable)
      .where(and(isNotNull(ghostTraceObservationsTable.anomalyType), eq(ghostTraceObservationsTable.resolved, false)));

    const criticalCount = activeAnomalies.filter(a => a.anomalyScore >= 80).length;

    res.json({
      monitoredDevices: baselines.length,
      activeAnomalies: activeAnomalies.length,
      criticalAnomalies: criticalCount,
      detectionTypes: ["C2 Beacon", "Data Exfiltration", "Malicious Destination", "Ghost Traffic", "DNS Tunneling"],
      agentless: true,
      vpnNative: true,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.post("/ingest", async (req: Request, res: Response) => {
  const { peerPublicKey, deviceName, nodeId, bytesOut, bytesIn, destIpCount, uniqueNewDests, avgIntervalMs } = req.body as {
    peerPublicKey: string;
    deviceName: string;
    nodeId: number;
    bytesOut: number;
    bytesIn: number;
    destIpCount: number;
    uniqueNewDests: number;
    avgIntervalMs?: number;
  };

  if (!peerPublicKey || !deviceName) {
    return res.status(400).json({ error: "peerPublicKey and deviceName required" });
  }

  let anomalyType: string | null = null;
  let anomalyScore = 0;
  let anomalyDetails: string | null = null;

  const baseline = await db
    .select()
    .from(ghostTraceBaselineTable)
    .where(eq(ghostTraceBaselineTable.peerPublicKey, peerPublicKey))
    .limit(1);

  if (baseline.length > 0) {
    const b = baseline[0];
    const hour = new Date().getHours();
    const activeHours: number[] = JSON.parse(b.activeHoursJson || "[]");
    const isOffHours = activeHours.length > 0 && !activeHours.includes(hour);

    if (avgIntervalMs && avgIntervalMs > 0 && avgIntervalMs < 60_000) {
      const stdDev = Math.abs(avgIntervalMs - 30_000);
      if (stdDev < 2_000) {
        anomalyType = "beacon";
        anomalyScore = Math.min(99, 70 + Math.floor((2000 - stdDev) / 20));
        anomalyDetails = JSON.stringify({
          description: "Near-constant interval outbound connections — C2 beacon pattern",
          avgIntervalMs,
          stdDev,
          matchesC2Pattern: true,
        });
      }
    }

    if (!anomalyType && b.baselineBytesOutPerHour > 0) {
      const multiplier = bytesOut / b.baselineBytesOutPerHour;
      if (multiplier > 10) {
        anomalyType = "exfil";
        anomalyScore = Math.min(99, 50 + Math.floor(multiplier * 2));
        anomalyDetails = JSON.stringify({
          description: `Outbound traffic ${multiplier.toFixed(1)}x above baseline`,
          multiplier,
          bytesOut,
          baseline: b.baselineBytesOutPerHour,
        });
      }
    }
  }

  try {
    await db.insert(ghostTraceObservationsTable).values({
      peerPublicKey,
      deviceName,
      nodeId: nodeId || 0,
      bytesOut: bytesOut || 0,
      bytesIn: bytesIn || 0,
      destIpCount: destIpCount || 0,
      uniqueNewDests: uniqueNewDests || 0,
      avgIntervalMs: avgIntervalMs || null,
      anomalyType,
      anomalyScore,
      anomalyDetails,
      resolved: false,
    });

    await db
      .insert(ghostTraceBaselineTable)
      .values({
        peerPublicKey,
        deviceName,
        baselineBytesOutPerHour: bytesOut,
        baselineDestCount: destIpCount,
        activeHoursJson: JSON.stringify([new Date().getHours()]),
        knownDestinationsJson: "[]",
      })
      .onConflictDoUpdate({
        target: ghostTraceBaselineTable.peerPublicKey,
        set: {
          lastUpdated: sql`NOW()`,
        },
      });

    res.json({ ok: true, anomalyDetected: !!anomalyType, anomalyType, anomalyScore });
  } catch (err) {
    req.log.error({ err }, "[ghost-trace] ingest error");
    res.status(500).json({ error: "Ingest failed" });
  }
});

export default router;
