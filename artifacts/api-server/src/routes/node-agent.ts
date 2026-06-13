// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Node Agent endpoints — authenticated via PSK header (NODE_AGENT_PSK).
// Remote Parrot OS node agents post health check-ins here.
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { nodeAgentHealthTable, nodeAgentEventsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { appendAuditEvent } from "../lib/audit-chain";
import { requireAdmin } from "../middlewares/requireAdmin";

const router = Router();

const NODE_AGENT_PSK = process.env.NODE_AGENT_PSK ?? "";

// Minimum required agent version — agents below this version are rejected with 426.
// Override with MIN_AGENT_VERSION env var (semver: "MAJOR.MINOR.PATCH").
const MIN_AGENT_VERSION = process.env.MIN_AGENT_VERSION ?? "1.2.0";

function validatePsk(req: Request): boolean {
  if (!NODE_AGENT_PSK) return false;
  const header = req.headers["x-node-agent-psk"] as string | undefined;
  if (!header) return false;
  if (header.length !== NODE_AGENT_PSK.length) return false;
  let diff = 0;
  for (let i = 0; i < header.length; i++) diff |= header.charCodeAt(i) ^ NODE_AGENT_PSK.charCodeAt(i);
  return diff === 0;
}

/**
 * Compare two semver strings (MAJOR.MINOR.PATCH).
 * Returns negative if a < b, zero if equal, positive if a > b.
 */
function compareSemver(a: string, b: string): number {
  const parse = (v: string) => v.replace(/[^0-9.]/g, "").split(".").map(n => parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const CheckinSchema = z.object({
  nodeId:   z.string().min(1).max(128),
  nodeName: z.string().min(1).max(256),
  version:  z.string().min(1).max(64),
  ip:       z.string().min(1).max(64),
  os:       z.string().max(128).optional(),
  arch:     z.string().max(64).optional(),
  tools:    z.array(z.string()).optional(),
  cpuPct:   z.number().min(0).max(100).optional(),
  memPct:   z.number().min(0).max(100).optional(),
  diskMb:   z.number().int().min(0).optional(),
  event:    z.object({
    type:    z.string().min(1).max(64),
    payload: z.record(z.unknown()).optional(),
  }).optional(),
});

// ── POST /api/node-agent/checkin — combined health + optional event ───────────
router.post("/checkin", async (req: Request, res: Response) => {
  if (!validatePsk(req)) {
    return res.status(401).json({ error: "Invalid or missing PSK" });
  }

  let body: z.infer<typeof CheckinSchema>;
  try { body = CheckinSchema.parse(req.body); } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  // P4-D: Reject agents running below the minimum enforced version.
  if (compareSemver(body.version, MIN_AGENT_VERSION) < 0) {
    appendAuditEvent({
      actor:    `node-agent:${body.nodeId}`,
      action:   "node_agent.checkin_rejected_version",
      resource: body.nodeId,
      result:   "deny",
      metadata: { version: body.version, minimum: MIN_AGENT_VERSION },
    });
    return res.status(426).json({
      error:          "Agent version below minimum required",
      minimumVersion: MIN_AGENT_VERSION,
      currentVersion: body.version,
      upgradeUrl:     "https://proxhqvpn.com/downloads",
    });
  }

  try {
    await db
      .insert(nodeAgentHealthTable)
      .values({
        nodeId:    body.nodeId,
        nodeName:  body.nodeName,
        version:   body.version,
        ip:        body.ip,
        os:        body.os,
        arch:      body.arch,
        toolsJson: body.tools ?? [],
        cpuPct:    body.cpuPct ?? null,
        memPct:    body.memPct ?? null,
        diskMb:    body.diskMb ?? null,
        status:    "active",
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: nodeAgentHealthTable.nodeId,
        set: {
          nodeName:  body.nodeName,
          version:   body.version,
          ip:        body.ip,
          os:        body.os,
          arch:      body.arch,
          toolsJson: body.tools ?? [],
          cpuPct:    body.cpuPct ?? null,
          memPct:    body.memPct ?? null,
          diskMb:    body.diskMb ?? null,
          status:    "active",
          lastSeenAt: new Date(),
        },
      });

    if (body.event) {
      await db.insert(nodeAgentEventsTable).values({
        nodeId:    body.nodeId,
        eventType: body.event.type,
        payload:   (body.event.payload as Record<string, unknown>) ?? {},
      });
    }

    appendAuditEvent({
      actor:    `node-agent:${body.nodeId}`,
      action:   "node_agent.checkin",
      resource: body.nodeId,
      result:   "allow",
      metadata: { version: body.version, ip: body.ip },
    });

    res.json({ ok: true, nodeId: body.nodeId, ts: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/node-agent/health — dedicated health telemetry report ───────────
// Nodes can call this more frequently than /checkin for lightweight telemetry.
const HealthTelemetrySchema = z.object({
  nodeId:  z.string().min(1).max(128),
  cpuPct:  z.number().min(0).max(100),
  memPct:  z.number().min(0).max(100),
  diskMb:  z.number().int().min(0).optional(),
  status:  z.enum(["active", "degraded", "offline"]).optional().default("active"),
});
router.post("/health", async (req: Request, res: Response) => {
  if (!validatePsk(req)) {
    return res.status(401).json({ error: "Invalid or missing PSK" });
  }
  let body: z.infer<typeof HealthTelemetrySchema>;
  try { body = HealthTelemetrySchema.parse(req.body); } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
  try {
    // Upsert health telemetry — node must already exist from /checkin
    const [existing] = await db.select({ nodeId: nodeAgentHealthTable.nodeId })
      .from(nodeAgentHealthTable).where(eq(nodeAgentHealthTable.nodeId, body.nodeId));
    if (!existing) return res.status(404).json({ error: "Node not registered. Call /checkin first." });

    await db.update(nodeAgentHealthTable)
      .set({
        cpuPct:     body.cpuPct,
        memPct:     body.memPct,
        diskMb:     body.diskMb ?? null,
        status:     body.status ?? "active",
        lastSeenAt: new Date(),
      })
      .where(eq(nodeAgentHealthTable.nodeId, body.nodeId));

    res.json({ ok: true, nodeId: body.nodeId, ts: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/node-agent/events — dedicated event batch reporting ─────────────
const EventBatchSchema = z.object({
  nodeId: z.string().min(1).max(128),
  events: z.array(z.object({
    type:    z.string().min(1).max(64),
    payload: z.record(z.unknown()).optional(),
  })).min(1).max(100),
});
router.post("/events", async (req: Request, res: Response) => {
  if (!validatePsk(req)) {
    return res.status(401).json({ error: "Invalid or missing PSK" });
  }
  let body: z.infer<typeof EventBatchSchema>;
  try { body = EventBatchSchema.parse(req.body); } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
  try {
    const rows = body.events.map(e => ({
      nodeId:    body.nodeId,
      eventType: e.type,
      payload:   (e.payload as Record<string, unknown>) ?? {},
    }));
    await db.insert(nodeAgentEventsTable).values(rows);
    // Bump lastSeenAt for activity tracking
    await db.update(nodeAgentHealthTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(nodeAgentHealthTable.nodeId, body.nodeId));
    res.json({ ok: true, inserted: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/node-agent/list — list all registered nodes (admin) ──────────────
router.get("/list", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(nodeAgentHealthTable)
      .orderBy(desc(nodeAgentHealthTable.lastSeenAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/node-agent/health — alias for /list ──────────────────────────────
router.get("/health", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(nodeAgentHealthTable)
      .orderBy(desc(nodeAgentHealthTable.lastSeenAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/node-agent/nodes — paginated node list ──────────────────────────
router.get("/nodes", requireAdmin, async (req: Request, res: Response) => {
  const limit  = Math.min(parseInt((req.query.limit  as string) || "50",  10), 200);
  const offset = Math.max(parseInt((req.query.offset as string) || "0",   10), 0);
  const status = (req.query.status as string) || undefined;
  try {
    // Fix: capture the result of .where() — Drizzle builder is immutable
    const rows = await (
      status
        ? db.select().from(nodeAgentHealthTable).where(eq(nodeAgentHealthTable.status, status))
        : db.select().from(nodeAgentHealthTable)
    ).orderBy(desc(nodeAgentHealthTable.lastSeenAt)).limit(limit).offset(offset);
    res.json({ nodes: rows, limit, offset });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/node-agent/events/:nodeId — events for a specific node ───────────
router.get("/events/:nodeId", requireAdmin, async (req: Request, res: Response) => {
  const limit  = Math.min(parseInt((req.query.limit  as string) || "50",  10), 200);
  const offset = Math.max(parseInt((req.query.offset as string) || "0",   10), 0);
  try {
    const rows = await db.select().from(nodeAgentEventsTable)
      .where(eq(nodeAgentEventsTable.nodeId, String(req.params.nodeId)))
      .orderBy(desc(nodeAgentEventsTable.createdAt))
      .limit(limit)
      .offset(offset);
    res.json({ events: rows, limit, offset });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/node-agent/events — all events, paginated, admin-only ────────────
router.get("/events", requireAdmin, async (req: Request, res: Response) => {
  const limit     = Math.min(parseInt((req.query.limit     as string) || "50",  10), 200);
  const offset    = Math.max(parseInt((req.query.offset    as string) || "0",   10), 0);
  const nodeId    = (req.query.nodeId    as string) || undefined;
  const eventType = (req.query.eventType as string) || undefined;
  try {
    // Fix: Drizzle builder is immutable — use and() to compose conditions
    const whereClause =
      nodeId && eventType ? and(eq(nodeAgentEventsTable.nodeId, nodeId), eq(nodeAgentEventsTable.eventType, eventType)) :
      nodeId              ? eq(nodeAgentEventsTable.nodeId, nodeId) :
      eventType           ? eq(nodeAgentEventsTable.eventType, eventType) :
      undefined;
    const rows = await db.select().from(nodeAgentEventsTable)
      .where(whereClause)
      .orderBy(desc(nodeAgentEventsTable.createdAt))
      .limit(limit)
      .offset(offset);
    res.json({ events: rows, limit, offset });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/node-agent/:nodeId — deregister a node (admin) ───────────────
router.delete("/:nodeId", requireAdmin, async (req: Request, res: Response) => {
  const nodeId = String(req.params.nodeId);
  try {
    const [row] = await db.delete(nodeAgentHealthTable)
      .where(eq(nodeAgentHealthTable.nodeId, nodeId))
      .returning();
    if (!row) return res.status(404).json({ error: "Node not found" });
    appendAuditEvent({ actor: "admin", action: "node_agent.deregister", resource: nodeId, result: "allow" });
    res.json({ ok: true, nodeId });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
