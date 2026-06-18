// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// LiveContext™ API routes — Intent-Runtime Correlation Engine
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import { db } from "@workspace/db";
import { livecontextSessionsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import {
  startLiveContextSession,
  recordLiveContextEvent,
  closeLiveContextSession,
} from "../lib/livecontext";

const router = Router();

// POST /session — start a session with optional intent declaration
router.post("/session", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { sessionType, intentText } = z.object({
    sessionType: z.enum(["terminal","sql","ssh","combined"]),
    intentText:  z.string().max(500).optional(),
  }).parse(req.body);

  const sessionId = await startLiveContextSession({ userId, sessionType, intentText });
  res.status(201).json({
    sessionId,
    message: intentText
      ? "Intent captured — divergence threshold will be calibrated to your stated goal."
      : "No intent declared — divergence threshold is lower. Consider declaring your intent for a higher rate-limit budget.",
  });
});

// POST /event — record an event in an active session
router.post("/event", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const body = z.object({
    sessionId: z.string().uuid(),
    eventType: z.enum(["command","query","ssh_exec","file_read","ip_contact","block"]),
    content:   z.string().max(2000),
    result:    z.string().optional(),
    exitCode:  z.number().int().optional(),
    tables:    z.array(z.string().max(100)).max(50).optional(),
    ips:       z.array(z.string()).max(20).optional(),
    files:     z.array(z.string().max(500)).max(20).optional(),
  }).parse(req.body);

  await recordLiveContextEvent(body);
  res.json({ ok: true });
});

// POST /session/:id/close — close session and get final divergence report
router.post("/session/:id/close", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // Verify ownership
  const [session] = await db
    .select({ userId: livecontextSessionsTable.userId })
    .from(livecontextSessionsTable)
    .where(eq(livecontextSessionsTable.id, String(req.params.id ?? "")));

  if (!session || session.userId !== userId) {
    return res.status(403).json({ error: "Session not found or not owned by caller" });
  }

  const result = await closeLiveContextSession(String(req.params.id ?? ""));
  res.json(result);
});

// GET /sessions — list caller's recent sessions
router.get("/sessions", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const sessions = await db
    .select()
    .from(livecontextSessionsTable)
    .where(eq(livecontextSessionsTable.userId, userId))
    .orderBy(desc(livecontextSessionsTable.startedAt))
    .limit(50);

  res.json({ sessions });
});

// GET /flagged — admin: sessions requiring review
router.get("/flagged", requireAdmin, async (_req, res) => {
  const sessions = await db
    .select()
    .from(livecontextSessionsTable)
    .where(eq(livecontextSessionsTable.reviewRequired, true))
    .orderBy(desc(livecontextSessionsTable.divergenceScore))
    .limit(100);

  res.json({ sessions, count: sessions.length });
});

// POST /session/:id/review — admin: mark session as reviewed
router.post("/session/:id/review", requireAdmin, async (req, res) => {
  const { userId } = getAuth(req);
  await db
    .update(livecontextSessionsTable)
    .set({ reviewRequired: false, reviewedBy: userId ?? "admin", reviewedAt: new Date() })
    .where(eq(livecontextSessionsTable.id, String(req.params.id ?? "")));
  res.json({ ok: true });
});

export default router;
