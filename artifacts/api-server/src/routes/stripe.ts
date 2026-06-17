// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { platformConfig } from "../config/platform";
import { getUncachableStripeClient, getStripePublishableKey, getStripeSync } from "../stripeClient";
import { stripeStorage } from "../stripeStorage";
import { isEmployeeEmail } from "./employees";
import { requireAdmin } from "../middlewares/requireAdmin";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const HOST = () => {
  // Prefer the custom domain if set, then fall back to the first Replit domain
  if (process.env.CUSTOM_DOMAIN) return `https://${process.env.CUSTOM_DOMAIN}`;
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  return domain ? `https://${domain}` : platformConfig.APP_URL;
};

router.get("/config", async (_req, res) => {
  try {
    const publishableKey = await getStripePublishableKey();
    res.json({ publishableKey });
  } catch (err: any) {
    res.status(503).json({ error: "Stripe not connected", message: err.message });
  }
});

router.get("/products", async (_req, res) => {
  try {
    // Try synced DB first (fast path)
    const rows = await stripeStorage.listProductsWithPrices();
    const map = new Map<string, any>();
    for (const row of rows as any[]) {
      if (!map.has(row.product_id)) {
        map.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          metadata: row.product_metadata ?? {},
          prices: [],
        });
      }
      if (row.price_id) {
        map.get(row.product_id).prices.push({
          id: row.price_id,
          unitAmount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
        });
      }
    }

    // If DB is empty (StripeSync hasn't synced yet), fall back to live Stripe API
    if (map.size === 0) {
      const stripe = await getUncachableStripeClient();
      const [productsRes, pricesRes] = await Promise.all([
        stripe.products.list({ active: true, limit: 50 }),
        stripe.prices.list({ active: true, limit: 100 }),
      ]);
      for (const p of productsRes.data) {
        map.set(p.id, {
          id: p.id,
          name: p.name,
          description: p.description ?? "",
          metadata: p.metadata ?? {},
          prices: [],
        });
      }
      for (const pr of pricesRes.data) {
        if (map.has(pr.product as string)) {
          map.get(pr.product as string).prices.push({
            id: pr.id,
            unitAmount: pr.unit_amount,
            currency: pr.currency,
            recurring: pr.recurring,
          });
        }
      }
    }

    res.json(Array.from(map.values()));
  } catch {
    res.json([]);
  }
});

router.get("/subscription", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // Resolve email from Clerk
  let email: string | null = null;
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    email = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ?? null;
  } catch {}

  // Employees always get full access — no subscription required
  if (email && await isEmployeeEmail(email)) {
    return res.json({
      subscription: { status: "active", plan: "Employee — Complimentary" },
      hasWireGuard: true,
      unlimitedDevices: true,
      isEmployee: true,
    });
  }

  const user = await stripeStorage.getUser(userId);
  if (!user?.stripeSubscriptionId) return res.json({ subscription: null, hasWireGuard: false, unlimitedDevices: false, tier: null });

  const subscription = await stripeStorage.getSubscription(user.stripeSubscriptionId);
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";
  const tier = isActive ? await stripeStorage.getSubscriptionTier(user.stripeSubscriptionId) : null;
  res.json({
    subscription,
    hasWireGuard: !!isActive,
    unlimitedDevices: !!isActive,
    isEmployee: false,
    tier,
    hasCommandCenter: tier === "command_center",
  });
});

router.post("/checkout", async (req, res) => {
  const { userId, sessionClaims } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const body = z.object({ priceId: z.string(), promoCode: z.string().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "priceId required" });

  const email = (sessionClaims?.email as string) ?? undefined;
  let user = await stripeStorage.getUser(userId);
  if (!user) user = await stripeStorage.upsertUser(userId, email);

  const stripe = await getUncachableStripeClient();

  let customerId = user.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { userId } });
    user = await stripeStorage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
    customerId = customer.id;
  }

  const base = HOST();
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: body.data.priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/checkout/cancel`,
    metadata: {
      userId,
      ...(body.data.promoCode ? { ambassador_promo_code: body.data.promoCode } : {}),
    },
  });

  res.json({ url: session.url });
});

router.post("/portal", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const user = await stripeStorage.getUser(userId);
  if (!user?.stripeCustomerId) return res.status(404).json({ error: "No billing account found. Please subscribe first." });

  const stripe = await getUncachableStripeClient();
  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${HOST()}/account`,
  });

  res.json({ url: portal.url });
});

