// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { runContinuousSelfAudit } from "../services/continuousSelfAuditService";

const router = Router();

router.post(
  "/run",
  asyncHandler(async (_req, res) => {
    res.json(await runContinuousSelfAudit());
  }),
);

export default router;
