// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { getUserAccessProfile } from "../services/userAccessService";

export async function requireCommandCenter(
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

  if (!profile.hasCommandCenter) {
    return res.status(403).json({
      error: "Command Center subscription required",
      required: "command_center",
    });
  }

  (req as any).accessProfile = profile;

  next();
}

export default requireCommandCenter;
