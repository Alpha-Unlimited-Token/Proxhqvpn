// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import publicRoutes from "./groups/public";
import adminRoutes from "./groups/admin";
import vpnRoutes from "./groups/vpn";
import commandCenterRoutes from "./groups/command-center";
import miscAuthenticatedRoutes from "./groups/misc-authenticated";
import { requireAuth, requireAdmin } from "./_auth";
import firewallPublicRouter from "./firewall-public";

const router: IRouter = Router();

router.use(publicRoutes);
// Firewall prompts/decisions — public reads, no Clerk session required
router.use("/firewall", firewallPublicRouter);
router.use(requireAuth);
router.use(vpnRoutes);
router.use(commandCenterRoutes);
router.use(adminRoutes);
router.use(miscAuthenticatedRoutes);

export { requireAdmin };
export default router;
