// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useMemo } from "react";

export type SecurityEventLine = {
  id: string;
  timestamp?: string;
  severity?: "info" | "success" | "warn" | "critical" | "error";
  message: string;
  source?: string;
};

function severityClass(severity?: string) {
  if (severity === "critical" || severity === "error") return "text-red-300";
  if (severity === "warn") return "text-yellow-300";
  if (severity === "success") return "text-primary";
  return "text-sky-300";
}

export function EventTerminal({
  events,
  loading,
  error,
}: {
  events: SecurityEventLine[];
  loading?: boolean;
  error?: string | null;
}) {
  const visible = useMemo(() => events.slice(-100), [events]);

  return (
    <section className="rounded-2xl border border-primary/20 bg-black/70 p-4 shadow-inner shadow-primary/10">
      <div className="mb-3 flex items-center justify-between border-b border-primary/20 pb-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-primary/80">Live Event Stream</h2>
        <span className="text-[10px] uppercase text-white/35">Real telemetry</span>
      </div>

      <div className="h-[360px] overflow-y-auto font-mono text-xs leading-5">
        {loading && <div className="text-white/45">Connecting to live event stream...</div>}
        {error && <div className="text-red-300">{error}</div>}
        {!loading && !error && visible.length === 0 && (
          <div className="text-white/45">No security events received yet.</div>
        )}
        {visible.map((event) => (
          <div key={event.id} className="whitespace-pre-wrap break-words">
            <span className="text-white/35">[{event.timestamp ?? new Date().toISOString()}]</span>{" "}
            <span className={severityClass(event.severity)}>{event.severity ?? "info"}</span>{" "}
            {event.source && <span className="text-white/40">{event.source} </span>}
            {event.message}
          </div>
        ))}
      </div>
    </section>
  );
}
