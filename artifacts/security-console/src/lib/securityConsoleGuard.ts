// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
const SECURITY_API_BASE = import.meta.env.VITE_SECURITY_API_BASE;
const CUSTOMER_APP_ORIGIN = import.meta.env.VITE_CUSTOMER_APP_ORIGIN;

export function assertSecurityConsoleIsolation() {
  if (!SECURITY_API_BASE) {
    throw new Error("Missing VITE_SECURITY_API_BASE");
  }

  if (CUSTOMER_APP_ORIGIN && SECURITY_API_BASE.startsWith(CUSTOMER_APP_ORIGIN)) {
    throw new Error(
      "Security Console cannot use the customer app origin as VITE_SECURITY_API_BASE.",
    );
  }

  if (
    import.meta.env.PROD &&
    !SECURITY_API_BASE.includes("security") &&
    !SECURITY_API_BASE.includes("internal")
  ) {
    throw new Error(
      "Production Security Console API base must look isolated. Include security/internal in the host name.",
    );
  }
}
