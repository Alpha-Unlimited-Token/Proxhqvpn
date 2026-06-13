// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Synthetic journey runner — tests key ProxhqVPN endpoints reachability.
import https from "https";
import http from "http";
import { URL } from "url";
import type { ValidationTarget } from "../services/validationTargetService";

export interface SyntheticJourneyResult {
  status: "passed" | "failed" | "warning" | "error";
  score: number;
  maxScore: number;
  message: string;
  toolName: string;
  toolVersion: string;
  rawOutput: Record<string, unknown>;
  findings: Array<{ title: string; severity: string; step: string }>;
}

interface Step {
  name: string;
  buildUrl: (base: string) => string;
  expectedStatus: number[];
  critical: boolean;
}

const JOURNEY_STEPS: Step[] = [
  { name: "homepage-load",          buildUrl: b => b,                        expectedStatus: [200,301,302], critical: true  },
  { name: "api-healthz",            buildUrl: b => `${b}/api/healthz`,        expectedStatus: [200],         critical: true  },
  { name: "login-reachable",        buildUrl: b => `${b}/sign-in`,            expectedStatus: [200,301,302], critical: false },
  { name: "dashboard-reachable",    buildUrl: b => `${b}/dashboard`,          expectedStatus: [200,301,302], critical: false },
];

function probe(url: string): Promise<{ status: number; latencyMs: number }> {
  return new Promise((resolve, reject) => {
    const start  = Date.now();
    const parsed = new URL(url);
    const lib    = parsed.protocol === "https:" ? https : http;
    const req    = lib.get(url, { headers: { "User-Agent": "ProxhqVPN-SyntheticRunner/1.0" } }, res => {
      res.resume();
      resolve({ status: res.statusCode ?? 0, latencyMs: Date.now() - start });
    });
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
  });
}

export async function runSyntheticJourney(target: ValidationTarget): Promise<SyntheticJourneyResult> {
  const base = target.url?.replace(/\/$/, "") ?? "";
  if (!base) {
    return { status: "error", score: 0, maxScore: 100, message: "Target has no URL", toolName: "synthetic-runner", toolVersion: "1.0.0", rawOutput: {}, findings: [] };
  }

  const findings: Array<{ title: string; severity: string; step: string }> = [];
  const stepResults: Record<string, unknown>[] = [];
  let passed = 0;

  for (const step of JOURNEY_STEPS) {
    const url = step.buildUrl(base);
    try {
      const { status, latencyMs } = await probe(url);
      const ok = step.expectedStatus.includes(status);
      stepResults.push({ step: step.name, url, status, latencyMs, ok });
      if (ok) {
        passed++;
      } else {
        findings.push({
          title:    `Synthetic step failed: ${step.name} (HTTP ${status})`,
          severity: step.critical ? "high" : "medium",
          step:     step.name,
        });
      }
    } catch (err: any) {
      stepResults.push({ step: step.name, url, error: err.message, ok: false });
      findings.push({
        title:    `Synthetic step error: ${step.name} — ${err.message}`,
        severity: step.critical ? "high" : "medium",
        step:     step.name,
      });
    }
  }

  const total = JOURNEY_STEPS.length;
  const score = Math.round((passed / total) * 100);

  return {
    status:      score === 100 ? "passed" : score >= 75 ? "warning" : "failed",
    score,
    maxScore:    100,
    message:     `${passed}/${total} synthetic journey steps passed`,
    toolName:    "synthetic-runner",
    toolVersion: "1.0.0",
    rawOutput:   { base, steps: stepResults },
    findings,
  };
}
