// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response } from "express";
import { requireCapability } from "../../middlewares/requireCapability";
import frontendEventsRouter from "../frontend-events";
import entitlementsRouter from "../entitlements";
import verifiedAssetsRouter from "../verified-assets";
import eventsRouter from "../events";

const router = Router();

router.use("/frontend-events", frontendEventsRouter);
router.use("/entitlements", entitlementsRouter);
router.use("/verified-assets", verifiedAssetsRouter);
router.use("/events", eventsRouter);

router.get("/config-lifecycle-events", requireCapability("vpn.read"), async (req: Request, res: Response) => {
  const userId = (req as any).auth?.userId ?? "unknown";
  const { getConfigLifecycleHistory } = await import("../../lib/config-lifecycle");
  const events = await getConfigLifecycleHistory(userId, 100);

  res.json({ events });
});

export default router;
