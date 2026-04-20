import { Router } from "express";
import { getAuth } from "@clerk/express";
import { getUncachableStripeClient, getStripePublishableKey, getStripeSync } from "../stripeClient";
import { stripeStorage } from "../stripeStorage";
import { z } from "zod";

const router = Router();

const HOST = () => {
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

  const user = await stripeStorage.getUser(userId);
  if (!user?.stripeSubscriptionId) return res.json({ subscription: null, hasWireGuard: false });

  const subscription = await stripeStorage.getSubscription(user.stripeSubscriptionId);
  const hasWireGuard = subscription?.status === "active" || subscription?.status === "trialing";
  res.json({ subscription, hasWireGuard: !!hasWireGuard });
});

router.post("/checkout", async (req, res) => {
  const { userId, sessionClaims } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const body = z.object({ priceId: z.string() }).safeParse(req.body);
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
    metadata: { userId },
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
