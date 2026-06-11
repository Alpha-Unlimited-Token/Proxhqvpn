// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Node Agent check-in endpoint — authenticated via PSK header (NODE_AGENT_PSK).
// Remote Parrot OS node agents post health check-ins here.
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { nodeAgentHealthTable, nodeAgentEventsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { appendAuditEvent } from "../lib/audit-chain";
import { requireAdmin } from "../middlewares/requireAdmin";

const router = Router();

const NODE_AGENT_PSK = process.env.NODE_AGENT_PSK ?? "";

function validatePsk(req: Request): boolean {
  if (!NODE_AGENT_PSK) return false;
  const header = req.headers["x-node-agent-psk"] as string | undefined;
  if (!header) return false;
  if (header.length !== NODE_AGENT_PSK.length) return false;
  let diff = 0;
  for (let i = 0; i < header.length; i++) diff |= header.charCodeAt(i) ^ NODE_AGENT_PSK.charCodeAt(i);
  return diff === 0;
}

const CheckinSchema = z.object({
  nodeId:   z.string().min(1).max(128),
  nodeName: z.string().min(1).max(256),
  version:  z.string().min(1).max(64),
  ip:       z.string().min(1).max(64),
  os:       z.string().max(128).optional(),
  arch:     z.string().max(64).optional(),
  tools:    z.array(z.string()).optional(),
  event:    z.object({
    type:    z.string().min(1).max(64),
    payload: z.record(z.unknown()).optional(),
  }).optional(),
});

// ── POST /api/node-agent/checkin ──────────────────────────────────────────
router.post("/checkin", async (req: Request, res: Response) => {
  if (!validatePsk(req)) {
    return res.status(401).json({ error: "Invalid or missing PSK" });
  }

  let body: z.infer<typeof CheckinSchema>;
  try { body = CheckinSchema.parse(req.body); } catch (e: any) {
    return res.status(400).json({ error: e.message });
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

// ── GET /api/node-agent/list — admin only ─────────────────────────────────
router.get("/list", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select()
      .from(nodeAgentHealthTable)
      .orderBy(desc(nodeAgentHealthTable.lastSeenAt));
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/node-agent/events/:nodeId — admin only ────────────────────────
router.get("/events/:nodeId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rows = await db.select()
      .from(nodeAgentEventsTable)
      .where(eq(nodeAgentEventsTable.nodeId, String(req.params.nodeId)))
      .orderBy(desc(nodeAgentEventsTable.createdAt))
      .limit(50);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
