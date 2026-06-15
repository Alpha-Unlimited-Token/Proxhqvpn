// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// requireFeature — Express middleware that gates routes behind commercial feature entitlements.
// Returns HTTP 402 Payment Required when the authenticated user lacks the feature.
// Admin users (req.__isAdmin = true) bypass all feature checks unconditionally.
import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { hasFeature, recordEntitlementAudit } from "../services/entitlementService";
import type { FeatureKey } from "../commercial/productCatalog";

export function requireFeature(featureKey: FeatureKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Admin bypass — platform admins have access to every feature regardless of subscription
    if ((req as any).__isAdmin) return next();

    const { userId } = getAuth(req);
    const tenantId: string | null = (req as any).tenantId ?? null;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const allowed = await hasFeature({ tenantId, userId, featureKey });

      if (!allowed) {
        void recordEntitlementAudit({
          actorUserId: userId,
          tenantId,
          action: "feature.denied",
          featureKey,
          metadata: { path: req.path, method: req.method },
        });

        return res.status(402).json({
          error: "Feature not included in current plan",
          requiredFeature: featureKey,
          upgradeRequired: true,
          upgradeUrl: "/pricing",
        });
      }

      next();
    } catch (err: any) {
      return res.status(500).json({ error: "Entitlement check failed", detail: err.message });
    }
  };
}
