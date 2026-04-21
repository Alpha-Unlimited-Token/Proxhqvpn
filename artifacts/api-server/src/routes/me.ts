import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { isEmployeeEmail } from "./employees";
import { stripeStorage } from "../stripeStorage";
import { eq } from "drizzle-orm";

const router = Router();

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

router.get("/", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const clerkUser = await clerkClient.users.getUser(userId);
  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ?? null;

  const isAdminByEmail = email ? ADMIN_EMAILS.includes(email.toLowerCase()) : false;

  const conflictSet: Record<string, unknown> = { email: email ?? undefined };
  if (isAdminByEmail) conflictSet.isAdmin = true;

  const [dbUser] = await db
    .insert(usersTable)
    .values({ id: userId, email: email ?? undefined, isAdmin: isAdminByEmail })
    .onConflictDoUpdate({ target: usersTable.id, set: conflictSet })
    .returning();

  const isAdmin = dbUser?.isAdmin ?? isAdminByEmail;
  const isEmployee = email ? await isEmployeeEmail(email) : false;

  // Determine whether this user has full access:
  // admin → yes | employee → yes | active/trialing Stripe subscription → yes | free account → no
  let hasSubscription = false;
  if (!isAdmin && !isEmployee) {
    try {
      const stripeUser = await stripeStorage.getUser(userId);
      if (stripeUser?.stripeSubscriptionId) {
        const sub = await stripeStorage.getSubscription(stripeUser.stripeSubscriptionId);
        hasSubscription = sub?.status === "active" || sub?.status === "trialing";
      }
    } catch {}
  }

  const hasAccess = isAdmin || isEmployee || hasSubscription;

  return res.json({
    userId,
    email,
    isAdmin,
    isEmployee,
    hasAccess,
    hasSubscription,
  });
});

export default router;
export { ADMIN_EMAILS };