// ── ADMIN: List & cancel used/active trial subscriptions ────────────────────
// "Used" = subscription exists in Stripe with status=trialing that has a
// trial_start date (meaning it was actually started, not just created).
// Security: only ADMIN_EMAILS can call this.
router.get("/admin/trials", requireAdmin, async (_req, res) => {
  try {
    const stripe = await getUncachableStripeClient();
    const subscriptions: any[] = [];
    let startingAfter: string | undefined;
    // Page through all trialing subscriptions
    while (true) {
      const page = await stripe.subscriptions.list({
        status: "trialing",
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      subscriptions.push(...page.data);
      if (!page.has_more) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
    const used = subscriptions.filter(s => s.trial_start !== null);
    res.json({
      total: subscriptions.length,
      used: used.length,
      unused: subscriptions.length - used.length,
      subscriptions: used.map(s => ({
        id: s.id,
        customerId: s.customer,
        status: s.status,
        trialStart: s.trial_start ? new Date(s.trial_start * 1000).toISOString() : null,
        trialEnd:   s.trial_end   ? new Date(s.trial_end   * 1000).toISOString() : null,
        createdAt:  new Date(s.created * 1000).toISOString(),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/cancel-trials", requireAdmin, async (req, res) => {
  const body = z.object({
    dryRun: z.boolean().default(false),
    reason: z.string().default("Security: trial abuse detected — cancelled by admin"),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  try {
    const stripe = await getUncachableStripeClient();
    const subscriptions: any[] = [];
    let startingAfter: string | undefined;
    while (true) {
      const page = await stripe.subscriptions.list({
        status: "trialing",
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      subscriptions.push(...page.data);
      if (!page.has_more) break;
      startingAfter = page.data[page.data.length - 1].id;
    }

    // Only cancel subscriptions that have ACTUALLY STARTED (trial_start is set)
    // This protects subscriptions that were created but never activated
    const toCancel = subscriptions.filter(s => s.trial_start !== null);

    if (body.data.dryRun) {
      return res.json({
        dryRun: true,
        wouldCancel: toCancel.length,
        subscriptions: toCancel.map(s => ({ id: s.id, customerId: s.customer, trialStart: s.trial_start })),
      });
    }

    const results: { id: string; cancelled: boolean; error?: string }[] = [];
    for (const sub of toCancel) {
      try {
        await stripe.subscriptions.cancel(sub.id, { cancellation_details: { comment: body.data.reason } });
        results.push({ id: sub.id, cancelled: true });
      } catch (e: any) {
        results.push({ id: sub.id, cancelled: false, error: e.message });
      }
    }

    const succeeded = results.filter(r => r.cancelled).length;
    res.json({
      cancelled: succeeded,
      failed: results.length - succeeded,
      total: results.length,
      results,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/stripe/webhook — Stripe lifecycle events ──────────────────────
// Raw body parser is required for signature verification.
// In public.ts, mount this BEFORE json middleware:
//   router.post("/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler)
router.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string | undefined;

  let event: any;
  try {
    const stripe = await getUncachableStripeClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // No secret configured — parse body as-is (development / Replit connector flow)
      event = typeof req.body === "string" || Buffer.isBuffer(req.body)
        ? JSON.parse(req.body.toString())
        : req.body;
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, "Stripe webhook signature verification failed");
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case "customer.subscription.deleted":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (customerId) {
          const [user] = await db.select().from(usersTable)
            .where(eq(usersTable.stripeCustomerId, customerId)).limit(1);
          if (user) {
            // subscriptionId may have changed (e.g. upgrade replaced old sub)
            const newSubId = typeof sub.id === "string" ? sub.id : null;
            if (newSubId && newSubId !== user.stripeSubscriptionId) {
              await db.update(usersTable)
                .set({ stripeSubscriptionId: newSubId })
                .where(eq(usersTable.id, user.id));
            }
            logger.info({ userId: user.id, status: sub.status }, "Stripe subscription updated");
          }
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          const [user] = await db.select().from(usersTable)
            .where(eq(usersTable.stripeCustomerId, customerId)).limit(1);
          if (user) {
            logger.warn({ userId: user.id, customerId }, "Stripe invoice payment failed");
          }
        }
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
          if (customerId) {
            const [user] = await db.select().from(usersTable)
              .where(eq(usersTable.stripeCustomerId, customerId)).limit(1);
            if (user) {
              const subId = typeof session.subscription === "string" ? session.subscription : null;
              if (subId) {
                await db.update(usersTable)
                  .set({ stripeSubscriptionId: subId })
                  .where(eq(usersTable.id, user.id));
              }
              logger.info({ userId: user.id }, "Stripe checkout completed — subscription activated");
            }
          }
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    logger.error({ err, eventType: event?.type }, "Stripe webhook handler error");
  }

  res.json({ received: true });
});

export default router;
