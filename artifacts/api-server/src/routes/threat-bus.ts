// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Threat Bus API — SSE stream + REST for the unified triple-layer security dashboard.
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { threatBusEventsTable } from "@workspace/db";
import { desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { bus } from "../lib/service-bus";
import { requireRbac } from "../middlewares/requireRbac";
// audit:read  — view threat bus stream/history
// incident:write — publish escalations
import { appendAuditEvent } from "../lib/audit-chain";
import { logger } from "../lib/logger";

const router = Router();

// ── SSE subscriber registry ───────────────────────────────────────────────────
type SseClient = { id: string; res: Response };
const sseClients = new Set<SseClient>();

function broadcastSse(data: object) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.res.write(payload); } catch { sseClients.delete(client); }
  }
}

// Hook into service bus to broadcast threat-bus channels to SSE clients
bus.subscribe("firewall.escalate_ghost_trap", (ev) => broadcastSse({ ...ev }));
bus.subscribe("ghost_trap.escalate_ghost_node", (ev) => broadcastSse({ ...ev }));
bus.subscribe("ghost_node.escalate_firewall", (ev) => broadcastSse({ ...ev }));
bus.subscribe("firewall.block", (ev) => broadcastSse({ ...ev }));

// ── GET /api/threat-bus/stream — SSE real-time feed ──────────────────────────
router.get("/stream", requireRbac("audit:read"), (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const client: SseClient = { id: crypto.randomUUID(), res };
  sseClients.add(client);

  // Send current recent events on connect
  db.select().from(threatBusEventsTable).orderBy(desc(threatBusEventsTable.escalatedAt)).limit(20)
    .then((rows) => {
      res.write(`data: ${JSON.stringify({ type: "snapshot", events: rows })}\n\n`);
    }).catch(() => {});

  const keepalive = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { clearInterval(keepalive); sseClients.delete(client); }
  }, 15_000);

  req.on("close", () => {
    clearInterval(keepalive);
    sseClients.delete(client);
  });
});

// ── GET /api/threat-bus/events — paginated event history ─────────────────────
router.get("/events", requireRbac("audit:read"), async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit as string ?? "100", 10), 500);
  const layer  = req.query.layer as string | undefined;
  const since  = req.query.since ? new Date(req.query.since as string) : undefined;

  let q = db.select().from(threatBusEventsTable).orderBy(desc(threatBusEventsTable.escalatedAt)).limit(limit);
  if (since) q = q.where(gte(threatBusEventsTable.escalatedAt, since)) as typeof q;

  const events = await q;
  const filtered = layer ? events.filter(e => e.sourceLayer === layer || e.targetLayer === layer) : events;
  return res.json({ events: filtered, total: filtered.length });
});

// ── POST /api/threat-bus/publish — manual escalation through all three layers ─
const ManualEscalateSchema = z.object({
  ip:          z.string().ip(),
  threatScore: z.number().int().min(0).max(100).default(90),
  reason:      z.string().max(500).optional(),
});

router.post("/publish", requireRbac("incident:write"), async (req, res) => {
  const { ip, threatScore, reason } = ManualEscalateSchema.parse(req.body);

  const events: typeof threatBusEventsTable.$inferInsert[] = [
    { eventType: "SUSPECT_IP_DETECTED",    sourceLayer: "manual", targetLayer: "firewall",    attackerIp: ip, threatScore, reason: reason ?? "Manual one-click escalation" },
    { eventType: "LURE_TRIGGERED",         sourceLayer: "manual", targetLayer: "ghost_trap",  attackerIp: ip, threatScore, reason: reason ?? "Manual one-click escalation" },
    { eventType: "DECEPTION_ROUTE_ACTIVATED", sourceLayer: "manual", targetLayer: "ghost_nodes", attackerIp: ip, threatScore, reason: reason ?? "Manual one-click escalation" },
  ];

  const inserted = await db.insert(threatBusEventsTable).values(events).returning();

  for (const ev of inserted) {
    broadcastSse({ type: "event", event: ev });
  }

  bus.publish("firewall.escalate_ghost_trap", { ip, threatScore, reason, source: "manual" }, "threat-bus");

  await appendAuditEvent({
    action:   "threat_bus.manual_escalation",
    actor:    req.ip ?? "unknown",
    resource: ip,
    metadata: { threatScore, reason },
  });

  logger.info({ ip, threatScore }, "Manual threat bus escalation");
  return res.json({ ok: true, events: inserted });
});

// ── GET /api/threat-bus/stats ─────────────────────────────────────────────────
router.get("/stats", requireRbac("audit:read"), async (_req, res) => {
  const rows = await db.select().from(threatBusEventsTable).orderBy(desc(threatBusEventsTable.escalatedAt)).limit(500);
  const byType:  Record<string, number> = {};
  const byLayer: Record<string, number> = {};
  for (const r of rows) {
    byType[r.eventType]     = (byType[r.eventType]     ?? 0) + 1;
    byLayer[r.sourceLayer]  = (byLayer[r.sourceLayer]  ?? 0) + 1;
  }
  return res.json({ total: rows.length, byType, byLayer, clients: sseClients.size });
});

export default router;
