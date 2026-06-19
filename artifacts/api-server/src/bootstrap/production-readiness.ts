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

  // Auto-detect from REPLIT_DOMAINS when ALLOWED_ORIGINS is not explicitly set.
  // REPLIT_DOMAINS is always present in Replit-hosted production deployments.
  const explicitOrigins = parseOrigins(process.env.ALLOWED_ORIGINS);
  const replitDomainOrigins = (process.env.REPLIT_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => `https://${d}`);

  const origins =
    explicitOrigins.length > 0 ? explicitOrigins : replitDomainOrigins;

  if (origins.length === 0) {
    issues.push({
      code: "ALLOWED_ORIGINS_EMPTY",
      severity: "error",
      message:
        "ALLOWED_ORIGINS must be set in production (or REPLIT_DOMAINS must be available).",
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

  if (process.env.PROXHQ_SKIP_SYSTEM_DEP_CHECK === "1") {
    issues.push({
      code: "SYSTEM_DEP_CHECK_SKIPPED",
      severity: "warn",
      message:
        "System dependency check is skipped. Make sure image/build checks cover WireGuard/OpenVPN dependencies.",
    });
  }

  // Cryptographic keys — required for audit chain integrity and WireGuard key encryption
  if (!hasStrongSecret(process.env.AUDIT_HMAC_KEY_B64, 44)) {
    issues.push({
      code: "AUDIT_HMAC_KEY_MISSING",
      severity: "error",
      message:
        "AUDIT_HMAC_KEY_B64 must be set to a 32-byte base64 value in production. " +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    });
  }

  if (!hasStrongSecret(process.env.PROXHQ_MASTER_KEY_B64, 44)) {
    issues.push({
      code: "PROXHQ_MASTER_KEY_MISSING",
      severity: "error",
      message:
        "PROXHQ_MASTER_KEY_B64 must be set for WireGuard key envelope encryption. " +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    });
  }

  if (!hasStrongSecret(process.env.INTERNAL_SECRET)) {
    issues.push({
      code: "INTERNAL_SECRET_MISSING",
      severity: "warn",
      message:
        "INTERNAL_SECRET is not set — internal service authentication will fall back to SESSION_SECRET. " +
        "Set INTERNAL_SECRET to a dedicated 32+ char secret to separate concerns.",
    });
  }

  if (!hasStrongSecret(process.env.DAEMON_PSK)) {
    issues.push({
      code: "DAEMON_PSK_MISSING",
      severity: "warn",
      message:
        "DAEMON_PSK is not set. Daemon-inbound routes will reject all node callbacks. " +
        "Required for WireGuard key delivery and node health check-ins.",
    });
  }

  if (!hasValue(process.env.NODE_AGENT_PSK)) {
    issues.push({
      code: "NODE_AGENT_PSK_MISSING",
      severity: "error",
      message:
        "NODE_AGENT_PSK is required in production. Without it, all Vultr node check-ins " +
        "are rejected and the node fleet goes dark.",
    });
  }

  if (!hasValue(process.env.HONEYPOT_PSK)) {
    issues.push({
      code: "HONEYPOT_PSK_MISSING",
      severity: "warn",
      message:
        "HONEYPOT_PSK is not set. Honeypot sensor callbacks will be rejected.",
    });
  }

  if (!hasValue(process.env.STRIPE_WEBHOOK_SECRET)) {
    issues.push({
      code: "STRIPE_WEBHOOK_SECRET_MISSING",
      severity: "error",
      message:
        "STRIPE_WEBHOOK_SECRET is required in production. Without it, Stripe webhook " +
        "signature validation fails and all payment events are rejected.",
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
