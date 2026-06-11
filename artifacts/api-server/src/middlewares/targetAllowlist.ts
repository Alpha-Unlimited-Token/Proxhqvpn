// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Target scope allowlist — enforces that scanned targets are within the user's
// declared authorized scope. Fail-closed: no scopes = deny.
import { db } from "@workspace/db";
import { toolTargetScopesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

// ── IP helpers ─────────────────────────────────────────────────────────────
/**
 * Convert a dotted-decimal IPv4 string to an unsigned 32-bit integer.
 * Returns NaN for invalid inputs so callers can check isNaN().
 */
function ipToUint32(ip: string): number {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return NaN;
  let result = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return NaN;
    result = ((result << 8) | n) >>> 0;
  }
  return result;
}

/** Strip scheme, path, query, fragment, and port to get the bare host/IP. */
function normalizeHost(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("?")[0]!
    .split("#")[0]!
    .split("/")[0]!
    .split(":")[0]!;
}

// ── Core matching ───────────────────────────────────────────────────────────
export function targetMatchesScope(
  target: string,
  scopeType: string,
  scopeValue: string,
): boolean {
  const t = target.trim().toLowerCase();
  const v = scopeValue.trim().toLowerCase();

  // ── IP exact match ──────────────────────────────────────────────────────
  if (scopeType === "ip") {
    return t === v || t.startsWith(`${v}/`);
  }

  // ── URL origin + path prefix ────────────────────────────────────────────
  // Use native URL parsing so that "https://example.com.evil.tld" does NOT
  // match a scope of "https://example.com" — origins must be identical.
  if (scopeType === "url") {
    try {
      const targetUrl = new URL(t);
      const scopeUrl  = new URL(v);
      // Origins MUST match exactly (scheme + host + port)
      if (targetUrl.origin !== scopeUrl.origin) return false;
      // Normalize paths to end with "/" so startsWith won't match adjacent
      // paths: scope "/api" won't match "/api-docs" after normalization.
      const scopePath  = scopeUrl.pathname.endsWith("/")  ? scopeUrl.pathname  : scopeUrl.pathname  + "/";
      const targetPath = targetUrl.pathname.endsWith("/") ? targetUrl.pathname : targetUrl.pathname + "/";
      return targetPath.startsWith(scopePath) || targetUrl.pathname === scopeUrl.pathname;
    } catch {
      // If either value is not a valid URL, fall back to exact match (fail-closed).
      return t === v;
    }
  }

  // ── Domain + subdomain ─────────────────────────────────────────────────
  if (scopeType === "domain") {
    const tClean = normalizeHost(t);
    return tClean === v || tClean.endsWith(`.${v}`);
  }

  // ── CIDR — proper bit-level IPv4 math ──────────────────────────────────
  // `Math.ceil(prefix / 8)` byte-comparison was wrong for non-octet boundaries
  // (e.g., /17 or /25). We now compute the correct bitmask and compare the
  // masked host address against the masked network address.
  if (scopeType === "cidr") {
    const targetHost = normalizeHost(t);
    const slashIdx = v.indexOf("/");
    const netAddrStr = slashIdx === -1 ? v : v.slice(0, slashIdx);
    const prefix = slashIdx === -1 ? 32 : parseInt(v.slice(slashIdx + 1), 10);

    if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

    // Build the bitmask: /0 → 0x00000000, /32 → 0xffffffff
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;

    const netUint    = ipToUint32(netAddrStr);
    const targetUint = ipToUint32(targetHost);

    if (isNaN(netUint) || isNaN(targetUint)) return false;
    return (targetUint & mask) === (netUint & mask);
  }

  return false;
}

// ── Allowlist enforcement ───────────────────────────────────────────────────
// Fail-closed: throws on DB error, denies when no scopes are defined.
// DB errors propagate to the caller → HTTP 500 (no silent swallow).
export async function checkTargetAllowlist(
  target: string,
  userId: string,
): Promise<{ allowed: boolean; reason: string | null }> {
  if (!target) return { allowed: true, reason: null };
  const scopes = await db
    .select()
    .from(toolTargetScopesTable)
    .where(eq(toolTargetScopesTable.userId, userId));
  if (scopes.length === 0) {
    return {
      allowed: false,
      reason: "No authorized scope entries found. Add your target to your scope list at /tool-scope before running any scan.",
    };
  }
  const inScope = scopes.some(s => targetMatchesScope(target, s.scopeType, s.scopeValue));
  if (!inScope) {
    return {
      allowed: false,
      reason: `Target '${target}' is not in your authorized scope list. Add it at /tool-scope first.`,
    };
  }
  return { allowed: true, reason: null };
}
