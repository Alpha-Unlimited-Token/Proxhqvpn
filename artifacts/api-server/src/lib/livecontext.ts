// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// LiveContext™ — Intent-Runtime Correlation Engine.
// Captures developer intent declarations and computes divergence from actual execution.

import { db } from "@workspace/db";
import { livecontextSessionsTable, livecontextEventsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { appendAuditEvent } from "./audit-chain";
import { shipSecurityEvent } from "./siem";
import { logger } from "./logger";

// ── Intent categories and behavioral expectations ─────────────────────────────

const INTENT_CATEGORIES: Record<string, {
  keywords:          string[];
  allowedEventTypes: string[];
  highRiskKeywords:  string[];
  maxRiskScore:      number;
}> = {
  debugging: {
    keywords:         ["debug", "log", "check", "trace", "inspect", "error", "crash", "fix", "why", "issue"],
    allowedEventTypes:["command", "query", "file_read", "ssh_exec"],
    highRiskKeywords: ["nmap", "masscan", "sqlmap", "hydra", "wg set", "iptables -F", "DROP TABLE"],
    maxRiskScore:     30,
  },
  maintenance: {
    keywords:         ["update", "migrate", "upgrade", "rotate", "clean", "prune", "backup", "index", "vacuum"],
    allowedEventTypes:["command", "query", "ssh_exec"],
    highRiskKeywords: ["nmap", "masscan", "sqlmap", "canary", "honeypot", "hydra"],
    maxRiskScore:     40,
  },
  investigation: {
    keywords:         ["investigate", "audit", "analyze", "threat", "attack", "scan", "probe", "recon", "intel"],
    allowedEventTypes:["command", "query", "ssh_exec", "ip_contact", "file_read"],
    highRiskKeywords: ["DROP TABLE", "DELETE FROM users", "wg set peer", "iptables -F", "rm -rf"],
    maxRiskScore:     60,
  },
  deployment: {
    keywords:         ["deploy", "release", "rollout", "config", "push", "apply", "install", "setup"],
    allowedEventTypes:["command", "ssh_exec", "query"],
    highRiskKeywords: ["nmap", "masscan", "sqlmap", "hydra", "SELECT * FROM users", "canary"],
    maxRiskScore:     25,
  },
  unknown: {
    keywords:         [],
    allowedEventTypes:["command", "query", "ssh_exec", "ip_contact", "file_read", "block"],
    highRiskKeywords: [],
    maxRiskScore:     20,
  },
};

// ── Intent classification ─────────────────────────────────────────────────────

function classifyIntent(text: string): { category: string; keywords: string[] } {
  if (!text) return { category: "unknown", keywords: [] };
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {};
  const foundKeywords: string[] = [];

  for (const [category, def] of Object.entries(INTENT_CATEGORIES)) {
    if (category === "unknown") continue;
    let score = 0;
    for (const kw of def.keywords) {
      if (lower.includes(kw)) { score++; foundKeywords.push(kw); }
    }
    scores[category] = score;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return {
    category: best && best[1] > 0 ? best[0] : "unknown",
    keywords: [...new Set(foundKeywords)],
  };
}

// ── Risk weight computation ───────────────────────────────────────────────────

function computeEventRiskWeight(
  eventType: string,
  content:   string,
  category:  string,
): number {
  const def = INTENT_CATEGORIES[category] ?? INTENT_CATEGORIES.unknown!;
  let risk = 0;

  for (const kw of def.highRiskKeywords) {
    if (content.toLowerCase().includes(kw.toLowerCase())) risk += 25;
  }

  if (!def.allowedEventTypes.includes(eventType)) risk += 15;

  if (/DROP\s+TABLE/i.test(content))            risk += 50;
  if (/DELETE\s+FROM\s+users/i.test(content))   risk += 40;
  if (/wg\s+set.*remove/i.test(content))        risk += 30;
  if (/iptables\s+-F\b/i.test(content))         risk += 35;

  return risk;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start a new LiveContext session.
 */
export async function startLiveContextSession(opts: {
  userId:       string;
  sessionType:  "terminal" | "sql" | "ssh" | "combined";
  intentText?:  string;
}): Promise<string> {
  const { category, keywords } = classifyIntent(opts.intentText ?? "");

  const [session] = await db
    .insert(livecontextSessionsTable)
    .values({
      userId:         opts.userId,
      sessionType:    opts.sessionType,
      intentText:     opts.intentText,
      intentKeywords: keywords,
      intentCategory: category,
    })
    .returning({ id: livecontextSessionsTable.id });

  logger.info({ sessionId: session!.id, userId: opts.userId, category }, "[LiveContext] Session started");
  return session!.id;
}

/**
 * Record an event within a session and update divergence scoring.
 */
export async function recordLiveContextEvent(opts: {
  sessionId:  string;
  eventType:  "command" | "query" | "ssh_exec" | "file_read" | "ip_contact" | "block";
  content:    string;
  result?:    string;
  exitCode?:  number;
  tables?:    string[];
  ips?:       string[];
  files?:     string[];
}): Promise<void> {
  const [session] = await db
    .select({
      intentCategory: livecontextSessionsTable.intentCategory,
      divergenceScore:livecontextSessionsTable.divergenceScore,
      reviewRequired: livecontextSessionsTable.reviewRequired,
    })
    .from(livecontextSessionsTable)
    .where(eq(livecontextSessionsTable.id, opts.sessionId));

  if (!session) return;

  const category   = session.intentCategory ?? "unknown";
  const riskWeight = computeEventRiskWeight(opts.eventType, opts.content, category);

  await db.insert(livecontextEventsTable).values({
    sessionId:  opts.sessionId,
    eventType:  opts.eventType,
    content:    opts.content.slice(0, 2000),
    result:     opts.result,
    exitCode:   opts.exitCode,
    riskWeight,
    tables:     opts.tables,
    ips:        opts.ips,
    files:      opts.files,
  });

  const newDivergence = (session.divergenceScore ?? 0) + riskWeight;
  const def = INTENT_CATEGORIES[category] ?? INTENT_CATEGORIES.unknown!;
  const reviewRequired = newDivergence > def.maxRiskScore;

  // Build array-append SQL fragments safely using Drizzle's sql tag
  const tablesSql = opts.tables && opts.tables.length > 0
    ? sql`array_cat(${livecontextSessionsTable.tablesAccessed}, ${opts.tables}::text[])`
    : livecontextSessionsTable.tablesAccessed;
  const ipsSql = opts.ips && opts.ips.length > 0
    ? sql`array_cat(${livecontextSessionsTable.ipsContacted}, ${opts.ips}::text[])`
    : livecontextSessionsTable.ipsContacted;
  const filesSql = opts.files && opts.files.length > 0
    ? sql`array_cat(${livecontextSessionsTable.filesAccessed}, ${opts.files}::text[])`
    : livecontextSessionsTable.filesAccessed;

  await db
    .update(livecontextSessionsTable)
    .set({
      commandsRun:    opts.eventType === "command" ? sql`${livecontextSessionsTable.commandsRun} + 1` : undefined,
      queriesRun:     opts.eventType === "query"   ? sql`${livecontextSessionsTable.queriesRun} + 1`  : undefined,
      commandsBlocked:opts.eventType === "block"   ? sql`${livecontextSessionsTable.commandsBlocked} + 1` : undefined,
      divergenceScore: newDivergence,
      reviewRequired,
      tablesAccessed:  tablesSql,
      ipsContacted:    ipsSql,
      filesAccessed:   filesSql,
      ...(reviewRequired && !session.reviewRequired ? { flaggedAt: new Date() } : {}),
    })
    .where(eq(livecontextSessionsTable.id, opts.sessionId));

  if (reviewRequired && !session.reviewRequired) {
    logger.warn({ sessionId: opts.sessionId, divergence: newDivergence, category }, "[LiveContext] Session divergence threshold crossed");

    appendAuditEvent({
      actor:    opts.sessionId,
      action:   "livecontext.divergence_flagged",
      resource: `session:${opts.sessionId}`,
      result:   "deny",
      metadata: { divergenceScore: newDivergence, category, riskWeight, event: opts.content.slice(0, 100) },
    });

    void shipSecurityEvent({
      actor:    opts.sessionId,
      action:   "livecontext.divergence_flagged",
      resource: `session:${opts.sessionId}`,
      result:   "deny",
      severity: "high",
      metadata: {
        divergenceScore:  newDivergence,
        intentCategory:   category,
        sessionType:      "terminal/sql",
        triggeringEvent:  opts.content.slice(0, 100),
      },
    });
  }
}

/**
 * Close a LiveContext session and return the final divergence report.
 */
export async function closeLiveContextSession(sessionId: string): Promise<{
  divergenceScore: number;
  category:        string;
  reviewRequired:  boolean;
  summary:         string;
}> {
  const [session] = await db
    .select()
    .from(livecontextSessionsTable)
    .where(eq(livecontextSessionsTable.id, sessionId));

  if (!session) return { divergenceScore: 0, category: "unknown", reviewRequired: false, summary: "Session not found" };

  await db
    .update(livecontextSessionsTable)
    .set({ endedAt: new Date() })
    .where(eq(livecontextSessionsTable.id, sessionId));

  const divergenceScore = session.divergenceScore ?? 0;
  const category        = session.intentCategory  ?? "unknown";
  const reviewRequired  = session.reviewRequired  ?? false;

  const summary = [
    `Intent: "${session.intentText?.slice(0, 80) ?? "none declared"}" (classified: ${category})`,
    `Commands: ${session.commandsRun}, Queries: ${session.queriesRun}, Blocked: ${session.commandsBlocked}`,
    `Tables accessed: ${(session.tablesAccessed ?? []).join(", ") || "none"}`,
    `IPs contacted: ${(session.ipsContacted ?? []).join(", ") || "none"}`,
    `Divergence score: ${Math.round(divergenceScore)}${reviewRequired ? " — REVIEW REQUIRED" : ""}`,
  ].join(" | ");

  logger.info({ sessionId, summary }, "[LiveContext] Session closed");
  return { divergenceScore, category, reviewRequired, summary };
}
