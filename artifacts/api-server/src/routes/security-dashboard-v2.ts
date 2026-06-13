// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { getSecurityDashboardSnapshot } from "../services/securityDashboardService";

const router = Router();

router.get(
  "/snapshot",
  asyncHandler(async (_req, res) => {
    res.json(await getSecurityDashboardSnapshot());
  }),
);

export default router;
