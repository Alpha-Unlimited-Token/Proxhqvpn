import crypto from "crypto";
import { bus } from "./service-bus";

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const sorted = Object.keys(value as object).sort();
  return `{${sorted.map(k => `${JSON.stringify(k)}:${stableStringify((value as any)[k])}`).join(",")}}`;
}

export function stableHash(value: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

export interface DriftResult {
  drifted: boolean;
  component: string;
  expectedHash: string;
  actualHash: string;
  detectedAt: string;
  severity?: "low" | "medium" | "high" | "critical";
  remediable?: boolean;
  remediationHint?: string;
}

export function detectDrift(component: string, expected: unknown, actual: unknown): DriftResult {
  const expectedHash = stableHash(expected);
  const actualHash   = stableHash(actual);
  const drifted = expectedHash !== actualHash;
  if (drifted) {
    bus.publish("drift.detected", { component, expectedHash, actualHash }, "drift-detector");
  }
  return {
    drifted,
    component,
    expectedHash,
    actualHash,
    detectedAt: new Date().toISOString(),
    severity: drifted ? classifyDriftSeverity(component) : undefined,
    remediable: drifted ? isRemediable(component) : false,
    remediationHint: drifted ? remediationHint(component) : undefined,
  };
}

export interface DriftSummary {
  total: number;
  drifted: number;
  results: DriftResult[];
  remediableCount: number;
}

export function summarizeDrift(results: DriftResult[]): DriftSummary {
  return {
    total:           results.length,
    drifted:         results.filter(r => r.drifted).length,
    remediableCount: results.filter(r => r.drifted && r.remediable).length,
    results,
  };
}

// ── Severity classification ───────────────────────────────────────────────────

const SEVERITY_MAP: Record<string, DriftResult["severity"]> = {
  firewall_policy:      "high",
  node_credentials:     "medium",
  device_config_parity: "low",
  wireguard_keys:       "critical",
  ztna_policy:          "high",
  dns_shield_rules:     "medium",
  kill_switch_state:    "high",
  rbac_policy:          "critical",
};

function classifyDriftSeverity(component: string): DriftResult["severity"] {
  return SEVERITY_MAP[component] ?? "medium";
}

// ── Remediability ─────────────────────────────────────────────────────────────

const REMEDIABLE_COMPONENTS = new Set([
  "node_credentials",
  "device_config_parity",
  "dns_shield_rules",
  "kill_switch_state",
]);

function isRemediable(component: string): boolean {
  return REMEDIABLE_COMPONENTS.has(component);
}

const REMEDIATION_HINTS: Record<string, string> = {
  node_credentials:     "Re-sync node enrollment credentials via POST /api/node-enrollment/sync",
  device_config_parity: "Revoke orphaned device configs via POST /api/devices/cleanup",
  dns_shield_rules:     "Reset DNS shield rules to last known-good snapshot",
  kill_switch_state:    "Re-apply kill switch state from stored configuration",
};

function remediationHint(component: string): string {
  return REMEDIATION_HINTS[component] ?? "Manual review required — automated repair not available for this component";
}

// ── Auto-remediation engine ───────────────────────────────────────────────────

export type RemediationStatus = "applied" | "skipped" | "failed" | "manual_required";

export interface RemediationReport {
  component: string;
  status: RemediationStatus;
  action: string;
  timestamp: string;
  error?: string;
}

type RemediationFn = (result: DriftResult) => Promise<RemediationReport>;

const remediationHandlers = new Map<string, RemediationFn>();

/** Register an auto-repair handler for a specific drift component. */
export function registerRemediationHandler(component: string, fn: RemediationFn): void {
  remediationHandlers.set(component, fn);
}

/** Attempt auto-remediation for a single drift result. */
export async function remediateDrift(result: DriftResult): Promise<RemediationReport> {
  if (!result.drifted) {
    return { component: result.component, status: "skipped", action: "no_drift", timestamp: new Date().toISOString() };
  }

  const handler = remediationHandlers.get(result.component);
  if (!handler) {
    const report: RemediationReport = {
      component: result.component,
      status: "manual_required",
      action: result.remediationHint ?? "No automated handler registered",
      timestamp: new Date().toISOString(),
    };
    return report;
  }

  try {
    const report = await handler(result);
    if (report.status === "applied") {
      bus.publish("drift.remediated", { component: result.component, action: report.action }, "drift-detector");
    }
    return report;
  } catch (err: any) {
    return {
      component: result.component,
      status: "failed",
      action: "remediation_threw",
      timestamp: new Date().toISOString(),
      error: err?.message ?? String(err),
    };
  }
}

/** Attempt auto-remediation for all drifted results in a summary. */
export async function remediateAll(summary: DriftSummary): Promise<RemediationReport[]> {
  const drifted = summary.results.filter(r => r.drifted);
  return Promise.all(drifted.map(r => remediateDrift(r)));
}
