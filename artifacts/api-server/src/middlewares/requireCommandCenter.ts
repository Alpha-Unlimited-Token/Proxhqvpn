// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * requireCommandCenter middleware
 *
 * Grants access if the user has:
 *   1. Admin status
 *   2. Employee status (complimentary full access)
 *   3. An active/trialing Command Center Pro subscription
 *
 * VPN Basic subscribers are blocked — they can see VPN features but not
 * the developer tooling suite.
 */

import { type Request, type Response, type NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable, cryptoSubscriptionsTable } from "@workspace/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { isEmployeeEmail } from "../routes/employees";
import { stripeStorage } from "../stripeStorage";

export const requireCommandCenter = async (req: Request, res: Response, next: NextFunction) => {
  // Internal bypass — request already validated by requireAuth with SESSION_SECRET
  if ((req as any).internalBypass) return next();

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // 1 — Admin always gets everything
  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (dbUser?.isAdmin) return next();

  // 2 — Employees get full access (no subscription required)
  let email: string | null = null;
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    email = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ?? null;
  } catch {}

  if (email && await isEmployeeEmail(email)) return next();

  // 3 — Active Command Center Pro subscription
  const stripeUser = await stripeStorage.getUser(userId);
  if (stripeUser?.stripeSubscriptionId) {
    const sub = await stripeStorage.getSubscription(stripeUser.stripeSubscriptionId);
    if (sub?.status === "active" || sub?.status === "trialing") {
      const tier = await stripeStorage.getSubscriptionTier(stripeUser.stripeSubscriptionId);
      if (tier === "command_center") return next();
    }
  }

  // 4 — Active crypto Command Center Pro subscription
  const [cryptoSub] = await db
    .select()
    .from(cryptoSubscriptionsTable)
    .where(and(
      eq(cryptoSubscriptionsTable.userId, userId),
      eq(cryptoSubscriptionsTable.planTier, "command_center"),
      gt(cryptoSubscriptionsTable.expiresAt, new Date()),
    ));
  if (cryptoSub) return next();

  return res.status(402).json({
    error: "Command Center Pro required",
    code: "UPGRADE_REQUIRED",
    message: "This feature requires a Command Center Pro subscription.",
    upgradeUrl: "/pricing",
  });
};
