// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useEffect, useRef, useState } from "react";
import {
  getTerminalJob,
  isTerminalJobDone,
  type TerminalJob,
} from "@/lib/terminalJobsClient";

export function useTerminalJobPolling(input: {
  jobId: string | null;
  enabled: boolean;
  intervalMs?: number;
}) {
  const { jobId, enabled, intervalMs = 1000 } = input;

  const [job, setJob] = useState<TerminalJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!jobId || !enabled) return;

    let cancelled = false;

    async function poll() {
      if (!jobId || cancelled) return;

      try {
        const nextJob = await getTerminalJob(jobId);

        if (cancelled) return;

        setJob(nextJob);
        setError(null);

        if (!isTerminalJobDone(nextJob)) {
          timerRef.current = window.setTimeout(poll, intervalMs);
        }
      } catch (err: any) {
        if (cancelled) return;

        setError(err?.message || "Failed to poll terminal job");
        timerRef.current = window.setTimeout(poll, intervalMs * 2);
      }
    }

    void poll();

    return () => {
      cancelled = true;

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [jobId, enabled, intervalMs]);

  return {
    job,
    error,
    isRunning: !!job && !isTerminalJobDone(job),
    isDone: !!job && isTerminalJobDone(job),
  };
}
