// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// NeuralFence™ API routes
import { Router } from "express";
import { db } from "@workspace/db";
import { neuralfenceNodesTable, neuralfenceEventsTable, neuralfencePatternsTable } from "@workspace/db/schema";
import { eq, desc, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../middlewares/requireAdmin";
import { ingestAttackerEvent, getIpAction } from "../lib/neuralfence";

const router = Router();

// GET /nodes — list all tracked attacker IPs (admin only)
router.get("/nodes", requireAdmin, async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10), 500);
  const nodes = await db
    .select()
    .from(neuralfenceNodesTable)
    .orderBy(desc(neuralfenceNodesTable.suspicionScore))
    .limit(limit);
  res.json({ nodes, count: nodes.length });
});

// GET /node/:ip — details for a specific IP (admin only)
router.get("/node/:ip", requireAdmin, async (req, res) => {
  const ip = String(req.params.ip ?? "");
  const [node] = await db
    .select()
    .from(neuralfenceNodesTable)
    .where(eq(neuralfenceNodesTable.ip, ip));
  if (!node) return res.status(404).json({ error: "IP not found in NeuralFence graph" });

  const events = await db
    .select()
    .from(neuralfenceEventsTable)
    .where(eq(neuralfenceEventsTable.ip, ip))
    .orderBy(desc(neuralfenceEventsTable.occurredAt))
    .limit(50);

  const patterns = await db
    .select()
    .from(neuralfencePatternsTable)
    .where(eq(neuralfencePatternsTable.ip, ip))
    .orderBy(desc(neuralfencePatternsTable.detectedAt))
    .limit(20);

  res.json({ node, events, patterns });
});

// GET /action/:ip — check current action for an IP
router.get("/action/:ip", requireAdmin, async (req, res) => {
  const ip = String(req.params.ip ?? "");
  const action = await getIpAction(ip);
  res.json({ ip, action });
});

// POST /ingest — manually ingest an attacker event (admin, for testing/correlation)
router.post("/ingest", requireAdmin, async (req, res) => {
  const body = z.object({
    ip:            z.string().ip(),
    eventType:     z.string().min(1).max(100),
    nodeId:        z.number().int().optional(),
    metadata:      z.record(z.unknown()).optional(),
    geoCountry:    z.string().optional(),
    isTorExit:     z.boolean().optional(),
    isDatacenter:  z.boolean().optional(),
  }).parse(req.body);

  const result = await ingestAttackerEvent(body);
  res.json(result);
});

// PUT /node/:ip/manual-action — admin override for IP action
router.put("/node/:ip/manual-action", requireAdmin, async (req, res) => {
  const ip = String(req.params.ip ?? "");
  const { action } = z.object({
    action: z.enum(["allow","rate_limit","challenge","soft_block","hard_block"]).nullable(),
  }).parse(req.body);

  await db
    .update(neuralfenceNodesTable)
    .set({ manualAction: action })
    .where(eq(neuralfenceNodesTable.ip, ip));

  res.json({ ok: true, ip, manualAction: action });
});

// GET /stats — summary stats
router.get("/stats", requireAdmin, async (_req, res) => {
  const [stats] = await db
    .select({
      total:       sql<number>`count(*)`,
      hardBlocked: sql<number>`count(*) filter (where action = 'hard_block')`,
      softBlocked: sql<number>`count(*) filter (where action = 'soft_block')`,
      challenged:  sql<number>`count(*) filter (where action = 'challenge')`,
      rateLimited: sql<number>`count(*) filter (where action = 'rate_limit')`,
      avgScore:    sql<number>`avg(suspicion_score)`,
      maxScore:    sql<number>`max(suspicion_score)`,
    })
    .from(neuralfenceNodesTable);

  res.json({ stats });
});

export default router;
