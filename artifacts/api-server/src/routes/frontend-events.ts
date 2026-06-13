// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validateRequest, getValidatedBody } from "../middlewares/validateRequest";
import { publishPlatformEvent } from "../lib/event-bus";

const router = Router();

const frontendEventSchema = z.object({
  type: z.string().min(1).max(128),
  severity: z.enum(["info", "warn", "error"]).default("info"),
  metadata: z.record(z.unknown()).default({}),
  occurredAt: z.string().optional(),
});

router.post(
  "/",
  validateRequest({ body: frontendEventSchema }),
  asyncHandler(async (req, res) => {
    const body = getValidatedBody<typeof frontendEventSchema>(req);

    await publishPlatformEvent({
      type: body.type,
      severity: body.severity,
      actor: (req as any).auth?.userId ?? undefined,
      payload: body.metadata,
    });

    res.json({ ok: true });
  }),
);

export default router;
