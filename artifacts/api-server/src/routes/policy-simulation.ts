// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validateRequest, getValidatedBody } from "../middlewares/validateRequest";
import { simulateZeroTrustDecision } from "../services/policySimulationService";

const router = Router();

const simulationSchema = z.object({
  userId: z.string().min(1),
  deviceTrustLevel: z.string().optional(),
  identityRiskLevel: z.string().optional(),
  requestedCapability: z.string().optional(),
  region: z.string().nullable().optional(),
});

router.post(
  "/zero-trust",
  validateRequest({ body: simulationSchema }),
  asyncHandler(async (req, res) => {
    const body = getValidatedBody<typeof simulationSchema>(req);
    res.json(await simulateZeroTrustDecision(body));
  }),
);

export default router;
