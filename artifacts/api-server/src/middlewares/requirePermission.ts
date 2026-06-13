// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { getUserPermissions } from "../services/rbacService";

export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const permissions = await getUserPermissions({
      userId,
      tenantId: req.tenantId ?? null,
    });

    if (!permissions.includes(permission) && !permissions.includes("*")) {
      return res.status(403).json({
        error: "Permission denied",
        required: permission,
      });
    }

    next();
  };
}
