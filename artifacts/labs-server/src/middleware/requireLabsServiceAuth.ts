// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Defense-in-depth: verify PSK even if proxy isolation is in place.
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    // Still run comparison to prevent timing oracle on length
    crypto.timingSafeEqual(ab, Buffer.alloc(ab.length));
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

export function requireLabsServiceAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.LABS_SERVICE_PSK;
  if (!expected || expected.length < 32) {
    res.status(503).json({ error: "Labs service auth not configured" });
    return;
  }
  const provided = String(req.headers["x-labs-service-psk"] ?? "");
  if (!provided || !timingSafeEqual(provided, expected)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
