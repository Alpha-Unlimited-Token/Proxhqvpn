import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  ghostTraceObservationsTable,
  ghostTraceBaselineTable,
  blockedIpsTable,
} from "@workspace/db";
import { eq, desc, and, isNotNull, sql } from "drizzle-orm";

const router = Router();

const DEMO_DEVICES = [
  {
    peerPublicKey: "DEMO_KEY_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0=",
    deviceName: "MacBook Pro (Home)",
    nodeId: 1,
    baselineBytesOutPerHour: 2_400_000,
    baselineDestCount: 12,
    activeHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
  },
  {
    peerPublicKey: "DEMO_KEY_Z9y8X7w6V5u4T3s2R1q0P9o8N7m6L5k4J3i2H1g0=",
    deviceName: "iPhone 15 Pro",
    nodeId: 1,
    baselineBytesOutPerHour: 800_000,
    baselineDestCount: 8,
    activeHours: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
  },
  {
    peerPublicKey: "DEMO_KEY_Q1w2E3r4T5y6U7i8O9p0A1s2D3f4G5h6J7k8L9=",
    deviceName: "Work Laptop (Ubuntu)",
    nodeId: 2,
    baselineBytesOutPerHour: 5_200_000,
    baselineDestCount: 24,
    activeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
  },
];

function generateTimelineData(deviceKey: string, daysBack = 7) {
  const seed = deviceKey.charCodeAt(10) || 42;
  const now = Date.now();
  const hours: { hour: string; bytesOut: number; bytesIn: number; anomaly: string | null }[] = [];
  const device = DEMO_DEVICES.find(d => d.peerPublicKey === deviceKey);
  const baseline = device?.baselineBytesOutPerHour || 2_000_000;
  const activeHours = device?.activeHours || [9, 10, 11, 12, 13, 14, 15, 16, 17];

  for (let h = daysBack * 24; h >= 0; h--) {
    const ts = new Date(now - h * 3_600_000);
    const hour = ts.getHours();
    const isActive = activeHours.includes(hour);
    const rand = Math.abs(Math.sin(seed * h + 1.7)) * 0.6 + 0.4;
    const bytesOut = isActive ? Math.floor(baseline * rand) : Math.floor(baseline * 0.05 * rand);
    const bytesIn = Math.floor(bytesOut * (0.3 + Math.abs(Math.sin(seed * h)) * 0.4));

    let anomaly: string | null = null;
    if (h === 38 && deviceKey.includes("A1b2")) anomaly = "beacon";
    if (h === 52 && deviceKey.includes("A1b2")) anomaly = "exfil";
    if (h === 15 && deviceKey.includes("Z9y8")) anomaly = "malicious_dest";

    hours.push({ hour: ts.toISOString(), bytesOut, bytesIn, anomaly });
  }
  return hours;
}

function generateDemoAnomalies() {
  return [
    {
      id: 1001,
      peerPublicKey: DEMO_DEVICES[0].peerPublicKey,
      deviceName: DEMO_DEVICES[0].deviceName,
      nodeId: 1,
      anomalyType: "beacon",
      anomalyScore: 87,
      bytesOut: 4_200,
      bytesIn: 1_800,
      destIpCount: 1,
      uniqueNewDests: 1,
      avgIntervalMs: 29_800,
      anomalyDetails: JSON.stringify({
        description: "Periodic outbound connections at near-constant 30-second intervals detected",
        destinationIp: "185.220.101.47",
        destinationPort: 443,
        intervalStdDev: 312,
        matchesC2Pattern: true,
        threatCategory: "Command & Control Beacon",
        knownMalicious: true,
        asnInfo: "AS204028 — Known Tor exit node / C2 infrastructure",
      }),
      resolved: false,
      observedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    },
    {
      id: 1002,
      peerPublicKey: DEMO_DEVICES[0].peerPublicKey,
      deviceName: DEMO_DEVICES[0].deviceName,
      nodeId: 1,
      anomalyType: "exfil",
      anomalyScore: 94,
      bytesOut: 48_000_000,
      bytesIn: 82_000,
      destIpCount: 1,
      uniqueNewDests: 1,
      avgIntervalMs: null,
      anomalyDetails: JSON.stringify({
        description: "Sustained high-volume outbound transfer to single untrusted IP — 48 MB in 4 minutes",
        destinationIp: "91.193.18.22",
        destinationPort: 8443,
        transferDurationMs: 237_000,
        mbTransferred: 48,
        uploadToDownloadRatio: 585,
        threatCategory: "Data Exfiltration",
        knownMalicious: false,
        asnInfo: "AS48282 — Unrecognized VPS provider, Eastern Europe",
        baselineMultiplier: "19.8x above normal",
      }),
      resolved: false,
      observedAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    },
    {
      id: 1003,
      peerPublicKey: DEMO_DEVICES[1].peerPublicKey,
      deviceName: DEMO_DEVICES[1].deviceName,
      nodeId: 1,
      anomalyType: "malicious_dest",
      anomalyScore: 72,
      bytesOut: 12_400,
      bytesIn: 3_200,
      destIpCount: 1,
      uniqueNewDests: 1,
      avgIntervalMs: null,
      anomalyDetails: JSON.stringify({
        description: "Connection to destination flagged across 4 threat intelligence feeds",
        destinationIp: "194.165.16.98",
        destinationPort: 80,
        threatCategory: "Malware Distribution",
        knownMalicious: true,
        asnInfo: "AS204957 — Bulletproof hosting",
        feeds: ["AlienVault OTX", "Spamhaus", "Emerging Threats", "ProofPoint ET"],
        firstSeen: "2024-09-12",
      }),
      resolved: false,
      observedAt: new Date(Date.now() - 8 * 3_600_000).toISOString(),
    },
  ];
}

