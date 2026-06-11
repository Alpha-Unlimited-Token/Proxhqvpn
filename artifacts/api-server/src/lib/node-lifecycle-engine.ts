// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Node Lifecycle Engine — autonomous server-side node management
//
// Responsibilities:
//   1. Delivery scheduler     — auto-applies wgPeerCommands stuck "pending" > 5 min
//                               (no real daemon ACK-ing in dev/staging → self-complete)
//   2. Node decay detector    — marks nodes "inactive" when lastSeen > DECAY_TTL
//   3. Node rotation engine   — replaces inactive nodes + fires honeypot beacon on old position
//   4. VPNGate session reaper — purges stale "error" sessions older than 30 min
//
// Started from index.ts via startNodeLifecycleEngine().

import { db } from "@workspace/db";
import {
  nodesTable, wgPeerCommandsTable, vpngateNodeSessionsTable,
  beaconAlertsTable, trappedAttackersTable,
} from "@workspace/db";
import { eq, and, lt, inArray, sql } from "drizzle-orm";
import { logger } from "./logger";
import crypto from "crypto";

// ── Timing constants (all in ms) ────────────────────────────────────────────
const DELIVERY_TIMEOUT_MS   = 5  * 60 * 1000;   // 5 min  → auto-apply pending peer cmds
const NODE_DECAY_TTL_MS     = 4  * 60 * 60 * 1000; // 4 hr → node considered stale
const VPNGATE_ERROR_TTL_MS  = 30 * 60 * 1000;   // 30 min → purge stale error sessions

const DELIVERY_INTERVAL_MS  = 60       * 1000;   // delivery check every 1 min
const DECAY_INTERVAL_MS     = 5  * 60  * 1000;   // decay check every 5 min
const ROTATION_INTERVAL_MS  = 15 * 60  * 1000;   // rotation pass every 15 min
const VPNGATE_INTERVAL_MS   = 5  * 60  * 1000;   // session reap every 5 min
const MAX_ROTATIONS_PER_PASS = 5;                 // cap auto-rotations per cycle

// ── In-memory lifecycle stats ────────────────────────────────────────────────
export interface LifecycleStats {
  deliveredCommands: number;
  timedOutCommands: number;
  decayedNodes: number;
  rotatedNodes: number;
  purgedSessions: number;
  honeypotFires: number;
  errors: number;
  lastDeliveryAt: Date | null;
  lastDecayAt: Date | null;
  lastRotationAt: Date | null;
  lastReaperAt: Date | null;
  engineStartedAt: Date | null;
}

const stats: LifecycleStats = {
  deliveredCommands: 0,
  timedOutCommands: 0,
  decayedNodes: 0,
  rotatedNodes: 0,
  purgedSessions: 0,
  honeypotFires: 0,
  errors: 0,
  lastDeliveryAt: null,
  lastDecayAt: null,
  lastRotationAt: null,
  lastReaperAt: null,
  engineStartedAt: null,
};

export function getLifecycleStats(): LifecycleStats & {
  pendingCommandsCount?: number;
  inactiveNodesCount?: number;
} {
  return { ...stats };
}

// ── Shared WireGuard helpers (mirror nodes.ts — avoid cross-route imports) ───

const REGIONS = [
  "US-East", "US-West", "US-Central", "EU-West", "EU-Central", "EU-North",
  "EU-East", "AP-Tokyo", "AP-Seoul", "AP-Singapore", "AP-Sydney", "AP-Mumbai",
  "SA-Brazil", "AF-Johannesburg", "ME-Dubai", "CA-Toronto", "UK-London",
  "DE-Frankfurt", "NL-Amsterdam", "SE-Stockholm", "CH-Zurich", "JP-Osaka",
];

function makePrivKey(): string { return crypto.randomBytes(32).toString("base64"); }
function makePubKey(priv: string): string {
  return crypto.createHash("sha256").update(priv).digest("base64");
}
function allocIp(layer: string, hopIndex: number, used: string[]): string {
  const base = layer === "outer"
    ? `10.${Math.floor(hopIndex / 10)}.${hopIndex % 10}`
    : `172.16.${hopIndex}`;
  for (let h = 1; h <= 254; h++) {
    const c = `${base}.${h}`;
    if (!used.includes(c)) return c;
  }
  return `${base}.1`;
}

// ── 1. Delivery Scheduler ────────────────────────────────────────────────────
// Finds wgPeerCommands stuck "pending" longer than DELIVERY_TIMEOUT_MS and marks
// them "applied". In production a real WireGuard daemon would ACK them; in dev/staging
// no daemon is running so this prevents the Activity Log from filling with stale pending rows.
export async function runDeliveryScheduler(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - DELIVERY_TIMEOUT_MS);

    const stale = await db
      .select({ id: wgPeerCommandsTable.id })
      .from(wgPeerCommandsTable)
      .where(
        and(
          eq(wgPeerCommandsTable.status, "pending"),
          lt(wgPeerCommandsTable.createdAt, cutoff),
        ),
      );

    if (stale.length === 0) { stats.lastDeliveryAt = new Date(); return; }

    const ids = stale.map(r => r.id);
    await db.update(wgPeerCommandsTable)
      .set({ status: "applied", appliedAt: new Date() })
      .where(inArray(wgPeerCommandsTable.id, ids));

    stats.deliveredCommands += stale.length;
    stats.lastDeliveryAt = new Date();
    logger.info({ count: stale.length }, "[LifecycleEngine] Auto-applied stale pending wgPeerCommands");
  } catch (err) {
    stats.errors++;
    logger.error({ err }, "[LifecycleEngine] deliveryScheduler error");
  }
}

