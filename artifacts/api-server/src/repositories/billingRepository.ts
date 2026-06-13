// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { and, desc, eq, gt, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, cryptoSubscriptionsTable } from "@workspace/db/schema";
import {
  isBillingSchemaConfigured,
  billingSubscriptionsTable,
  getBillingColumns,
} from "./billingSchemaAdapter";

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

function isActiveStatus(raw: unknown): boolean {
  const status = String(raw ?? "").toLowerCase();
  return ["active", "trialing", "paid"].includes(status);
}

function isFutureDate(raw: unknown): boolean {
  if (!raw) return false;
  const time = raw instanceof Date ? raw.getTime() : Date.parse(String(raw));
  return Number.isFinite(time) && time > Date.now();
}

function chooseOrderColumn(columns: ReturnType<typeof getBillingColumns>) {
  return (
    columns.updatedAt ??
    columns.createdAt ??
    columns.currentPeriodEnd ??
    columns.id
  );
}

/**
 * Path A — unified subscriptions table via billingSchemaAdapter
 * (active once a subscriptionsTable is exported from @workspace/db/schema)
 */
async function getBillingFromSubscriptionsTable(
  userId: string,
): Promise<BillingAccessState> {
  const table = billingSubscriptionsTable as any;
  const columns = getBillingColumns(table);

  const identityWhere =
    columns.userId &&
    columns.clerkUserId &&
    columns.userId !== columns.clerkUserId
      ? or(eq(columns.userId, userId), eq(columns.clerkUserId, userId))
      : eq(columns.userId ?? columns.clerkUserId, userId);

  const [subscription] = await db
    .select()
    .from(table)
    .where(identityWhere)
    .orderBy(desc(chooseOrderColumn(columns)))
    .limit(1);

  if (!subscription) {
    return { hasSubscription: false, hasCommandCenter: false, tier: null, status: null };
  }

  const status =
    subscription.status ??
    subscription.subscriptionStatus ??
    subscription.stripeStatus ??
    null;

  const tier = normalizeTier(
    subscription.tier ??
      subscription.planTier ??
      subscription.subscriptionTier ??
      subscription.plan,
  );

  const currentPeriodEnd =
    subscription.currentPeriodEnd ??
    subscription.current_period_end ??
    subscription.endsAt ??
    subscription.expiresAt ??
    null;

  const hasSubscription =
    isActiveStatus(status) || isFutureDate(currentPeriodEnd);

  return {
    hasSubscription,
    hasCommandCenter: hasSubscription && tier === "command_center",
    tier: hasSubscription ? tier : null,
    status: status ? String(status) : null,
  };
}

/**
 * Path B — fallback for current schema:
 *   1. crypto_subscriptions (planTier + expiresAt, fully in DB)
 *   2. users.stripe_subscription_id presence (status resolution in 7D+)
 */
async function getBillingFromCurrentSchema(
  userId: string,
): Promise<BillingAccessState> {
  // 1. Crypto subscription — full state stored in DB
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
    // Non-fatal — fall through
  }

  // 2. Stripe subscription — presence check only
  //    (live status + tier resolution deferred to future stripeStorage integration)
  try {
    const [user] = await db
      .select({ stripeSubscriptionId: usersTable.stripeSubscriptionId })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (user?.stripeSubscriptionId) {
      return {
        hasSubscription: true,
        hasCommandCenter: false, // resolved when stripeStorage integration lands
        tier: "vpn",             // conservative default
        status: "active",
      };
    }
  } catch {
    // Non-fatal
  }

  return { hasSubscription: false, hasCommandCenter: false, tier: null, status: null };
}

/**
 * Returns the billing access state for a user.
 *
 * Automatically uses the unified subscriptions table adapter (Path A) when
 * billingSubscriptionsTable is configured, and falls back to the current
 * split-schema approach (Path B) until then.
 */
export async function getBillingAccessState(
  userId: string,
): Promise<BillingAccessState> {
  if (isBillingSchemaConfigured()) {
    return getBillingFromSubscriptionsTable(userId);
  }

  return getBillingFromCurrentSchema(userId);
}
