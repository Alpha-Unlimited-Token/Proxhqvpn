// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import rateLimit from "express-rate-limit";
import type { Request } from "express";

function keyGenerator(req: Request) {
  const userId = (req as any).auth?.userId;
  if (userId) return `user:${userId}`;
  const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
  // Normalize IPv6-mapped IPv4 (::ffff:1.2.3.4 → 1.2.3.4)
  const normalized = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  return `ip:${normalized}`;
}

const shared = {
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
} as const;

export const normalRateLimit = rateLimit({
  ...shared,
  windowMs: 60_000,
  max: 120,
});

export const highRiskRateLimit = rateLimit({
  ...shared,
  windowMs: 60_000,
  max: 30,
  message: { error: "High-risk route rate limit exceeded" },
});

export const criticalRateLimit = rateLimit({
  ...shared,
  windowMs: 60_000,
  max: 10,
  message: { error: "Critical route rate limit exceeded" },
});
