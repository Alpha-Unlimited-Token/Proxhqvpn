import { Router } from "express";
import { db } from "@workspace/db";
import { nodesTable, beaconAlertsTable, wgPeerCommandsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const DAEMON_PSK = process.env.DAEMON_PSK ?? "";

function requirePsk(req: any, res: any, next: any) {
  const psk = req.headers["x-daemon-psk"];
  if (!DAEMON_PSK) {
    return res.status(503).json({ error: "DAEMON_PSK not configured. Set the DAEMON_PSK environment variable." });
  }
  if (!psk || psk !== DAEMON_PSK) {
    return res.status(401).json({ error: "Invalid daemon PSK" });
  }
  next();
}

router.use(requirePsk);

router.post("/report", async (req, res) => {
  const body = z.object({
    nodeId: z.number(),
    system: z.object({
      cpuPercent: z.number(),
      memoryUsedMb: z.number(),
      memoryTotalMb: z.number(),
      memoryPercent: z.number(),
      uptimeSeconds: z.number(),
      networkInMb: z.number().optional(),
      networkOutMb: z.number().optional(),
      timestamp: z.string(),
    }),
    wireguard: z.object({
      publicKey: z.string().optional(),
      listenPort: z.string().optional(),
      activePeers: z.number(),
    }),
  }).parse(req.body);

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, body.nodeId));
  if (!node) return res.status(404).json({ error: "Node not found" });

  await db.update(nodesTable).set({
    status: "active",
    lastSeen: new Date(),
  }).where(eq(nodesTable.id, body.nodeId));

  return res.json({ ok: true, nodeId: body.nodeId, receivedAt: new Date().toISOString() });
});

router.post("/beacon", async (req, res) => {
  const body = z.object({
    nodeId: z.number(),
    attackerIp: z.string(),
    probeType: z.enum(["ping", "port_scan", "traceroute", "packet_sniff", "tunnel_probe"]),
    fingerprint: z.string().optional(),
    raw: z.string().optional(),
  }).parse(req.body);

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, body.nodeId));
  if (!node) return res.status(404).json({ error: "Node not found" });

  const severityMap: Record<string, "low" | "medium" | "high" | "critical"> = {
    ping: "low",
    traceroute: "medium",
    port_scan: "high",
    packet_sniff: "critical",
    tunnel_probe: "critical",
  };

  const [alert] = await db.insert(beaconAlertsTable).values({
    nodeId: body.nodeId,
    nodeName: node.name,
    nodeLayer: node.layer,
    attackerIp: body.attackerIp,
    attackerFingerprint: body.fingerprint ?? `IP:${body.attackerIp}|Source:proxhqd`,
    probeType: body.probeType,
    severity: severityMap[body.probeType],
    status: "active",
    silkWebTrapped: false,
    rawData: body.raw ?? null,
    detectedAt: new Date(),
  }).returning();

  return res.status(201).json({ ok: true, alertId: alert.id });
});

router.get("/pending-peers", async (req, res) => {
  const nodeId = parseInt(req.query.nodeId as string);
  if (!nodeId) return res.status(400).json({ error: "nodeId required" });

  const pending = await db
    .select()
    .from(wgPeerCommandsTable)
    .where(and(eq(wgPeerCommandsTable.nodeId, nodeId), eq(wgPeerCommandsTable.status, "pending")));

  return res.json({ peers: pending });
});

router.post("/peer-ack", async (req, res) => {
  const body = z.object({
    commandId: z.number(),
    success: z.boolean(),
    errorMessage: z.string().optional(),
  }).parse(req.body);

  await db.update(wgPeerCommandsTable).set({
    status: body.success ? "applied" : "failed",
    appliedAt: body.success ? new Date() : null,
    errorMessage: body.errorMessage ?? null,
  }).where(eq(wgPeerCommandsTable.id, body.commandId));

  return res.json({ ok: true });
});

export default router;
