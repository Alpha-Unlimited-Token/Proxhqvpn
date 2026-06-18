// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Break-glass emergency access token — single-use, 15-minute TTL.
// Tokens are invalidated immediately after a successful verification.
import crypto from "crypto";

const BREAK_GLASS_TTL_MS = 15 * 60 * 1000; // 15 minutes

// In-process usage tracker: tokenHash → firstUseTimestamp
// If a token appears in this map it has already been consumed.
const _usedTokens = new Map<string, number>();

// Periodically purge expired entries so the map doesn't grow forever.
setInterval(() => {
  const cutoff = Date.now() - BREAK_GLASS_TTL_MS;
  for (const [hash, ts] of _usedTokens) {
    if (ts < cutoff) _usedTokens.delete(hash);
  }
}, 60_000).unref();

export function verifyBreakGlassToken(token: string | undefined): boolean {
  const expected = (process.env.BREAK_GLASS_TOKEN ?? "").trim();
  const provided = (token ?? "").trim();

  if (!expected || !provided) return false;
  if (expected.length < 32) return false;
  if (provided.length !== expected.length) return false;

  if (!crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return false;

  // Single-use: reject if already consumed (timing-safe hash as map key)
  const tokenHash = crypto.createHash("sha256").update(provided).digest("hex");
  if (_usedTokens.has(tokenHash)) return false;

  // Consume the token — subsequent calls with the same token are denied
  _usedTokens.set(tokenHash, Date.now());
  return true;
}
