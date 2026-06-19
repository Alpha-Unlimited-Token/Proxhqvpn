// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Public firewall-prompts endpoints — no Clerk auth required (global_admin bucket)
import { Router } from "express";
import { db } from "@workspace/db";
import {
  firewallConnectionPromptsTable, firewallUserDecisionsTable,
  blockedIpsTable, beaconAlertsTable, nodeAgentEventsTable,
} from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../lib/logger";

const router = Router();
const GLOBAL_UID = "global_admin";

function makeKey(sourceIp: string, destPort?: string, protocol?: string): string {
  if (destPort) return `${sourceIp}:${destPort}:${protocol ?? "tcp"}`;
  return sourceIp;
}

const SAMPLE_THREATS = [
  { sourceIp: "185.220.101.47", destPort: "22",   protocol: "tcp", reason: "Tor exit node probing SSH port",             threatLevel: "high" },
  { sourceIp: "45.33.32.156",   destPort: "80",   protocol: "tcp", reason: "Known scanner — Shodan crawler",             threatLevel: "medium" },
  { sourceIp: "194.165.16.11",  destPort: "443",  protocol: "tcp", reason: "Inbound TLS from high-risk ASN",             threatLevel: "medium" },
  { sourceIp: "103.199.17.3",   destPort: "3389", protocol: "tcp", reason: "RDP brute-force attempt detected",           threatLevel: "critical" },
  { sourceIp: "92.118.160.4",   destPort: "8080", protocol: "tcp", reason: "HTTP proxy scanner — Censys",               threatLevel: "low" },
  { sourceIp: "162.142.125.81", destPort: "1194", protocol: "udp", reason: "OpenVPN port probe from datacenter IP",     threatLevel: "medium" },
  { sourceIp: "5.188.86.172",   destPort: "21",   protocol: "tcp", reason: "FTP brute-force from botnet node",          threatLevel: "high" },
  { sourceIp: "209.126.5.11",   destPort: "25",   protocol: "tcp", reason: "SMTP relay attempt from flagged IP",        threatLevel: "medium" },
];

// GET /api/firewall/prompts
router.get("/prompts", async (_req, res) => {
  const existing = await db.select().from(firewallConnectionPromptsTable)
    .where(eq(firewallConnectionPromptsTable.userId, GLOBAL_UID));
  const pendingCount = existing.filter(p => p.decision === "pending").length;

  if (pendingCount < 3) {
    const seenKeys = new Set(existing.map(p => p.patternKey));
    const toInsert: Array<typeof firewallConnectionPromptsTable.$inferInsert> = [];

    // Priority 1: real ghost-trap events from node agents
    try {
      const ghostEvents = await db.select().from(nodeAgentEventsTable)
        .where(inArray(nodeAgentEventsTable.eventType, [
          "ghost_trap_tcp", "ghost_trap_udp", "ghost_trap_event",
          "honeypot_hit", "ghost_probe", "trap_triggered",
        ]))
        .orderBy(desc(nodeAgentEventsTable.createdAt)).limit(50);

      for (const ev of ghostEvents) {
        const p = ev.payload as Record<string, unknown> | null;
        const srcIp = (p?.src_ip ?? p?.srcIp ?? p?.source_ip ?? null) as string | null;
        if (!srcIp) continue;
        const dp = (p?.dest_port ?? p?.destPort ?? p?.port ?? null);
        const portStr = dp != null ? String(dp) : undefined;
        const key = makeKey(srcIp, portStr);
        if (!seenKeys.has(key)) {
          toInsert.push({
            userId: GLOBAL_UID, sourceIp: srcIp,
            destPort: portStr ?? null, protocol: "tcp",
            reason: `Ghost-trap triggered${portStr ? ` on port ${portStr}` : ""} — real attacker probe from ${srcIp} (node: ${ev.nodeId})`,
            threatLevel: "high", patternKey: key, decision: "pending",
            metadata: { nodeId: ev.nodeId, eventType: ev.eventType, rawPayload: p },
          });
          seenKeys.add(key);
          if (toInsert.length >= 8) break;
        }
      }
    } catch (e) { logger.error({ err: e }, "ghost-trap event query failed"); }

    // Priority 2: beacon alerts
    if (toInsert.length < 3) {
      try {
        const beacons = await db.select().from(beaconAlertsTable)
          .orderBy(desc(beaconAlertsTable.detectedAt)).limit(20);
        for (const b of beacons) {
          const ip = b.attackerIp ?? "0.0.0.0";
          const key = makeKey(ip);
          if (!seenKeys.has(key)) {
            const pt = b.probeType ?? "ping";
            const threat = pt === "tunnel_probe" ? "critical" : pt === "port_scan" ? "high" : "medium";
            toInsert.push({
              userId: GLOBAL_UID, sourceIp: ip, destPort: null, protocol: "tcp",
              reason: `${pt.replace(/_/g, " ").toUpperCase()} detected — suspicious activity from ${ip}`,
              threatLevel: threat, patternKey: key, decision: "pending",
              metadata: { probeType: pt, nodeId: b.nodeId },
            });
            seenKeys.add(key);
            if (toInsert.length >= 5) break;
          }
        }
      } catch (e) { logger.error({ err: e }, "beacon query failed"); }
    }

    // Priority 3: sample threats fallback
    if (toInsert.length < 2) {
      for (const t of SAMPLE_THREATS) {
        const key = makeKey(t.sourceIp, t.destPort, t.protocol);
        if (!seenKeys.has(key)) {
          toInsert.push({ userId: GLOBAL_UID, ...t, patternKey: key, decision: "pending", metadata: null });
          seenKeys.add(key);
          if (toInsert.length >= 3) break;
        }
      }
    }

    if (toInsert.length > 0) {
      try {
        await db.insert(firewallConnectionPromptsTable).values(toInsert).onConflictDoNothing();
        logger.info({ inserted: toInsert.length }, "firewall prompts seeded");
      } catch (e) { logger.error({ err: e }, "firewall prompts seed insert failed"); }
    }
  }

  const prompts = await db.select().from(firewallConnectionPromptsTable)
    .where(eq(firewallConnectionPromptsTable.userId, GLOBAL_UID))
    .orderBy(desc(firewallConnectionPromptsTable.createdAt));

  res.json({ prompts, pendingCount: prompts.filter(p => p.decision === "pending").length });
});

