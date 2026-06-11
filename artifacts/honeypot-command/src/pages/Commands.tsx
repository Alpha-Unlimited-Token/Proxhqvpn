// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { useListHoneypotCommands } from "@/hooks/useApi";
import { FileCode2, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Commands() {
  const [page, setPage] = useState(0);
  const limit = 50;
  const { data, isLoading } = useListHoneypotCommands({ limit, offset: page * limit });
  const commands = data?.commands ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <FileCode2 className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold font-mono">Captured Commands</h1>
        {total > 0 && (
          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{total} total</span>
        )}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm font-mono animate-pulse">Loading commands...</div>
      ) : commands.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg py-16 flex flex-col items-center gap-2">
          <FileCode2 className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground font-mono">No commands captured yet.</p>
        </div>
      ) : (
        <>
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="bg-muted/30 border-b border-border text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-normal w-8">#</th>
                    <th className="px-4 py-2.5 text-left font-normal">COMMAND</th>
                    <th className="px-4 py-2.5 text-left font-normal">MITRE</th>
                    <th className="px-4 py-2.5 text-left font-normal">MALWARE</th>
                    <th className="px-4 py-2.5 text-left font-normal">CAPTURED</th>
                  </tr>
                </thead>
                <tbody>
                  {commands.map((c: any) => (
                    <tr key={c.id} className={cn("border-b border-border/50 hover:bg-muted/20", c.isMalicious && "bg-destructive/5")}>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.id}</td>
                      <td className="px-4 py-2.5 max-w-xs">
                        <div className="flex items-start gap-1.5">
                          {c.isMalicious && <AlertTriangle className="w-3 h-3 text-destructive flex-shrink-0 mt-0.5" />}
                          <code className={cn("truncate block", c.isMalicious ? "text-destructive" : "text-foreground")}>
                            {c.command}
                          </code>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {c.mitreTechnique ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.malwareFamily ? (
                          <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 text-[10px]">
                            {c.malwareFamily}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {new Date(c.capturedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>Page {page + 1} of {totalPages} ({total} commands)</span>
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
