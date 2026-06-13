// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { requireAdmin } from "../_auth";
import { featureGate } from "../../middlewares/featureGate";
import { isSecurityLabEnabled } from "../../lib/feature-flags";

import nodeCrackerRouter from "../node-cracker";
import devAuditRouter from "../dev-audit";

const router = Router();

/**
 * Security-lab routes are intentionally not part of the normal customer API.
 *
 * They require:
 * - authenticated session
 * - owner/admin permissions
 * - PROXHQ_ENABLE_SECURITY_LAB=1
 * - plus PROXHQ_ENABLE_SECURITY_LAB_PROD=1 in production
 */
router.use(
  featureGate({
    featureName: "security-lab",
    enabled: isSecurityLabEnabled,
  }),
);

router.use(requireAdmin);

router.use("/node-cracker", nodeCrackerRouter);
router.use("/dev-audit", devAuditRouter);

export default router;