// POST /api/firewall/prompts/:id/decide
router.post("/prompts/:id/decide", async (req, res) => {
  const schema = z.object({
    decision: z.enum(["allow_once", "allow_always", "block_always", "dismissed"]),
    notes: z.string().max(256).optional(),
  });
  const body = schema.parse(req.body);
  const id = parseInt(req.params.id);

  const [prompt] = await db.select().from(firewallConnectionPromptsTable)
    .where(eq(firewallConnectionPromptsTable.id, id));
  if (!prompt) { res.status(404).json({ error: "Not found" }); return; }

  await db.update(firewallConnectionPromptsTable)
    .set({ decision: body.decision, resolvedAt: new Date() })
    .where(eq(firewallConnectionPromptsTable.id, id));

  if (body.decision === "allow_always" || body.decision === "block_always") {
    const decision = body.decision === "allow_always" ? "allow" : "block";
    const existing = await db.select().from(firewallUserDecisionsTable)
      .where(eq(firewallUserDecisionsTable.patternKey, prompt.patternKey));
    const prev = existing.find(d => d.userId === GLOBAL_UID);

    if (prev) {
      await db.update(firewallUserDecisionsTable)
        .set({ decision, lastSeenAt: new Date(), hitCount: prev.hitCount + 1, notes: body.notes ?? prev.notes })
        .where(eq(firewallUserDecisionsTable.id, prev.id));
    } else {
      await db.insert(firewallUserDecisionsTable).values({
        userId: GLOBAL_UID, patternKey: prompt.patternKey,
        patternType: prompt.destPort ? "ip_port" : "ip",
        decision, label: null,
        sourceIp: prompt.sourceIp, destPort: prompt.destPort,
        protocol: prompt.protocol, hitCount: 1,
        notes: body.notes ?? null,
      });
    }

    if (decision === "block") {
      const already = await db.select().from(blockedIpsTable)
        .where(eq(blockedIpsTable.ip, prompt.sourceIp));
      if (already.length === 0) {
        await db.insert(blockedIpsTable).values({
          ip: prompt.sourceIp, reason: `Admin blocked — ${prompt.reason}`,
          autoBlocked: false, hitCount: 1,
        });
      }
    }
  }

  res.json({ ok: true, decision: body.decision });
});

// GET /api/firewall/user-decisions
router.get("/user-decisions", async (_req, res) => {
  const decisions = await db.select().from(firewallUserDecisionsTable)
    .where(eq(firewallUserDecisionsTable.userId, GLOBAL_UID))
    .orderBy(desc(firewallUserDecisionsTable.lastSeenAt));
  res.json({ decisions, total: decisions.length });
});

// DELETE /api/firewall/user-decisions/:id
router.delete("/user-decisions/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [row] = await db.select().from(firewallUserDecisionsTable)
    .where(eq(firewallUserDecisionsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(firewallUserDecisionsTable).where(eq(firewallUserDecisionsTable.id, id));
  res.json({ ok: true });
});

// POST /api/firewall/blocked-ips/:id/unblock
router.post("/blocked-ips/:id/unblock", async (req, res) => {
  const [row] = await db.delete(blockedIpsTable)
    .where(eq(blockedIpsTable.id, parseInt(req.params.id)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

export default router;
