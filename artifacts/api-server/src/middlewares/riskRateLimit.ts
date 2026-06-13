// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import rateLimit from "express-rate-limit";
import type { Request } from "express";

function keyGenerator(req: Request) {
  const userId = (req as any).auth?.userId;
  return userId ? `user:${userId}` : `ip:${req.ip ?? req.socket?.remoteAddress ?? "unknown"}`;
}

export const normalRateLimit = rateLimit({
  windowMs: 60_000,
  max: 120,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
});

export const highRiskRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "High-risk route rate limit exceeded" },
});

export const criticalRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Critical route rate limit exceeded" },
});
