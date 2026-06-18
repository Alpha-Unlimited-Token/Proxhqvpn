// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// GhostStream™ API routes
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { ghoststreamProfilesTable, ghoststreamSessionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  rotateGhostStreamProfile,
  getActiveDirective,
  encodeShapeDirective,
} from "../lib/ghoststream";
import { requireAdmin } from "../middlewares/requireAdmin";

const router = Router();

// GET /profiles — list all cover profiles
router.get("/profiles", async (_req, res) => {
  const profiles = await db
    .select({
      id:          ghoststreamProfilesTable.id,
      name:        ghoststreamProfilesTable.name,
      description: ghoststreamProfilesTable.description,
      enabled:     ghoststreamProfilesTable.enabled,
      holdMinS:    ghoststreamProfilesTable.holdMinS,
      holdMaxS:    ghoststreamProfilesTable.holdMaxS,
      dummyPps:    ghoststreamProfilesTable.dummyPps,
    })
    .from(ghoststreamProfilesTable);
  res.json({ profiles });
});

// GET /session — get current session state for caller
router.get("/session", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const sessions = await db
    .select()
    .from(ghoststreamSessionsTable)
    .where(eq(ghoststreamSessionsTable.userId, userId));

  res.json({ sessions });
});

// POST /rotate — force immediate profile rotation for a config
router.post("/rotate", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { configId } = z.object({ configId: z.number().int().positive() }).parse(req.body);
  const directive = await rotateGhostStreamProfile(userId, configId);

  res.json({
    directive,
    encoded: encodeShapeDirective(directive).toString("hex"),
    message: "Profile rotated. Embed the encoded directive in your next WireGuard packet.",
  });
});

// GET /directive/:configId — get current shape directive (daemon polling)
router.get("/directive/:configId", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const configId = parseInt(req.params.configId!, 10);
  if (isNaN(configId)) return res.status(400).json({ error: "Invalid configId" });

  const directive = await getActiveDirective(userId, configId);
  if (!directive) {
    const newDirective = await rotateGhostStreamProfile(userId, configId);
    return res.json({ directive: newDirective, encoded: encodeShapeDirective(newDirective).toString("hex"), fresh: true });
  }
  res.json({ directive, encoded: encodeShapeDirective(directive).toString("hex"), fresh: false });
});

// PUT /toggle — enable or disable morphing for a config
router.put("/toggle", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { configId, enabled } = z.object({
    configId: z.number().int().positive(),
    enabled:  z.boolean(),
  }).parse(req.body);

  await db
    .update(ghoststreamSessionsTable)
    .set({ morphingEnabled: enabled })
    .where(
      and(
        eq(ghoststreamSessionsTable.userId, userId),
        eq(ghoststreamSessionsTable.configId, configId),
      )
    );

  res.json({ ok: true, configId, morphingEnabled: enabled });
});

// GET /admin/sessions — admin: list all active sessions
router.get("/admin/sessions", requireAdmin, async (_req, res) => {
  const sessions = await db
    .select()
    .from(ghoststreamSessionsTable);
  res.json({ sessions, count: sessions.length });
});

export default router;
