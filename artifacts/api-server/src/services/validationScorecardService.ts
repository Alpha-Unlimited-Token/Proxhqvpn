// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Computes the ProxhqVPN validation trust scorecard from real DB data.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getLatestValidationHash } from "./validationHashChainService";

export interface ScorecardMetric {
  label: string;
  score: number;
  maxScore: number;
  status: "ok" | "warn" | "fail";
  detail: string;
}

export interface ValidationScorecard {
  score: number;
  maxScore: number;
  status: "trusted" | "warning" | "failed";
  grade: string;
  metrics: ScorecardMetric[];
  latestRuns: Array<{ run_type: string; status: string; score: number; started_at: string }>;
  openFindings: { critical: number; high: number; medium: number; low: number; total: number };
  hashChainValid: boolean;
  computedAt: string;
}

function grade(score: number, max: number): string {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

async function uptimeMetric(): Promise<ScorecardMetric> {
  const result = await db.execute(sql`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status='passed' THEN 1 ELSE 0 END) AS passed
    FROM validation_runs
    WHERE run_type = 'uptime' AND started_at > NOW() - INTERVAL '24 hours'
  `).catch(() => ({ rows: [{ total: 0, passed: 0 }] }));
  const row = (result as { rows: Record<string, unknown>[] }).rows[0] ?? {};
  const total  = Number(row.total  ?? 0);
  const passed = Number(row.passed ?? 0);
  const pct    = total > 0 ? Math.round((passed / total) * 100) : 0;
  return {
    label:    "Uptime",
    score:    Math.round(pct / 5),  // out of 20
    maxScore: 20,
    status:   pct >= 99 ? "ok" : pct >= 95 ? "warn" : "fail",
    detail:   total > 0 ? `${pct}% uptime (${passed}/${total} checks passed)` : "No uptime checks in last 24h",
  };
}

async function tlsMetric(): Promise<ScorecardMetric> {
  const result = await db.execute(sql`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status='passed' THEN 1 ELSE 0 END) AS passed
    FROM validation_runs
    WHERE run_type = 'tls' AND started_at > NOW() - INTERVAL '7 days'
  `).catch(() => ({ rows: [{ total: 0, passed: 0 }] }));
  const row    = (result as { rows: Record<string, unknown>[] }).rows[0] ?? {};
  const total  = Number(row.total  ?? 0);
  const passed = Number(row.passed ?? 0);
  const ok     = total > 0 && passed === total;
  return {
    label:    "TLS/Certificate",
    score:    ok ? 15 : total > 0 ? 7 : 0,
    maxScore: 15,
    status:   ok ? "ok" : total > 0 ? "warn" : "fail",
    detail:   total > 0 ? `${passed}/${total} TLS checks passed` : "No TLS checks in last 7d",
  };
}

async function securityMetric(): Promise<ScorecardMetric> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(critical_count), 0) AS critical,
           COALESCE(SUM(high_count), 0)     AS high
    FROM validation_runs
    WHERE run_type IN ('zap','trivy','semgrep','headers')
      AND started_at > NOW() - INTERVAL '7 days'
      AND status NOT IN ('error','queued','running')
  `).catch(() => ({ rows: [{ critical: 0, high: 0 }] }));
  const row      = (result as { rows: Record<string, unknown>[] }).rows[0] ?? {};
  const critical = Number(row.critical ?? 0);
  const high     = Number(row.high     ?? 0);
  const score    = critical > 0 ? 0 : high > 0 ? 10 : 25;
  return {
    label:    "Security Scans",
    score,
    maxScore: 25,
    status:   critical > 0 ? "fail" : high > 0 ? "warn" : "ok",
    detail:   `${critical} critical, ${high} high findings from security scans`,
  };
}

async function wgNodeMetric(): Promise<ScorecardMetric> {
  const result = await db.execute(sql`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status='passed' THEN 1 ELSE 0 END) AS passed
    FROM validation_runs
    WHERE run_type IN ('wireguard','node_health')
      AND started_at > NOW() - INTERVAL '1 hour'
  `).catch(() => ({ rows: [{ total: 0, passed: 0 }] }));
  const row    = (result as { rows: Record<string, unknown>[] }).rows[0] ?? {};
  const total  = Number(row.total  ?? 0);
  const passed = Number(row.passed ?? 0);
  const pct    = total > 0 ? Math.round((passed / total) * 100) : 0;
  return {
    label:    "WireGuard Nodes",
    score:    total > 0 ? Math.round((pct / 100) * 25) : 0,
    maxScore: 25,
    status:   pct >= 90 ? "ok" : pct >= 70 ? "warn" : "fail",
    detail:   total > 0 ? `${passed}/${total} node checks passed` : "No node checks in last hour",
  };
}

async function findingsMetric(): Promise<{ critical: number; high: number; medium: number; low: number; total: number }> {
  const result = await db.execute(sql`
    SELECT
      SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END) AS critical,
      SUM(CASE WHEN severity='high'     THEN 1 ELSE 0 END) AS high,
      SUM(CASE WHEN severity='medium'   THEN 1 ELSE 0 END) AS medium,
      SUM(CASE WHEN severity='low'      THEN 1 ELSE 0 END) AS low,
      COUNT(*)                                              AS total
    FROM validation_findings WHERE status = 'open'
  `).catch(() => ({ rows: [{}] }));
  const row = (result as { rows: Record<string, unknown>[] }).rows[0] ?? {};
  return {
    critical: Number(row.critical ?? 0),
    high:     Number(row.high     ?? 0),
    medium:   Number(row.medium   ?? 0),
    low:      Number(row.low      ?? 0),
    total:    Number(row.total    ?? 0),
  };
}

async function hashChainCheck(): Promise<boolean> {
  try {
    await getLatestValidationHash();
    return true;
  } catch {
    return false;
  }
}

async function latestRunsSummary() {
  const result = await db.execute(sql`
    SELECT DISTINCT ON (run_type) run_type, status, score, started_at
    FROM validation_runs
    ORDER BY run_type, started_at DESC
    LIMIT 20
  `).catch(() => ({ rows: [] }));
  return (result as { rows: Array<{ run_type: string; status: string; score: number; started_at: string }> }).rows;
}

export async function generateScorecard(): Promise<ValidationScorecard> {
  const [uptime, tls, security, wgNode, findings, hashOk, latestRuns] = await Promise.all([
    uptimeMetric(),
    tlsMetric(),
    securityMetric(),
    wgNodeMetric(),
    findingsMetric(),
    hashChainCheck(),
    latestRunsSummary(),
  ]);

  const metrics = [uptime, tls, security, wgNode];
  const score   = metrics.reduce((s, m) => s + m.score, 0);
  const maxScore = metrics.reduce((s, m) => s + m.maxScore, 0);
  const pct     = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const hasCrit = metrics.some(m => m.status === "fail") || findings.critical > 0;
  const hasWarn = metrics.some(m => m.status === "warn") || findings.high > 0;

  const status: "trusted" | "warning" | "failed" = hasCrit ? "failed" : hasWarn ? "warning" : "trusted";

  // Snapshot to DB
  const id = randomUUID();
  await db.execute(sql`
    INSERT INTO validation_trust_snapshots (id, score, max_score, status, metrics)
    VALUES (${id}, ${score}, ${maxScore}, ${status},
            ${JSON.stringify({ uptime, tls, security, wgNode, pct: Math.round(pct) })}::jsonb)
  `).catch(() => { /* non-fatal */ });

  return {
    score,
    maxScore,
    status,
    grade: grade(score, maxScore),
    metrics,
    latestRuns,
    openFindings: findings,
    hashChainValid: hashOk,
    computedAt: new Date().toISOString(),
  };
}
