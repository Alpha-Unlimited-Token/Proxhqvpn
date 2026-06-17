// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Verified-Asset ownership gate + DNS/HTTP verification helpers.
//
// USAGE in any scan route:
//   await requireVerifiedAsset(userId, targetHostOrIp, req);
//
// Checks in order:
//   1. verified_assets table (user self-verified ownership)
//   2. lab_targets table     (admin-added authorized targets)
// If neither passes → throws 403.
import dns from "dns/promises";
import https from "https";
import http from "http";
import crypto from "crypto";
import { db } from "@workspace/db";
import { verifiedAssetsTable, labTargetsTable } from "@workspace/db/schema";
import { and, eq, or, isNull, gt } from "drizzle-orm";
import type { Request } from "express";

const TOKEN_PREFIX = "proxhqvpn-verify";

// ── requireVerifiedAsset ─────────────────────────────────────────────────────
// Call this at the top of any scan handler that sends packets to a target.
// Throws a 403-tagged error if the user does not own the target.
export async function requireVerifiedAsset(
  userId: string,
  target: string,
  _req?: Request,
): Promise<void> {
  const now = new Date();

  // ── 1. Check verified_assets ────────────────────────────────────────────
  const [asset] = await db
    .select()
    .from(verifiedAssetsTable)
    .where(
      and(
        eq(verifiedAssetsTable.userId, userId),
        eq(verifiedAssetsTable.value, normalizeTarget(target)),
        eq(verifiedAssetsTable.verificationStatus, "verified"),
        or(
          isNull(verifiedAssetsTable.expiresAt),
          gt(verifiedAssetsTable.expiresAt, now),
        ),
      ),
    )
    .limit(1);

  if (asset) return;

  // ── 2. Fallback: check lab_targets (admin-added) ─────────────────────────
  const ip = extractIp(target);
  if (ip) {
    const [labTarget] = await db
      .select()
      .from(labTargetsTable)
      .where(
        and(
          eq(labTargetsTable.ip, ip),
          eq(labTargetsTable.active, true),
          or(isNull(labTargetsTable.expiresAt), gt(labTargetsTable.expiresAt, now)),
        ),
      )
      .limit(1);

    if (labTarget) return;
  }

  // ── 3. Blocked ───────────────────────────────────────────────────────────
  const err = new Error(
    `Forbidden: "${target}" is not a verified asset. ` +
    `Verify ownership at /security-audit → Verified Assets, ` +
    `or ask an admin to add it to Lab Targets.`,
  ) as Error & { statusCode: number };
  err.statusCode = 403;
  throw err;
}

// ── generateVerificationToken ────────────────────────────────────────────────
export function generateVerificationToken(): string {
  return crypto.randomBytes(20).toString("hex");
}

// ── verifyViaDnsTxt ──────────────────────────────────────────────────────────
// Looks for a TXT record: proxhqvpn-verify=<token> on the domain.
export async function verifyViaDnsTxt(
  domain: string,
  token: string,
): Promise<{ verified: boolean; evidence: object }> {
  try {
    const records = await dns.resolveTxt(domain);
    const flat = records.flat();
    const expected = `${TOKEN_PREFIX}=${token}`;
    const found = flat.some((r) => r.trim() === expected);
    return {
      verified: found,
      evidence: { method: "dns_txt", records: flat, expected, checkedAt: new Date().toISOString() },
    };
  } catch (e: any) {
    return {
      verified: false,
      evidence: { method: "dns_txt", error: e.message, checkedAt: new Date().toISOString() },
    };
  }
}

// ── verifyViaHttpFile ────────────────────────────────────────────────────────
// Fetches /.well-known/proxhqvpn-verify.txt and checks it contains the token.
export async function verifyViaHttpFile(
  domain: string,
  token: string,
): Promise<{ verified: boolean; evidence: object }> {
  // Try HTTPS first (strict TLS), fall back to HTTP only if HTTPS is unavailable.
  // We never disable TLS certificate validation — if the domain has a cert issue,
  // DNS TXT verification should be used instead.
  const urls = [
    `https://${domain}/.well-known/${TOKEN_PREFIX}.txt`,
    `http://${domain}/.well-known/${TOKEN_PREFIX}.txt`,
  ];
  for (const url of urls) {
    const result = await attemptHttpFileVerification(url, token, domain);
    if (result.verified || result.reachable) return result;
  }
  return {
    verified: false,
    evidence: { method: "http_file", domain, error: "unreachable on both HTTPS and HTTP", checkedAt: new Date().toISOString() },
  };
}

async function attemptHttpFileVerification(
  url: string,
  token: string,
  _domain: string,
): Promise<{ verified: boolean; reachable?: boolean; evidence: object }> {
  return new Promise((resolve) => {
    const fetcher = url.startsWith("https") ? https : http;
    const req = fetcher.get(
      url,
      { timeout: 10000 },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        res.on("end", () => {
          const verified = body.trim() === token;
          resolve({
            verified,
            reachable: true, // server responded — skip HTTP fallback
            evidence: {
              method: "http_file",
              url,
              statusCode: res.statusCode,
              body: body.slice(0, 200),
              checkedAt: new Date().toISOString(),
            },
          });
        });
      },
    );
    req.on("error", (e: Error) => {
      resolve({
        verified: false,
        evidence: { method: "http_file", url, error: e.message, checkedAt: new Date().toISOString() },
      });
    });
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        verified: false,
        evidence: { method: "http_file", url, error: "timeout", checkedAt: new Date().toISOString() },
      });
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function normalizeTarget(t: string): string {
  try {
    if (t.startsWith("http://") || t.startsWith("https://")) {
      return new URL(t).hostname;
    }
  } catch {}
  return t.toLowerCase().replace(/^www\./, "");
}

function extractIp(target: string): string | null {
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const bare = normalizeTarget(target);
  return ipv4.test(bare) ? bare : null;
}
