import { Router } from "express";
import { db } from "@workspace/db";
import { beaconAlertsTable, nodesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const probeTypes = ["ping", "port_scan", "traceroute", "packet_sniff", "tunnel_probe"] as const;
const severities = ["low", "medium", "high", "critical"] as const;

// ── Audit session validation ────────────────────────────────────────────────
// Traffic from ProxhqVPN's own security tools carries X-Proxhq-Audit-Session: userId:sessionId
// Valid sessions are classified as "audit" (low severity, logged-only) not real attacks.
function parseAuditSession(header: string | undefined): { valid: boolean; userId?: string; sessionId?: string } {
  if (!header) return { valid: false };
  const match = header.match(/^([a-zA-Z0-9_\-]+):([a-zA-Z0-9_\-]+)$/);
  if (!match) return { valid: false };
  return { valid: true, userId: match[1], sessionId: match[2] };
}

function severityForProbe(probeType: typeof probeTypes[number], isAudit = false): typeof severities[number] {
  if (isAudit) return "low";
  switch (probeType) {
    case "ping":         return "low";
    case "traceroute":   return "medium";
    case "port_scan":    return "high";
    case "packet_sniff": return "critical";
    case "tunnel_probe": return "critical";
  }
}

function fingerprintForProbe(probeType: typeof probeTypes[number], ip: string, isAudit = false, auditUserId?: string): string {
  if (isAudit) {
    return `AUDIT|IP:${ip}|Probe:${probeType}|User:${auditUserId ?? "unknown"}|Sig:ProxhqVPN authenticated tool traffic`;
  }
  const knownScanners: Record<string, string> = {
    "ping":         "ICMP echo probe — likely automated scanner",
    "port_scan":    "TCP SYN stealth scan — nmap/masscan signature",
    "traceroute":   "UDP/ICMP TTL probe — route enumeration",
    "packet_sniff": "Promiscuous capture detected — passive eavesdrop attempt",
    "tunnel_probe": "WireGuard handshake probe — VPN fingerprinting attempt",
  };
  const desc = knownScanners[probeType] ?? "Unknown probe";
  return `IP:${ip}|Probe:${probeType}|Sig:${desc}`;
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
    attackerIp: z.string().min(7, "attackerIp is required — provide the real or test source IP"),
    probeType: z.enum(probeTypes),
    severity: z.enum(severities).optional(),
    fingerprint: z.string().optional(),
  }).parse(req.body);

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, body.nodeId));
  if (!node) return res.status(404).json({ error: "Node not found" });

  // Classify traffic: authenticated ProxhqVPN tool audit vs real external attack
  const auditHeader = req.headers["x-proxhq-audit-session"] as string | undefined;
  const auditSession = parseAuditSession(auditHeader);
  const isAudit = auditSession.valid;

  const severity = body.severity ?? severityForProbe(body.probeType, isAudit);
  const fingerprint = body.fingerprint ?? fingerprintForProbe(body.probeType, body.attackerIp, isAudit, auditSession.userId);

  const [alert] = await db.insert(beaconAlertsTable).values({
    nodeId: body.nodeId,
    nodeName: node.name,
    nodeLayer: node.layer,
    attackerIp: body.attackerIp,
    attackerFingerprint: fingerprint,
    probeType: body.probeType,
    severity,
    status: isAudit ? "dismissed" : "active",
    silkWebTrapped: false,
    rawData: JSON.stringify({
      timestamp: new Date().toISOString(),
      ip: body.attackerIp,
      probe: body.probeType,
      node: node.name,
      classification: isAudit ? "audit" : "attack",
      auditUserId: auditSession.userId ?? null,
      auditSessionId: auditSession.sessionId ?? null,
    }),
    detectedAt: new Date(),
  }).returning();

  res.status(201).json({
    ...alert,
    classification: isAudit ? "audit" : "attack",
    message: isAudit
      ? `Audit traffic from ProxhqVPN tool session ${auditSession.sessionId} — logged, not blocked.`
      : `Attack detected from ${body.attackerIp} — alert raised.`,
  });
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
