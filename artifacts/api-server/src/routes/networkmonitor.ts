import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  nodesTable,
  beaconAlertsTable,
  blockedIpsTable,
  firewallStatusTable,
  userWgConfigsTable,
  trappedAttackersTable,
} from "@workspace/db";
import { eq, sql, gte, isNull, desc } from "drizzle-orm";

const router = Router();

const PROBE_TO_PROTO: Record<string, string> = {
  port_scan: "TCP",
  tunnel_probe: "UDP",
  ping: "ICMP",
  packet_sniff: "TCP",
  traceroute: "ICMP",
};

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const since24h = new Date(Date.now() - 24 * 3_600_000);

    const [nodeRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(nodesTable)
      .where(eq(nodesTable.status, "active"));

    const [connRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userWgConfigsTable)
      .where(isNull(userWgConfigsTable.revokedAt));

    const [threatRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(beaconAlertsTable)
      .where(gte(beaconAlertsTable.detectedAt, since24h));

    const [blockedRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(blockedIpsTable)
      .where(gte(blockedIpsTable.blockedAt, since24h));

    const [fwStatus] = await db.select().from(firewallStatusTable).limit(1);

    const [trappedRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(trappedAttackersTable);

    const activeConns = connRow?.count ?? 0;
    const avgBytesPerConn = 524288; // 512 KB average per active WireGuard session
    const estimatedIn  = activeConns * avgBytesPerConn;
    const estimatedOut = activeConns * avgBytesPerConn * 0.6;
    const peakMbps     = activeConns > 0 ? Math.round(activeConns * 1.2 * 10) / 10 : 0;
    const pps          = activeConns * 80;

    res.json({
      activeConnections: activeConns,
      totalBytesIn: estimatedIn,
      totalBytesOut: estimatedOut,
      packetsPerSecond: pps,
      blockedConnections: (blockedRow?.count ?? 0) + (fwStatus?.packetsBlocked ?? 0),
      activeNodes: nodeRow?.count ?? 0,
      threatAlerts: threatRow?.count ?? 0,
      peakBandwidthMbps: peakMbps,
      trappedAttackers: trappedRow?.count ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/flows", async (_req: Request, res: Response) => {
  try {
    const since = new Date(Date.now() - 6 * 3_600_000);
    const alerts = await db
      .select()
      .from(beaconAlertsTable)
      .where(gte(beaconAlertsTable.detectedAt, since))
      .orderBy(desc(beaconAlertsTable.detectedAt))
      .limit(50);

    const flows = alerts.map((a) => ({
      id: `flow-beacon-${a.id}`,
      srcIp: a.attackerIp,
      destHost: a.nodeName,
      destPort: a.probeType === "port_scan" ? 443 : a.probeType === "tunnel_probe" ? 51820 : 80,
      protocol: PROBE_TO_PROTO[a.probeType] ?? "TCP",
      probeType: a.probeType,
      bytesIn: 0,
      bytesOut: 0,
      duration: 0,
      country: "",
      threat: a.severity === "critical" || a.severity === "high" ? a.probeType.replace("_", " ") : null,
      status: a.status === "active" ? "active" : "closed",
      severity: a.severity,
      silkWebTrapped: a.silkWebTrapped,
      timestamp: a.detectedAt instanceof Date ? a.detectedAt.toISOString() : String(a.detectedAt),
    }));

    const recentBlocked = await db
      .select()
      .from(blockedIpsTable)
      .where(gte(blockedIpsTable.blockedAt, since))
      .orderBy(desc(blockedIpsTable.blockedAt))
      .limit(20);

    const blockedFlows = recentBlocked.map((b) => ({
      id: `flow-block-${b.id}`,
      srcIp: b.ip,
      destHost: "Firewall",
      destPort: 0,
      protocol: "TCP",
      probeType: "blocked",
      bytesIn: 0,
      bytesOut: 0,
      duration: 0,
      country: "",
      threat: "blocked",
      status: "blocked",
      severity: "medium",
      silkWebTrapped: false,
      timestamp: b.blockedAt instanceof Date ? b.blockedAt.toISOString() : String(b.blockedAt),
    }));

    const all = [...flows, ...blockedFlows].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    res.json(all);
  } catch (err) {
    res.status(500).json({ error: "Failed to load flows" });
  }
});

router.get("/timeline", async (_req: Request, res: Response) => {
  try {
    const hours = 24;
    const since = new Date(Date.now() - hours * 3_600_000);

    const alerts = await db
      .select()
      .from(beaconAlertsTable)
      .where(gte(beaconAlertsTable.detectedAt, since));

    const blocked = await db
      .select()
      .from(blockedIpsTable)
      .where(gte(blockedIpsTable.blockedAt, since));

    const buckets = Array.from({ length: hours }, (_, h) => ({
      time: new Date(Date.now() - (hours - 1 - h) * 3_600_000).toISOString(),
      bytesIn: 0,
      bytesOut: 0,
      connections: 0,
      blocked: 0,
    }));

    for (const a of alerts) {
      const ts = a.detectedAt instanceof Date ? a.detectedAt : new Date(a.detectedAt as string);
      const hoursAgo = Math.floor((Date.now() - ts.getTime()) / 3_600_000);
      const idx = hours - 1 - Math.min(hoursAgo, hours - 1);
      if (idx >= 0 && idx < hours) buckets[idx].connections++;
    }

    for (const b of blocked) {
      const ts = b.blockedAt instanceof Date ? b.blockedAt : new Date(b.blockedAt as string);
      const hoursAgo = Math.floor((Date.now() - ts.getTime()) / 3_600_000);
      const idx = hours - 1 - Math.min(hoursAgo, hours - 1);
      if (idx >= 0 && idx < hours) buckets[idx].blocked++;
    }

    res.json(buckets);
  } catch (err) {
    res.status(500).json({ error: "Failed to load timeline" });
  }
});

router.get("/protocols", async (_req: Request, res: Response) => {
  try {
    const alerts = await db.select().from(beaconAlertsTable).limit(1000);

    const protoCount: Record<string, number> = {};
    for (const a of alerts) {
      const proto = PROBE_TO_PROTO[a.probeType] ?? "TCP";
      protoCount[proto] = (protoCount[proto] ?? 0) + 1;
    }

    const total = Object.values(protoCount).reduce((a, b) => a + b, 0) || 1;
    const protocols = Object.entries(protoCount)
      .map(([protocol, count]) => ({
        protocol,
        count,
        bytes: count * 512,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    res.json(protocols);
  } catch (err) {
    res.status(500).json({ error: "Failed to load protocols" });
  }
});

router.get("/countries", (_req: Request, res: Response) => {
  res.json([]);
});

export default router;
