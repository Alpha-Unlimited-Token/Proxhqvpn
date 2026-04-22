/**
 * Seed & maintain two Stripe products at server startup (idempotent).
 *
 * Tier 1 — VPN Basic          $6.99/mo · $59.99/yr
 * Tier 2 — Command Center Pro $39.99/mo · $349.99/yr
 *
 * Products are tagged with metadata.tier = "vpn" | "command_center".
 * Always verifies product existence via the live Stripe API (not just the
 * synced DB) so a fresh account never re-uses stale sandbox IDs.
 */

import { getUncachableStripeClient } from "./stripeClient";
import { logger } from "./lib/logger";

interface PriceTarget {
  interval: "month" | "year";
  amount: number;   // cents
  nickname: string;
}

const VPN_TARGETS: PriceTarget[] = [
  { interval: "month", amount: 699,   nickname: "VPN Basic — Monthly"  },
  { interval: "year",  amount: 5999,  nickname: "VPN Basic — Annual"   },
];

const PRO_TARGETS: PriceTarget[] = [
  { interval: "month", amount: 3999,  nickname: "Command Center Pro — Monthly" },
  { interval: "year",  amount: 34999, nickname: "Command Center Pro — Annual"  },
];

/** Find a live product in Stripe (not the synced DB) by tier metadata. */
async function findProductInStripe(tier: string): Promise<string | null> {
  const stripe = await getUncachableStripeClient();
  const list = await stripe.products.list({ active: true, limit: 100 });
  const match = list.data.find(p => p.metadata?.tier === tier);
  return match?.id ?? null;
}

async function reconcilePrices(productId: string, targets: PriceTarget[]) {
  const stripe = await getUncachableStripeClient();

  const existing = await stripe.prices.list({ product: productId, active: true, limit: 50 });

  for (const target of targets) {
    const match = existing.data.find(
      p =>
        p.recurring?.interval === target.interval &&
        p.unit_amount === target.amount &&
        p.currency === "usd"
    );

    if (!match) {
      // Deactivate any outdated price for this interval
      for (const old of existing.data) {
        if (old.recurring?.interval === target.interval && old.unit_amount !== target.amount) {
          await stripe.prices.update(old.id, { active: false }).catch(() => {});
          logger.info({ priceId: old.id }, `Deactivated outdated price`);
        }
      }

      const created = await stripe.prices.create({
        product: productId,
        unit_amount: target.amount,
        currency: "usd",
        recurring: { interval: target.interval },
        nickname: target.nickname,
      });
      logger.info({ priceId: created.id, amount: target.amount }, `Created price: ${target.nickname}`);
    }
  }
}

export async function seedStripeProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    // ── VPN Basic ────────────────────────────────────────────────────────────
    let vpnId = await findProductInStripe("vpn");
    if (!vpnId) {
      const vpn = await stripe.products.create({
        name: "ProxhqVPN — VPN Basic",
        description: "Dedicated WireGuard VPN with kill switch, DNS protection, leak detection, and unlimited devices.",
        metadata: { tier: "vpn" },
      });
      vpnId = vpn.id;
      logger.info({ productId: vpnId }, "Seeded Stripe product: VPN Basic");
    } else {
      logger.info({ productId: vpnId }, "Stripe product exists: VPN Basic");
    }
    await reconcilePrices(vpnId, VPN_TARGETS);

    // ── Command Center Pro ───────────────────────────────────────────────────
    let proId = await findProductInStripe("command_center");
    if (!proId) {
      const pro = await stripe.products.create({
        name: "ProxhqVPN — Command Center Pro",
        description: "Everything in VPN Basic plus the full developer toolkit: vulnerability scanner, Tor browser, proxy chains, threat intelligence, security audit, Alpha Toolkit, and more.",
        metadata: { tier: "command_center" },
      });
      proId = pro.id;
      logger.info({ productId: proId }, "Seeded Stripe product: Command Center Pro");
    } else {
      logger.info({ productId: proId }, "Stripe product exists: Command Center Pro");
    }
    await reconcilePrices(proId, PRO_TARGETS);

    logger.info("Stripe products seeded successfully");
  } catch (err: any) {
    logger.warn({ err: err.message }, "Stripe product seed failed — will retry on next restart");
  }
}
