// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import {
  getGlobalVpnControlPlaneSnapshot,
  runGlobalVpnControlPlaneMaintenance,
} from "../services/globalVpnControlPlaneService";

const router = Router();

router.get(
  "/snapshot",
  asyncHandler(async (_req, res) => {
    res.json(await getGlobalVpnControlPlaneSnapshot());
  }),
);

router.post(
  "/maintenance",
  asyncHandler(async (_req, res) => {
    res.json(await runGlobalVpnControlPlaneMaintenance());
  }),
);

export default router;
