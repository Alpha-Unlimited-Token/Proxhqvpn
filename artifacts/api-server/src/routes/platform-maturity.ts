// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { scorePlatformMaturity } from "../services/platformMaturityService";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await scorePlatformMaturity());
  }),
);

export default router;
