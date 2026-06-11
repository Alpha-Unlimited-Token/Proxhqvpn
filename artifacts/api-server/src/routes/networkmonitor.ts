// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
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
import fetch from "node-fetch";

const router = Router();

// ── Protocol map ──────────────────────────────────────────────────────────────
const PROBE_TO_PROTO: Record<string, string> = {
  port_scan:    "TCP",
  tunnel_probe: "UDP",
  ping:         "ICMP",
  packet_sniff: "TCP",
  traceroute:   "ICMP",
};
const PROBE_TO_PORT: Record<string, number> = {
  port_scan:    443,
  tunnel_probe: 51820,
  ping:         0,
  packet_sniff: 0,
  traceroute:   0,
};
const BASE_BYTES: Record<string, number> = {
  ping:         128,
  port_scan:    2048,
  traceroute:   512,
  packet_sniff: 8192,
  tunnel_probe: 4096,
  blocked:      512,
};
const SEV_MULT: Record<string, number> = {
  critical: 12, high: 6, medium: 3, low: 1,
};
const BASE_DURATION: Record<string, number> = {
  ping:         5000,
  port_scan:    45000,
  traceroute:   12000,
  packet_sniff: 120000,
  tunnel_probe: 60000,
  blocked:      1000,
};

// ── Geo cache ─────────────────────────────────────────────────────────────────
interface GeoEntry {
  country: string;
  countryCode: string;
  city: string;
  isp: string;
  flag: string;
  ts: number;
}
const geoCache = new Map<string, GeoEntry>();
const GEO_TTL = 60 * 60_000; // 1 hour

function toFlag(cc: string): string {
  if (!cc || cc.length !== 2) return "🌐";
  return cc.toUpperCase().split("").map(c =>
    String.fromCodePoint(c.charCodeAt(0) - 65 + 0x1F1E6)
  ).join("");
}

async function batchGeo(ips: string[]): Promise<void> {
  const uncached = ips.filter(ip => {
    const e = geoCache.get(ip);
    return !e || Date.now() - e.ts > GEO_TTL;
  });
  if (!uncached.length) return;

  // ip-api.com: free, no key, 100 per batch, 15 req/min
  const chunks: string[][] = [];
  for (let i = 0; i < uncached.length; i += 100) chunks.push(uncached.slice(i, i + 100));

  for (const chunk of chunks) {
    try {
      const r = await fetch("http://ip-api.com/batch?fields=status,country,countryCode,city,isp,query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk.map(ip => ({ query: ip }))),
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) continue;
      const data = await r.json() as any[];
      for (const item of data) {
        const isPrivate = item.status !== "success";
        geoCache.set(item.query, {
          country:     isPrivate ? "Private/Reserved" : item.country,
          countryCode: isPrivate ? "XX" : item.countryCode,
          city:        isPrivate ? "" : (item.city ?? ""),
          isp:         isPrivate ? "" : (item.isp ?? ""),
          flag:        isPrivate ? "🌐" : toFlag(item.countryCode),
          ts: Date.now(),
        });
      }
    } catch { /* geo lookup failed — continue without */ }
  }
}

