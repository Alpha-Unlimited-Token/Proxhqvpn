// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// NeuralFence™ — Attacker Memory Graph with Temporal Decay Scoring.

import { db } from "@workspace/db";
import {
  neuralfenceNodesTable,
  neuralfenceEventsTable,
  neuralfencePatternsTable,
} from "@workspace/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { logger } from "./logger";
import { shipSecurityEvent } from "./siem";
import { appendAuditEvent } from "./audit-chain";
import { sendMail, adminEmails } from "./mailer";

// ── Constants ─────────────────────────────────────────────────────────────────

const DECAY_LAMBDA = 0.15;  // exponential decay rate — half-life ≈ 5 days
const MS_PER_DAY   = 86_400_000;

export const EVENT_WEIGHTS: Record<string, number> = {
  "honeypot.ssh_login_attempt":     15,
  "wireguard.revoked_key_handshake":25,
  "network.port_scan":              8,
  "canary.triggered":               40,
  "daemon.failed_psk":              20,
  "ips.critical":                   35,
  "ips.high":                       20,
  "ips.medium":                     10,
  "ips.low":                        3,
  "geo_block.hit":                  3,
  "beacon.alert":                   12,
  "ghost_node.interaction":         18,
  "darkweb.ioc_match":              50,
  "daemon.ban_threshold":           30,
};

const SCORE_TO_ACTION = (score: number): string => {
  if (score >= 100) return "hard_block";
  if (score >= 75)  return "soft_block";
  if (score >= 50)  return "challenge";
  if (score >= 25)  return "rate_limit";
  return "allow";
};

// ── Pattern detector ──────────────────────────────────────────────────────────

interface PatternResult {
  name:       string;
  amplifier:  number;
  eventIds:   number[];
}

async function detectPatterns(ip: string, newEventId: number): Promise<PatternResult[]> {
  const patterns: PatternResult[] = [];
  const windowStart = new Date(Date.now() - 7 * MS_PER_DAY);

  const recentEvents = await db
    .select({
      id:        neuralfenceEventsTable.id,
      eventType: neuralfenceEventsTable.eventType,
      occurredAt:neuralfenceEventsTable.occurredAt,
      nodeId:    neuralfenceEventsTable.nodeId,
    })
    .from(neuralfenceEventsTable)
    .where(and(eq(neuralfenceEventsTable.ip, ip), gte(neuralfenceEventsTable.occurredAt, windowStart)))
    .orderBy(neuralfenceEventsTable.occurredAt);

  const types = new Set(recentEvents.map(e => e.eventType));

  // Pattern 1: Port scan → credential attempt within 1hr
  const portScans   = recentEvents.filter(e => e.eventType === "network.port_scan");
  const credAttempts = recentEvents.filter(e =>
    e.eventType === "honeypot.ssh_login_attempt" || e.eventType === "daemon.failed_psk",
  );
  for (const scan of portScans) {
    for (const cred of credAttempts) {
      const gapMs = new Date(cred.occurredAt).getTime() - new Date(scan.occurredAt).getTime();
      if (gapMs > 0 && gapMs < 3_600_000) {
        patterns.push({ name: "port_scan_then_credential", amplifier: 2.5, eventIds: [scan.id, cred.id] });
        break;
      }
    }
  }

  // Pattern 2: Honeypot touch → WireGuard probe within 24hr
  const honeypotTouches = recentEvents.filter(e =>
    e.eventType === "honeypot.ssh_login_attempt" || e.eventType === "ghost_node.interaction",
  );
  const wgProbes = recentEvents.filter(e => e.eventType === "wireguard.revoked_key_handshake");
  for (const touch of honeypotTouches) {
    for (const probe of wgProbes) {
      const gapMs = new Date(probe.occurredAt).getTime() - new Date(touch.occurredAt).getTime();
      if (gapMs > 0 && gapMs < 86_400_000) {
        patterns.push({ name: "honeypot_then_wireguard_probe", amplifier: 3.0, eventIds: [touch.id, probe.id] });
        break;
      }
    }
  }

  // Pattern 3: Canary trigger → any subsequent connection
  const canaryTriggers = recentEvents.filter(e => e.eventType === "canary.triggered");
  if (canaryTriggers.length > 0 && recentEvents.length > canaryTriggers.length) {
    const first = canaryTriggers[0]!;
    const afterCanary = recentEvents.filter(e =>
      e.eventType !== "canary.triggered" &&
      new Date(e.occurredAt) > new Date(first.occurredAt),
    );
    if (afterCanary.length > 0) {
      patterns.push({ name: "canary_then_connection", amplifier: 4.0, eventIds: [first.id, afterCanary[0]!.id] });
    }
  }

  // Pattern 4: 3+ event types from same IP within 7 days
  if (types.size >= 3) {
    patterns.push({ name: "multi_vector_attack", amplifier: 2.0, eventIds: recentEvents.map(e => e.id) });
  }

  // Pattern 5: Same IP across 2+ nodes
  const nodeIds = new Set(recentEvents.map(e => e.nodeId).filter((n): n is number => n !== null));
  if (nodeIds.size >= 2) {
    patterns.push({ name: "multi_node_presence", amplifier: 2.5, eventIds: recentEvents.map(e => e.id) });
  }

  void newEventId; // referenced for context but pattern detection uses all events
  return patterns;
}

