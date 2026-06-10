import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

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

  const nodes = (nodesResult?.rows ?? []).map((n: any) => ({
    id:              n.id,
    name:            n.name,
    country:         n.country,
    city:            n.city,
    ipAddress:       n.ip_address,
    latencyMs:       n.latency_ms ?? 0,
    uptimePct:       99.5, // placeholder — real uptime from monitoring
    anomalyCount:    Number(n.anomaly_count),
    patchStatus:     "current",
    daemonEnrolled:  Boolean(n.daemon_enrolled),
    status:          n.status,
    trustScore:      computeTrustScore({
      latency_ms:     n.latency_ms ?? 0,
      uptime_pct:     99.5,
      anomaly_count:  Number(n.anomaly_count),
      daemon_enrolled: Boolean(n.daemon_enrolled),
    }),
  }));

  const avgTrust = nodes.length > 0
    ? Math.round(nodes.reduce((s, n) => s + n.trustScore, 0) / nodes.length)
    : 0;

  res.json({ nodes, avgTrust, total: nodes.length });
});

export default router;
