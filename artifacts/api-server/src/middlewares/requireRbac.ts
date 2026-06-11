// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// RBAC middleware factory — wraps lib/rbac.ts requirePermission() for Express routes.
// Derives the caller's role from the usersTable.role column (falls back to "user").
// Usage:  router.post("/sensitive", requireAdmin, requireRbac("vpn:write"), handler)
// Order:  always place AFTER requireAuth/requireAdmin so userId is guaranteed.

import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission, parseRole, type Action } from "../lib/rbac";

/**
 * Returns an Express middleware that enforces RBAC for the given action.
 * Reads user's role from DB; falls back to "user" if no role is stored.
 * Admins (isAdmin=true) are unconditionally mapped to "network_admin" or higher.
 */
export function requireRbac(action: Action) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    let role = "user" as ReturnType<typeof parseRole>;

    try {
      const [user] = await db.select({ role: usersTable.role, isAdmin: usersTable.isAdmin })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      if (user) {
        if (user.isAdmin) {
          // Admin users get owner-level access if no explicit role is stored
          role = parseRole(user.role ?? "owner");
          if (role === "user") role = "owner";
        } else {
          role = parseRole(user.role ?? "user");
        }
      }
    } catch {
      // DB error → conservative fallback, do not block but log
      role = "user";
    }

    try {
      requirePermission(role, action);
      next();
    } catch (err: any) {
      res.status(err.statusCode ?? 403).json({
        error: err.message ?? "Forbidden",
        role,
        action,
      });
    }
  };
}
