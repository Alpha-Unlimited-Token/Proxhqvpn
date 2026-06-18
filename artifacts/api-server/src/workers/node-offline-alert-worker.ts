// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Fires a security event when a Vultr node goes silent for > 5 minutes.
// Patch 8 — node offline alerting.
import { registerWorker } from "../lib/worker-registry";
import { db } from "@workspace/db";
import { nodeAgentHealthTable } from "@workspace/db";
import { lt, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { shipSecurityEvent } from "../lib/siem";
import { broadcastSecurityEvent } from "../lib/sse-event-bus";

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// Track which nodes we've already alerted on to avoid alert storms
const _alertedNodes = new Set<string>();

registerWorker({
  name: "node-offline-alert-worker",
  intervalMs: 60_000,
  enabled: () => process.env.PROXHQ_ENABLE_NODE_OFFLINE_ALERTING !== "0",
  async run() {
    const cutoff = new Date(Date.now() - OFFLINE_THRESHOLD_MS);

    const offlineNodes = await db
      .select({
        nodeId: nodeAgentHealthTable.nodeId,
        nodeName: nodeAgentHealthTable.nodeName,
        ip: nodeAgentHealthTable.ip,
        lastSeenAt: nodeAgentHealthTable.lastSeenAt,
      })
      .from(nodeAgentHealthTable)
      .where(lt(nodeAgentHealthTable.lastSeenAt, cutoff));

    for (const node of offlineNodes) {
      if (_alertedNodes.has(node.nodeId)) continue;

      const silentMs = Date.now() - (node.lastSeenAt?.getTime() ?? 0);
      const silentMin = Math.round(silentMs / 60_000);

      logger.warn(
        { nodeId: node.nodeId, nodeName: node.nodeName, ip: node.ip, silentMin },
        "Node offline alert: node has not checked in",
      );

      await shipSecurityEvent({
        actor: "system",
        action: "node.offline_detected",
        resource: `node:${node.nodeId}`,
        result: "error",
        severity: "high",
        metadata: { nodeName: node.nodeName, ip: node.ip, silentMin, lastSeenAt: node.lastSeenAt?.toISOString() },
      });

      broadcastSecurityEvent({
        type:      "node.offline",
        severity:  "high",
        payload:   { nodeId: node.nodeId, nodeName: node.nodeName, ip: node.ip, silentMin },
        adminOnly: true,
      });

      _alertedNodes.add(node.nodeId);
    }

    // Clear recovered nodes from the alert set
    if (offlineNodes.length === 0 && _alertedNodes.size > 0) {
      _alertedNodes.clear();
    } else if (_alertedNodes.size > 0) {
      const offlineIds = new Set(offlineNodes.map((n) => n.nodeId));
      for (const id of _alertedNodes) {
        if (!offlineIds.has(id)) _alertedNodes.delete(id);
      }
    }
  },
});
