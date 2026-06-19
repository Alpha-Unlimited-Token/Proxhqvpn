// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { db } from "@workspace/db";
import { beaconAlertsTable, nodesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { bus } from "../lib/service-bus";

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

// ── In-memory whitelist (trusted developer / audit IPs) ────────────────────
interface WhitelistEntry {
  ip: string;
  reason: string;
  addedAt: string;
  probeTypes: string[];    // "*" = all probe types, otherwise specific ones
  addedBy: "manual" | "allow-action" | "audit-header";
}
const trustedWhitelist: WhitelistEntry[] = [];

function isWhitelisted(ip: string, probeType: string): boolean {
  return trustedWhitelist.some(
    e => e.ip === ip && (e.probeTypes.includes("*") || e.probeTypes.includes(probeType))
  );
}

router.get("/", async (req, res) => {
  const { status } = req.query as { status?: string };
  let alerts = await db.select().from(beaconAlertsTable).orderBy(sql`detected_at DESC`).limit(500);
  if (status && status !== "all") {
    alerts = alerts.filter((a) => a.status === status);
  }
  // Annotate each alert with classification parsed from fingerprint
  // rawData is used only for internal parsing and stripped from response
  const annotated = alerts.map(a => {
    const { rawData, ...alertFields } = a;
    let rawParsed: Record<string, unknown> = {};
    try { rawParsed = JSON.parse(rawData ?? "{}"); } catch {}
    const isAudit = (alertFields.attackerFingerprint ?? "").startsWith("AUDIT|");
    const whitelisted = isWhitelisted(alertFields.attackerIp, alertFields.probeType);
    return {
      ...alertFields,
      classification: isAudit ? "audit" : "attack",
      whitelisted,
      rawParsed,
    };
  });
  res.json({
    alerts: annotated,
    total: alerts.length,
    activeCount: alerts.filter((a) => a.status === "active").length,
    auditCount: annotated.filter(a => a.classification === "audit").length,
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

  // Classify traffic: check whitelist first, then audit session header
  const alreadyWhitelisted = isWhitelisted(body.attackerIp, body.probeType);
  const auditHeader = req.headers["x-proxhq-audit-session"] as string | undefined;
  const auditSession = parseAuditSession(auditHeader);
  const isAudit = auditSession.valid || alreadyWhitelisted;

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

  bus.publish("beacon.alert", {
    alertId: alert.id,
    attackerIp: body.attackerIp,
    probeType: body.probeType,
    severity,
    classification: isAudit ? "audit" : "attack",
    nodeId: body.nodeId,
    nodeName: node.name,
    fingerprint: alert.attackerFingerprint,
  }, "beacons");

  res.status(201).json({
    ...alert,
    classification: isAudit ? "audit" : "attack",
    message: isAudit
      ? `Audit traffic from ProxhqVPN tool session ${auditSession.sessionId} — logged, not blocked.`
      : `Attack detected from ${body.attackerIp} — alert raised.`,
  });
});

// POST /beacons/:id/dismiss  — one-time dismissal
router.post("/:id/dismiss", async (req, res) => {
  const id = parseInt(req.params.id);
  const [alert] = await db.update(beaconAlertsTable)
    .set({ status: "dismissed" })
    .where(eq(beaconAlertsTable.id, id))
    .returning();
  if (!alert) return res.status(404).json({ error: "Alert not found" });
  res.json(alert);
});

// POST /beacons/:id/ignore — false positive: dismiss + suppress future alerts from this IP/probe
router.post("/:id/ignore", async (req, res) => {
  const id = parseInt(req.params.id);
  const [alert] = await db.update(beaconAlertsTable)
    .set({ status: "dismissed" })
    .where(eq(beaconAlertsTable.id, id))
    .returning();
  if (!alert) return res.status(404).json({ error: "Alert not found" });

  const body = z.object({
    reason: z.string().default("False positive — marked by developer"),
    allProbeTypes: z.boolean().default(false),
  }).parse(req.body ?? {});

  const existing = trustedWhitelist.find(e => e.ip === alert.attackerIp);
  if (existing) {
    if (body.allProbeTypes) existing.probeTypes = ["*"];
    else if (!existing.probeTypes.includes(alert.probeType)) existing.probeTypes.push(alert.probeType);
  } else {
    trustedWhitelist.push({
      ip: alert.attackerIp,
      reason: body.reason,
      addedAt: new Date().toISOString(),
      probeTypes: body.allProbeTypes ? ["*"] : [alert.probeType],
      addedBy: "allow-action",
    });
  }
  res.json({ alert, whitelistEntry: trustedWhitelist.find(e => e.ip === alert.attackerIp) });
});

// POST /beacons/:id/allow — trusted source: dismiss + add IP to full audit whitelist
router.post("/:id/allow", async (req, res) => {
  const id = parseInt(req.params.id);
  const [alert] = await db.update(beaconAlertsTable)
    .set({ status: "dismissed" })
    .where(eq(beaconAlertsTable.id, id))
    .returning();
  if (!alert) return res.status(404).json({ error: "Alert not found" });

  const body = z.object({
    reason: z.string().default("Trusted developer / audit source"),
  }).parse(req.body ?? {});

  const existing = trustedWhitelist.find(e => e.ip === alert.attackerIp);
  if (existing) {
    existing.probeTypes = ["*"];
    existing.reason = body.reason;
  } else {
    trustedWhitelist.push({
      ip: alert.attackerIp,
      reason: body.reason,
      addedAt: new Date().toISOString(),
      probeTypes: ["*"],
      addedBy: "allow-action",
    });
  }
  res.json({ alert, whitelistEntry: trustedWhitelist.find(e => e.ip === alert.attackerIp) });
});

// GET /beacons/whitelist — return trusted whitelist
router.get("/whitelist", (_req, res) => {
  res.json({ whitelist: trustedWhitelist, count: trustedWhitelist.length });
});

// POST /beacons/whitelist — manually add an IP
router.post("/whitelist", (req, res) => {
  const body = z.object({
    ip: z.string().min(7),
    reason: z.string().default("Manually whitelisted"),
    probeTypes: z.array(z.string()).default(["*"]),
  }).parse(req.body);

  const existing = trustedWhitelist.find(e => e.ip === body.ip);
  if (existing) {
    existing.reason = body.reason;
    existing.probeTypes = body.probeTypes;
    return res.json({ updated: existing });
  }
  const entry: WhitelistEntry = { ...body, addedAt: new Date().toISOString(), addedBy: "manual" };
  trustedWhitelist.push(entry);
  res.status(201).json({ added: entry });
});

// DELETE /beacons/whitelist/:ip — remove an IP from the whitelist
router.delete("/whitelist/:ip", (req, res) => {
  const ip = decodeURIComponent(req.params.ip);
  const idx = trustedWhitelist.findIndex(e => e.ip === ip);
  if (idx === -1) return res.status(404).json({ error: "IP not in whitelist" });
  const [removed] = trustedWhitelist.splice(idx, 1);
  res.json({ removed });
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
