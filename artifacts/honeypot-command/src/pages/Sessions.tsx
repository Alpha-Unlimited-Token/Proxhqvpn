// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { useListHoneypotSessions } from "@/hooks/useApi";
import { Terminal, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const OUTCOME_COLORS: Record<string, string> = {
  captured: "bg-primary/10 text-primary border-primary/20",
  login_failed: "bg-destructive/10 text-destructive border-destructive/20",
  session_end: "bg-muted text-muted-foreground border-border",
};

export default function Sessions() {
  const [page, setPage] = useState(0);
  const limit = 30;
  const { data, isLoading } = useListHoneypotSessions({ limit, offset: page * limit });
  const sessions = data?.sessions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Terminal className="w-5 h-5 text-accent" />
        <h1 className="text-lg font-bold font-mono">Attack Sessions</h1>
        {total > 0 && (
          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{total} total</span>
        )}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm font-mono animate-pulse">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg py-16 flex flex-col items-center gap-2">
          <Terminal className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground font-mono">No sessions captured yet.</p>
        </div>
      ) : (
        <>
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="bg-muted/30 border-b border-border text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-normal">ID</th>
                    <th className="px-4 py-2.5 text-left font-normal">ATTACKER IP</th>
                    <th className="px-4 py-2.5 text-left font-normal">PROTO</th>
                    <th className="px-4 py-2.5 text-left font-normal">USERNAME</th>
                    <th className="px-4 py-2.5 text-left font-normal">PASSWORD</th>
                    <th className="px-4 py-2.5 text-left font-normal">CLIENT</th>
                    <th className="px-4 py-2.5 text-left font-normal">CMDS</th>
                    <th className="px-4 py-2.5 text-left font-normal">OUTCOME</th>
                    <th className="px-4 py-2.5 text-left font-normal">STARTED</th>
                    <th className="px-4 py-2.5 text-left font-normal">DURATION</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s: any) => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-2.5 text-muted-foreground">#{s.id}</td>
                      <td className="px-4 py-2.5 text-primary font-bold">
                        {s.attacker?.ipAddress ?? "—"}
                        {s.attacker?.country && (
                          <span className="ml-1 text-muted-foreground font-normal">({s.attacker.country})</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-accent">{s.protocol?.toUpperCase()}</td>
                      <td className="px-4 py-2.5 text-foreground">{s.username ?? "—"}</td>
                      <td className="px-4 py-2.5 text-foreground">{s.password ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[120px]">{s.clientVersion ?? "—"}</td>
                      <td className="px-4 py-2.5 text-primary">{s.commandCount}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn("px-1.5 py-0.5 rounded border text-[10px]", OUTCOME_COLORS[s.outcome] ?? "bg-muted text-muted-foreground border-border")}>
                          {s.outcome}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {new Date(s.startedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {s.duration != null ? `${s.duration}s` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>Page {page + 1} of {totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="p-1.5 border border-border rounded hover:bg-muted disabled:opacity-40">
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="p-1.5 border border-border rounded hover:bg-muted disabled:opacity-40">
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
