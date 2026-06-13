// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Trap Safety Service — SSRF/public-target protection guards.
// All outbound scan actions MUST pass through these checks.
import { db } from "@workspace/db";
import { labTargetsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

// RFC 1918 / loopback / link-local / multicast private ranges.
const PRIVATE_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^100\.6[4-9]\./,
  /^100\.[7-9]\d\./,
  /^100\.1[01]\d\./,
  /^100\.12[0-7]\./,
];

export function isPrivateIp(ip: string): boolean {
  return PRIVATE_RANGES.some(re => re.test(ip));
}

export function isPublicIp(ip: string): boolean {
  return !isPrivateIp(ip);
}

// Verify that a target IP is an authorized internal lab target before any scan.
export async function verifyLabTarget(targetId: string, _userId: string): Promise<{
  allowed: boolean;
  reason: string;
  target?: { targetIp: string; targetUrl: string | null };
}> {
  const [target] = await db
    .select()
    .from(labTargetsTable)
    .where(eq(labTargetsTable.id, parseInt(targetId, 10)))
    .limit(1);

  if (!target) {
    return { allowed: false, reason: "Target not found in lab_targets." };
  }
  if (!target.active) {
    return { allowed: false, reason: "Lab target is inactive." };
  }
  if (target.expiresAt && target.expiresAt < new Date()) {
    return { allowed: false, reason: "Lab target authorization has expired." };
  }
  if (isPublicIp(target.ip)) {
    return { allowed: false, reason: `Target IP ${target.ip} is a public internet address. Scanning public IPs is not permitted under any circumstances.` };
  }

  return {
    allowed: true,
    reason:  "Lab target verified — authorized internal scope.",
    target:  { targetIp: target.ip, targetUrl: target.hostname ?? null },
  };
}

// Returns a standard 451 policy rejection response body.
export function buildScanRejectionBody(detail?: string) {
  return {
    error:       "Scan blocked — policy violation.",
    policy:      "Outbound scanning tools (SQLmap, nmap, os-cmd, file-read) may only target authorized internal lab systems with authorized_lab_target=true and target_scope='internal_lab'. Scanning attacker IPs or any public internet address is unauthorized computer access under CFAA/Computer Misuse Act.",
    detail:      detail ?? "Target did not pass lab authorization check.",
    guidance:    "Register an internal lab target at /api/lab-targets then pass its ID as labTargetId in the request body.",
    removedAt:   "2026-06-13",
    documentedIn: "GHOST_PHASE1_SAFETY_FIX_REPORT.md",
  };
}
