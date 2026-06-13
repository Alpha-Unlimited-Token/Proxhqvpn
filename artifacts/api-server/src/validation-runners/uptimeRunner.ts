// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Uptime runner — HTTP GET/HEAD against allowlisted ProxhqVPN-owned targets only.
import https from "https";
import http from "http";
import { URL } from "url";
import type { ValidationTarget } from "../services/validationTargetService";

export interface UptimeResult {
  status: "passed" | "failed" | "warning" | "error";
  statusCode: number | null;
  latencyMs: number;
  message: string;
  toolName: string;
  toolVersion: string;
  score: number;
  maxScore: number;
  rawOutput: Record<string, unknown>;
}

function httpGet(url: string, timeoutMs = 10_000): Promise<{ statusCode: number; latencyMs: number; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;

    const req = lib.get(url, { headers: { "User-Agent": "ProxhqVPN-ValidationRunner/1.0" } }, (res) => {
      const latencyMs = Date.now() - start;
      res.resume(); // drain body
      resolve({ statusCode: res.statusCode ?? 0, latencyMs, headers: res.headers as Record<string, string> });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error("Request timed out")); });
    req.on("error", reject);
  });
}

export async function runUptimeCheck(target: ValidationTarget): Promise<UptimeResult> {
  const url = target.url;
  if (!url) {
    return { status: "error", statusCode: null, latencyMs: 0, message: "Target has no URL configured", toolName: "uptime-runner", toolVersion: "1.0.0", score: 0, maxScore: 100, rawOutput: {} };
  }

  try {
    const { statusCode, latencyMs, headers } = await httpGet(url);
    const ok = statusCode >= 200 && statusCode < 400;
    const slow = latencyMs > 3000;
    const score = ok ? (slow ? 75 : 100) : 0;

    return {
      status:      ok ? (slow ? "warning" : "passed") : "failed",
      statusCode,
      latencyMs,
      message:     ok ? `HTTP ${statusCode} in ${latencyMs}ms` : `HTTP ${statusCode} — target unreachable`,
      toolName:    "uptime-runner",
      toolVersion: "1.0.0",
      score,
      maxScore:    100,
      rawOutput:   { url, statusCode, latencyMs, headers },
    };
  } catch (err: any) {
    return {
      status:      "error",
      statusCode:  null,
      latencyMs:   0,
      message:     `Uptime check failed: ${err.message ?? "unknown error"}`,
      toolName:    "uptime-runner",
      toolVersion: "1.0.0",
      score:       0,
      maxScore:    100,
      rawOutput:   { url, error: err.message },
    };
  }
}
