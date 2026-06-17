// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import app, { loadDaemonBansFromDb } from "./app";
import { logger } from "./lib/logger";
import { verifySystemDependencies } from "./bootstrap/system-deps";
import { startEmbeddedTorIfEnabled } from "./bootstrap/tor";
import { startSessionWatchdog } from "./bootstrap/session-watchdog";
import { initStripeRuntime } from "./bootstrap/stripe";
import { seedRuntimeData } from "./bootstrap/seed";
import { startRuntimeWorkers } from "./bootstrap/workers";
import { assertProductionReadiness } from "./bootstrap/production-readiness";

function getPort(): number {
  const rawPort = process.env.PORT;

  if (!rawPort) {
    throw new Error("PORT environment variable is required but was not provided.");
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  return port;
}

async function bootstrap(): Promise<void> {
  assertProductionReadiness();

  verifySystemDependencies();
  startEmbeddedTorIfEnabled();

  await initStripeRuntime();
  await loadDaemonBansFromDb();

  seedRuntimeData();
  startSessionWatchdog();
  startRuntimeWorkers();

  const port = getPort();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, "Fatal bootstrap error");
  process.exit(1);
});