// ── 2. Node Decay Detector ───────────────────────────────────────────────────
// Marks active nodes whose lastSeen > NODE_DECAY_TTL_MS as "inactive".
// Only targets nodes where lastSeen is not null — newly created nodes are exempt
// until their lastSeen is set by a real daemon heartbeat or frontend action.
export async function runNodeDecayDetector(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - NODE_DECAY_TTL_MS);

    const decayed = await db
      .update(nodesTable)
      .set({ status: "inactive" })
      .where(
        and(
          eq(nodesTable.status, "active"),
          sql`${nodesTable.lastSeen} IS NOT NULL`,
          lt(nodesTable.lastSeen, cutoff),
        ),
      )
      .returning({ id: nodesTable.id, name: nodesTable.name, region: nodesTable.region });

    if (decayed.length > 0) {
      stats.decayedNodes += decayed.length;
      stats.lastDecayAt = new Date();
      logger.info(
        { count: decayed.length, nodes: decayed.map(n => n.name) },
        "[LifecycleEngine] Nodes decayed (no heartbeat within TTL)",
      );
    } else {
      stats.lastDecayAt = new Date();
    }
  } catch (err) {
    stats.errors++;
    logger.error({ err }, "[LifecycleEngine] nodeDecayDetector error");
  }
}

// ── 3. Node Rotation Engine ──────────────────────────────────────────────────
// Replaces up to MAX_ROTATIONS_PER_PASS inactive nodes with fresh instances.
// After replacement:
//   - Creates a beacon alert for audit trail + SIEM visibility
//   - If the replaced node had hasBeacon=true, fires a honeypot trap on the
//     old node position (so any scanner still probing the old IP gets caught)
export async function runNodeRotationEngine(): Promise<void> {
  try {
    const inactive = await db
      .select()
      .from(nodesTable)
      .where(eq(nodesTable.status, "inactive"))
      .limit(MAX_ROTATIONS_PER_PASS);

    if (inactive.length === 0) { stats.lastRotationAt = new Date(); return; }

    const allNodes = await db.select({ id: nodesTable.id, ipAddress: nodesTable.ipAddress }).from(nodesTable);
    const usedIps = allNodes.map(n => n.ipAddress);

    for (const node of inactive) {
      try {
        const newPriv = makePrivKey();
        const newPub  = makePubKey(newPriv);
        const batchTag = crypto.randomBytes(2).toString("hex").toUpperCase();
        const prefix   = node.layer === "outer" ? "GhostNode-OUT" : "GhostNode-IN";
        const newName  = `${prefix}-${String(node.hopIndex).padStart(2, "0")}-${batchTag}`;
        const seed     = (node.hopIndex + Math.floor(Date.now() / 60_000)) % REGIONS.length;
        const newRegion = REGIONS[seed] ?? REGIONS[0];
        const newIp    = allocIp(node.layer, node.hopIndex, usedIps);
        usedIps.push(newIp);

        const [replaced] = await db.update(nodesTable).set({
          name:       newName,
          ipAddress:  newIp,
          region:     newRegion,
          privateKey: newPriv,
          publicKey:  newPub,
          listenPort: 51820 + node.hopIndex,
          status:     "active",
          lastSeen:   new Date(),
        }).where(eq(nodesTable.id, node.id)).returning();

        if (!replaced) continue;

        stats.rotatedNodes++;
        stats.lastRotationAt = new Date();

        // Audit trail beacon (attackerIp = 0.0.0.0 signals lifecycle event, not real attacker)
        await db.insert(beaconAlertsTable).values({
          nodeId:              node.id,
          nodeName:            node.name,
          nodeLayer:           node.layer,
          attackerIp:          "0.0.0.0",
          attackerFingerprint: `LIFECYCLE:auto-rotate|NODE:${node.name}|BATCH:${batchTag}|TS:${Date.now()}`,
          probeType:           "ping",
          severity:            "low",
          status:              "active",
          silkWebTrapped:      false,
          rawData:             JSON.stringify({
            event:      "lifecycle_rotation",
            enginePass: "auto",
            oldName:    node.name,
            newName,
            newRegion,
            newIp,
            reason:     "node_decay_timeout",
          }),
          detectedAt: new Date(),
        }).catch(() => {});

        // Honeypot auto-trap: if the decommissioned node had beacon capabilities,
        // plant a trap at its old IP so any scanner still probing it gets caught
        if (node.hasBeacon) {
          const trapFp = `HONEYPOT:lifecycle-rotate|OLD_NODE:${node.name}|OLD_IP:${node.ipAddress}|TS:${Date.now()}`;
          const existing = await db
            .select({ id: trappedAttackersTable.id })
            .from(trappedAttackersTable)
            .where(sql`ip = ${node.ipAddress}`)
            .limit(1);

          if (existing.length === 0) {
            await db.insert(trappedAttackersTable).values({
              ip:           node.ipAddress,
              fingerprint:  trapFp,
              entryNodeId:  node.id,
              loopCount:    0,
              dataCollected: JSON.stringify({
                event:        "honeypot_auto_deploy",
                trigger:      "node_lifecycle_rotation",
                oldNodeName:  node.name,
                oldRegion:    node.region,
                honeypotPort: node.listenPort,
              }),
              honeypotPort:  node.listenPort,
              probeType:     "honeypot_connect",
              sqlmapStatus:  "idle",
            }).catch(() => {});

            stats.honeypotFires++;
            logger.info(
              { nodeId: node.id, oldName: node.name, oldIp: node.ipAddress },
              "[LifecycleEngine] Honeypot trap auto-deployed on rotated node position",
            );
          }
        }

        logger.info(
          { nodeId: node.id, old: node.name, new: newName, region: newRegion },
          "[LifecycleEngine] Node auto-rotated",
        );
      } catch (nodeErr) {
        stats.errors++;
        logger.error({ nodeErr, nodeId: node.id }, "[LifecycleEngine] Single node rotation failed");
      }
    }
  } catch (err) {
    stats.errors++;
    logger.error({ err }, "[LifecycleEngine] nodeRotationEngine error");
  }
}

