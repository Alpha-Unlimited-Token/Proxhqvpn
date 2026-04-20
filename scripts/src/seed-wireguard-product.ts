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

async function seedProducts() {
  const secretKey = await getCredentials();
  const stripe = new Stripe(secretKey, { apiVersion: "2025-08-27.basil" as any });

  console.log("Checking for existing ProxhqVPN WireGuard add-on...");
  const existing = await stripe.products.search({ query: "name:'ProxhqVPN WireGuard Add-on' AND active:'true'" });

  if (existing.data.length > 0) {
    console.log("Product already exists:", existing.data[0].id);
    const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
    prices.data.forEach(p => {
      const interval = (p.recurring as any)?.interval ?? "one_time";
      console.log(`  Price ${p.id}: $${(p.unit_amount! / 100).toFixed(2)} / ${interval}`);
    });
    return;
  }

  console.log("Creating ProxhqVPN WireGuard Add-on product...");

  const product = await stripe.products.create({
    name: "ProxhqVPN WireGuard Add-on",
    description: "Unlock WireGuard VPN tunnels on all your devices — auto-configuration, QR code setup, device manager, and router configs included.",
    metadata: {
      type: "addon",
      feature: "wireguard",
      brand: "ProxhqVPN",
    },
  });
  console.log("Product created:", product.id);

  const monthly = await stripe.prices.create({
    product: product.id,
    unit_amount: 1400,
    currency: "usd",
    recurring: { interval: "month" },
    nickname: "Monthly",
    metadata: { plan: "monthly" },
  });
  console.log(`Monthly: $14.00/mo — ${monthly.id}`);

  const annual = await stripe.prices.create({
    product: product.id,
    unit_amount: 8400,
    currency: "usd",
    recurring: { interval: "year" },
    nickname: "Annual",
    metadata: { plan: "annual" },
  });
  console.log(`Annual: $7.00/mo billed $84.00/yr — ${annual.id}`);

  const biennial = await stripe.prices.create({
    product: product.id,
    unit_amount: 12000,
    currency: "usd",
    recurring: { interval: "year", interval_count: 2 },
    nickname: "2-Year",
    metadata: { plan: "2year" },
  });
  console.log(`2-Year: $5.00/mo billed $120.00/2yr — ${biennial.id}`);

  console.log("\nDone! Products seeded. Webhooks will sync to your database automatically.");
}

seedProducts().catch(console.error);
