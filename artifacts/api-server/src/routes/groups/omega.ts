// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { requireCapability } from "../../middlewares/requireCapability";
import { featureGate } from "../../middlewares/featureGate";
import { isOmegaEnabled } from "../../lib/feature-flags";

import omegaRouter from "../omega";

const router = Router();

/**
 * Omega is isolated from normal VPN / Command Center routing.
 *
 * It requires:
 * - authenticated session
 * - owner/admin permissions
 * - PROXHQ_ENABLE_OMEGA=1
 * - plus PROXHQ_ENABLE_OMEGA_PROD=1 in production
 */
router.use(
  featureGate({
    featureName: "omega",
    enabled: isOmegaEnabled,
  }),
);

router.use(requireCapability("omega.admin"));
router.use("/omega", omegaRouter);

export default router;
