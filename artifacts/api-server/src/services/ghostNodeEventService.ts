// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Node Event Service — event ingestion with per-IP rate limiting.
import { db } from "@workspace/db";
import { ghostNodeEventsTable } from "@workspace/db";
import { eq, desc, and, gte } from "drizzle-orm";
import { shipSecurityEvent } from "../lib/siem";

// Per-IP rate limiter: max 30 events/IP/60s (env override: GHOST_EVENT_IP_RATE)
const RATE_LIMIT  = parseInt(process.env["GHOST_EVENT_IP_RATE"] ?? "30", 10);
const WINDOW_MS   = 60_000;
const ipBuckets   = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of ipBuckets) {
    if (now > v.resetAt) ipBuckets.delete(k);
  }
}, 5 * 60_000);

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    ipBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  bucket.count++;
  if (bucket.count > RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: RATE_LIMIT - bucket.count };
}

export async function ingestEvent(ghostNodeId: number, opts: {
  eventType: string;
  sourceIp: string;
  sourcePort?: number;
  rawPayload?: string;
  geoCountry?: string;
  geoCity?: string;
  geoAsn?: string;
  severity?: "info" | "warn" | "critical";
}) {
  const { allowed } = checkRateLimit(opts.sourceIp);
  if (!allowed) {
    return { ok: false, reason: "rate_limited", message: `Rate limit exceeded for ${opts.sourceIp}` };
  }

  const [row] = await db
    .insert(ghostNodeEventsTable)
    .values({
      ghostNodeId,
      eventType:  opts.eventType,
      sourceIp:   opts.sourceIp,
      sourcePort: opts.sourcePort ?? null,
      rawPayload: opts.rawPayload ?? null,
      geoCountry: opts.geoCountry ?? null,
      geoCity:    opts.geoCity    ?? null,
      geoAsn:     opts.geoAsn     ?? null,
      severity:   opts.severity   ?? "info",
    })
    .returning();

  if (opts.severity === "critical" || opts.severity === "warn") {
    const siemSev: "medium" | "critical" = opts.severity === "warn" ? "medium" : "critical";
    shipSecurityEvent({
      actor:    "ghost_node",
      action:   opts.eventType,
      resource: `ghost_node:${ghostNodeId}`,
      result:   "allow",
      severity: siemSev,
      metadata: { ghostNodeId, sourceIp: opts.sourceIp, geoCountry: opts.geoCountry },
    }).catch(() => {});
  }

  return { ok: true, event: row! };
}

export async function getRecentEvents(ghostNodeId: number, limit = 100) {
  return db
    .select()
    .from(ghostNodeEventsTable)
    .where(eq(ghostNodeEventsTable.ghostNodeId, ghostNodeId))
    .orderBy(desc(ghostNodeEventsTable.createdAt))
    .limit(limit);
}
