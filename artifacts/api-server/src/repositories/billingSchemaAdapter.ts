// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import * as schema from "@workspace/db/schema";

/**
 * IMPORTANT:
 * Set this adapter to the real exported subscription table from
 * lib/db/src/schema/index.ts.
 *
 * Common expected names:
 * - subscriptionsTable
 * - userSubscriptionsTable
 * - stripeSubscriptionsTable
 *
 * The fallback lookup below makes this patch easier to apply across schema
 * versions, but once confirmed, replace it with a direct export reference.
 *
 * NOTE: This project's billing state is currently stored across two tables:
 *   - cryptoSubscriptionsTable (crypto-paid, time-based)
 *   - usersTable.stripeSubscriptionId (Stripe ID presence)
 *
 * billingSubscriptionsTable will be null until a unified subscriptions table
 * is added to the schema. getBillingAccessState falls back to those tables.
 */
export const billingSubscriptionsTable =
  (schema as any).subscriptionsTable ??
  (schema as any).userSubscriptionsTable ??
  (schema as any).stripeSubscriptionsTable ??
  null;

export function isBillingSchemaConfigured(): boolean {
  return billingSubscriptionsTable !== null;
}

export function assertBillingSchemaConfigured() {
  if (!billingSubscriptionsTable) {
    throw new Error(
      "Billing subscription table is not configured. Export subscriptionsTable, " +
        "userSubscriptionsTable, or stripeSubscriptionsTable from @workspace/db/schema, " +
        "or update billingSchemaAdapter.ts.",
    );
  }
}

export function getBillingColumns(table: any) {
  return {
    id: table.id,
    userId:
      table.userId ?? table.user_id ?? table.clerkUserId ?? table.clerk_user_id,
    clerkUserId:
      table.clerkUserId ?? table.clerk_user_id ?? table.userId ?? table.user_id,
    status:
      table.status ?? table.subscriptionStatus ?? table.stripeStatus,
    tier:
      table.tier ?? table.planTier ?? table.subscriptionTier ?? table.plan,
    currentPeriodEnd:
      table.currentPeriodEnd ??
      table.current_period_end ??
      table.endsAt ??
      table.expiresAt,
    createdAt: table.createdAt ?? table.created_at,
    updatedAt: table.updatedAt ?? table.updated_at,
  };
}
