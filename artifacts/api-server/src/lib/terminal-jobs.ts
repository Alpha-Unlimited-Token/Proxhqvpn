// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { exec } from "child_process";
import { promisify } from "util";
import {
  truncateTerminalOutput,
  TERMINAL_OUTPUT_LIMIT,
  TERMINAL_STDERR_LIMIT,
} from "./terminal-policy";
import { auditTerminalEvent } from "./terminal-audit";

const execAsync = promisify(exec);

export type TerminalJobStatus = "queued" | "running" | "completed" | "failed";

export type TerminalJob = {
  id: string;
  ownerUserId: string;
  command: string;
  ghostMode: boolean;
  timeout: number;
  status: TerminalJobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  stdout: string;
  stderr: string;
  exitCode?: number;
  error?: string;
};

const jobs = new Map<string, TerminalJob>();

function runSpawn(command: string, timeoutMs: number) {
  return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
    const parts = command.trim().match(/\S+/g) ?? [];
    const [file, ...args] = parts;

    if (!file) {
      resolve({ stdout: "", stderr: "Empty command", exitCode: 1 });
      return;
    }

    const child = spawn(file, args, {
      shell: false,
      timeout: timeoutMs,
      env: { ...process.env, HOME: process.env.HOME ?? "/tmp" },
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = truncateTerminalOutput(stdout + chunk.toString(), TERMINAL_OUTPUT_LIMIT);
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = truncateTerminalOutput(stderr + chunk.toString(), TERMINAL_STDERR_LIMIT);
    });

    child.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });

    child.on("error", (err) => {
      resolve({ stdout: "", stderr: err.message, exitCode: 1 });
    });
  });
}

export function createTerminalJob(input: {
  ownerUserId: string;
  command: string;
  ghostMode: boolean;
  timeout: number;
}): TerminalJob {
  const job: TerminalJob = {
    id: randomUUID(),
    ownerUserId: input.ownerUserId,
    command: input.command,
    ghostMode: input.ghostMode,
    timeout: input.timeout,
    status: "queued",
    createdAt: new Date().toISOString(),
    stdout: "",
    stderr: "",
  };

  jobs.set(job.id, job);
  void runTerminalJob(job.id);

  return job;
}

export function getTerminalJob(ownerUserId: string, jobId: string): TerminalJob | null {
  const job = jobs.get(jobId);
  if (!job || job.ownerUserId !== ownerUserId) return null;
  return job;
}

export function listTerminalJobs(ownerUserId: string): TerminalJob[] {
  return [...jobs.values()]
    .filter((job) => job.ownerUserId === ownerUserId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
}

async function runTerminalJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = "running";
  job.startedAt = new Date().toISOString();

  try {
    const result = job.ghostMode
      ? await execAsync(job.command, {
          timeout: job.timeout,
          maxBuffer: TERMINAL_OUTPUT_LIMIT,
          shell: "/bin/bash",
          env: { ...process.env, HOME: process.env.HOME ?? "/tmp" },
        }).then(
          ({ stdout, stderr }) => ({
            stdout,
            stderr,
            exitCode: 0,
          }),
          (err: any) => ({
            stdout: err.stdout ?? "",
            stderr: err.stderr ?? err.message ?? "Command failed",
            exitCode: typeof err.code === "number" ? err.code : 1,
          }),
        )
      : await runSpawn(job.command, job.timeout);

    job.stdout = truncateTerminalOutput(result.stdout, TERMINAL_OUTPUT_LIMIT);
    job.stderr = truncateTerminalOutput(result.stderr, TERMINAL_STDERR_LIMIT);
    job.exitCode = result.exitCode;
    job.status = result.exitCode === 0 ? "completed" : "failed";
    job.completedAt = new Date().toISOString();

    await auditTerminalEvent({
      actor: job.ownerUserId,
      action: job.ghostMode ? "terminal.ghost_job_completed" : "terminal.job_completed",
      result: result.exitCode === 0 ? "allow" : "error",
      command: job.command,
      metadata: {
        jobId: job.id,
        exitCode: result.exitCode,
      },
    });
  } catch (err: any) {
    job.status = "failed";
    job.error = err?.message ?? "Terminal job failed";
    job.completedAt = new Date().toISOString();

    await auditTerminalEvent({
      actor: job.ownerUserId,
      action: "terminal.job_failed",
      result: "error",
      command: job.command,
      metadata: {
        jobId: job.id,
        error: job.error,
      },
    });
  }
}

setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;

  for (const [jobId, job] of jobs.entries()) {
    const completedAt = job.completedAt ? Date.parse(job.completedAt) : null;
    const createdAt = Date.parse(job.createdAt);

    if ((completedAt ?? createdAt) < cutoff) {
      jobs.delete(jobId);
    }
  }
}, 10 * 60 * 1000);
