// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Security headers runner — checks HSTS, CSP, X-Frame-Options, etc.
import https from "https";
import http from "http";
import { URL } from "url";
import type { ValidationTarget } from "../services/validationTargetService";

export interface SecurityHeadersResult {
  status: "passed" | "failed" | "warning" | "error";
  score: number;
  maxScore: number;
  message: string;
  toolName: string;
  toolVersion: string;
  rawOutput: Record<string, unknown>;
  findings: Array<{ title: string; severity: string; description: string }>;
}

interface HeaderCheck {
  header:      string;
  required:    boolean;
  severity:    "high" | "medium" | "low";
  validate?:   (val: string) => boolean;
  advice:      string;
}

const HEADER_CHECKS: HeaderCheck[] = [
  { header: "strict-transport-security", required: true,  severity: "high",   validate: v => v.includes("max-age"), advice: "Add Strict-Transport-Security: max-age=31536000; includeSubDomains" },
  { header: "content-security-policy",   required: true,  severity: "high",   advice: "Add a Content-Security-Policy header" },
  { header: "x-frame-options",           required: false, severity: "medium", validate: v => ["DENY","SAMEORIGIN"].includes(v.toUpperCase()), advice: "Set X-Frame-Options: DENY or SAMEORIGIN" },
  { header: "x-content-type-options",    required: true,  severity: "medium", validate: v => v.toLowerCase() === "nosniff", advice: "Set X-Content-Type-Options: nosniff" },
  { header: "referrer-policy",           required: false, severity: "low",    advice: "Set Referrer-Policy: strict-origin-when-cross-origin" },
  { header: "permissions-policy",        required: false, severity: "low",    advice: "Add a Permissions-Policy header to restrict browser features" },
];

function fetchHeaders(url: string): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.get(url, { headers: { "User-Agent": "ProxhqVPN-SecurityHeadersRunner/1.0" } }, res => {
      res.resume();
      resolve(res.headers as Record<string, string>);
    });
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error("Timed out")); });
    req.on("error", reject);
  });
}

export async function runSecurityHeadersCheck(target: ValidationTarget): Promise<SecurityHeadersResult> {
  const url = target.url;
  if (!url) {
    return { status: "error", score: 0, maxScore: 100, message: "Target has no URL", toolName: "security-headers-runner", toolVersion: "1.0.0", rawOutput: {}, findings: [] };
  }

  try {
    const headers = await fetchHeaders(url);
    const findings: Array<{ title: string; severity: string; description: string }> = [];
    let deductions = 0;

    for (const check of HEADER_CHECKS) {
      const val = headers[check.header];
      const present = !!val;
      const valid   = present && (!check.validate || check.validate(val));

      if (!valid) {
        const points = check.severity === "high" ? 25 : check.severity === "medium" ? 15 : 5;
        deductions += (check.required || present) ? points : Math.floor(points / 2);
        findings.push({
          title:       `Missing or misconfigured header: ${check.header}`,
          severity:    check.severity,
          description: check.advice,
        });
      }
    }

    const score = Math.max(0, 100 - deductions);
    return {
      status:      score >= 80 ? "passed" : score >= 60 ? "warning" : "failed",
      score,
      maxScore:    100,
      message:     findings.length === 0 ? "All security headers present and valid" : `${findings.length} header issue(s) found`,
      toolName:    "security-headers-runner",
      toolVersion: "1.0.0",
      rawOutput:   { url, headers },
      findings,
    };
  } catch (err: any) {
    return { status: "error", score: 0, maxScore: 100, message: `Header check failed: ${err.message}`, toolName: "security-headers-runner", toolVersion: "1.0.0", rawOutput: { url, error: err.message }, findings: [] };
  }
}
