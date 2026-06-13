// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

export type TerminalExecResponse =
  | {
      jobId: string;
      status: TerminalJobStatus;
      createdAt: string;
      pollUrl: string;
    }
  | {
      command: string;
      stdout: string;
      stderr: string;
      exitCode: number;
      executedAt?: string;
      ghostMode?: boolean;
      blocked?: boolean;
    };

export async function createTerminalJob(input: {
  command: string;
  ghostMode: boolean;
  timeout?: number;
  breakGlassToken?: string;
}): Promise<TerminalExecResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (input.breakGlassToken) {
    headers["X-Break-Glass-Token"] = input.breakGlassToken;
  }

  const res = await fetch(`${BASE}/api/terminal/exec`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({
      command: input.command,
      ghostMode: input.ghostMode,
      timeout: input.timeout ?? 15000,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || data?.stderr || `Terminal request failed: HTTP ${res.status}`);
  }

  return data as TerminalExecResponse;
}

export async function getTerminalJob(jobId: string): Promise<TerminalJob> {
  const res = await fetch(`${BASE}/api/terminal/jobs/${encodeURIComponent(jobId)}`, {
    credentials: "include",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || `Terminal job fetch failed: HTTP ${res.status}`);
  }

  return data.job as TerminalJob;
}

export async function listTerminalJobs(): Promise<TerminalJob[]> {
  const res = await fetch(`${BASE}/api/terminal/jobs`, {
    credentials: "include",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || `Terminal jobs fetch failed: HTTP ${res.status}`);
  }

  return Array.isArray(data.jobs) ? data.jobs : [];
}

export function isQueuedExecResponse(
  response: TerminalExecResponse,
): response is Extract<TerminalExecResponse, { jobId: string }> {
  return "jobId" in response;
}

export function isTerminalJobDone(job: TerminalJob): boolean {
  return job.status === "completed" || job.status === "failed";
}
