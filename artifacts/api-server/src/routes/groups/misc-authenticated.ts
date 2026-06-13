// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response } from "express";
import { requireAccess } from "../../middlewares/requireAccess";

const router = Router();

router.get("/config-lifecycle-events", requireAccess, async (req: Request, res: Response) => {
  const userId = (req as any).auth?.userId ?? "unknown";
  const { getConfigLifecycleHistory } = await import("../../lib/config-lifecycle");
  const events = await getConfigLifecycleHistory(userId, 100);

  res.json({ events });
});

export default router;
