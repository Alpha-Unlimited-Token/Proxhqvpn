// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { routeRegistry } from "./routeRegistry";

export function auditFrontendCapabilities() {
  const highRiskWithoutCapability = routeRegistry.filter(
    (route) =>
      (route.risk === "high" || route.risk === "critical") &&
      !route.capability,
  );

  return {
    totalRoutes: routeRegistry.length,
    highRiskWithoutCapability,
    ok: highRiskWithoutCapability.length === 0,
  };
}
