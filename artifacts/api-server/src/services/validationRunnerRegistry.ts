// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Maps run_type strings to runner functions.
import type { ValidationTarget } from "./validationTargetService";
import { runUptimeCheck } from "../validation-runners/uptimeRunner";
import { runTlsCheck } from "../validation-runners/tlsRunner";
import { runSecurityHeadersCheck } from "../validation-runners/securityHeadersRunner";
import { runWireguardValidation } from "../validation-runners/wireguardValidationRunner";
import { runSyntheticJourney } from "../validation-runners/syntheticJourneyRunner";
import { runZapScan } from "../validation-runners/zapRunner";
import { runTrivyScan } from "../validation-runners/trivyRunner";
import { runSemgrepScan } from "../validation-runners/semgrepRunner";
import { runK6Test } from "../validation-runners/k6Runner";
import { runDependencyScan } from "../validation-runners/dependencyRunner";

export interface RunnerOutput {
  status: "passed" | "failed" | "warning" | "error";
  score: number;
  maxScore: number;
  message: string;
  toolName: string;
  toolVersion: string;
  rawOutput: Record<string, unknown>;
  findings?: Array<{ title: string; severity: string; [k: string]: unknown }>;
}

export type RunType =
  | "zap" | "trivy" | "semgrep" | "dependency"
  | "tls" | "headers" | "uptime"
  | "wireguard" | "node_health"
  | "k6" | "synthetic" | "custom";

type RunnerFn = (target: ValidationTarget) => Promise<RunnerOutput>;

const REGISTRY: Partial<Record<RunType, RunnerFn>> = {
  uptime:     runUptimeCheck,
  tls:        runTlsCheck,
  headers:    runSecurityHeadersCheck,
  wireguard:  runWireguardValidation,
  node_health: runWireguardValidation,
  synthetic:  runSyntheticJourney,
  zap:        runZapScan,
  trivy:      runTrivyScan,
  semgrep:    runSemgrepScan,
  dependency: runDependencyScan,
  k6:         runK6Test,
};

export function getRunner(runType: string): RunnerFn {
  const runner = REGISTRY[runType as RunType];
  if (!runner) {
    return async () => ({
      status:      "error" as const,
      score:       0,
      maxScore:    100,
      message:     `No runner registered for run_type="${runType}"`,
      toolName:    "unknown",
      toolVersion: "n/a",
      rawOutput:   { runType },
      findings:    [],
    });
  }
  return runner;
}

export function listSupportedRunTypes(): RunType[] {
  return Object.keys(REGISTRY) as RunType[];
}
