// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { requireAdmin as requireAdminMiddleware } from "../middlewares/requireAdmin";

export const requireAdmin = requireAdminMiddleware;

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if ((req as any).internalBypass) return next();

  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}
