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
import {
  completeTerminalJob as dbCompleteTerminalJob,
  failTerminalJob as dbFailTerminalJob,
  getTerminalJobByOwner,
  insertTerminalJob,
  listTerminalJobsByOwner,
  markTerminalJobRunning,
} from "../repositories/terminalJobsRepository";

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

export type SshExecRunner = (
  command: string,
  timeout: number,
) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

export function createSshTerminalJob(input: {
  ownerUserId: string;
  command: string;
  timeout: number;
  sessionId: string;
  host: string;
  username: string;
  run: SshExecRunner;
}): TerminalJob {
  const job: TerminalJob = {
    id: randomUUID(),
    ownerUserId: input.ownerUserId,
    command: input.command,
    ghostMode: false,
    timeout: input.timeout,
    status: "queued",
    createdAt: new Date().toISOString(),
    stdout: "",
    stderr: "",
  };

  jobs.set(job.id, job);

  void runSshTerminalJob(job.id, {
    sessionId: input.sessionId,
    host: input.host,
    username: input.username,
    run: input.run,
  });

  return job;
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
  void insertTerminalJob({
    id: job.id,
    ownerUserId: job.ownerUserId,
    command: job.command,
    ghostMode: job.ghostMode,
    timeout: job.timeout,
  }).then(() => runTerminalJob(job.id));

  return job;
}

export async function getTerminalJob(ownerUserId: string, jobId: string) {
  const memoryJob = jobs.get(jobId);
  if (memoryJob && memoryJob.ownerUserId === ownerUserId) return memoryJob;
  return getTerminalJobByOwner(ownerUserId, jobId);
}

export async function listTerminalJobs(ownerUserId: string) {
  return listTerminalJobsByOwner(ownerUserId);
}

async function runTerminalJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = "running";
  job.startedAt = new Date().toISOString();
  await markTerminalJobRunning(job.id);

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

    await dbCompleteTerminalJob({
      jobId: job.id,
      stdout: job.stdout,
      stderr: job.stderr,
      exitCode: job.exitCode ?? 1,
    });

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

    await dbFailTerminalJob({
      jobId: job.id,
      error: job.error ?? "Terminal job failed",
    });

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

async function runSshTerminalJob(
  jobId: string,
  input: {
    sessionId: string;
    host: string;
    username: string;
    run: SshExecRunner;
  },
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = "running";
  job.startedAt = new Date().toISOString();

  try {
    const result = await input.run(job.command, job.timeout);

    job.stdout = truncateTerminalOutput(result.stdout, TERMINAL_OUTPUT_LIMIT);
    job.stderr = truncateTerminalOutput(result.stderr, TERMINAL_STDERR_LIMIT);
    job.exitCode = result.exitCode;
    job.status = result.exitCode === 0 ? "completed" : "failed";
    job.completedAt = new Date().toISOString();

    await auditTerminalEvent({
      actor: job.ownerUserId,
      action: "terminal.ssh_job_completed",
      result: result.exitCode === 0 ? "allow" : "error",
      command: job.command,
      metadata: {
        jobId: job.id,
        sessionId: input.sessionId,
        host: input.host,
        username: input.username,
        exitCode: result.exitCode,
      },
    });
  } catch (err: any) {
    job.status = "failed";
    job.error = err?.message ?? "SSH terminal job failed";
    job.completedAt = new Date().toISOString();

    await auditTerminalEvent({
      actor: job.ownerUserId,
      action: "terminal.ssh_job_failed",
      result: "error",
      command: job.command,
      metadata: {
        jobId: job.id,
        sessionId: input.sessionId,
        host: input.host,
        username: input.username,
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
