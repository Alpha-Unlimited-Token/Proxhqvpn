// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { nodesTable } from "@workspace/db";

const router = Router();

interface RotatorSettings {
  enabled:        boolean;
  intervalMinutes: number;  // rotation interval
  currentNodeId:  number | null;
  nextRotationAt: string | null;
  rotationCount:  number;
  updatedAt:      string;
}

interface RotationEvent {
  from:         number | null;
  to:           number;
  fromName:     string | null;
  toName:       string;
  rotatedAt:    string;
  triggeredBy:  "schedule" | "manual";
}

const rotatorStore:  Record<string, RotatorSettings> = {};
const rotationLogs:  Record<string, RotationEvent[]> = {};

const INTERVAL_OPTIONS = [5, 10, 15, 30, 60, 120, 240, 480, 1440]; // minutes

function getSettings(userId: string): RotatorSettings {
  return rotatorStore[userId] ?? {
    enabled:         false,
    intervalMinutes: 60,
    currentNodeId:   null,
    nextRotationAt:  null,
    rotationCount:   0,
    updatedAt:       new Date().toISOString(),
  };
}

function getLogs(userId: string): RotationEvent[] {
  return rotationLogs[userId] ?? [];
}

function scheduleNext(settings: RotatorSettings): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + settings.intervalMinutes);
  return now.toISOString();
}

// GET /iprotator/settings
router.get("/settings", async (req, res) => {
  const userId   = (req.auth as any)?.userId ?? "anonymous";
  const settings = getSettings(userId);
  const nodes    = await db.select().from(nodesTable);
  const logs     = getLogs(userId).slice(-20); // last 20 rotations

  const currentNode = nodes.find(n => n.id === settings.currentNodeId) ?? null;
  const msUntilNext = settings.nextRotationAt
    ? Math.max(0, new Date(settings.nextRotationAt).getTime() - Date.now())
    : null;

  res.json({
    settings,
    currentNode,
    msUntilNext,
    logs,
    availableNodes: nodes.map(n => ({ id: n.id, name: n.name, ipAddress: n.ipAddress, location: n.location, layer: n.layer })),
    intervalOptions: INTERVAL_OPTIONS.map(m => ({
      minutes: m,
      label: m < 60 ? `${m}m` : m < 1440 ? `${m / 60}h` : "24h",
    })),
  });
});

// POST /iprotator/settings — update settings
router.post("/settings", async (req, res) => {
  const userId = (req.auth as any)?.userId ?? "anonymous";
  const body   = z.object({
    enabled:         z.boolean().optional(),
    intervalMinutes: z.number().min(1).optional(),
  }).parse(req.body);

  const current = getSettings(userId);
  const updated: RotatorSettings = { ...current, ...body, updatedAt: new Date().toISOString() };

  if (updated.enabled && !updated.currentNodeId) {
    // Pick a random initial node
    const nodes = await db.select().from(nodesTable);
    if (nodes.length) {
      const node = nodes[Math.floor(Math.random() * nodes.length)];
      updated.currentNodeId = node.id;
    }
  }

  if (updated.enabled) {
    updated.nextRotationAt = scheduleNext(updated);
  } else {
    updated.nextRotationAt = null;
  }

  rotatorStore[userId] = updated;
  res.json({ settings: updated });
});

// POST /iprotator/rotate — manually trigger an immediate rotation
router.post("/rotate", async (req, res) => {
  const userId = (req.auth as any)?.userId ?? "anonymous";
  const settings = getSettings(userId);

  const nodes    = await db.select().from(nodesTable);
  if (!nodes.length) return res.status(400).json({ error: "No VPN nodes available for rotation." });

  // Pick a different node than the current one
  const candidates = nodes.filter(n => n.id !== settings.currentNodeId);
  const next = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : nodes[0];
  const prev = nodes.find(n => n.id === settings.currentNodeId) ?? null;

  const event: RotationEvent = {
    from:        settings.currentNodeId,
    to:          next.id,
    fromName:    prev?.name ?? null,
    toName:      next.name,
    rotatedAt:   new Date().toISOString(),
    triggeredBy: "manual",
  };

  if (!rotationLogs[userId]) rotationLogs[userId] = [];
  rotationLogs[userId].push(event);

  const updated: RotatorSettings = {
    ...settings,
    currentNodeId:  next.id,
    nextRotationAt: settings.enabled ? scheduleNext(settings) : null,
    rotationCount:  settings.rotationCount + 1,
    updatedAt:      new Date().toISOString(),
  };
  rotatorStore[userId] = updated;

  res.json({
    event,
    settings: updated,
    message: `IP rotated: ${prev?.name ?? "none"} → ${next.name} (${next.ipAddress})`,
  });
});

export default router;
