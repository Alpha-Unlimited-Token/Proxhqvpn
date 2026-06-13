// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Trivy runner — filesystem/image vulnerability scan against local repo/container only.
import { execSync } from "child_process";
import type { ValidationTarget } from "../services/validationTargetService";

export interface TrivyRunnerResult {
  status: "passed" | "failed" | "warning" | "error";
  score: number;
  maxScore: number;
  message: string;
  toolName: string;
  toolVersion: string;
  rawOutput: Record<string, unknown>;
  findings: Array<{ title: string; severity: string; description: string; pkg?: string }>;
}

function trivyVersion(): string | null {
  try {
    return execSync("trivy version --format json 2>/dev/null", { timeout: 5000, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

export async function runTrivyScan(target: ValidationTarget): Promise<TrivyRunnerResult> {
  const version = trivyVersion();
  if (!version) {
    return {
      status:      "error",
      score:       0,
      maxScore:    100,
      message:     "Trivy is not installed. Install: https://trivy.dev/latest/getting-started/installation/ — run `apt-get install trivy` or download from GitHub Releases.",
      toolName:    "trivy",
      toolVersion: "not-installed",
      rawOutput:   { installed: false, installUrl: "https://trivy.dev" },
      findings:    [],
    };
  }

  // Scan path — either host (container image) or defaults to /home/runner/workspace
  const scanTarget = target.host ?? process.env.WORKSPACE_ROOT ?? "/home/runner/workspace";
  const targetType = target.target_type === "container" ? "image" : "fs";

  try {
    const raw = execSync(
      `trivy ${targetType} --format json --quiet "${scanTarget}"`,
      { timeout: 180_000, encoding: "utf8" },
    );
    const parsed = JSON.parse(raw);
    const results: unknown[] = parsed.Results ?? [];
    const findings: TrivyRunnerResult["findings"] = [];

    for (const r of results as any[]) {
      for (const vuln of (r.Vulnerabilities ?? [])) {
        findings.push({
          title:       `${vuln.VulnerabilityID}: ${vuln.Title ?? "Vulnerability"}`,
          severity:    (vuln.Severity ?? "unknown").toLowerCase(),
          description: vuln.Description ?? "",
          pkg:         `${vuln.PkgName}@${vuln.InstalledVersion}`,
        });
      }
    }

    const critical = findings.filter(f => f.severity === "critical").length;
    const high     = findings.filter(f => f.severity === "high").length;
    const score    = critical > 0 ? 0 : high > 0 ? 40 : findings.length > 0 ? 70 : 100;

    return {
      status:      score === 100 ? "passed" : critical > 0 ? "failed" : "warning",
      score,
      maxScore:    100,
      message:     `Trivy: ${findings.length} vulnerabilities (${critical} critical, ${high} high)`,
      toolName:    "trivy",
      toolVersion: version.slice(0, 40),
      rawOutput:   { scanTarget, targetType, vulnCount: findings.length },
      findings,
    };
  } catch (err: any) {
    return { status: "error", score: 0, maxScore: 100, message: `Trivy scan error: ${err.message}`, toolName: "trivy", toolVersion: version.slice(0, 40), rawOutput: { error: err.message }, findings: [] };
  }
}
