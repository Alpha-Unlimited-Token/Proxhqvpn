// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// k6 load test runner — only runs against targets with allow_load_tests=true.
import { writeFileSync, unlinkSync } from "fs";
import { execSync, exec as execCb } from "child_process";
import { promisify } from "util";
import os from "os";
import path from "path";
import type { ValidationTarget } from "../services/validationTargetService";

const exec = promisify(execCb);

export interface K6RunnerResult {
  status: "passed" | "failed" | "warning" | "error";
  score: number;
  maxScore: number;
  message: string;
  toolName: string;
  toolVersion: string;
  rawOutput: Record<string, unknown>;
  findings: Array<{ title: string; severity: string }>;
}

function k6Version(): string | null {
  try {
    return execSync("k6 version 2>/dev/null", { timeout: 5000, encoding: "utf8" }).trim();
  } catch { return null; }
}

const K6_SCRIPT_TEMPLATE = (url: string) => `
import http from 'k6/http';
import { check, sleep } from 'k6';
export const options = {
  vus: 3, duration: '30s',
  thresholds: { 'http_req_duration': ['p(95)<3000'], 'http_req_failed': ['rate<0.05'] }
};
export default function () {
  const res = http.get('${url}', { headers: { 'User-Agent': 'ProxhqVPN-k6-LoadTest/1.0' } });
  check(res, { 'status is 2xx': (r) => r.status >= 200 && r.status < 300 });
  sleep(1);
}
`;

export async function runK6Test(target: ValidationTarget): Promise<K6RunnerResult> {
  if (!target.allow_load_tests) {
    return { status: "error", score: 0, maxScore: 100, message: "Load tests not enabled for this target. Set allow_load_tests=true.", toolName: "k6", toolVersion: "n/a", rawOutput: {}, findings: [] };
  }

  const version = k6Version();
  if (!version) {
    return { status: "error", score: 0, maxScore: 100, message: "k6 is not installed. Install: https://grafana.com/docs/k6/latest/get-started/installation/", toolName: "k6", toolVersion: "not-installed", rawOutput: { installed: false }, findings: [] };
  }

  const url = target.url;
  if (!url) {
    return { status: "error", score: 0, maxScore: 100, message: "Target has no URL", toolName: "k6", toolVersion: version, rawOutput: {}, findings: [] };
  }

  const scriptPath = path.join(os.tmpdir(), `proxhq-k6-${Date.now()}.js`);
  try {
    writeFileSync(scriptPath, K6_SCRIPT_TEMPLATE(url));

    const { stdout } = await exec(`k6 run --out json=/dev/null "${scriptPath}" 2>&1`, { timeout: 60_000 });

    const errRate = parseFloat((stdout.match(/http_req_failed[^\d]*([\d.]+)%/) ?? [])[1] ?? "0") / 100;
    const p95     = parseFloat((stdout.match(/p\(95\)=([\d.]+)ms/) ?? [])[1] ?? "0");

    const score = errRate > 0.05 ? 30 : p95 > 3000 ? 60 : 100;
    return {
      status:      score === 100 ? "passed" : score >= 60 ? "warning" : "failed",
      score,
      maxScore:    100,
      message:     `k6: error rate ${(errRate * 100).toFixed(1)}%, p95 latency ${p95.toFixed(0)}ms`,
      toolName:    "k6",
      toolVersion: version.slice(0, 40),
      rawOutput:   { url, errRate, p95 },
      findings:    errRate > 0.05 ? [{ title: `High error rate: ${(errRate*100).toFixed(1)}%`, severity: "high" }] : [],
    };
  } catch (err: any) {
    return { status: "error", score: 0, maxScore: 100, message: `k6 error: ${err.message}`, toolName: "k6", toolVersion: version, rawOutput: { error: err.message }, findings: [] };
  } finally {
    try { unlinkSync(scriptPath); } catch { /* ignore */ }
  }
}
