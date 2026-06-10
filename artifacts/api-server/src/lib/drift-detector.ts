import crypto from "crypto";

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
}

export function detectDrift(component: string, expected: unknown, actual: unknown): DriftResult {
  const expectedHash = stableHash(expected);
  const actualHash   = stableHash(actual);
  return {
    drifted: expectedHash !== actualHash,
    component,
    expectedHash,
    actualHash,
    detectedAt: new Date().toISOString(),
  };
}

export interface DriftSummary {
  total: number;
  drifted: number;
  results: DriftResult[];
}

export function summarizeDrift(results: DriftResult[]): DriftSummary {
  return {
    total:   results.length,
    drifted: results.filter(r => r.drifted).length,
    results,
  };
}
