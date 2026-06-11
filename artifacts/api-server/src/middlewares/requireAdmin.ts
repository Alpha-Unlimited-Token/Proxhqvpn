// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable, employeesTable } from "@workspace/db/schema";
import { eq, ilike } from "drizzle-orm";

/** Full owner-level admin only */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  // Internal bypass — already validated by requireAuth
  if ((req as any).internalBypass) return next();

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user?.isAdmin) return res.status(403).json({ error: "Forbidden: owner admin only" });
  (req as any).adminEmail = user.email;
  (req as any).__isAdmin = true;
  next();
};

/** Owner OR employee-admin */
export const requireAdminOrEmployeeAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (user?.isAdmin) {
    (req as any).adminEmail = user.email;
    (req as any).isOwner = true;
    return next();
  }

  if (user?.email) {
    const [emp] = await db.select().from(employeesTable).where(ilike(employeesTable.email, user.email));
    if (emp?.isAdminEmployee) {
      (req as any).adminEmail = user.email;
      (req as any).isOwner = false;
      return next();
    }
  }

  return res.status(403).json({ error: "Forbidden: admin access required" });
};
