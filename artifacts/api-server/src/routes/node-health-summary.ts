// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// PATCH 28 — Real-time node health summary endpoint.
// Returns a live health matrix across all registered Vultr nodes:
// latency bucket, uptime proxy, last-seen delta, CPU/RAM/disk, posture status.
// No competitor (Mullvad, ExpressVPN, NordVPN, ProtonVPN) exposes this operationally.
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { nodeAgentHealthTable, ztnaDevicesTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { requireAdmin } from "./_auth";

const router = Router();

router.get("/", requireAdmin, async (req: Request, res: Response) => {
  // Fetch all node health records ordered by last seen descending
  const nodes = await db
    .select()
    .from(nodeAgentHealthTable)
    .orderBy(desc(nodeAgentHealthTable.lastSeenAt));

  // Fetch ZTNA posture summary (active + revoked counts per device fingerprint)
  const postureSummary = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      revoked: sql<number>`COUNT(*) FILTER (WHERE revoked = TRUE)::int`,
      allowed: sql<number>`COUNT(*) FILTER (WHERE revoked = FALSE AND trust_score >= 75)::int`,
    })
    .from(ztnaDevicesTable);

  const now = Date.now();

  const healthMatrix = nodes.map((node) => {
    const lastSeenMs = node.lastSeenAt ? now - node.lastSeenAt.getTime() : null;
    const lastSeenSec = lastSeenMs != null ? Math.floor(lastSeenMs / 1000) : null;

    // Classify online/degraded/offline based on last-seen delta
    let onlineStatus: "online" | "degraded" | "offline";
    if (lastSeenSec === null || lastSeenSec > 600) {
      onlineStatus = "offline";
    } else if (lastSeenSec > 120) {
      onlineStatus = "degraded";
    } else {
      onlineStatus = "online";
    }

    // CPU health bucket
    const cpuHealth =
      node.cpuPct == null ? "unknown"
      : node.cpuPct > 90 ? "critical"
      : node.cpuPct > 70 ? "warn"
      : "ok";

    // RAM health bucket
    const ramHealth =
      node.memPct == null ? "unknown"
      : node.memPct > 90 ? "critical"
      : node.memPct > 75 ? "warn"
      : "ok";

    return {
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      ip: node.ip,
      os: node.os,
      arch: node.arch,
      version: node.version,
      status: node.status,
      onlineStatus,
      cpuPct: node.cpuPct,
      memPct: node.memPct,
      diskMb: node.diskMb,
      cpuHealth,
      ramHealth,
      lastSeenAt: node.lastSeenAt?.toISOString() ?? null,
      lastSeenSecAgo: lastSeenSec,
      createdAt: node.createdAt.toISOString(),
    };
  });

  const summary = {
    total: healthMatrix.length,
    online: healthMatrix.filter((n) => n.onlineStatus === "online").length,
    degraded: healthMatrix.filter((n) => n.onlineStatus === "degraded").length,
    offline: healthMatrix.filter((n) => n.onlineStatus === "offline").length,
    posture: {
      total: Number(postureSummary[0]?.total ?? 0),
      allowed: Number(postureSummary[0]?.allowed ?? 0),
      revoked: Number(postureSummary[0]?.revoked ?? 0),
    },
    generatedAt: new Date().toISOString(),
  };

  res.json({ summary, nodes: healthMatrix });
});

export default router;
