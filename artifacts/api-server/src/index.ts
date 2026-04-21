import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { exec } from "child_process";
import fs from "fs";

// ── Ensure Tor daemon is running (port 9050) ─────────────────────────────────
function ensureTor() {
  const dataDir = "/tmp/tor-data";
  fs.mkdirSync(dataDir, { recursive: true });
  exec(
    `tor --RunAsDaemon 1 --DataDirectory ${dataDir} --SocksPort 9050 --ControlPort 9051 --Log "warn stderr"`,
    (err) => {
      if (err && !err.message?.includes("already")) {
        logger.warn({ err }, "Tor failed to start — Tor routing unavailable");
      } else {
        logger.info("Tor daemon started on 127.0.0.1:9050");
      }
    },
  );
}
ensureTor();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) { logger.warn("DATABASE_URL not set — Stripe init skipped"); return; }
  try {
    await runMigrations({ databaseUrl } as any);
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost"}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    logger.info("Stripe webhook configured");

    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe data synced"))
      .catch((err: unknown) => logger.error({ err }, "Stripe backfill error"));
  } catch (err) {
    logger.warn({ err }, "Stripe init failed — continuing without Stripe");
  }
}

await initStripe();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
