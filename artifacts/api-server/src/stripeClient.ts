import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

/**
 * Resolve Stripe credentials.
 *
 * Priority order:
 *  1. STRIPE_SECRET_KEY env var  — the owner's real Stripe account keys
 *  2. Replit connector           — sandbox keys for development / testing
 */
async function getCredentials(): Promise<{ publishableKey: string; secretKey: string; webhookSecret?: string }> {
  // ── 1. Owner's own Stripe keys (real account) ────────────────────────────
  if (process.env.STRIPE_SECRET_KEY) {
    return {
      secretKey:    process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
      webhookSecret:  process.env.STRIPE_WEBHOOK_SECRET,
    };
  }

  // ── 2. Replit connector (sandbox / test fallback) ────────────────────────
  const hostname    = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Stripe not configured. Set STRIPE_SECRET_KEY in Secrets or connect via the Integrations tab."
    );
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", targetEnvironment);

  const resp = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) throw new Error(`Failed to fetch Stripe credentials: ${resp.status} ${resp.statusText}`);

  const data = await resp.json() as any;
  const settings = data.items?.[0]?.settings;

  if (!settings?.secret) {
    throw new Error("Stripe not configured. Set STRIPE_SECRET_KEY in Secrets or connect via the Integrations tab.");
  }

  return {
    publishableKey: settings.publishable ?? "",
    secretKey:      settings.secret,
    webhookSecret:  settings.webhook_secret,
  };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, { apiVersion: "2025-08-27.basil" as any });
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

/** Normalize DATABASE_URL sslmode to suppress pg-connection-string v3 deprecation warning.
 *  Only applied in the deployed environment — dev Postgres may not support TLS. */
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

export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");

  const { secretKey, webhookSecret } = await getCredentials();
  return new StripeSync({
    poolConfig: { connectionString: normalizeDatabaseUrl(databaseUrl), max: 2 },
    stripeSecretKey:      secretKey,
    stripeWebhookSecret:  webhookSecret ?? "",
  });
}
