import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { getUncachableStripeClient, getStripePublishableKey, getStripeSync } from "../stripeClient";
import { stripeStorage } from "../stripeStorage";
import { isEmployeeEmail } from "./employees";
import { z } from "zod";

const router = Router();

const HOST = () => {
  // Prefer the custom domain if set, then fall back to the first Replit domain
  if (process.env.CUSTOM_DOMAIN) return `https://${process.env.CUSTOM_DOMAIN}`;
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  return domain ? `https://${domain}` : "http://localhost:3000";
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

export default router;