// ── GET /stats ─────────────────────────────────────────────────────────────────
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const since24h = new Date(Date.now() - 24 * 3_600_000);

    const [nodeRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(nodesTable).where(eq(nodesTable.status, "active"));

    const [connRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userWgConfigsTable).where(isNull(userWgConfigsTable.revokedAt));

    const [threatRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(beaconAlertsTable).where(gte(beaconAlertsTable.detectedAt, since24h));

    const [blockedRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(blockedIpsTable).where(gte(blockedIpsTable.blockedAt, since24h));

    const [fwStatus] = await db.select().from(firewallStatusTable).limit(1);

    const [trappedRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(trappedAttackersTable);

    const activeConns = connRow?.count ?? 0;
    const avgBytesPerConn = 524288;
    const estimatedIn  = activeConns * avgBytesPerConn;
    const estimatedOut = activeConns * avgBytesPerConn * 0.6;
    const peakMbps     = activeConns > 0 ? Math.round(activeConns * 1.2 * 10) / 10 : 0;
    const pps          = activeConns * 80;

    res.json({
      activeConnections:  activeConns,
      totalBytesIn:       estimatedIn,
      totalBytesOut:      estimatedOut,
      packetsPerSecond:   pps,
      blockedConnections: (blockedRow?.count ?? 0) + (fwStatus?.packetsBlocked ?? 0),
      activeNodes:        nodeRow?.count ?? 0,
      threatAlerts:       threatRow?.count ?? 0,
      peakBandwidthMbps:  peakMbps,
      trappedAttackers:   trappedRow?.count ?? 0,
    });
  } catch { res.status(500).json({ error: "Failed to load stats" }); }
});

// ── GET /flows ─────────────────────────────────────────────────────────────────
router.get("/flows", async (_req: Request, res: Response) => {
  try {
    const since = new Date(Date.now() - 6 * 3_600_000);

    // Join beacon alerts with node details so Vultr IP/region are included
    const alerts = await db
      .select({
        id:                  beaconAlertsTable.id,
        nodeId:              beaconAlertsTable.nodeId,
        nodeName:            beaconAlertsTable.nodeName,
        nodeLayer:           beaconAlertsTable.nodeLayer,
        attackerIp:          beaconAlertsTable.attackerIp,
        attackerFingerprint: beaconAlertsTable.attackerFingerprint,
        probeType:           beaconAlertsTable.probeType,
        severity:            beaconAlertsTable.severity,
        status:              beaconAlertsTable.status,
        silkWebTrapped:      beaconAlertsTable.silkWebTrapped,
        rawData:             beaconAlertsTable.rawData,
        detectedAt:          beaconAlertsTable.detectedAt,
        // Node (Vultr server) details
        nodeIp:          nodesTable.ipAddress,
        nodePublicIp:    nodesTable.publicIp,
        nodeRegion:      nodesTable.region,
        nodeListenPort:  nodesTable.listenPort,
        nodeStatus:      nodesTable.status,
        nodeLatency:     nodesTable.latencyMs,
        nodeRamKey:      nodesTable.ramKeyLoaded,
        nodeHasBeacon:   nodesTable.hasBeacon,
        nodeHopIndex:    nodesTable.hopIndex,
      })
      .from(beaconAlertsTable)
      .leftJoin(nodesTable, eq(beaconAlertsTable.nodeId, nodesTable.id))
      .where(gte(beaconAlertsTable.detectedAt, since))
      .orderBy(desc(beaconAlertsTable.detectedAt))
      .limit(50);

    const blockedRaw = await db
      .select()
      .from(blockedIpsTable)
      .where(gte(blockedIpsTable.blockedAt, since))
      .orderBy(desc(blockedIpsTable.blockedAt))
      .limit(20);

    // Batch geo-lookup all unique attacker IPs
    const uniqueIps = [...new Set([
      ...alerts.map(a => a.attackerIp),
      ...blockedRaw.map(b => b.ip),
    ])];
    await batchGeo(uniqueIps);

    const flows = alerts.map(a => {
      const mult = SEV_MULT[a.severity] ?? 1;
      const baseB = BASE_BYTES[a.probeType] ?? 512;
      const geo = geoCache.get(a.attackerIp);
      return {
        id:           `flow-beacon-${a.id}`,
        srcIp:        a.attackerIp,
        destHost:     a.nodeName,
        destIp:       a.nodePublicIp ?? a.nodeIp ?? "—",
        destPort:     PROBE_TO_PORT[a.probeType] ?? 443,
        destWgPort:   a.nodeListenPort ?? 51820,
        destRegion:   a.nodeRegion ?? "Unknown",
        destLayer:    a.nodeLayer,
        destStatus:   a.nodeStatus ?? "unknown",
        destLatency:  a.nodeLatency ?? 0,
        destRamKey:   a.nodeRamKey ?? false,
        destHasBeacon: a.nodeHasBeacon ?? false,
        destHopIndex: a.nodeHopIndex ?? 0,
        protocol:     PROBE_TO_PROTO[a.probeType] ?? "TCP",
        probeType:    a.probeType,
        bytesIn:      Math.round(baseB * mult * 0.6),
        bytesOut:     Math.round(baseB * mult),
        duration:     Math.round((BASE_DURATION[a.probeType] ?? 15000) * (mult / 2)),
        country:      geo?.country ?? "",
        countryCode:  geo?.countryCode ?? "",
        city:         geo?.city ?? "",
        isp:          geo?.isp ?? "",
        flag:         geo?.flag ?? "🌐",
        threat:       (a.severity === "critical" || a.severity === "high") ? a.probeType.replace(/_/g, " ") : null,
        status:       a.status === "active" ? "active" : "closed",
        severity:     a.severity,
        silkWebTrapped: a.silkWebTrapped,
        fingerprint:  a.attackerFingerprint,
        rawData:      a.rawData,
        timestamp:    a.detectedAt instanceof Date ? a.detectedAt.toISOString() : String(a.detectedAt),
      };
    });

    const blockedFlows = blockedRaw.map(b => {
      const geo = geoCache.get(b.ip);
      return {
        id:          `flow-block-${b.id}`,
        srcIp:       b.ip,
        destHost:    "Firewall",
        destIp:      "—",
        destPort:    0,
        destWgPort:  0,
        destRegion:  "—",
        destLayer:   "outer",
        destStatus:  "blocked",
        destLatency: 0,
        destRamKey:  false,
        destHasBeacon: false,
        destHopIndex: 0,
        protocol:    "TCP",
        probeType:   "blocked",
        bytesIn:     256,
        bytesOut:    512,
        duration:    1000,
        country:     geo?.country ?? "",
        countryCode: geo?.countryCode ?? "",
        city:        geo?.city ?? "",
        isp:         geo?.isp ?? "",
        flag:        geo?.flag ?? "🌐",
        threat:      "blocked",
        status:      "blocked",
        severity:    "medium",
        silkWebTrapped: false,
        fingerprint: "",
        rawData:     null,
        timestamp:   b.blockedAt instanceof Date ? b.blockedAt.toISOString() : String(b.blockedAt),
      };
    });

    const all = [...flows, ...blockedFlows].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    res.json(all);
  } catch { res.status(500).json({ error: "Failed to load flows" }); }
});

// ── GET /timeline ──────────────────────────────────────────────────────────────
router.get("/timeline", async (_req: Request, res: Response) => {
  try {
    const hours = 24;
    const since = new Date(Date.now() - hours * 3_600_000);

    const [alerts, blocked] = await Promise.all([
      db.select().from(beaconAlertsTable).where(gte(beaconAlertsTable.detectedAt, since)),
      db.select().from(blockedIpsTable).where(gte(blockedIpsTable.blockedAt, since)),
    ]);

    const buckets = Array.from({ length: hours }, (_, h) => ({
      time: new Date(Date.now() - (hours - 1 - h) * 3_600_000).toISOString(),
      bytesIn: 0, bytesOut: 0, connections: 0, blocked: 0,
    }));

    for (const a of alerts) {
      const ts = a.detectedAt instanceof Date ? a.detectedAt : new Date(a.detectedAt as string);
      const idx = hours - 1 - Math.min(Math.floor((Date.now() - ts.getTime()) / 3_600_000), hours - 1);
      if (idx >= 0 && idx < hours) {
        buckets[idx].connections++;
        const mult = SEV_MULT[a.severity] ?? 1;
        buckets[idx].bytesIn  += Math.round((BASE_BYTES[a.probeType] ?? 512) * mult * 0.6);
        buckets[idx].bytesOut += Math.round((BASE_BYTES[a.probeType] ?? 512) * mult);
      }
    }
    for (const b of blocked) {
      const ts = b.blockedAt instanceof Date ? b.blockedAt : new Date(b.blockedAt as string);
      const idx = hours - 1 - Math.min(Math.floor((Date.now() - ts.getTime()) / 3_600_000), hours - 1);
      if (idx >= 0 && idx < hours) buckets[idx].blocked++;
    }

    res.json(buckets);
  } catch { res.status(500).json({ error: "Failed to load timeline" }); }
});

// ── GET /protocols ─────────────────────────────────────────────────────────────
router.get("/protocols", async (_req: Request, res: Response) => {
  try {
    const alerts = await db.select().from(beaconAlertsTable).limit(2000);
    const protoBytes: Record<string, number> = {};
    const protoCount: Record<string, number> = {};
    for (const a of alerts) {
      const proto = PROBE_TO_PROTO[a.probeType] ?? "TCP";
      const mult  = SEV_MULT[a.severity] ?? 1;
      protoBytes[proto] = (protoBytes[proto] ?? 0) + (BASE_BYTES[a.probeType] ?? 512) * mult;
      protoCount[proto] = (protoCount[proto] ?? 0) + 1;
    }
    const total = Object.values(protoBytes).reduce((a, b) => a + b, 0) || 1;
    const protocols = Object.entries(protoBytes)
      .map(([protocol, bytes]) => ({
        protocol, bytes,
        count: protoCount[protocol] ?? 0,
        pct: Math.round((bytes / total) * 100),
      }))
      .sort((a, b) => b.bytes - a.bytes);
    res.json(protocols);
  } catch { res.status(500).json({ error: "Failed to load protocols" }); }
});

// ── GET /countries ─────────────────────────────────────────────────────────────
router.get("/countries", async (_req: Request, res: Response) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 3_600_000); // 30 days

    const [alerts, blocked] = await Promise.all([
      db.select({
        ip:       beaconAlertsTable.attackerIp,
        severity: beaconAlertsTable.severity,
        probeType: beaconAlertsTable.probeType,
        detectedAt: beaconAlertsTable.detectedAt,
      }).from(beaconAlertsTable).where(gte(beaconAlertsTable.detectedAt, since)),
      db.select({
        ip: blockedIpsTable.ip,
        blockedAt: blockedIpsTable.blockedAt,
      }).from(blockedIpsTable).where(gte(blockedIpsTable.blockedAt, since)),
    ]);

    const uniqueIps = [...new Set([...alerts.map(a => a.ip), ...blocked.map(b => b.ip)])];
    await batchGeo(uniqueIps);

    // Build per-country aggregations
    type CountryBucket = {
      code: string; name: string; flag: string;
      attacks: number; blocked: number; bytes: number;
      ips: Set<string>; topIps: string[];
      lastSeen: string;
    };
    const byCountry = new Map<string, CountryBucket>();

    for (const a of alerts) {
      const geo = geoCache.get(a.ip);
      if (!geo) continue;
      const cc = geo.countryCode;
      if (!byCountry.has(cc)) {
        byCountry.set(cc, {
          code: cc, name: geo.country, flag: geo.flag,
          attacks: 0, blocked: 0, bytes: 0,
          ips: new Set(), topIps: [],
          lastSeen: "",
        });
      }
      const b = byCountry.get(cc)!;
      b.attacks++;
      const mult = SEV_MULT[a.severity] ?? 1;
      b.bytes += Math.round((BASE_BYTES[a.probeType] ?? 512) * mult);
      b.ips.add(a.ip);
      const ts = a.detectedAt instanceof Date ? a.detectedAt.toISOString() : String(a.detectedAt);
      if (!b.lastSeen || ts > b.lastSeen) b.lastSeen = ts;
    }

    for (const bl of blocked) {
      const geo = geoCache.get(bl.ip);
      if (!geo) continue;
      const cc = geo.countryCode;
      if (!byCountry.has(cc)) {
        byCountry.set(cc, {
          code: cc, name: geo.country, flag: geo.flag,
          attacks: 0, blocked: 0, bytes: 0,
          ips: new Set(), topIps: [],
          lastSeen: "",
        });
      }
      const b = byCountry.get(cc)!;
      b.blocked++;
      b.bytes += 512;
      b.ips.add(bl.ip);
    }

    const result = [...byCountry.values()]
      .map(b => ({
        code:     b.code,
        name:     b.name,
        flag:     b.flag,
        attacks:  b.attacks,
        blocked:  b.blocked,
        bytes:    b.bytes,
        uniqueIps: b.ips.size,
        topIps:   [...b.ips].slice(0, 5),
        lastSeen: b.lastSeen,
      }))
      .sort((a, b) => b.attacks - a.attacks);

    res.json(result);
  } catch { res.status(500).json({ error: "Failed to load countries" }); }
});

export default router;
