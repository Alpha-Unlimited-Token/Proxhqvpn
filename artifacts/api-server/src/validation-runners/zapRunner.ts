// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// ZAP runner — OWASP ZAP passive + active scan against allowlisted ProxhqVPN URLs only.
// If ZAP is not installed, returns status=error with install instructions.
import { execSync } from "child_process";
import type { ValidationTarget } from "../services/validationTargetService";

export interface ZapRunnerResult {
  status: "passed" | "failed" | "warning" | "error";
  score: number;
  maxScore: number;
  message: string;
  toolName: string;
  toolVersion: string;
  rawOutput: Record<string, unknown>;
  findings: Array<{ title: string; severity: string; description: string; url?: string }>;
}

const SEVERITY_MAP: Record<string, string> = {
  "3": "high", "2": "medium", "1": "low", "0": "info",
};

function zapVersion(): string | null {
  try {
    return execSync("zap.sh -version 2>/dev/null || zaproxy -version 2>/dev/null", { timeout: 5000 }).toString().trim();
  } catch {
    return null;
  }
}

export async function runZapScan(target: ValidationTarget): Promise<ZapRunnerResult> {
  const version = zapVersion();
  if (!version) {
    return {
      status:      "error",
      score:       0,
      maxScore:    100,
      message:     "OWASP ZAP is not installed. Install instructions: https://www.zaproxy.org/download/ — run `snap install zaproxy` or download the JAR.",
      toolName:    "owasp-zap",
      toolVersion: "not-installed",
      rawOutput:   { installed: false, installUrl: "https://www.zaproxy.org/download/" },
      findings:    [],
    };
  }

  const url = target.url;
  if (!url) {
    return { status: "error", score: 0, maxScore: 100, message: "Target has no URL", toolName: "owasp-zap", toolVersion: version, rawOutput: {}, findings: [] };
  }

  try {
    const raw = execSync(
      `zap-cli --zap-url http://localhost:8090 quick-scan --self-contained --start-options "-daemon" --output JSON --format JSON "${url}"`,
      { timeout: 120_000, encoding: "utf8" },
    );
    const parsed = JSON.parse(raw);
    const alerts: unknown[] = parsed.alerts ?? [];
    const findings = alerts.map((a: any) => ({
      title:       a.name ?? a.alert ?? "ZAP Alert",
      severity:    SEVERITY_MAP[String(a.riskcode ?? a.risk ?? 0)] ?? "info",
      description: a.desc ?? a.description ?? "",
      url:         a.url ?? url,
    }));
    const critical = findings.filter(f => f.severity === "high").length;
    const score    = critical > 0 ? 0 : findings.length > 5 ? 50 : findings.length > 0 ? 70 : 100;
    return {
      status:      score === 100 ? "passed" : score >= 70 ? "warning" : "failed",
      score,
      maxScore:    100,
      message:     `ZAP scan: ${findings.length} alerts found`,
      toolName:    "owasp-zap",
      toolVersion: version,
      rawOutput:   { url, alertCount: findings.length },
      findings,
    };
  } catch (err: any) {
    return { status: "error", score: 0, maxScore: 100, message: `ZAP scan error: ${err.message}`, toolName: "owasp-zap", toolVersion: version, rawOutput: { error: err.message }, findings: [] };
  }
}
