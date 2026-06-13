// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Semgrep runner — SAST scan against local repository paths only.
import { execSync } from "child_process";
import type { ValidationTarget } from "../services/validationTargetService";

export interface SemgrepRunnerResult {
  status: "passed" | "failed" | "warning" | "error";
  score: number;
  maxScore: number;
  message: string;
  toolName: string;
  toolVersion: string;
  rawOutput: Record<string, unknown>;
  findings: Array<{ title: string; severity: string; file?: string; line?: number }>;
}

function semgrepVersion(): string | null {
  try {
    return execSync("semgrep --version 2>/dev/null", { timeout: 5000, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

export async function runSemgrepScan(target: ValidationTarget): Promise<SemgrepRunnerResult> {
  const version = semgrepVersion();
  if (!version) {
    return {
      status:      "error",
      score:       0,
      maxScore:    100,
      message:     "Semgrep is not installed. Install: `pip install semgrep` or `brew install semgrep`",
      toolName:    "semgrep",
      toolVersion: "not-installed",
      rawOutput:   { installed: false, installUrl: "https://semgrep.dev/docs/getting-started/" },
      findings:    [],
    };
  }

  const scanPath = target.host ?? process.env.WORKSPACE_ROOT ?? "/home/runner/workspace";

  try {
    const raw = execSync(
      `semgrep scan --config=auto --json --quiet "${scanPath}"`,
      { timeout: 300_000, encoding: "utf8" },
    );
    const parsed = JSON.parse(raw);
    const results: unknown[] = parsed.results ?? [];
    const findings: SemgrepRunnerResult["findings"] = results.map((r: any) => ({
      title:    r.check_id ?? "Semgrep finding",
      severity: (r.extra?.severity ?? r.severity ?? "warning").toLowerCase(),
      file:     r.path,
      line:     r.start?.line,
    }));

    const critical = findings.filter(f => f.severity === "error" || f.severity === "critical").length;
    const score    = critical > 0 ? 30 : findings.length > 10 ? 60 : findings.length > 0 ? 80 : 100;

    return {
      status:      score === 100 ? "passed" : critical > 0 ? "failed" : "warning",
      score,
      maxScore:    100,
      message:     `Semgrep: ${findings.length} findings`,
      toolName:    "semgrep",
      toolVersion: version.slice(0, 40),
      rawOutput:   { scanPath, findingCount: findings.length },
      findings,
    };
  } catch (err: any) {
    return { status: "error", score: 0, maxScore: 100, message: `Semgrep error: ${err.message}`, toolName: "semgrep", toolVersion: version, rawOutput: { error: err.message }, findings: [] };
  }
}
