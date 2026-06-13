// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { and, eq, gt } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, cryptoSubscriptionsTable } from "@workspace/db/schema";

export type BillingTier = "vpn" | "command_center" | null;

export type BillingAccessState = {
  hasSubscription: boolean;
  hasCommandCenter: boolean;
  tier: BillingTier;
  status: string | null;
};

function normalizeTier(raw: unknown): BillingTier {
  const value = String(raw ?? "").toLowerCase();

  if (
    ["command_center", "command-center", "pro", "command center"].includes(
      value,
    )
  ) {
    return "command_center";
  }

  if (["vpn", "vpn_basic", "basic", "vpn-basic"].includes(value)) {
    return "vpn";
  }

  return null;
}

/**
 * Returns the billing access state for a user by checking:
 *   1. crypto_subscriptions — time-based access with planTier in DB
 *   2. users.stripe_subscription_id — Stripe subscriber presence
 *      (status/tier resolution will be handled in 7D via stripeStorage)
 */
export async function getBillingAccessState(
  userId: string,
): Promise<BillingAccessState> {
  // 1. Crypto subscription (full state stored in DB)
  try {
    const [cryptoSub] = await db
      .select()
      .from(cryptoSubscriptionsTable)
      .where(
        and(
          eq(cryptoSubscriptionsTable.userId, userId),
          gt(cryptoSubscriptionsTable.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (cryptoSub) {
      const tier = normalizeTier(cryptoSub.planTier);
      return {
        hasSubscription: true,
        hasCommandCenter: tier === "command_center",
        tier,
        status: "active",
      };
    }
  } catch {
    // Non-fatal — fall through to Stripe check
  }

  // 2. Stripe subscription — presence check only
  //    (live status + tier resolution to be added in 7D via stripeStorage)
  try {
    const [user] = await db
      .select({ stripeSubscriptionId: usersTable.stripeSubscriptionId })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (user?.stripeSubscriptionId) {
      return {
        hasSubscription: true,
        hasCommandCenter: false, // resolved by 7D via stripeStorage
        tier: "vpn",             // conservative default until 7D
        status: "active",        // optimistic — Stripe cancelled subs also have IDs
      };
    }
  } catch {
    // Non-fatal — return no-subscription default
  }

  return {
    hasSubscription: false,
    hasCommandCenter: false,
    tier: null,
    status: null,
  };
}
