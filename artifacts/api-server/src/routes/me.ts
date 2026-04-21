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

  // Determine subscription tier
  let tier: "vpn" | "command_center" | null = null;
  if (!isAdmin && !isEmployee) {
    try {
      const stripeUser = await stripeStorage.getUser(userId);
      if (stripeUser?.stripeSubscriptionId) {
        const sub = await stripeStorage.getSubscription(stripeUser.stripeSubscriptionId);
        if (sub?.status === "active" || sub?.status === "trialing") {
          tier = await stripeStorage.getSubscriptionTier(stripeUser.stripeSubscriptionId);
        }
      }
    } catch {}
  }

  // Access flags:
  // hasAccess        = can use VPN features (admin | employee | any active sub)
  // hasCommandCenter = can use developer tools (admin | employee | command_center sub)
  const hasSubscription = tier !== null;
  const hasAccess = isAdmin || isEmployee || hasSubscription;
  const hasCommandCenter = isAdmin || isEmployee || tier === "command_center";

  return res.json({
    userId,
    email,
    isAdmin,
    isEmployee,
    hasAccess,
    hasSubscription,
    hasCommandCenter,
    tier: isAdmin || isEmployee ? "command_center" : tier,
  });
});

export default router;
export { ADMIN_EMAILS };
