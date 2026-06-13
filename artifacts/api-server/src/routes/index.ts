// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import publicRoutes from "./groups/public";
import adminRoutes from "./groups/admin";
import vpnRoutes from "./groups/vpn";
import commandCenterRoutes from "./groups/command-center";
import miscAuthenticatedRoutes from "./groups/misc-authenticated";
import { requireAuth, requireAdmin } from "./_auth";

const router: IRouter = Router();

/**
 * Route-group order matters:
 *
 * 1. Public routes must mount before requireAuth.
 * 2. Everything after requireAuth requires Clerk session or validated internal bypass.
 * 3. Group files own their own tier/admin/capability guards.
 */
router.use(publicRoutes);

router.use(requireAuth);

router.use(vpnRoutes);
router.use(commandCenterRoutes);
router.use(adminRoutes);
router.use(miscAuthenticatedRoutes);

export { requireAdmin };

export default router;
