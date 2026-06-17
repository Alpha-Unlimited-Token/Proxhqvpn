// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import publicRoutes from "./groups/public";
import adminRoutes from "./groups/admin";
import vpnRoutes from "./groups/vpn";
import commandCenterRoutes from "./groups/command-center";
import miscAuthenticatedRoutes from "./groups/misc-authenticated";
import omegaRoutes from "./groups/omega";
import { requireAuth, requireAdmin } from "./_auth";

const router: IRouter = Router();

/**
 * Route-group order matters:
 *
 * 1. Public routes mount before requireAuth.
 * 2. Everything after requireAuth requires Clerk session or validated internal bypass.
 * 3. Normal product routes mount before isolated high-risk route groups.
 * 4. Security-lab and Omega are disabled by default and admin-only.
 */
router.use(publicRoutes);

router.use(requireAuth);

router.use(vpnRoutes);
router.use(commandCenterRoutes);
router.use(adminRoutes);
router.use(miscAuthenticatedRoutes);

// Omega routes (feature-gated and admin-only).
router.use(omegaRoutes);

export { requireAdmin };

export default router;
