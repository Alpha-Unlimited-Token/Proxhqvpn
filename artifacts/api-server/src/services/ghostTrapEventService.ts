// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Trap Event Service — unified event log for the Ghost Trap timeline.
import { db } from "@workspace/db";
import { ghostTrapEventsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import crypto from "crypto";
import { shipSecurityEvent } from "../lib/siem";

export type GhostTrapEventType =
  | "probe"
  | "beacon"
  | "session_start"
  | "session_loop"
  | "block"
  | "evidence_export"
  | "rule_match"
  | "config_change";

export type GhostTrapSeverity = "info" | "warn" | "high" | "critical";

export async function recordEvent(opts: {
  userId?: string;
  eventType: GhostTrapEventType;
  severity?: GhostTrapSeverity;
  sourceIp?: string;
  summary: string;
  detailJson?: Record<string, unknown>;
  probeId?: string;
  sessionId?: string;
  fedToSiem?: boolean;
}) {
  const eventId = `GTE-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  const [row] = await db
    .insert(ghostTrapEventsTable)
    .values({
      eventId,
      userId:     opts.userId ?? null,
      eventType:  opts.eventType,
      severity:   opts.severity ?? "info",
      sourceIp:   opts.sourceIp ?? null,
      summary:    opts.summary,
      detailJson: opts.detailJson ? JSON.stringify(opts.detailJson) : null,
      probeId:    opts.probeId ?? null,
      sessionId:  opts.sessionId ?? null,
      fedToSiem:  opts.fedToSiem ?? false,
    })
    .returning();

  if (opts.fedToSiem ?? (opts.severity === "high" || opts.severity === "critical")) {
    const siemSev: "low" | "medium" | "high" | "critical" = opts.severity === "warn" ? "medium"
      : opts.severity === "info" ? "low"
      : (opts.severity as "low" | "medium" | "high" | "critical") ?? "low";
    shipSecurityEvent({
      actor:    "ghost_trap",
      action:   opts.eventType,
      resource: `ghost_trap:${opts.sourceIp ?? "unknown"}`,
      result:   "allow",
      severity: siemSev,
      metadata: { eventId, sourceIp: opts.sourceIp, summary: opts.summary, ...opts.detailJson },
    }).catch(() => {});
  }

  return row!;
}

export async function getEvents(userId: string, limit = 100) {
  return db
    .select()
    .from(ghostTrapEventsTable)
    .where(eq(ghostTrapEventsTable.userId, userId))
    .orderBy(desc(ghostTrapEventsTable.createdAt))
    .limit(limit);
}

export async function getPlatformEvents(limit = 200) {
  return db
    .select()
    .from(ghostTrapEventsTable)
    .orderBy(desc(ghostTrapEventsTable.createdAt))
    .limit(limit);
}