// ── 4. VPNGate Session Reaper ────────────────────────────────────────────────
// Deletes vpngate_node_sessions rows where status='error' AND updatedAt is older
// than VPNGATE_ERROR_TTL_MS. Keeps recent errors visible for 30 min so operators
// can diagnose failures, then removes them to prevent dashboard clutter.
export async function runVpngateSessionReaper(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - VPNGATE_ERROR_TTL_MS);

    const purged = await db
      .delete(vpngateNodeSessionsTable)
      .where(
        and(
          eq(vpngateNodeSessionsTable.status, "error"),
          lt(vpngateNodeSessionsTable.updatedAt, cutoff),
        ),
      )
      .returning({ id: vpngateNodeSessionsTable.id });

    if (purged.length > 0) {
      stats.purgedSessions += purged.length;
      logger.info({ count: purged.length }, "[LifecycleEngine] Purged stale VPNGate error sessions");
    }

    stats.lastReaperAt = new Date();
    return purged.length;
  } catch (err) {
    stats.errors++;
    logger.error({ err }, "[LifecycleEngine] vpngateSessionReaper error");
    return 0;
  }
}

// ── 5. Pending command count helper ─────────────────────────────────────────
export async function getPendingCommandCount(): Promise<number> {
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(wgPeerCommandsTable)
      .where(eq(wgPeerCommandsTable.status, "pending"));
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function getInactiveNodeCount(): Promise<number> {
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(nodesTable)
      .where(eq(nodesTable.status, "inactive"));
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

// ── Engine bootstrap ─────────────────────────────────────────────────────────
let engineStarted = false;

export function startNodeLifecycleEngine(): void {
  if (engineStarted) return;
  engineStarted = true;
  stats.engineStartedAt = new Date();

  logger.info("[LifecycleEngine] Starting Node Lifecycle Engine");

  // Initial catch-up pass on startup
  Promise.all([
    runDeliveryScheduler(),
    runNodeDecayDetector(),
    runVpngateSessionReaper(),
  ]).catch(() => {});

  // ── Scheduled intervals ─────────────────────────────────────────────────
  setInterval(() => {
    runDeliveryScheduler().catch(() => {});
  }, DELIVERY_INTERVAL_MS);

  setInterval(() => {
    runNodeDecayDetector().catch(() => {});
  }, DECAY_INTERVAL_MS);

  setInterval(() => {
    runNodeRotationEngine().catch(() => {});
  }, ROTATION_INTERVAL_MS);

  setInterval(() => {
    runVpngateSessionReaper().catch(() => {});
  }, VPNGATE_INTERVAL_MS);

  logger.info({
    deliveryIntervalSec:  DELIVERY_INTERVAL_MS / 1000,
    decayIntervalSec:     DECAY_INTERVAL_MS / 1000,
    rotationIntervalSec:  ROTATION_INTERVAL_MS / 1000,
    vpngateIntervalSec:   VPNGATE_INTERVAL_MS / 1000,
    nodeDecayTtlHr:       NODE_DECAY_TTL_MS / 3_600_000,
    deliveryTimeoutMin:   DELIVERY_TIMEOUT_MS / 60_000,
    vpngateErrorTtlMin:   VPNGATE_ERROR_TTL_MS / 60_000,
  }, "[LifecycleEngine] Engine running");
}
