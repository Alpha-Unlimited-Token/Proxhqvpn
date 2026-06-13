// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { logger } from "../lib/logger";

function isEnabled(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function parseOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function assertSecurityApiReadiness(): void {
  if (!hasValue(process.env.DATABASE_URL)) {
    throw new Error("DATABASE_URL is required for security-api");
  }

  if (!hasValue(process.env.CLERK_SECRET_KEY)) {
    throw new Error("CLERK_SECRET_KEY is required for security-api");
  }

  const origins = parseOrigins(process.env.SECURITY_API_ALLOWED_ORIGINS);

  if (process.env.NODE_ENV === "production" && origins.length === 0) {
    throw new Error("SECURITY_API_ALLOWED_ORIGINS is required in production");
  }

  if (process.env.NODE_ENV === "production") {
    for (const origin of origins) {
      if (!origin.startsWith("https://")) {
        throw new Error(
          `Security API origin must use HTTPS in production: ${origin}`,
        );
      }

      if (origin === "*" || origin.includes("localhost")) {
        throw new Error(`Invalid production security-api origin: ${origin}`);
      }
    }

    if (!isEnabled(process.env.PROXHQ_ENABLE_OMEGA)) {
      logger.warn("Security API started with Omega disabled");
    }

    if (!isEnabled(process.env.PROXHQ_ENABLE_OMEGA_PROD)) {
      logger.warn("Security API production Omega override disabled");
    }

    if (!isEnabled(process.env.PROXHQ_ENABLE_SECURITY_LAB)) {
      logger.warn("Security API started with Security Lab disabled");
    }

    if (!isEnabled(process.env.PROXHQ_ENABLE_SECURITY_LAB_PROD)) {
      logger.warn("Security API production Security Lab override disabled");
    }
  }

  logger.info("Security API readiness passed");
}
