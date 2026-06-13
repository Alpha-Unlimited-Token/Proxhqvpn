// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isEnabled(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

export function isOmegaEnabled(): boolean {
  if (!isEnabled(process.env.PROXHQ_ENABLE_OMEGA)) return false;

  // Production requires a second explicit override.
  if (isProduction() && !isEnabled(process.env.PROXHQ_ENABLE_OMEGA_PROD)) {
    return false;
  }

  return true;
}

export function isSecurityLabEnabled(): boolean {
  if (!isEnabled(process.env.PROXHQ_ENABLE_SECURITY_LAB)) return false;

  // Production requires a second explicit override.
  if (isProduction() && !isEnabled(process.env.PROXHQ_ENABLE_SECURITY_LAB_PROD)) {
    return false;
  }

  return true;
}
