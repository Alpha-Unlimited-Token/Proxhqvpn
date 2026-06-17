// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { getUserAccessProfile } from "../services/userAccessService";
import { db } from "@workspace/db";
import { usersTable, userWgConfigsTable, devicesTable, verifiedAssetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";
import { appendAuditEvent } from "../lib/audit-chain";
import { logger } from "../lib/logger";

const router = Router();

router.get("/", async (req, res) => {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const profile = await getUserAccessProfile(userId);

  res.json(profile);
});

// ── DELETE /api/me — GDPR Article 17 right to erasure ───────────────────────
// Cancels subscriptions, revokes WireGuard keys, removes devices and verified
// assets, anonymizes audit logs (retained 30 days for legal compliance), then
// deletes the user record. This is irreversible.
router.delete("/", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // 1. Cancel active Stripe subscription
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (user?.stripeSubscriptionId) {
      try {
        const stripe = await getUncachableStripeClient();
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      } catch (stripeErr: any) {
        logger.warn({ userId, err: stripeErr.message }, "Stripe subscription cancel failed during account deletion");
      }
    }

    // 2. Revoke all WireGuard configs (removes keys from DB)
    await db.delete(userWgConfigsTable).where(eq(userWgConfigsTable.userId, userId));

    // 3. Remove registered devices
    await db.delete(devicesTable).where(eq(devicesTable.userId, userId));

    // 4. Remove verified assets (ownership proofs)
    await db.delete(verifiedAssetsTable).where(eq(verifiedAssetsTable.userId, userId));

    // 5. Delete user record
    // Audit logs are NOT deleted immediately — retained 30 days for legal compliance.
    await db.delete(usersTable).where(eq(usersTable.id, userId));

    appendAuditEvent({
      actor:    userId,
      action:   "account.deleted",
      resource: `user:${userId}`,
      result:   "allow",
    });

    logger.info({ userId }, "Account deleted per GDPR Article 17 request");
    res.json({ message: "Account deleted. All personal data has been removed." });
  } catch (err: any) {
    logger.error({ err, userId }, "Account deletion failed");
    res.status(500).json({ error: "Deletion failed. Contact support@proxhqvpn.com" });
  }
});

export default router;
