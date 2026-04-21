import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { seedEmployees } from "./routes/employees";
import { seedStripeProducts } from "./seedStripeProducts";
import { exec, execSync } from "child_process";
import fs from "fs";

// ── Auto-install all required dependencies on server startup ─────────────────
// Users never see install instructions — the server handles everything itself.
function autoInstallDependencies() {
  const hasApt = (() => { try { execSync("which apt-get 2>/dev/null", { timeout: 2000 }); return true; } catch { return false; } })();
  if (!hasApt) return; // Only auto-install on Debian/Ubuntu servers

  const checkBin = (bin: string) => { try { execSync(`which ${bin} 2>/dev/null`, { timeout: 1000 }); return true; } catch { return false; } };

  const missing: string[] = [];
  if (!checkBin("openvpn"))     missing.push("openvpn");
  if (!checkBin("proxychains4") && !checkBin("proxychains")) missing.push("proxychains4");
  if (!checkBin("wg"))          missing.push("wireguard", "wireguard-tools");

  if (missing.length === 0) {
    logger.info("All VPN dependencies already installed");
    return;
  }

  logger.info({ packages: missing }, "Auto-installing VPN dependencies...");
  exec(
    `DEBIAN_FRONTEND=noninteractive apt-get install -y ${missing.join(" ")} 2>&1`,
    { timeout: 180000 },
    (err, stdout) => {
      if (err) {
        logger.warn({ err }, "Auto-install encountered errors — some features may be limited");
      } else {
        logger.info("VPN dependencies installed successfully");
      }
    }
  );

  // Write global proxychains config for Ghost Chain routing
  const proxychainsConf = `strict_chain\nproxy_dns\ntcp_read_time_out 15000\ntcp_connect_time_out 8000\n[ProxyList]\nsocks5 127.0.0.1 9050\n`;
  try {
    fs.writeFileSync("/etc/proxychains4.conf", proxychainsConf);
  } catch { /* non-fatal */ }
}
autoInstallDependencies();

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

// Seed default employees (idempotent — uses onConflictDoNothing)
seedEmployees().catch((err) => logger.warn({ err }, "Employee seed failed"));

// Create the two Stripe pricing tiers if they don't exist yet
seedStripeProducts().catch((err) => logger.warn({ err }, "Stripe product seed failed"));

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
