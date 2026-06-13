// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";

/**
 * Starts Tor only when explicitly enabled.
 *
 * Recommended production model:
 * - run Tor as a sidecar/system service
 * - point the API at it using TOR_SOCKS_URL
 *
 * Legacy embedded startup can be enabled with:
 * PROXHQ_ENABLE_EMBEDDED_TOR=1
 */
export function startEmbeddedTorIfEnabled(): void {
  if (process.env.PROXHQ_ENABLE_TOR === "0") {
    logger.info("Tor disabled by PROXHQ_ENABLE_TOR=0");
    return;
  }

  if (process.env.PROXHQ_ENABLE_EMBEDDED_TOR !== "1") {
    logger.info(
      "Embedded Tor startup disabled. Use PROXHQ_ENABLE_EMBEDDED_TOR=1 only for dev/single-node deployments.",
    );
    return;
  }

  const dataDir =
    process.env.TOR_DATA_DIR ?? path.join(process.cwd(), ".runtime", "tor-data");

  try {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  } catch {
    logger.warn({ dataDir }, "Could not create Tor data directory");
  }

  exec(
    `tor --RunAsDaemon 1 --DataDirectory ${dataDir} --SocksPort 9050 --ControlPort 9051 --Log "warn stderr"`,
    (err) => {
      if (err && !err.message?.includes("already")) {
        logger.warn({ err }, "Tor failed to start");
        return;
      }

      logger.info({ dataDir }, "Embedded Tor daemon started");
    },
  );
}
