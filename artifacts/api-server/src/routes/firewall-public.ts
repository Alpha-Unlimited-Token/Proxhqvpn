// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Firewall alert routing — 3-lane architecture:
//   Lane 1 (admin_infra)   — infrastructure threats: HIGH/CRITICAL, external IPs only, admin sees this
//   Lane 2 (per-user)      — session alerts scoped to a user's own WireGuard devices
//   Lane 3 (admin session) — admin's own tunnel alerts, same as any user
//
// Admin GET /api/firewall/prompts → Lane 1 + Lane 2 (their own session)
// User  GET /api/firewall/prompts → Lane 2 only (their session)
// No auth                         → 401

import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  firewallConnectionPromptsTable, firewallUserDecisionsTable,
  blockedIpsTable, beaconAlertsTable, nodeAgentEventsTable,
  devicesTable, firewallIocsTable,
} from "@workspace/db";
import { eq, desc, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../lib/logger";
import { isOwnerAdmin } from "../repositories/usersRepository";

const router = Router();

// ── Constants ─────────────────────────────────────────────────────────────────

const ADMIN_INFRA_UID = "admin_infra";

const INFRA_EVENT_TYPES = [
  "ghost_trap_tcp", "ghost_trap_udp", "ghost_trap_event",
  "honeypot_hit", "ghost_probe", "trap_triggered",
];

const HIGH_SEVERITY = ["high", "critical"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeKey(sourceIp: string, destPort?: string, protocol?: string): string {
  if (destPort) return `${sourceIp}:${destPort}:${protocol ?? "tcp"}`;
  return sourceIp;
}

/** True for RFC1918 / loopback / link-local — these are internal, not external threats */
function isInternal(ip: string): boolean {
  if (!ip) return true;
  return (
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^127\./.test(ip) ||
    /^169\.254\./.test(ip) ||
    /^::1$/.test(ip) ||
    ip === "0.0.0.0"
  );
}

// ── Lane 1: Seed admin infrastructure threats ─────────────────────────────────
// Only real external attackers, HIGH/CRITICAL severity, ghost-trap/honeypot events.
// Skips routine pings, low-severity events, and internal IPs entirely.

async function seedAdminInfraAlerts() {
  const existing = await db.select().from(firewallConnectionPromptsTable)
    .where(eq(firewallConnectionPromptsTable.userId, ADMIN_INFRA_UID));
  const pendingCount = existing.filter(p => p.decision === "pending").length;

  if (pendingCount >= 3) return;

  const seenKeys = new Set(existing.map(p => p.patternKey));
  const toInsert: Array<typeof firewallConnectionPromptsTable.$inferInsert> = [];

  // Ghost trap / honeypot events from node agents — external IPs, high/critical only
  try {
    const ghostEvents = await db.select().from(nodeAgentEventsTable)
      .where(inArray(nodeAgentEventsTable.eventType, INFRA_EVENT_TYPES))
      .orderBy(desc(nodeAgentEventsTable.createdAt)).limit(100);

    for (const ev of ghostEvents) {
      const p = ev.payload as Record<string, unknown> | null;
      const srcIp = (p?.src_ip ?? p?.srcIp ?? p?.source_ip ?? null) as string | null;
      if (!srcIp || isInternal(srcIp)) continue;

      const dp = (p?.dest_port ?? p?.destPort ?? p?.port ?? null);
      const portStr = dp != null ? String(dp) : undefined;
      const key = makeKey(srcIp, portStr);
      if (seenKeys.has(key)) continue;

      // Ghost-trap hits are always high severity
      toInsert.push({
        userId: ADMIN_INFRA_UID, sourceIp: srcIp,
        destPort: portStr ?? null, protocol: "tcp",
        reason: `Ghost-trap triggered${portStr ? ` on port ${portStr}` : ""} — external attacker probe from ${srcIp} (node: ${ev.nodeId})`,
        threatLevel: "high", patternKey: key, decision: "pending",
        metadata: { nodeId: ev.nodeId, eventType: ev.eventType, rawPayload: p, lane: "infra" },
      });
      seenKeys.add(key);
      if (toInsert.length >= 10) break;
    }
  } catch (e) { logger.error({ err: e }, "infra: ghost-trap seed failed"); }

  // Beacon alerts — external IPs, high/critical only, no pings or routine probes
  if (toInsert.length < 3) {
    try {
      const beacons = await db.select().from(beaconAlertsTable)
        .orderBy(desc(beaconAlertsTable.detectedAt)).limit(50);
      for (const b of beacons) {
        const ip = b.attackerIp ?? "";
        if (!ip || isInternal(ip)) continue;
        const pt = b.probeType ?? "ping";
        // Skip low-value probe types — admin doesn't need to see routine pings
        if (pt === "ping" || pt === "traceroute") continue;

        const key = makeKey(ip);
        if (seenKeys.has(key)) continue;
        const threat = pt === "tunnel_probe" ? "critical" : pt === "port_scan" ? "high" : "medium";
        if (!HIGH_SEVERITY.includes(threat)) continue; // medium and below — skip

        toInsert.push({
          userId: ADMIN_INFRA_UID, sourceIp: ip, destPort: null, protocol: "tcp",
          reason: `${pt.replace(/_/g, " ").toUpperCase()} — active attacker from external IP ${ip}`,
          threatLevel: threat, patternKey: key, decision: "pending",
          metadata: { probeType: pt, nodeId: b.nodeId, severity: b.severity, lane: "infra" },
        });
        seenKeys.add(key);
        if (toInsert.length >= 8) break;
      }
    } catch (e) { logger.error({ err: e }, "infra: beacon seed failed"); }
  }

  if (toInsert.length > 0) {
    try {
      await db.insert(firewallConnectionPromptsTable).values(toInsert).onConflictDoNothing();
      logger.info({ inserted: toInsert.length }, "admin infra alerts seeded");
    } catch (e) { logger.error({ err: e }, "infra: seed insert failed"); }
  }
}

// ── Lane 2: Seed per-user session alerts ──────────────────────────────────────
// Scoped strictly to the user's own registered WireGuard device IPs.
// Users never see other users' data.

async function seedUserSessionAlerts(userId: string) {
  // Look up user's registered devices
  const userDevices = await db.select().from(devicesTable)
    .where(eq(devicesTable.userId, userId));

  if (userDevices.length === 0) return; // No devices → no session alerts yet

  const assignedIps = userDevices.map(d => d.assignedIp).filter(Boolean);
  if (assignedIps.length === 0) return;

  const existing = await db.select().from(firewallConnectionPromptsTable)
    .where(eq(firewallConnectionPromptsTable.userId, userId));
  const pendingCount = existing.filter(p => p.decision === "pending").length;
  if (pendingCount >= 2) return;

  const seenKeys = new Set(existing.map(p => p.patternKey));
  const toInsert: Array<typeof firewallConnectionPromptsTable.$inferInsert> = [];

  // Look for beacon events involving this user's assigned IPs
  // (e.g. their tunnel peer was part of a flagged probe pattern)
  try {
    const beacons = await db.select().from(beaconAlertsTable)
      .where(inArray(beaconAlertsTable.attackerIp, assignedIps))
      .orderBy(desc(beaconAlertsTable.detectedAt)).limit(10);

    for (const b of beacons) {
      const ip = b.attackerIp ?? "";
      const key = `user:${makeKey(ip)}`;
      if (seenKeys.has(key)) continue;
      const pt = b.probeType ?? "ping";
      const threat = pt === "tunnel_probe" ? "critical" : pt === "port_scan" ? "high" : "medium";
      toInsert.push({
        userId, sourceIp: ip, destPort: null, protocol: "tcp",
        reason: `Anomalous traffic detected on your VPN tunnel — ${pt.replace(/_/g, " ")} pattern observed`,
        threatLevel: threat, patternKey: key, decision: "pending",
        metadata: { probeType: pt, nodeId: b.nodeId, deviceIp: ip, lane: "session" },
      });
      seenKeys.add(key);
      if (toInsert.length >= 3) break;
    }
  } catch (e) { logger.error({ err: e, userId }, "session: beacon seed failed"); }

  if (toInsert.length > 0) {
    try {
      await db.insert(firewallConnectionPromptsTable).values(toInsert).onConflictDoNothing();
    } catch (e) { logger.error({ err: e }, "session: seed insert failed"); }
  }
}

// ── GET /api/firewall/prompts ─────────────────────────────────────────────────

router.get("/prompts", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const isAdmin = await isOwnerAdmin(userId);

  // Seed the relevant lanes
  if (isAdmin) {
    await seedAdminInfraAlerts();
  }
  await seedUserSessionAlerts(userId);

  // Fetch prompts for this user
  // Admin: their own session alerts + infrastructure threats
  // User:  only their own session alerts
  let prompts;
  if (isAdmin) {
    const [infraPrompts, sessionPrompts] = await Promise.all([
      db.select().from(firewallConnectionPromptsTable)
        .where(eq(firewallConnectionPromptsTable.userId, ADMIN_INFRA_UID))
        .orderBy(desc(firewallConnectionPromptsTable.createdAt)),
      db.select().from(firewallConnectionPromptsTable)
        .where(eq(firewallConnectionPromptsTable.userId, userId))
        .orderBy(desc(firewallConnectionPromptsTable.createdAt)),
    ]);
    // Merge: infra threats first, then own session, sorted by date
    prompts = [...infraPrompts, ...sessionPrompts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else {
    prompts = await db.select().from(firewallConnectionPromptsTable)
      .where(eq(firewallConnectionPromptsTable.userId, userId))
      .orderBy(desc(firewallConnectionPromptsTable.createdAt));
  }

  res.json({ prompts, pendingCount: prompts.filter(p => p.decision === "pending").length });
});

// ── POST /api/firewall/prompts/:id/decide ────────────────────────────────────

router.post("/prompts/:id/decide", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const schema = z.object({
    decision: z.enum(["allow_once", "allow_always", "block_always", "dismissed"]),
    notes: z.string().max(256).optional(),
  });
  const body = schema.parse(req.body);
  const id = parseInt(req.params.id);

  const isAdmin = await isOwnerAdmin(userId);

  const [prompt] = await db.select().from(firewallConnectionPromptsTable)
    .where(eq(firewallConnectionPromptsTable.id, id));
  if (!prompt) { res.status(404).json({ error: "Not found" }); return; }

  // Users can only decide on their own session prompts
  // Admin can decide on infra prompts or their own session prompts
  const canDecide = prompt.userId === userId || (isAdmin && prompt.userId === ADMIN_INFRA_UID);
  if (!canDecide) { res.status(403).json({ error: "Forbidden" }); return; }

  const decisionUserId = prompt.userId === ADMIN_INFRA_UID ? ADMIN_INFRA_UID : userId;

  await db.update(firewallConnectionPromptsTable)
    .set({ decision: body.decision, resolvedAt: new Date() })
    .where(eq(firewallConnectionPromptsTable.id, id));

  if (body.decision === "allow_always" || body.decision === "block_always") {
    const ruleDecision = body.decision === "allow_always" ? "allow" : "block";
    const prev = await db.select().from(firewallUserDecisionsTable)
      .where(eq(firewallUserDecisionsTable.patternKey, prompt.patternKey));
    const existing = prev.find(d => d.userId === decisionUserId);

    if (existing) {
      await db.update(firewallUserDecisionsTable)
        .set({ decision: ruleDecision, lastSeenAt: new Date(), hitCount: existing.hitCount + 1, notes: body.notes ?? existing.notes })
        .where(eq(firewallUserDecisionsTable.id, existing.id));
    } else {
      await db.insert(firewallUserDecisionsTable).values({
        userId: decisionUserId, patternKey: prompt.patternKey,
        patternType: prompt.destPort ? "ip_port" : "ip",
        decision: ruleDecision, label: null,
        sourceIp: prompt.sourceIp, destPort: prompt.destPort,
        protocol: prompt.protocol, hitCount: 1,
        notes: body.notes ?? null,
      });
    }

    if (ruleDecision === "block") {
      const already = await db.select().from(blockedIpsTable)
        .where(eq(blockedIpsTable.ip, prompt.sourceIp));
      if (already.length === 0) {
        await db.insert(blockedIpsTable).values({
          ip: prompt.sourceIp, reason: `Blocked — ${prompt.reason}`,
          autoBlocked: false, hitCount: 1,
        });
      }
    }
  }

  res.json({ ok: true, decision: body.decision });
});

// ── GET /api/firewall/user-decisions ─────────────────────────────────────────

router.get("/user-decisions", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const isAdmin = await isOwnerAdmin(userId);
  let decisions;

  if (isAdmin) {
    // Admin sees infra rules + their own session rules
    const [infraD, sessionD] = await Promise.all([
      db.select().from(firewallUserDecisionsTable)
        .where(eq(firewallUserDecisionsTable.userId, ADMIN_INFRA_UID))
        .orderBy(desc(firewallUserDecisionsTable.lastSeenAt)),
      db.select().from(firewallUserDecisionsTable)
        .where(eq(firewallUserDecisionsTable.userId, userId))
        .orderBy(desc(firewallUserDecisionsTable.lastSeenAt)),
    ]);
    decisions = [...infraD, ...sessionD].sort(
      (a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
    );
  } else {
    decisions = await db.select().from(firewallUserDecisionsTable)
      .where(eq(firewallUserDecisionsTable.userId, userId))
      .orderBy(desc(firewallUserDecisionsTable.lastSeenAt));
  }

  res.json({ decisions, total: decisions.length });
});

// ── DELETE /api/firewall/user-decisions/:id ───────────────────────────────────

router.delete("/user-decisions/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const isAdmin = await isOwnerAdmin(userId);
  const id = parseInt(req.params.id);
  const [row] = await db.select().from(firewallUserDecisionsTable)
    .where(eq(firewallUserDecisionsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const canDelete = row.userId === userId || (isAdmin && row.userId === ADMIN_INFRA_UID);
  if (!canDelete) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(firewallUserDecisionsTable).where(eq(firewallUserDecisionsTable.id, id));
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// ── EDL (External Dynamic List) Export — PUBLIC, no auth required ───────────
// Compatible with Palo Alto Networks, Fortinet FortiGate, Check Point, Azure FW
// Hardware firewalls must be able to poll this without a session cookie.
// ═══════════════════════════════════════════════════════════════════════════

router.get("/edl", async (req, res) => {
  const format = (req.query.format as string) ?? "txt";
  const type   = (req.query.type   as string) ?? "ip";

  const [blocked, iocs] = await Promise.all([
    db.select({ ip: blockedIpsTable.ip }).from(blockedIpsTable),
    db.select().from(firewallIocsTable).where(eq(firewallIocsTable.enabled, true)),
  ]);

  const ipEntries     = [...blocked.map(b => b.ip), ...iocs.filter(i => i.iocType === "ip" || i.iocType === "cidr").map(i => i.value)];
  const domainEntries = iocs.filter(i => i.iocType === "domain").map(i => i.value);
  const urlEntries    = iocs.filter(i => i.iocType === "url").map(i => i.value);

  let entries: string[] = [];
  if (type === "ip")          entries = [...new Set(ipEntries)];
  else if (type === "domain") entries = [...new Set(domainEntries)];
  else if (type === "url")    entries = [...new Set(urlEntries)];
  else                        entries = [...new Set([...ipEntries, ...domainEntries, ...urlEntries])];

  const meta = { generatedAt: new Date().toISOString(), total: entries.length, type, source: "ProxhqVPN GhostOS EDL" };

  if (format === "json") return res.json({ ...meta, entries });
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="proxhqvpn-edl-${type}-${Date.now()}.csv"`);
    return res.send(`value,type,source\n${entries.map(e => `${e},${type},ProxhqVPN`).join("\n")}`);
  }
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store");
  res.setHeader("X-ProxhqVPN-EDL-Total", String(entries.length));
  res.setHeader("X-ProxhqVPN-EDL-Generated", meta.generatedAt);
  return res.send(entries.join("\n"));
});

// ── POST /api/firewall/blocked-ips/:id/unblock ───────────────────────────────
// Admin-only: unblocking a server-level blocked IP is an infrastructure action.

router.post("/blocked-ips/:id/unblock", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const isAdmin = await isOwnerAdmin(userId);
  if (!isAdmin) { res.status(403).json({ error: "Forbidden: admin only" }); return; }

  const [row] = await db.delete(blockedIpsTable)
    .where(eq(blockedIpsTable.id, parseInt(req.params.id)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

export default router;
