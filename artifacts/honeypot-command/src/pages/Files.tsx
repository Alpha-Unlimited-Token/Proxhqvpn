// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { useListHoneypotFiles } from "@/hooks/useApi";
import { Bug, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Files() {
  const [page, setPage] = useState(0);
  const limit = 30;
  const { data, isLoading } = useListHoneypotFiles({ limit, offset: page * limit });
  const files = data?.files ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Bug className="w-5 h-5 text-destructive" />
        <h1 className="text-lg font-bold font-mono">Captured Payloads</h1>
        {total > 0 && (
          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{total} total</span>
        )}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm font-mono animate-pulse">Loading payloads...</div>
      ) : files.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg py-16 flex flex-col items-center gap-2">
          <Bug className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground font-mono">No payloads captured yet.</p>
          <p className="text-xs text-muted-foreground/60">Cowrie automatically captures file downloads.</p>
        </div>
      ) : (
        <>
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="bg-muted/30 border-b border-border text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-normal">FILENAME</th>
                    <th className="px-4 py-2.5 text-left font-normal">SHA256</th>
                    <th className="px-4 py-2.5 text-left font-normal">SIZE</th>
                    <th className="px-4 py-2.5 text-left font-normal">TYPE</th>
                    <th className="px-4 py-2.5 text-left font-normal">MALWARE</th>
                    <th className="px-4 py-2.5 text-left font-normal">VT SCORE</th>
                    <th className="px-4 py-2.5 text-left font-normal">CAPTURED</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f: any) => (
                    <tr key={f.id} className={cn("border-b border-border/50 hover:bg-muted/20", f.isMalware && "bg-destructive/5")}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {f.isMalware && <AlertTriangle className="w-3 h-3 text-destructive flex-shrink-0" />}
                          <span className={cn("font-medium", f.isMalware ? "text-destructive" : "text-foreground")}>
                            {f.filename}
                          </span>
                        </div>
                        {f.url && (
                          <div className="text-muted-foreground text-[10px] truncate max-w-[200px] mt-0.5">{f.url}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {f.sha256 ? `${f.sha256.substring(0, 16)}...` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-foreground">{formatSize(f.size)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{f.mimeType ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {f.malwareFamily ? (
                          <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 text-[10px]">
                            {f.malwareFamily}
                          </span>
                        ) : f.isMalware ? (
                          <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 text-[10px]">
                            MALWARE
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {f.virusTotalScore != null ? (
                          <span className={cn("font-bold", f.virusTotalScore > 10 ? "text-destructive" : f.virusTotalScore > 0 ? "text-yellow-400" : "text-primary")}>
                            {f.virusTotalScore}/70
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {new Date(f.capturedAt).toLocaleString()}
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
