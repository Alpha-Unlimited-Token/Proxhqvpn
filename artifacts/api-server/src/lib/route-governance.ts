import type { Request, Response, NextFunction } from "express";

export type Exposure = "public" | "authenticated" | "admin" | "command_center" | "daemon_psk" | "internal";

export interface RouteExposureRule {
  method: string;
  pathPrefix: string;
  exposure: Exposure;
  reason: string;
  enabled?: boolean;
}

export const PUBLIC_EXPOSURE_RULES: RouteExposureRule[] = [
  { method: "GET",  pathPrefix: "/api/health",              exposure: "public",     reason: "health check" },
  { method: "GET",  pathPrefix: "/api/my-ip",               exposure: "public",     reason: "client IP detection for self-service allowlist" },
  { method: "POST", pathPrefix: "/api/stripe/webhook",      exposure: "public",     reason: "Stripe signed webhook" },
  { method: "POST", pathPrefix: "/api/daemon-inbound",      exposure: "daemon_psk", reason: "node daemon callback with PSK/mTLS" },
  { method: "POST", pathPrefix: "/api/node-provision/enroll", exposure: "daemon_psk", reason: "one-time node enrollment token exchange" },
  { method: "GET",  pathPrefix: "/api/updates/check",       exposure: "public",     reason: "signed update manifest lookup" },
  { method: "GET",  pathPrefix: "/api/warrant-canary",      exposure: "public",     reason: "transparency endpoint" },
];

function matches(req: Request, rule: RouteExposureRule): boolean {
  return (
    (rule.enabled ?? true) &&
    req.method.toUpperCase() === rule.method.toUpperCase() &&
    req.path.startsWith(rule.pathPrefix)
  );
}

export function isExplicitlyPublic(req: Request): boolean {
  return PUBLIC_EXPOSURE_RULES.some((r) => matches(req, r) && r.exposure === "public");
}

export function routeExposureReport() {
  return PUBLIC_EXPOSURE_RULES.map((r) => ({ ...r, enabled: r.enabled ?? true }));
}

export function blockTemporaryProductionRoutes(req: Request, res: Response, next: NextFunction) {
  const tempPrefixes = ["/api/dl/", "/api/setup-script-public"];
  const isTemp = tempPrefixes.some((p) => req.path.startsWith(p));
  if (!isTemp) return next();
  if (process.env.NODE_ENV === "production" && process.env.PROXHQ_ALLOW_TEMP_DOWNLOADS !== "1") {
    return res.status(404).json({ error: "Route disabled in production." });
  }
  next();
}
