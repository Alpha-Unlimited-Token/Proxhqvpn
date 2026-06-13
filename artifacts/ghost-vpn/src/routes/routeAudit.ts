// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { routeRegistry } from "./routeRegistry";

export function auditRouteRegistry() {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const route of routeRegistry) {
    if (seen.has(route.path)) duplicates.push(route.path);
    seen.add(route.path);
  }

  const criticalVisibleInNav = routeRegistry.filter(
    (route) => route.risk === "critical" && route.nav,
  );

  return {
    total: routeRegistry.length,
    duplicates,
    criticalVisibleInNav,
    ok: duplicates.length === 0 && criticalVisibleInNav.length === 0,
  };
}
