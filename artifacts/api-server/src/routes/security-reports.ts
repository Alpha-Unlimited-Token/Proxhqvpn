// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validateRequest, getValidatedQuery } from "../middlewares/validateRequest";
import { generateSecurityOperationsReport } from "../services/securityReportingService";

const router = Router();

const reportQuery = z.object({
  days: z.coerce.number().min(1).max(365).default(7),
});

router.get(
  "/operations",
  validateRequest({ query: reportQuery }),
  asyncHandler(async (req, res) => {
    const query = getValidatedQuery<typeof reportQuery>(req);
    res.json(await generateSecurityOperationsReport({ days: query.days }));
  }),
);

export default router;
