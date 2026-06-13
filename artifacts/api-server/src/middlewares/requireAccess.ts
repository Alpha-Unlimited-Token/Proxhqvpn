// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { getUserAccessProfile } from "../services/userAccessService";

export async function requireAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if ((req as any).internalBypass) return next();

  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const profile = await getUserAccessProfile(userId);

  if (!profile.hasAccess) {
    return res.status(402).json({
      error: "Subscription required",
      required: "vpn",
    });
  }

  (req as any).accessProfile = profile;

  next();
}

export default requireAccess;
