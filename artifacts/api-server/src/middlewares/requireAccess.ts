/**
 * requireAccess middleware
 *
 * Grants access if the signed-in user is:
 *   1. An admin (isAdmin flag in DB, set via ADMIN_EMAILS env)
 *   2. A registered employee (in the employees table)
 *   3. An active/trialing Stripe subscriber
 *
 * Everyone else (free accounts) gets 402 Payment Required.
 */

import { type Request, type Response, type NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable, cryptoSubscriptionsTable } from "@workspace/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { isEmployeeEmail } from "../routes/employees";
import { stripeStorage } from "../stripeStorage";

export const requireAccess = async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // 1 — Admin check (DB flag, set from ADMIN_EMAILS env on first login)
  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (dbUser?.isAdmin) return next();

  // 2 — Employee check (in employees table, gets complimentary access)
  let email: string | null = null;
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    email = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ?? null;
  } catch {}

  if (email && await isEmployeeEmail(email)) return next();

  // 3 — Active Stripe subscription check
  const stripeUser = await stripeStorage.getUser(userId);
  if (stripeUser?.stripeSubscriptionId) {
    const sub = await stripeStorage.getSubscription(stripeUser.stripeSubscriptionId);
    if (sub?.status === "active" || sub?.status === "trialing") return next();
  }

  // 4 — Active crypto subscription check (Bitcoin / Ethereum payments)
  const [cryptoSub] = await db
    .select()
    .from(cryptoSubscriptionsTable)
    .where(and(
      eq(cryptoSubscriptionsTable.userId, userId),
      gt(cryptoSubscriptionsTable.expiresAt, new Date()),
    ));
  if (cryptoSub) return next();

  // No valid access
  return res.status(402).json({
    error: "Subscription required",
    code: "NO_SUBSCRIPTION",
    message: "An active ProxhqVPN subscription is required to access this feature.",
  });
};
