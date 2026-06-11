// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import app from "./app";
import { logger } from "./lib/logger";
import { startCryptoPoller } from "./lib/cryptoPoller";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { seedEmployees } from "./routes/employees";
import { seedStripeProducts } from "./seedStripeProducts";
import { exec, execSync } from "child_process";
import fs from "fs";
import pathLib from "path";
import { db } from "@workspace/db";
import { vpngateNodeSessionsTable, batchScanJobsTable } from "@workspace/db";
import { eq, and, lt, sql, inArray, notInArray } from "drizzle-orm";
import { startBatchWorker, createBatchJob } from "./lib/scheme-auditor/batch-worker";
import { startNodeLifecycleEngine } from "./lib/node-lifecycle-engine";

/** Normalize DATABASE_URL sslmode to suppress pg-connection-string deprecation warnings.
 *  Only applied in the deployed environment where the managed Postgres supports TLS.
 *  Development uses a local Postgres that may not have SSL, so we skip normalization. */
function normalizeDatabaseUrl(url: string): string {
  if (process.env.REPLIT_DEPLOYMENT !== "1") return url;
  try {
    const u = new URL(url);
    u.searchParams.set("sslmode", "verify-full");
    return u.toString();
  } catch {
    return url.replace(/([?&])sslmode=[^&]*/g, "$1sslmode=verify-full").replace(/^([^?]*)$/, "$1?sslmode=verify-full");
  }
}

// ── Auto-install all required dependencies on server startup ─────────────────
// Users never see install instructions — the server handles everything itself.
// Skip entirely in Replit deployment containers (REPLIT_DEPLOYMENT=1) — the
// package manager is not available there and the install will fail with code 100.
function autoInstallDependencies() {
  if (process.env.REPLIT_DEPLOYMENT === "1") {
    logger.info("Deployment environment detected — skipping VPN package auto-install");
    return;
  }
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
// Tor is required for the OnionBrowser, Ghost Chain, and SOCKS5 proxy features.
// Set PROXHQ_ENABLE_TOR=0 to disable Tor startup (e.g. in restricted environments).
// Default: enabled (runs whenever Tor binary is available, skipped in deployment).
function ensureTor() {
  if (process.env.PROXHQ_ENABLE_TOR === "0") {
    logger.info("Tor disabled by PROXHQ_ENABLE_TOR=0 — Tor routing unavailable");
    return;
  }
  const dataDir = process.env.TOR_DATA_DIR ?? pathLib.join(process.cwd(), ".runtime", "tor-data");
  try {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  } catch { /* non-fatal if dir already exists */ }
  exec(
    `tor --RunAsDaemon 1 --DataDirectory ${dataDir} --SocksPort 9050 --ControlPort 9051 --Log "warn stderr"`,
    (err) => {
      if (err && !err.message?.includes("already")) {
        logger.warn({ err }, "Tor failed to start — Tor routing unavailable");
      } else {
        logger.info({ dataDir }, "Tor daemon started on 127.0.0.1:9050");
      }
    },
  );
}
ensureTor();

// ── Double-hop session watchdog ───────────────────────────────────────────────
// If a node session stays in pending_connect/pending_disconnect for more than
// 2 minutes it means the node daemon is not running or cannot reach the API.
// Mark it as error so the UI shows a clear message instead of hanging forever.
async function timeoutStaleSessions() {
  try {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
    const stale = await db
      .select()
      .from(vpngateNodeSessionsTable)
      .where(
        and(
          sql`status IN ('pending_connect', 'pending_disconnect')`,
          lt(vpngateNodeSessionsTable.updatedAt, cutoff),
        ),
      );

    for (const session of stale) {
      await db
        .update(vpngateNodeSessionsTable)
        .set({
          status: "error",
          errorMessage:
            "Node daemon not responding. Ensure proxhqd.py is running on the node server with DAEMON_PSK configured and can reach this API.",
          updatedAt: new Date(),
        })
        .where(eq(vpngateNodeSessionsTable.id, session.id));
      logger.warn({ sessionId: session.id, nodeId: session.nodeId }, "Double-hop session timed out — node daemon not responding");
    }
  } catch (err) {
    logger.warn({ err }, "Session watchdog error");
  }
}

// Run immediately on startup, then every 30 seconds
timeoutStaleSessions();
setInterval(timeoutStaleSessions, 30_000);

// ── Crypto payment background poller ─────────────────────────────────────────
// Checks pending blockchain invoices every 60 s so users get access even
// after closing the modal or navigating away from the pricing page.
startCryptoPoller(60_000);

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
  const rawDatabaseUrl = process.env.DATABASE_URL;
  if (!rawDatabaseUrl) { logger.warn("DATABASE_URL not set — Stripe init skipped"); return; }
  const databaseUrl = normalizeDatabaseUrl(rawDatabaseUrl);
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

// ── Autonomous Batch Worker ───────────────────────────────────────────────────
startBatchWorker();

// ── Node Lifecycle Engine — delivery scheduler + decay + rotation + VPNGate reaper
startNodeLifecycleEngine();

// ── Pre-load sillytuna attacker files (idempotent — skips if already active) ──
async function preloadAttackerFiles() {
  try {
    const SOURCE_NAMES = ["sillytuna_attacker_wallets", "sillytuna_attacker_tx_hashes"];
    for (const src of SOURCE_NAMES) {
      // Only skip if there's an ACTIVE job (pending/running/completed).
      // Re-queue if all existing jobs for this source are cancelled/failed.
      const [active] = await db.select({ id: batchScanJobsTable.id })
        .from(batchScanJobsTable)
        .where(
          and(
            eq(batchScanJobsTable.sourceName, src),
            notInArray(batchScanJobsTable.status, ["cancelled", "failed"]),
          )
        )
        .limit(1);
      if (active) continue; // already active — don't duplicate

      const candidates = [
        pathLib.join(process.cwd(), "..", "..", "attached_assets", src + "_1777326855520.txt"),
        pathLib.join(process.cwd(), "..", "..", "attached_assets", src + "_1777326855652.txt"),
      ].filter(p => fs.existsSync(p));

      if (candidates.length === 0) {
        // Try glob match
        const dir = pathLib.join(process.cwd(), "..", "..", "attached_assets");
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir).filter(f => f.startsWith(src));
          if (files.length > 0) candidates.push(pathLib.join(dir, files[0]));
        }
      }

      if (candidates.length === 0) {
        logger.warn({ src }, "Attacker file not found — skipping pre-load");
        continue;
      }

      const raw = fs.readFileSync(candidates[0], "utf8");
      const targets = raw.split("\n").map(l => l.trim()).filter(l => l.length >= 10);
      const label = src.includes("wallet") ? "Sillytuna Attacker Wallets" : "Sillytuna Attacker TX Hashes";
      const jobId = await createBatchJob({ name: label, sourceName: src, targets });
      logger.info({ jobId, src, total: targets.length }, "Attacker file queued as batch job");
    }
  } catch (err) {
    logger.warn({ err }, "Attacker file pre-load failed — non-fatal");
  }
}

preloadAttackerFiles();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