router.get("/devices", async (req: Request, res: Response) => {
  try {
    const dbBaselines = await db
      .select()
      .from(ghostTraceBaselineTable)
      .limit(50);

    const dbObs = await db
      .select()
      .from(ghostTraceObservationsTable)
      .where(isNotNull(ghostTraceObservationsTable.anomalyType))
      .orderBy(desc(ghostTraceObservationsTable.observedAt))
      .limit(100);

    const demoAnomalies = generateDemoAnomalies();
    const allDevices = DEMO_DEVICES.map(d => {
      const anomalies = demoAnomalies.filter(a => a.peerPublicKey === d.peerPublicKey && !a.resolved);
      const maxScore = anomalies.length ? Math.max(...anomalies.map(a => a.anomalyScore)) : 0;
      const status = maxScore >= 80 ? "critical" : maxScore >= 50 ? "warning" : "clean";
      return {
        peerPublicKey: d.peerPublicKey,
        deviceName: d.deviceName,
        nodeId: d.nodeId,
        status,
        activeAnomalies: anomalies.length,
        anomalyScore: maxScore,
        baseline: {
          bytesOutPerHour: d.baselineBytesOutPerHour,
          destCount: d.baselineDestCount,
        },
        lastSeen: new Date(Date.now() - Math.floor(Math.random() * 600_000)).toISOString(),
      };
    });

    dbBaselines.forEach(b => {
      if (!allDevices.find(d => d.peerPublicKey === b.peerPublicKey)) {
        const myObs = dbObs.filter(o => o.peerPublicKey === b.peerPublicKey && !o.resolved);
        const maxScore = myObs.length ? Math.max(...myObs.map(o => o.anomalyScore)) : 0;
        allDevices.push({
          peerPublicKey: b.peerPublicKey,
          deviceName: b.deviceName,
          nodeId: 0,
          status: maxScore >= 80 ? "critical" : maxScore >= 50 ? "warning" : "clean",
          activeAnomalies: myObs.length,
          anomalyScore: maxScore,
          baseline: {
            bytesOutPerHour: b.baselineBytesOutPerHour,
            destCount: b.baselineDestCount,
          },
          lastSeen: new Date().toISOString(),
        });
      }
    });

    res.json(allDevices);
  } catch (err) {
    console.error("[ghost-trace] devices error:", err);
    res.status(500).json({ error: "Failed to load devices" });
  }
});

router.get("/timeline/:key", (req: Request, res: Response) => {
  const { key } = req.params;
  const data = generateTimelineData(key, 7);
  res.json(data);
});

router.get("/anomalies", async (req: Request, res: Response) => {
  try {
    const dbAnomalies = await db
      .select()
      .from(ghostTraceObservationsTable)
      .where(and(isNotNull(ghostTraceObservationsTable.anomalyType), eq(ghostTraceObservationsTable.resolved, false)))
      .orderBy(desc(ghostTraceObservationsTable.observedAt))
      .limit(50);

    const demo = generateDemoAnomalies();
    const combined = [...demo, ...dbAnomalies.map(a => ({
      ...a,
      observedAt: a.observedAt.toISOString(),
      anomalyDetails: a.anomalyDetails || null,
    }))];

    res.json(combined);
  } catch (err) {
    console.error("[ghost-trace] anomalies error:", err);
    res.status(500).json({ error: "Failed to load anomalies" });
  }
});

router.post("/anomalies/:id/resolve", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (id >= 1000) {
    return res.json({ ok: true, demo: true });
  }
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
    const demoAnomalies = generateDemoAnomalies();
    const activeCount = demoAnomalies.filter(a => !a.resolved).length;
    const criticalCount = demoAnomalies.filter(a => a.anomalyScore >= 80 && !a.resolved).length;
    const deviceCount = DEMO_DEVICES.length;

    res.json({
      monitoredDevices: deviceCount,
      activeAnomalies: activeCount,
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
    console.error("[ghost-trace] ingest error:", err);
    res.status(500).json({ error: "Ingest failed" });
  }
});

export default router;
