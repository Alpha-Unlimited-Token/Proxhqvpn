// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validateRequest, getValidatedQuery } from "../middlewares/validateRequest";
import { generateExecutiveSummary } from "../services/executiveReportingService";

const router = Router();

const querySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
});

router.get(
  "/summary",
  validateRequest({ query: querySchema }),
  asyncHandler(async (req, res) => {
    const query = getValidatedQuery<typeof querySchema>(req);
    res.json(await generateExecutiveSummary({ days: query.days }));
  }),
);

export default router;
