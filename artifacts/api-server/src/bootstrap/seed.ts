// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { seedEmployees } from "../routes/employees";
import { seedStripeProducts } from "../seedStripeProducts";
import { logger } from "../lib/logger";

export function seedRuntimeData(): void {
  if (process.env.PROXHQ_ENABLE_RUNTIME_SEEDING === "0") {
    logger.info("Runtime seeders disabled");
    return;
  }

  seedEmployees().catch((err) =>
    logger.warn({ err }, "Employee seed failed"),
  );

  seedStripeProducts().catch((err) =>
    logger.warn({ err }, "Stripe product seed failed"),
  );

  logger.info("Runtime seeders queued");
}
