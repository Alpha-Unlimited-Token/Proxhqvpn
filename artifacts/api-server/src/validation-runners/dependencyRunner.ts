// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Dependency vulnerability runner — npm audit against local workspace.
import { exec as execCb } from "child_process";
import { promisify } from "util";
import type { ValidationTarget } from "../services/validationTargetService";

const exec = promisify(execCb);

export interface DependencyRunnerResult {
  status: "passed" | "failed" | "warning" | "error";
  score: number;
  maxScore: number;
  message: string;
  toolName: string;
  toolVersion: string;
  rawOutput: Record<string, unknown>;
  findings: Array<{ title: string; severity: string; pkg?: string; via?: string }>;
}

export async function runDependencyScan(_target: ValidationTarget): Promise<DependencyRunnerResult> {
  const workspaceRoot = process.env.WORKSPACE_ROOT ?? "/home/runner/workspace";

  try {
    const { stdout } = await exec(`pnpm audit --json 2>/dev/null || npm audit --json 2>/dev/null`, {
      timeout: 60_000,
      cwd: workspaceRoot,
    });

    const parsed = JSON.parse(stdout);
    // pnpm audit format
    const vulns: Record<string, unknown> = parsed.vulnerabilities ?? parsed.advisories ?? {};
    const findings: DependencyRunnerResult["findings"] = Object.values(vulns).map((v: any) => ({
      title:    v.title ?? v.name ?? "Dependency vulnerability",
      severity: (v.severity ?? "unknown").toLowerCase(),
      pkg:      v.name ?? v.module_name,
      via:      Array.isArray(v.via) ? v.via.filter((x: unknown) => typeof x === "string").join(", ") : undefined,
    }));

    const critical = findings.filter(f => f.severity === "critical").length;
    const high     = findings.filter(f => f.severity === "high").length;
    const score    = critical > 0 ? 0 : high > 0 ? 40 : findings.length > 0 ? 70 : 100;

    return {
      status:      score === 100 ? "passed" : critical > 0 ? "failed" : "warning",
      score,
      maxScore:    100,
      message:     `Dependency audit: ${findings.length} vulnerabilities (${critical} critical, ${high} high)`,
      toolName:    "pnpm-audit",
      toolVersion: "workspace",
      rawOutput:   { workspaceRoot, total: findings.length },
      findings,
    };
  } catch (err: any) {
    return { status: "error", score: 0, maxScore: 100, message: `Dependency audit error: ${err.message}`, toolName: "pnpm-audit", toolVersion: "workspace", rawOutput: { error: err.message }, findings: [] };
  }
}
