// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "../stripeClient";
import { logger } from "../lib/logger";

function normalizeDatabaseUrl(url: string): string {
  if (process.env.REPLIT_DEPLOYMENT !== "1") return url;

  try {
    const u = new URL(url);
    u.searchParams.set("sslmode", "verify-full");
    return u.toString();
  } catch {
    return url
      .replace(/([?&])sslmode=[^&]*/g, "$1sslmode=verify-full")
      .replace(/^([^?]*)$/, "$1?sslmode=verify-full");
  }
}

export async function initStripeRuntime(): Promise<void> {
  if (process.env.PROXHQ_ENABLE_STRIPE_RUNTIME === "0") {
    logger.info("Stripe runtime init disabled");
    return;
  }

  const rawDatabaseUrl = process.env.DATABASE_URL;

  if (!rawDatabaseUrl) {
    logger.warn("DATABASE_URL not set — Stripe init skipped");
    return;
  }

  const databaseUrl = normalizeDatabaseUrl(rawDatabaseUrl);

  try {
    await runMigrations({ databaseUrl } as any);
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();
    const webhookBaseUrl = `https://${
      process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost"
    }`;

    await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
    );

    logger.info("Stripe webhook configured");

    stripeSync
      .syncBackfill()
      .then(() => logger.info("Stripe data synced"))
      .catch((err: unknown) => logger.error({ err }, "Stripe backfill error"));
  } catch (err) {
    logger.warn({ err }, "Stripe init failed — continuing without Stripe");
  }
}
