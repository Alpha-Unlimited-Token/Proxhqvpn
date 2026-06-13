// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { getUserAccessProfile } from "../services/userAccessService";

export function requireSubscriptionPlan(required: "vpn" | "command_center") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const profile = await getUserAccessProfile(userId);

    if (profile.isAdmin || profile.isEmployee) return next();

    if (required === "vpn" && profile.hasAccess) return next();

    if (required === "command_center" && profile.hasCommandCenter) {
      return next();
    }

    return res.status(402).json({
      error: "Subscription plan required",
      required,
    });
  };
}
