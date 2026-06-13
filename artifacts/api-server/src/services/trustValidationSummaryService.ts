// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Public-safe Trust Center summary — no raw findings, no private internals.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export interface TrustValidationSummary {
  status: "trusted" | "warning" | "failed" | "unknown";
  score: number;
  maxScore: number;
  uptimePct: number;
  lastValidationAt: string | null;
  lastTlsCheckAt: string | null;
  activeIncidents: number;
  environment: "production";
  generatedAt: string;
}

export async function getTrustValidationSummary(): Promise<TrustValidationSummary> {
  const generatedAt = new Date().toISOString();

  const [snapshotResult, uptimeResult, tlsResult, critResult] = await Promise.all([
    db.execute(sql`
      SELECT score, max_score, status, created_at
      FROM validation_trust_snapshots
      ORDER BY created_at DESC LIMIT 1
    `).catch(() => ({ rows: [] })),

    db.execute(sql`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='passed' THEN 1 ELSE 0 END) AS passed,
        MAX(started_at) AS last_check
      FROM validation_runs
      WHERE run_type = 'uptime' AND started_at > NOW() - INTERVAL '24 hours'
    `).catch(() => ({ rows: [{ total: 0, passed: 0, last_check: null }] })),

    db.execute(sql`
      SELECT MAX(started_at) AS last_check
      FROM validation_runs
      WHERE run_type = 'tls' AND status = 'passed'
    `).catch(() => ({ rows: [{ last_check: null }] })),

    db.execute(sql`
      SELECT COUNT(*) AS cnt
      FROM validation_findings
      WHERE status = 'open' AND severity IN ('critical','high')
    `).catch(() => ({ rows: [{ cnt: 0 }] })),
  ]);

  const snap     = (snapshotResult as { rows: Record<string, unknown>[] }).rows[0];
  const uptime   = (uptimeResult as { rows: Record<string, unknown>[] }).rows[0] ?? {};
  const tls      = (tlsResult as { rows: Record<string, unknown>[] }).rows[0]    ?? {};
  const crit     = (critResult as { rows: Record<string, unknown>[] }).rows[0]   ?? {};

  const total    = Number(uptime.total  ?? 0);
  const passed   = Number(uptime.passed ?? 0);
  const uptimePct = total > 0 ? Math.round((passed / total) * 10000) / 100 : 0;

  return {
    status:           (snap?.status as "trusted" | "warning" | "failed") ?? "unknown",
    score:            Number(snap?.score    ?? 0),
    maxScore:         Number(snap?.max_score ?? 100),
    uptimePct,
    lastValidationAt: (uptime.last_check as string | null) ?? null,
    lastTlsCheckAt:   (tls.last_check    as string | null) ?? null,
    activeIncidents:  Number(crit.cnt ?? 0),
    environment:      "production",
    generatedAt,
  };
}
