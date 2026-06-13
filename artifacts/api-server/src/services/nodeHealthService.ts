// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.

export type NodeHealthScore = {
  nodeId: string;
  score: number;
  state: "healthy" | "degraded" | "stale" | "offline" | "error";
  reasons: string[];
};

export function scoreNodeHealth(node: any): NodeHealthScore {
  const nodeId = String(node.id ?? node.nodeId ?? node.node_id);
  const reasons: string[] = [];
  let score = 100;

  const status = String(node.status ?? "unknown");
  if (status === "error") {
    score -= 70;
    reasons.push("node_status_error");
  }

  if (status === "maintenance") {
    score -= 50;
    reasons.push("maintenance_mode");
  }

  const lastSeenRaw =
    node.lastSeenAt ?? node.last_seen_at ?? node.updatedAt ?? node.updated_at;
  const lastSeen = lastSeenRaw ? new Date(lastSeenRaw) : null;

  if (!lastSeen || !Number.isFinite(lastSeen.getTime())) {
    score -= 40;
    reasons.push("missing_last_seen");
  } else {
    const ageMs = Date.now() - lastSeen.getTime();

    if (ageMs > 15 * 60_000) {
      score -= 80;
      reasons.push("offline_last_seen_gt_15m");
    } else if (ageMs > 5 * 60_000) {
      score -= 35;
      reasons.push("stale_last_seen_gt_5m");
    }
  }

  const latencyMs = Number(node.latencyMs ?? node.latency_ms ?? 0);
  if (latencyMs > 250) {
    score -= 20;
    reasons.push("high_latency");
  }

  const load = Number(node.load ?? node.cpuLoad ?? node.cpu_load ?? 0);
  if (load > 0.85) {
    score -= 20;
    reasons.push("high_load");
  }

  score = Math.max(0, Math.min(100, score));

  const state =
    score >= 80
      ? "healthy"
      : score >= 55
        ? "degraded"
        : score >= 25
          ? "stale"
          : status === "error"
            ? "error"
            : "offline";

  return { nodeId, score, state, reasons };
}
