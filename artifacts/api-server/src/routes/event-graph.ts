// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Global Event Graph API
//   GET /api/events/graph            — full graph snapshot (default 30m window)
//   GET /api/events/graph?window=60  — custom window in minutes
//   GET /api/events/chains           — correlated chains only
//   GET /api/events/stats            — event stats
//   POST /api/events/test-publish    — publish a test event (admin only)
// Audit recommendation: add global event graph for cross-system correlation.

import { Router, type Request, type Response } from "express";
import { eventGraph } from "../lib/event-graph";
import { bus, type EventChannel } from "../lib/service-bus";

const router = Router();

router.get("/graph", (req: Request, res: Response) => {
  const window = Math.min(Math.max(parseInt(String(req.query.window ?? "30"), 10) || 30, 1), 1440);
  res.json(eventGraph.snapshot(window));
});

router.get("/chains", (req: Request, res: Response) => {
  const severity = req.query.severity as any;
  const chains = eventGraph.getChains(severity);
  res.json({ total: chains.length, chains });
});

router.get("/stats", (_req: Request, res: Response) => {
  const snapshot = eventGraph.snapshot(60);
  res.json({
    window60m:  snapshot.stats,
    busStats:   bus.getStats(),
    recentBus:  bus.getRecent(10),
    timestamp:  new Date().toISOString(),
  });
});

router.post("/test-publish", (req: Request, res: Response) => {
  const channel = (req.body?.channel ?? "siem.event") as EventChannel;
  const payload = req.body?.payload ?? { test: true };
  bus.publish(channel, payload, "test");
  res.json({ published: true, channel, payload });
});

export default router;
