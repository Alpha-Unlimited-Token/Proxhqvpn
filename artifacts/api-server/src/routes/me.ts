// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { isEmployeeEmail, getEmployeeByEmail } from "./employees";
import { stripeStorage } from "../stripeStorage";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

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

  // Check ALL email addresses on the account (primary + secondary) so admin status
  // is preserved even if the primary email changes or a second address was added.
  const allEmails = clerkUser.emailAddresses.map((e) => e.emailAddress.toLowerCase());
  const isAdminByEmail =
    allEmails.some((e) => ADMIN_EMAILS.includes(e)) ||
    (email ? ADMIN_EMAILS.includes(email.toLowerCase()) : false);

  const conflictSet: Record<string, unknown> = { email: email ?? undefined };
  if (isAdminByEmail) conflictSet.isAdmin = true;

  const [dbUser] = await db
    .insert(usersTable)
    .values({ id: userId, email: email ?? undefined, isAdmin: isAdminByEmail })
    .onConflictDoUpdate({ target: usersTable.id, set: conflictSet })
    .returning();

  const isAdmin = dbUser?.isAdmin ?? isAdminByEmail;
  const employee = email ? await getEmployeeByEmail(email) : null;
  const isEmployee = !!employee;
  const isAdminEmployee = !isAdmin && (employee?.isAdminEmployee ?? false);

  // Auto-create a pre-approved ambassador account for:
  //   a) employees flagged as ambassadors, and
  //   b) admin users (platform owners)
  const shouldAutoAmb =
    (employee?.isAmbassador && employee.ambassadorPromoCode) || isAdminByEmail;

  if (shouldAutoAmb) {
    try {
      const existingAmb = await db.execute(sql`
        SELECT id FROM ambassadors WHERE user_id = ${userId} LIMIT 1
      `);
      const existing: any[] = Array.isArray(existingAmb) ? existingAmb : ((existingAmb as any).rows ?? []);
      if (existing.length === 0) {
        const displayName = employee?.displayName ?? email?.split("@")[0] ?? "Ambassador";
        // Use employee promo code if set, otherwise derive a unique code from userId
        const rawCode = employee?.ambassadorPromoCode
          ?? ("PROXHQ" + userId.replace(/[^A-Z0-9]/gi, "").substring(0, 6).toUpperCase());
        const promoCode = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 12);
        const bio = isAdminByEmail
          ? "Founder & CEO — ALPHA UNLIMITED TECHNOLOGIES LLC. Official ProxhqVPN founding ambassador."
          : "ProxhqVPN team member and founding ambassador.";
        await db.execute(sql`
          INSERT INTO ambassadors (user_id, name, bio, promo_code, avatar_url, social_urls, status)
          VALUES (
            ${userId},
            ${displayName},
            ${bio},
            ${promoCode},
            ${null},
            ${"{}"}::jsonb,
            ${"approved"}
          )
          ON CONFLICT (user_id) DO NOTHING
        `);
      }
    } catch (err) {
      // Non-fatal — ambassador setup can be retried later
      console.error("[me] ambassador auto-create failed:", err);
    }
  }

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
  // devTier          = 1 (Recon) | 2 (Strike/CC Pro) | 3 (Arsenal) | null
  const hasSubscription = tier !== null;
  const hasAccess = isAdmin || isEmployee || hasSubscription;
  const hasCommandCenter = isAdmin || isEmployee || tier === "command_center";
  const devTier: 1 | 2 | 3 | null =
    isAdmin || isEmployee ? 3 :
    tier === "command_center" ? 2 :
    null;
  const hasArsenal = devTier === 3;

  // role hierarchy: "owner" > "employee_admin" > "employee" > "subscriber" > null
  const role = isAdmin
    ? "owner"
    : isAdminEmployee
    ? "employee_admin"
    : isEmployee
    ? "employee"
    : tier
    ? "subscriber"
    : null;

  return res.json({
    userId,
    email,
    isAdmin,
    isEmployee,
    isAdminEmployee,
    role,
    hasAccess,
    hasSubscription,
    hasCommandCenter,
    devTier,
    hasArsenal,
    tier: isAdmin || isEmployee || isAdminEmployee ? "command_center" : tier,
  });
});

export default router;
export { ADMIN_EMAILS };
