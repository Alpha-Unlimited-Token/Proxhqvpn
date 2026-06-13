// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import app from "./security-app";
import { logger } from "./lib/logger";
import { assertSecurityApiReadiness } from "./bootstrap/security-api-readiness";

function getPort(): number {
  const rawPort = process.env.SECURITY_API_PORT ?? process.env.PORT;

  if (!rawPort) {
    throw new Error("SECURITY_API_PORT or PORT is required");
  }

  const port = Number(rawPort);

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid security-api port: ${rawPort}`);
  }

  return port;
}

async function bootstrap(): Promise<void> {
  assertSecurityApiReadiness();

  const port = getPort();

  app.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Security API listen error");
      process.exit(1);
    }

    logger.info({ port }, "Security API listening");
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, "Security API fatal bootstrap error");
  process.exit(1);
});
