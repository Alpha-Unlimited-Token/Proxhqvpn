// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      tenantRole?: string;
    }
  }
}

export async function tenantContext(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const requestedTenantId = String(
    req.headers["x-tenant-id"] ?? req.query.tenantId ?? "",
  ).trim();

  if (!requestedTenantId) return next();

  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const result: any = await db.execute(sql`
    SELECT role
    FROM tenant_memberships
    WHERE tenant_id = ${requestedTenantId}
      AND user_id = ${userId}
      AND status = 'active'
    LIMIT 1
  `);

  const membership = result.rows?.[0];

  if (!membership) {
    return res.status(403).json({ error: "Tenant access denied" });
  }

  req.tenantId = requestedTenantId;
  req.tenantRole = membership.role;

  next();
}
