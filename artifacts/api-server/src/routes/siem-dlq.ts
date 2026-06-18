// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// PATCH 29 — SIEM Dead-Letter Queue replay endpoint.
// Allows operators to inspect and replay events that failed all delivery attempts.
import { Router, type Request, type Response } from "express";
import { requireAdmin } from "./_auth";
import { getDeadLetterQueue, clearDeadLetterQueue, shipSecurityEvent } from "../lib/siem";
import { logger } from "../lib/logger";

const router = Router();

// GET /dlq — inspect the dead-letter queue
router.get("/", requireAdmin, (req: Request, res: Response) => {
  const queue = getDeadLetterQueue();
  res.json({
    count: queue.length,
    entries: queue,
  });
});

// POST /dlq/replay — replay all queued events and clear the queue
router.post("/replay", requireAdmin, async (req: Request, res: Response) => {
  const queue = getDeadLetterQueue();
  if (queue.length === 0) {
    return res.json({ replayed: 0, message: "Dead-letter queue is empty" });
  }

  logger.info({ count: queue.length }, "Replaying SIEM dead-letter queue");
  clearDeadLetterQueue(); // clear first so new failures don't re-enqueue these same events

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const entry of queue) {
    try {
      await shipSecurityEvent(entry.event);
      succeeded++;
    } catch (err: any) {
      failed++;
      errors.push(String(err?.message ?? err));
    }
  }

  res.json({ replayed: queue.length, succeeded, failed, errors });
});

// DELETE /dlq — discard all queued events without replay
router.delete("/", requireAdmin, (req: Request, res: Response) => {
  const count = getDeadLetterQueue().length;
  clearDeadLetterQueue();
  logger.warn({ count }, "SIEM dead-letter queue cleared without replay");
  res.json({ cleared: count });
});

export default router;
