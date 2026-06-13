// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validateRequest, getValidatedQuery } from "../middlewares/validateRequest";
import { buildAttackPath } from "../services/attackPathService";
import { getSecurityGraphForEntity } from "../services/securityGraphService";

const router = Router();

const graphQuery = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  maxDepth: z.coerce.number().min(1).max(5).default(3),
});

router.get(
  "/entity",
  validateRequest({ query: graphQuery }),
  asyncHandler(async (req, res) => {
    const query = getValidatedQuery<typeof graphQuery>(req);
    res.json(await getSecurityGraphForEntity(query.entityType, query.entityId));
  }),
);

router.get(
  "/attack-path",
  validateRequest({ query: graphQuery }),
  asyncHandler(async (req, res) => {
    const query = getValidatedQuery<typeof graphQuery>(req);
    res.json(await buildAttackPath(query));
  }),
);

export default router;
