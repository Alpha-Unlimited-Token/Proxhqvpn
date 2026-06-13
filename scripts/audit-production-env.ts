// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.

type Issue = {
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

const issues: Issue[] = [];

if (!hasValue(process.env.DATABASE_URL)) {
  issues.push({
    code: "DATABASE_URL_MISSING",
    severity: "error",
    message: "DATABASE_URL is required.",
  });
}

if (!hasStrongSecret(process.env.SESSION_SECRET)) {
  issues.push({
    code: "SESSION_SECRET_WEAK",
    severity: "error",
    message: "SESSION_SECRET must be at least 32 characters.",
  });
}

if (!hasValue(process.env.CLERK_SECRET_KEY)) {
  issues.push({
    code: "CLERK_SECRET_KEY_MISSING",
    severity: "error",
    message: "CLERK_SECRET_KEY is required.",
  });
}

const origins = parseOrigins(process.env.ALLOWED_ORIGINS);

if (origins.length === 0) {
  issues.push({
    code: "ALLOWED_ORIGINS_EMPTY",
    severity: "error",
    message: "ALLOWED_ORIGINS must be set.",
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

  if (!origin.startsWith("https://")) {
    issues.push({
      code: "ALLOWED_ORIGINS_NON_HTTPS",
      severity: "error",
      message: `Origin must use https: ${origin}`,
    });
  }
}

if (isEnabled(process.env.PROXHQ_PRELOAD_ATTACKER_FILES)) {
  issues.push({
    code: "ATTACKER_PRELOAD_ENABLED",
    severity: "error",
    message: "Do not preload attacker files in production.",
  });
}

if (
  isEnabled(process.env.PROXHQ_ENABLE_SECURITY_LAB) ||
  isEnabled(process.env.PROXHQ_ENABLE_SECURITY_LAB_PROD)
) {
  issues.push({
    code: "SECURITY_LAB_ENABLED",
    severity: "error",
    message: "Security Lab must not be enabled on public production.",
  });
}

if (
  isEnabled(process.env.PROXHQ_ENABLE_OMEGA) ||
  isEnabled(process.env.PROXHQ_ENABLE_OMEGA_PROD)
) {
  issues.push({
    code: "OMEGA_ENABLED",
    severity: "error",
    message: "Omega must not be enabled on public production.",
  });
}

const errors = issues.filter((issue) => issue.severity === "error");
const warnings = issues.filter((issue) => issue.severity === "warn");

for (const warning of warnings) {
  console.warn(`⚠️  ${warning.code}: ${warning.message}`);
}

for (const error of errors) {
  console.error(`❌ ${error.code}: ${error.message}`);
}

if (errors.length > 0) {
  process.exit(1);
}

console.log("✅ Production environment audit passed");
