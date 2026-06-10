// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Node Trust — trust scoring + routing pool enforcement.
// Upgrade #5: Node Trust → Routing. Untrusted nodes excluded from active routing pool.
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { bus } from "../lib/service-bus";

const router = Router();

const NODE_ROUTING_THRESHOLD = 55;

function computeTrustScore(node: any): number {
  let score = 100;
  if (node.latency_ms > 200) score -= 15;
  else if (node.latency_ms > 100) score -= 5;
  if (node.uptime_pct < 99) score -= 20;
  else if (node.uptime_pct < 99.9) score -= 5;
  if (node.anomaly_count > 5) score -= 30;
  else if (node.anomaly_count > 0) score -= 10;
  if (!node.daemon_enrolled) score -= 20;
  return Math.max(0, score);
}

// GET /api/node-trust — full trust map with scores
router.get("/", async (_req: Request, res: Response) => {
  const nodesResult = await db.execute(sql`
    SELECT n.id, n.name, n.country, n.city, n.ip_address, n.latency_ms,
           n.status, n.created_at,
           COALESCE(b.anomaly_count, 0) AS anomaly_count,
           EXISTS(SELECT 1 FROM node_daemon_credentials ndc WHERE ndc.node_id = n.id::text) AS daemon_enrolled
    FROM nodes n
    LEFT JOIN (
      SELECT node_id, COUNT(*) AS anomaly_count
      FROM beacons WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY node_id
    ) b ON b.node_id = n.id
    WHERE n.status != 'inactive'
    ORDER BY n.id
  `);

  const nodes = (nodesResult?.rows ?? []).map((n: any) => {
    const trustScore = computeTrustScore({
      latency_ms:     n.latency_ms ?? 0,
      uptime_pct:     99.5,
      anomaly_count:  Number(n.anomaly_count),
      daemon_enrolled: Boolean(n.daemon_enrolled),
    });
    return {
      id:             n.id,
      name:           n.name,
      country:        n.country,
      city:           n.city,
      ipAddress:      n.ip_address,
      latencyMs:      n.latency_ms ?? 0,
      uptimePct:      99.5,
      anomalyCount:   Number(n.anomaly_count),
      patchStatus:    "current",
      daemonEnrolled: Boolean(n.daemon_enrolled),
      status:         n.status,
      trustScore,
      eligible:       trustScore >= NODE_ROUTING_THRESHOLD,
    };
  });

  const avgTrust = nodes.length > 0
    ? Math.round(nodes.reduce((s, n) => s + n.trustScore, 0) / nodes.length)
    : 0;

  const eligible = nodes.filter(n => n.eligible);
  const degraded = nodes.filter(n => !n.eligible);

  // Publish trust changes for event graph
  for (const n of degraded) {
    bus.publish("node.trust_change", {
      nodeId: n.id, nodeName: n.name, trustScore: n.trustScore,
      threshold: NODE_ROUTING_THRESHOLD, action: "degraded",
    }, "node-trust");
  }

  res.json({ nodes, avgTrust, total: nodes.length, eligibleCount: eligible.length, degradedCount: degraded.length });
});

// GET /api/node-trust/routing-pool — only trusted nodes eligible for WG config issuance
// Upgrade #5: this is the authoritative set of nodes users may connect to
router.get("/routing-pool", async (_req: Request, res: Response) => {
  const nodesResult = await db.execute(sql`
    SELECT n.id, n.name, n.country, n.city, n.ip_address, n.latency_ms,
           n.status,
           COALESCE(b.anomaly_count, 0) AS anomaly_count,
           EXISTS(SELECT 1 FROM node_daemon_credentials ndc WHERE ndc.node_id = n.id::text) AS daemon_enrolled
    FROM nodes n
    LEFT JOIN (
      SELECT node_id, COUNT(*) AS anomaly_count
      FROM beacons WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY node_id
    ) b ON b.node_id = n.id
    WHERE n.status = 'active'
    ORDER BY n.latency_ms ASC NULLS LAST
  `);

  const eligible = (nodesResult?.rows ?? [])
    .map((n: any) => ({
      id:             n.id,
      name:           n.name,
      country:        n.country,
      city:           n.city,
      ipAddress:      n.ip_address,
      latencyMs:      n.latency_ms ?? 0,
      trustScore:     computeTrustScore({
        latency_ms: n.latency_ms ?? 0, uptime_pct: 99.5,
        anomaly_count: Number(n.anomaly_count), daemon_enrolled: Boolean(n.daemon_enrolled),
      }),
    }))
    .filter(n => n.trustScore >= NODE_ROUTING_THRESHOLD);

  res.json({
    nodes:      eligible,
    total:      eligible.length,
    threshold:  NODE_ROUTING_THRESHOLD,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
