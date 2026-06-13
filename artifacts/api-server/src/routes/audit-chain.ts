// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middlewares/asyncHandler";
import {
  validateRequest,
  getValidatedQuery,
} from "../middlewares/validateRequest";
import {
  persistAuditChainVerification,
  verifyAuditChain,
} from "../lib/audit-chain-verifier";

const router = Router();

const verifyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100_000).default(10_000),
  persist: z.coerce.boolean().default(true),
});

router.get(
  "/verify",
  validateRequest({ query: verifyQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = getValidatedQuery<typeof verifyQuerySchema>(req);
    const result = await verifyAuditChain(query.limit);

    if (query.persist) {
      await persistAuditChainVerification(result);
    }

    res.json(result);
  }),
);

export default router;
