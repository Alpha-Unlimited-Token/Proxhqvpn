import Stripe from "stripe";

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) throw new Error("Stripe integration not connected");

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", "development");

  const resp = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
  });
  const data = await resp.json() as any;
  const settings = data.items?.[0]?.settings;
  if (!settings?.secret) throw new Error("Stripe secret key not found");
  return settings.secret as string;
}

async function seed() {
  const secretKey = await getCredentials();
  const stripe = new Stripe(secretKey, { apiVersion: "2025-08-27.basil" as any });

  console.log("Checking for existing ProxhqVPN product...");
  const existing = await stripe.products.search({ query: "name:'ProxhqVPN' AND active:'true'" });

  let product: Stripe.Product;

  if (existing.data.length > 0) {
    product = existing.data[0];
    console.log("Product already exists:", product.id);
  } else {
    console.log("Creating ProxhqVPN product...");
    product = await stripe.products.create({
      name: "ProxhqVPN",
      description: "Full-access VPN protection. WireGuard encryption, auto peer registration, kill switch, DNS shield, threat monitor, and more. No logs. Ever.",
      metadata: { brand: "ProxhqVPN", type: "subscription" },
    });
    console.log("Product created:", product.id);
  }

  const existingPrices = await stripe.prices.list({ product: product.id, active: true });
  const plans = existingPrices.data.map(p => p.nickname);

  if (!plans.includes("Monthly")) {
    const monthly = await stripe.prices.create({
      product: product.id,
      unit_amount: 999,
      currency: "usd",
      recurring: { interval: "month" },
      nickname: "Monthly",
      metadata: { plan: "monthly" },
    });
    console.log(`✓ Monthly: $9.99/mo — ${monthly.id}`);
  } else {
    console.log("  Monthly price already exists, skipping.");
  }

  if (!plans.includes("Annual")) {
    const annual = await stripe.prices.create({
      product: product.id,
      unit_amount: 6999,
      currency: "usd",
      recurring: { interval: "year" },
      nickname: "Annual",
      metadata: { plan: "annual" },
    });
    console.log(`✓ Annual: $69.99/yr ($5.83/mo) — ${annual.id}`);
  } else {
    console.log("  Annual price already exists, skipping.");
  }

  if (!plans.includes("Lifetime")) {
    const lifetime = await stripe.prices.create({
      product: product.id,
      unit_amount: 14999,
      currency: "usd",
      nickname: "Lifetime",
      metadata: { plan: "lifetime" },
    });
    console.log(`✓ Lifetime: $149.99 one-time — ${lifetime.id}`);
  } else {
    console.log("  Lifetime price already exists, skipping.");
  }

  console.log("\nAll plans seeded successfully.");
  console.log("Product ID:", product.id);
  const prices = await stripe.prices.list({ product: product.id, active: true });
  prices.data.forEach(p => {
    const billing = p.recurring ? `${p.recurring.interval}ly` : "one-time";
    console.log(`  ${p.nickname}: $${((p.unit_amount ?? 0) / 100).toFixed(2)} ${billing} — ${p.id}`);
  });
}

seed().catch(console.error);