// ── Score computation ─────────────────────────────────────────────────────────

/**
 * Recompute the suspicion score for an IP from all its events.
 * Uses exponential decay: score = Σ (weight × e^(−λ × days))
 * Exported so the daily decay worker can call it.
 */
export async function recomputeScore(ip: string): Promise<number> {
  const events = await db
    .select({ baseWeight: neuralfenceEventsTable.baseWeight, occurredAt: neuralfenceEventsTable.occurredAt })
    .from(neuralfenceEventsTable)
    .where(eq(neuralfenceEventsTable.ip, ip));

  const now = Date.now();
  let score = 0;
  for (const e of events) {
    const daysSince = (now - new Date(e.occurredAt).getTime()) / MS_PER_DAY;
    score += e.baseWeight * Math.exp(-DECAY_LAMBDA * daysSince);
  }

  const patterns = await db
    .select({ amplifier: neuralfencePatternsTable.amplifier, detectedAt: neuralfencePatternsTable.detectedAt })
    .from(neuralfencePatternsTable)
    .where(and(
      eq(neuralfencePatternsTable.ip, ip),
      gte(neuralfencePatternsTable.detectedAt, new Date(now - 7 * MS_PER_DAY)),
    ));

  for (const p of patterns) {
    score *= p.amplifier;
  }

  return Math.max(0, score);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface IngestResult {
  ip:            string;
  previousScore: number;
  newScore:      number;
  previousAction:string;
  newAction:     string;
  actionChanged: boolean;
  patterns:      string[];
}

/**
 * Ingest a security event for an IP and update its suspicion score.
 * Call this from every route that receives attacker signals.
 */
export async function ingestAttackerEvent(opts: {
  ip:            string;
  eventType:     string;
  nodeId?:       number;
  metadata?:     Record<string, unknown>;
  geoCountry?:   string;
  geoAsn?:       string;
  isp?:          string;
  isTorExit?:    boolean;
  isDatacenter?: boolean;
}): Promise<IngestResult> {
  const baseWeight = EVENT_WEIGHTS[opts.eventType] ?? 5;

  await db
    .insert(neuralfenceNodesTable)
    .values({
      ip:           opts.ip,
      geoCountry:   opts.geoCountry,
      geoAsn:       opts.geoAsn,
      isp:          opts.isp,
      isTorExit:    opts.isTorExit ?? false,
      isDatacenter: opts.isDatacenter ?? false,
    })
    .onConflictDoUpdate({
      target: neuralfenceNodesTable.ip,
      set: {
        lastSeenAt:  new Date(),
        eventCount:  sql`${neuralfenceNodesTable.eventCount} + 1`,
        ...(opts.geoCountry  ? { geoCountry: opts.geoCountry }   : {}),
        ...(opts.isTorExit !== undefined ? { isTorExit: opts.isTorExit } : {}),
      },
    });

  const [node] = await db
    .select({ suspicionScore: neuralfenceNodesTable.suspicionScore, action: neuralfenceNodesTable.action })
    .from(neuralfenceNodesTable)
    .where(eq(neuralfenceNodesTable.ip, opts.ip));

  const previousScore  = node?.suspicionScore ?? 0;
  const previousAction = node?.action ?? "allow";

  const [event] = await db
    .insert(neuralfenceEventsTable)
    .values({
      ip:          opts.ip,
      eventType:   opts.eventType,
      baseWeight,
      nodeId:      opts.nodeId,
      rawMetadata: opts.metadata,
    })
    .returning({ id: neuralfenceEventsTable.id });

  const patterns = await detectPatterns(opts.ip, event!.id);
  for (const pattern of patterns) {
    await db.insert(neuralfencePatternsTable).values({
      ip:          opts.ip,
      patternName: pattern.name,
      amplifier:   pattern.amplifier,
      eventIds:    pattern.eventIds,
    }).onConflictDoNothing();
  }

  const newScore  = await recomputeScore(opts.ip);
  const newAction = SCORE_TO_ACTION(newScore);

  await db
    .update(neuralfenceNodesTable)
    .set({
      suspicionScore:  newScore,
      scoreUpdatedAt:  new Date(),
      action:          newAction,
      actionUpdatedAt: new Date(),
    })
    .where(eq(neuralfenceNodesTable.ip, opts.ip));

  const actionChanged = newAction !== previousAction;

  if (actionChanged && newAction === "hard_block") {
    logger.warn({ ip: opts.ip, score: newScore, patterns: patterns.map(p => p.name) }, "[NeuralFence] IP hard-blocked");
    appendAuditEvent({
      actor:    "system",
      action:   "neuralfence.hard_block",
      resource: `ip:${opts.ip}`,
      result:   "deny",
      metadata: { score: newScore, patterns: patterns.map(p => p.name) },
    });
    void shipSecurityEvent({
      actor:    "system",
      action:   "neuralfence.hard_block",
      resource: `ip:${opts.ip}`,
      result:   "deny",
      severity: "critical",
      metadata: { score: newScore, previousScore, patterns: patterns.map(p => p.name), ip: opts.ip },
    });
    const emails = adminEmails();
    if (emails.length > 0) {
      void sendMail({
        to:      emails,
        subject: `[ProxhqVPN] NeuralFence: IP ${opts.ip} auto-blocked (score ${Math.round(newScore)})`,
        html: `<h2>NeuralFence™ Automatic Block</h2>
               <p>IP <code>${opts.ip}</code> crossed the hard-block threshold.</p>
               <table>
                 <tr><td><b>Score</b></td><td>${Math.round(newScore)}</td></tr>
                 <tr><td><b>Previous action</b></td><td>${previousAction}</td></tr>
                 <tr><td><b>Patterns</b></td><td>${patterns.map(p => p.name).join(", ") || "none"}</td></tr>
               </table>`,
      }).catch(() => {});
    }
  }

  return {
    ip: opts.ip,
    previousScore,
    newScore,
    previousAction,
    newAction,
    actionChanged,
    patterns: patterns.map(p => p.name),
  };
}

/**
 * Look up the current action for an IP.
 * Returns 'allow' if the IP is unknown.
 */
export async function getIpAction(ip: string): Promise<string> {
  const [node] = await db
    .select({ action: neuralfenceNodesTable.action, manualAction: neuralfenceNodesTable.manualAction })
    .from(neuralfenceNodesTable)
    .where(eq(neuralfenceNodesTable.ip, ip));
  return node?.manualAction ?? node?.action ?? "allow";
}
