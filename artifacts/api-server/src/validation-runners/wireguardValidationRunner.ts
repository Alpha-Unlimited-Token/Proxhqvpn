// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// WireGuard node health runner — validates nodes from DB + daemon heartbeat data.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { ValidationTarget } from "../services/validationTargetService";

export interface WireguardValidationResult {
  status: "passed" | "failed" | "warning" | "error";
  score: number;
  maxScore: number;
  message: string;
  toolName: string;
  toolVersion: string;
  rawOutput: Record<string, unknown>;
  findings: Array<{ title: string; severity: string; nodeId?: number }>;
}

const HEARTBEAT_STALE_MS = 5 * 60 * 1000;  // 5 min
const HEARTBEAT_DEAD_MS  = 15 * 60 * 1000; // 15 min

export async function runWireguardValidation(_target: ValidationTarget): Promise<WireguardValidationResult> {
  const findings: Array<{ title: string; severity: string; nodeId?: number }> = [];

  const result = await db.execute(sql`
    SELECT id, name, status, ip, region,
           last_seen, health_score, cpu_pct, mem_pct,
           peer_count, wg_interface
    FROM nodes
    ORDER BY last_seen DESC NULLS LAST
    LIMIT 100
  `).catch(() => ({ rows: [] }));

  const nodes = (result as { rows: Record<string, unknown>[] }).rows;
  if (nodes.length === 0) {
    return {
      status:      "warning",
      score:       0,
      maxScore:    100,
      message:     "No nodes found in DB",
      toolName:    "wireguard-validator",
      toolVersion: "1.0.0",
      rawOutput:   { nodeCount: 0 },
      findings:    [{ title: "No WireGuard nodes registered", severity: "medium" }],
    };
  }

  const now = Date.now();
  let passed = 0;

  for (const node of nodes) {
    const nodeId   = Number(node.id);
    const name     = String(node.name ?? nodeId);
    const lastSeen = node.last_seen ? new Date(node.last_seen as string).getTime() : 0;
    const age      = lastSeen > 0 ? now - lastSeen : Infinity;
    const health   = Number(node.health_score ?? 0);
    const status   = String(node.status ?? "unknown");

    if (status !== "active") {
      findings.push({ title: `Node ${name} status: ${status}`, severity: "low", nodeId });
      continue;
    }
    if (age > HEARTBEAT_DEAD_MS) {
      findings.push({ title: `Node ${name} heartbeat missing (>${Math.round(age/60000)}min ago)`, severity: "high", nodeId });
      continue;
    }
    if (age > HEARTBEAT_STALE_MS) {
      findings.push({ title: `Node ${name} heartbeat stale`, severity: "medium", nodeId });
    }
    if (health < 50) {
      findings.push({ title: `Node ${name} health score low (${health})`, severity: health < 25 ? "high" : "medium", nodeId });
    }
    passed++;
  }

  const total    = nodes.length;
  const pct      = total > 0 ? Math.round((passed / total) * 100) : 0;
  const score    = pct;
  const critical = findings.filter(f => f.severity === "high").length;

  return {
    status:      critical > 0 ? "warning" : pct >= 80 ? "passed" : "warning",
    score,
    maxScore:    100,
    message:     `${passed}/${total} WireGuard nodes healthy (${pct}%)`,
    toolName:    "wireguard-validator",
    toolVersion: "1.0.0",
    rawOutput:   { total, passed, pct, nodes: nodes.map(n => ({ id: n.id, name: n.name, status: n.status, health_score: n.health_score })) },
    findings,
  };
}
