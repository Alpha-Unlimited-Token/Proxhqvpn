// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import {
  canAccessAdminOrEmployeeAdmin,
  canAccessOwnerAdmin,
  getAuthzProfile,
} from "../services/authzService";

/** Full owner-level admin only */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if ((req as any).internalBypass) return next();

  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const allowed = await canAccessOwnerAdmin(userId);

  if (!allowed) {
    return res.status(403).json({ error: "Forbidden: owner admin only" });
  }

  const profile = await getAuthzProfile(userId);

  (req as any).adminEmail = profile.user?.email;
  (req as any).__isAdmin = true;

  next();
};

/** Owner OR employee-admin */
export const requireAdminOrEmployeeAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const allowed = await canAccessAdminOrEmployeeAdmin(userId);

  if (!allowed) {
    return res.status(403).json({ error: "Forbidden: admin access required" });
  }

  const profile = await getAuthzProfile(userId);

  (req as any).adminEmail = profile.user?.email;
  (req as any).isOwner = profile.isOwner;

  next();
};
