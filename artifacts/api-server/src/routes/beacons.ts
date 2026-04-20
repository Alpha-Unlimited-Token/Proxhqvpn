import { Router } from "express";
import { db } from "@workspace/db";
import { beaconAlertsTable, nodesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const probeTypes = ["ping", "port_scan", "traceroute", "packet_sniff", "tunnel_probe"] as const;
const severities = ["low", "medium", "high", "critical"] as const;

function randomFingerprint(): string {
  const os = ["Linux/5.15", "Windows/11", "macOS/14", "FreeBSD/13"][Math.floor(Math.random() * 4)];
  const ttl = [64, 128, 255][Math.floor(Math.random() * 3)];
  return `OS:${os}|TTL:${ttl}|UA:${Math.random().toString(36).substring(7)}`;
}

function randomIp(): string {
  return `${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254) + 1}`;
}

router.get("/", async (req, res) => {
  const { status } = req.query as { status?: string };
  let alerts = await db.select().from(beaconAlertsTable).orderBy(sql`detected_at DESC`);
  if (status && status !== "all") {
    alerts = alerts.filter((a) => a.status === status);
  }
  res.json({
    alerts,
    total: alerts.length,
    activeCount: alerts.filter((a) => a.status === "active").length,
  });
});

router.post("/trigger", async (req, res) => {
  const body = z.object({
    nodeId: z.number(),
    simulatedIp: z.string().optional(),
    probeType: z.enum(probeTypes),
  }).parse(req.body);

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, body.nodeId));
  if (!node) return res.status(404).json({ error: "Node not found" });

  const attackerIp = body.simulatedIp || randomIp();
  const severity = severities[Math.floor(Math.random() * severities.length)];

  const [alert] = await db.insert(beaconAlertsTable).values({
    nodeId: body.nodeId,
    nodeName: node.name,
    nodeLayer: node.layer,
    attackerIp,
    attackerFingerprint: randomFingerprint(),
    probeType: body.probeType,
    severity,
    status: "active",
    silkWebTrapped: Math.random() > 0.5,
    rawData: JSON.stringify({
      timestamp: new Date().toISOString(),
      ip: attackerIp,
      probe: body.probeType,
      node: node.name,
      headers: { "User-Agent": "Mozilla/5.0 (scanning)", "X-Forwarded-For": attackerIp },
    }),
    detectedAt: new Date(),
  }).returning();

  res.status(201).json(alert);
});

router.post("/:id/dismiss", async (req, res) => {
  const id = parseInt(req.params.id);
  const [alert] = await db.update(beaconAlertsTable)
    .set({ status: "dismissed" })
    .where(eq(beaconAlertsTable.id, id))
    .returning();
  if (!alert) return res.status(404).json({ error: "Alert not found" });
  res.json(alert);
});

router.get("/stats", async (req, res) => {
  const alerts = await db.select().from(beaconAlertsTable);
  const now = new Date();
  const last24h = alerts.filter((a) => {
    const diff = now.getTime() - new Date(a.detectedAt).getTime();
    return diff < 24 * 60 * 60 * 1000;
  });
  const probeCounts: Record<string, number> = {};
  for (const a of alerts) {
    probeCounts[a.probeType] = (probeCounts[a.probeType] || 0) + 1;
  }
  const topProbeType = Object.entries(probeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "none";

  res.json({
    totalAlerts: alerts.length,
    activeAlerts: alerts.filter((a) => a.status === "active").length,
    trappedAttackers: alerts.filter((a) => a.silkWebTrapped).length,
    alertsLast24h: last24h.length,
    topProbeType,
    criticalAlerts: alerts.filter((a) => a.severity === "critical").length,
  });
});

export default router;
