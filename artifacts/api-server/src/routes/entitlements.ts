// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Entitlement routes — product catalog, feature resolution, admin grant/revoke.
import { Router } from "express";
import { z } from "zod";
import { getAuth } from "@clerk/express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validateRequest, getValidatedBody } from "../middlewares/validateRequest";
import { requireAdmin } from "./_auth";
import {
  resolveEntitlements,
  grantTenantFeature,
  revokeTenantFeature,
  grantUserFeature,
  revokeUserFeature,
  seedProductCatalog,
  getUpgradeRecommendations,
} from "../services/entitlementService";
import { PRODUCT_CATALOG } from "../commercial/productCatalog";
import { isKnownFeature } from "../commercial/featureRegistry";
import { FEATURE_REGISTRY } from "../commercial/featureRegistry";

const router = Router();

// ── Public: product catalog ───────────────────────────────────────────────────
router.get("/products", (_req, res) => {
  res.json({ products: PRODUCT_CATALOG });
});

// ── Public: feature registry ──────────────────────────────────────────────────
router.get("/features", (_req, res) => {
  res.json({ features: Object.values(FEATURE_REGISTRY) });
});

// ── Authenticated: my entitlements ────────────────────────────────────────────
router.get("/me", asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // Admin users get all features
  if ((req as any).__isAdmin) {
    const allFeatures: Record<string, boolean> = {};
    for (const f of Object.keys(FEATURE_REGISTRY)) allFeatures[f] = true;
    return res.json({ features: allFeatures, limits: {}, products: [], isAdmin: true });
  }

  res.json(await resolveEntitlements({ userId, tenantId: (req as any).tenantId ?? null }));
}));

// ── Authenticated: upgrade recommendations ────────────────────────────────────
router.get("/me/recommendations", asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  res.json(await getUpgradeRecommendations(userId));
}));

// ── Validation schemas ────────────────────────────────────────────────────────
const tenantFeatureSchema = z.object({
  tenantId:   z.string().min(1),
  featureKey: z.string().refine(isKnownFeature, { message: "Unknown feature key" }),
  enabled:    z.boolean().default(true),
  limits:     z.record(z.unknown()).default({}),
  expiresAt:  z.string().datetime().optional(),
});

const userFeatureSchema = z.object({
  userId:     z.string().min(1),
  tenantId:   z.string().optional(),
  featureKey: z.string().refine(isKnownFeature, { message: "Unknown feature key" }),
  enabled:    z.boolean().default(true),
  limits:     z.record(z.unknown()).default({}),
  expiresAt:  z.string().datetime().optional(),
});

// ── Admin: seed product catalog ───────────────────────────────────────────────
router.post("/admin/seed", requireAdmin, asyncHandler(async (_req, res) => {
  res.json(await seedProductCatalog());
}));

// ── Admin: grant/revoke tenant feature ───────────────────────────────────────
router.post(
  "/admin/tenant-feature",
  requireAdmin,
  validateRequest({ body: tenantFeatureSchema }),
  asyncHandler(async (req, res) => {
    const body = getValidatedBody<typeof tenantFeatureSchema>(req);
    const { userId: actorUserId } = getAuth(req);
    const featureKey = body.featureKey as any;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    if (body.enabled) {
      res.json(await grantTenantFeature({ tenantId: body.tenantId, featureKey, actorUserId, limits: body.limits, expiresAt }));
    } else {
      res.json(await revokeTenantFeature({ tenantId: body.tenantId, featureKey, actorUserId }));
    }
  }),
);

// ── Admin: grant/revoke user feature ─────────────────────────────────────────
router.post(
  "/admin/user-feature",
  requireAdmin,
  validateRequest({ body: userFeatureSchema }),
  asyncHandler(async (req, res) => {
    const body = getValidatedBody<typeof userFeatureSchema>(req);
    const { userId: actorUserId } = getAuth(req);
    const featureKey = body.featureKey as any;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    if (body.enabled) {
      res.json(await grantUserFeature({ userId: body.userId, tenantId: body.tenantId ?? null, featureKey, actorUserId, limits: body.limits, expiresAt }));
    } else {
      res.json(await revokeUserFeature({ userId: body.userId, tenantId: body.tenantId ?? null, featureKey, actorUserId }));
    }
  }),
);

// ── Admin: resolve entitlements for any user ─────────────────────────────────
router.get("/admin/resolve", requireAdmin, asyncHandler(async (req, res) => {
  const userId = req.query.userId as string | undefined;
  const tenantId = req.query.tenantId as string | undefined;
  if (!userId && !tenantId) return res.status(400).json({ error: "userId or tenantId required" });
  res.json(await resolveEntitlements({ userId: userId ?? null, tenantId: tenantId ?? null }));
}));

export default router;
