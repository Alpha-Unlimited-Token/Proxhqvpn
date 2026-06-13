// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { logger } from "../lib/logger";

type ReadinessIssue = {
  code: string;
  severity: "error" | "warn";
  message: string;
};

function isEnabled(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasStrongSecret(value: string | undefined, minLength = 32): boolean {
  return hasValue(value) && value!.trim().length >= minLength;
}

function parseOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isLocalhostOrigin(origin: string): boolean {
  return (
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    origin.includes("0.0.0.0")
  );
}

function collectProductionIssues(): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  if (!hasValue(process.env.DATABASE_URL)) {
    issues.push({
      code: "DATABASE_URL_MISSING",
      severity: "error",
      message: "DATABASE_URL is required in production.",
    });
  }

  if (!hasStrongSecret(process.env.SESSION_SECRET)) {
    issues.push({
      code: "SESSION_SECRET_WEAK",
      severity: "error",
      message: "SESSION_SECRET must be set and at least 32 characters.",
    });
  }

  if (!hasStrongSecret(process.env.BREAK_GLASS_TOKEN)) {
    issues.push({
      code: "BREAK_GLASS_TOKEN_WEAK",
      severity: "warn",
      message:
        "BREAK_GLASS_TOKEN is missing or shorter than 32 chars. Ghost mode will be unusable, which is safe but should be intentional.",
    });
  }

  if (!hasValue(process.env.CLERK_SECRET_KEY)) {
    issues.push({
      code: "CLERK_SECRET_KEY_MISSING",
      severity: "error",
      message: "CLERK_SECRET_KEY is required in production.",
    });
  }

  const origins = parseOrigins(process.env.ALLOWED_ORIGINS);

  if (origins.length === 0) {
    issues.push({
      code: "ALLOWED_ORIGINS_EMPTY",
      severity: "error",
      message: "ALLOWED_ORIGINS must be set in production.",
    });
  }

  for (const origin of origins) {
    if (origin === "*") {
      issues.push({
        code: "ALLOWED_ORIGINS_WILDCARD",
        severity: "error",
        message: "ALLOWED_ORIGINS must not contain '*'.",
      });
    }

    if (isLocalhostOrigin(origin)) {
      issues.push({
        code: "ALLOWED_ORIGINS_LOCALHOST",
        severity: "warn",
        message: `Production ALLOWED_ORIGINS contains local origin: ${origin}`,
      });
    }

    if (!origin.startsWith("https://")) {
      issues.push({
        code: "ALLOWED_ORIGINS_NON_HTTPS",
        severity: "error",
        message: `Production origin must use https: ${origin}`,
      });
    }
  }

  if (isEnabled(process.env.PROXHQ_ENABLE_EMBEDDED_TOR)) {
    issues.push({
      code: "EMBEDDED_TOR_ENABLED",
      severity: "warn",
      message:
        "Embedded Tor is enabled. Production should normally use a sidecar/system service.",
    });
  }

  if (isEnabled(process.env.PROXHQ_PRELOAD_ATTACKER_FILES)) {
    issues.push({
      code: "ATTACKER_PRELOAD_ENABLED",
      severity: "error",
      message:
        "PROXHQ_PRELOAD_ATTACKER_FILES must not be enabled in production.",
    });
  }

  if (
    isEnabled(process.env.PROXHQ_ENABLE_SECURITY_LAB) ||
    isEnabled(process.env.PROXHQ_ENABLE_SECURITY_LAB_PROD)
  ) {
    issues.push({
      code: "SECURITY_LAB_ENABLED",
      severity: "error",
      message:
        "Security Lab must not be enabled on the public production API deployment.",
    });
  }

  if (
    isEnabled(process.env.PROXHQ_ENABLE_OMEGA) ||
    isEnabled(process.env.PROXHQ_ENABLE_OMEGA_PROD)
  ) {
    issues.push({
      code: "OMEGA_ENABLED",
      severity: "error",
      message:
        "Omega must not be enabled on the public production API deployment.",
    });
  }

  if (process.env.PROXHQ_SKIP_SYSTEM_DEP_CHECK === "1") {
    issues.push({
      code: "SYSTEM_DEP_CHECK_SKIPPED",
      severity: "warn",
      message:
        "System dependency check is skipped. Make sure image/build checks cover WireGuard/OpenVPN dependencies.",
    });
  }

  return issues;
}

export function assertProductionReadiness(): void {
  if (process.env.NODE_ENV !== "production") {
    logger.info("Production readiness guard skipped outside production");
    return;
  }

  const issues = collectProductionIssues();
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warn");

  for (const warning of warnings) {
    logger.warn(warning, "Production readiness warning");
  }

  if (errors.length > 0) {
    for (const error of errors) {
      logger.error(error, "Production readiness error");
    }

    throw new Error(
      `Production readiness failed with ${errors.length} error(s). Fix environment before deploying.`,
    );
  }

  logger.info("Production readiness guard passed");
}
