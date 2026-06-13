// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import crypto from "crypto";

export function verifyBreakGlassToken(token: string | undefined): boolean {
  const expected = (process.env.BREAK_GLASS_TOKEN ?? "").trim();
  const provided = (token ?? "").trim();

  if (!expected || !provided) return false;
  if (expected.length < 32) return false;
  if (provided.length !== expected.length) return false;

  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
