/**
 * Seed two Stripe products at server startup if they don't already exist.
 *
 * Tier 1 — VPN Basic      ($9.99/mo · $89.99/yr)
 * Tier 2 — Command Center Pro ($34.99/mo · $299.99/yr)
 *
 * Products are tagged with metadata.tier = "vpn" | "command_center" so
 * the backend can determine which feature set a subscriber gets.
 */

import { getUncachableStripeClient } from "./stripeClient";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./lib/logger";

async function productExistsByTier(tier: string): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT id FROM stripe.products WHERE active = true AND metadata->>'tier' = ${tier} LIMIT 1`
  );
  return result.rows.length > 0;
}

export async function seedStripeProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    // ── VPN Basic ──────────────────────────────────────────────────────────────
    if (!(await productExistsByTier("vpn"))) {
      const vpn = await stripe.products.create({
        name: "ProxhqVPN — VPN Basic",
        description: "Dedicated WireGuard VPN with kill switch, DNS protection, leak detection, and unlimited devices.",
        metadata: { tier: "vpn" },
      });

      await stripe.prices.create({
        product: vpn.id,
        unit_amount: 999,
        currency: "usd",
        recurring: { interval: "month" },
        nickname: "VPN Basic — Monthly",
      });
      await stripe.prices.create({
        product: vpn.id,
        unit_amount: 8999,
        currency: "usd",
        recurring: { interval: "year" },
        nickname: "VPN Basic — Annual",
      });

      logger.info({ productId: vpn.id }, "Seeded Stripe product: VPN Basic");
    }

    // ── Command Center Pro ──────────────────────────────────────────────────────
    if (!(await productExistsByTier("command_center"))) {
      const pro = await stripe.products.create({
        name: "ProxhqVPN — Command Center Pro",
        description: "Everything in VPN Basic plus the full developer toolkit: vulnerability scanner, Tor browser, proxy chains, threat intelligence, security audit, Alpha Toolkit, and more.",
        metadata: { tier: "command_center" },
      });

      await stripe.prices.create({
        product: pro.id,
        unit_amount: 3499,
        currency: "usd",
        recurring: { interval: "month" },
        nickname: "Command Center Pro — Monthly",
      });
      await stripe.prices.create({
        product: pro.id,
        unit_amount: 29999,
        currency: "usd",
        recurring: { interval: "year" },
        nickname: "Command Center Pro — Annual",
      });

      logger.info({ productId: pro.id }, "Seeded Stripe product: Command Center Pro");
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, "Stripe product seed failed — run again when Stripe is connected");
  }
}
