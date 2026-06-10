// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// API Gateway — centralized middleware for auth, rate limiting, tier enforcement,
// request logging, and telemetry. Mounts before all routes.
// Audit recommendation: add API Gateway and Service Bus layer.

import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { bus } from "./service-bus";
import { tierFromAccess, TIER_LABELS, type Tier } from "./platform-tiers";
import { logger } from "./logger";

// ── Per-route rate limiting (simple sliding window, in-process) ───────────────

interface WindowEntry { count: number; windowStart: number }
const rateLimitWindows = new Map<string, WindowEntry>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitWindows.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitWindows.set(key, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= maxRequests;
}

// Clean stale windows every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, entry] of rateLimitWindows) {
    if (entry.windowStart < cutoff) rateLimitWindows.delete(key);
  }
}, 5 * 60 * 1000);

// ── Request telemetry ─────────────────────────────────────────────────────────

export function gatewayTelemetry(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const clientIp =
    (Array.isArray(req.headers["x-forwarded-for"])
      ? req.headers["x-forwarded-for"][0]
      : req.headers["x-forwarded-for"])?.split(",")[0]?.trim() ??
    req.socket?.remoteAddress ??
    "unknown";

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const { userId } = getAuth(req);

    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
      ip: clientIp,
      userId: userId ?? null,
    }, "api_request");

    if (durationMs > 5000) {
      logger.warn({ path: req.path, durationMs }, "slow_request");
    }

    if (res.statusCode >= 500) {
      bus.publish("siem.event", {
        action: "api.server_error",
        path: req.path,
        method: req.method,
        status: res.statusCode,
        ip: clientIp,
      }, "api-gateway");
    }
  });

  next();
}

// ── Gateway rate limiter ──────────────────────────────────────────────────────

export function gatewayRateLimit(
  maxPerMin = 300,
  keyFn?: (req: Request) => string,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const { userId } = getAuth(req);
    const ip =
      (Array.isArray(req.headers["x-forwarded-for"])
        ? req.headers["x-forwarded-for"][0]
        : req.headers["x-forwarded-for"])?.split(",")[0]?.trim() ??
      req.socket?.remoteAddress ?? "unknown";

    const key = keyFn ? keyFn(req) : `rate:${userId ?? ip}:${req.path.split("/")[1] ?? "root"}`;
    if (!checkRateLimit(key, maxPerMin, 60_000)) {
      res.status(429).json({ error: "Rate limit exceeded. Please slow down." });
      return;
    }
    next();
  };
}

// ── Tier header injection ─────────────────────────────────────────────────────
// Reads the resolved tier (set by requireAccess/requireCommandCenter middlewares)
// and injects it into response headers for client awareness.

export function tierHeaderMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.on("finish", () => {
    const isAdmin     = !!(req as any).__isAdmin;
    const isCC        = !!(req as any).__isCommandCenter;
    const hasAccess   = !!(req as any).__hasAccess;
    const tier: Tier | null = tierFromAccess(isAdmin, isCC, hasAccess);
    if (tier) res.setHeader("X-ProxHQ-Tier", tier);
  });
  next();
}

// ── Security headers ──────────────────────────────────────────────────────────

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-ProxHQ-API-Version", "2026-06-10");
  res.setHeader("X-ProxHQ-Gateway", "unified");
  next();
}

// ── Gateway health export ─────────────────────────────────────────────────────

export function getGatewayStats(): {
  activeWindows: number;
  tier: Record<string, string>;
} {
  return {
    activeWindows: rateLimitWindows.size,
    tier: Object.fromEntries(
      Object.entries(TIER_LABELS).map(([k, v]) => [k, v])
    ),
  };
}
