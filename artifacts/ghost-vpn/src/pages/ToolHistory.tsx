// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { History, Download, Eye, ChevronDown, ChevronUp, Terminal, Globe, CheckCircle2, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const API = "/api/tool-runner";

interface ToolJob {
  id: string;
  toolId: string;
  toolName: string;
  category: string;
  target: string | null;
  status: string;
  exitCode: number | null;
  outputText: string | null;
  geoJson: Record<string, unknown> | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  running:   "border-blue-500/40 text-blue-400 bg-blue-900/10",
  completed: "border-[#00ff88]/40 text-[#00ff88] bg-[#00ff88]/5",
  failed:    "border-red-500/40 text-red-400 bg-red-900/10",
};

export default function ToolHistory() {
  const [jobs, setJobs]       = useState<ToolJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage]       = useState(0);
  const LIMIT = 20;

  async function loadJobs(offset = 0) {
    setLoading(true);
    try {
      const r = await fetch(`${API}/history?limit=${LIMIT}&offset=${offset}`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setJobs(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadJobs(page * LIMIT); }, [page]);

  async function downloadEvidence(jobId: string) {
    const r = await fetch(`${API}/evidence/${jobId}`, { method: "POST", credentials: "include" });
    if (!r.ok) return;
    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `evidence-${jobId.substring(0,8)}.zip`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 md:p-6 space-y-5 font-mono min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <History className="w-5 h-5 text-[#00ff88]" />
            <h1 className="text-lg font-bold text-primary tracking-tight">Scan History</h1>
            <Badge className="text-[9px] border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88] font-mono uppercase tracking-widest px-1.5">
              {jobs.length} jobs
            </Badge>
          </div>
          <p className="text-xs text-primary/40 max-w-xl leading-relaxed">
            Persisted log of all tool runs — output, GeoIP data, exit codes, and evidence export.
          </p>
        </div>
        <Button onClick={() => loadJobs(page * LIMIT)} variant="outline"
          className="border-primary/20 text-primary/60 hover:text-primary font-mono text-xs h-8 px-3">
          Refresh
        </Button>
      </div>

      {error && (
        <div className="border border-red-500/30 bg-red-900/10 text-red-400 text-xs p-3 rounded-sm flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-primary/40 text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading history...
        </div>
      ) : jobs.length === 0 ? (
        <div className="border border-primary/10 rounded-sm p-12 text-center">
          <Terminal className="w-10 h-10 text-primary/10 mx-auto mb-3" />
          <div className="text-sm text-primary/25">No scan history yet</div>
          <div className="text-xs text-primary/15 mt-1">Run tools from the Parrot Tool Runner to build history</div>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => {
            const isExpanded = expanded === job.id;
            const dur = job.completedAt && job.startedAt
              ? Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)
              : null;
            return (
              <div key={job.id} className="border border-primary/10 rounded-sm overflow-hidden">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-primary/3 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : job.id)}
                >
                  <span className={`text-[9px] border px-1.5 py-px font-mono uppercase ${STATUS_COLORS[job.status] ?? "border-primary/20 text-primary/40"}`}>
                    {job.status}
                  </span>
                  <span className="text-xs font-bold text-primary font-mono flex-1 min-w-0 truncate">{job.toolName}</span>
                  {job.target && (
                    <span className="text-[10px] text-primary/40 font-mono hidden sm:block truncate max-w-[200px]">{job.target}</span>
                  )}
                  {job.geoJson && (
                    <span className="flex items-center gap-1 text-[9px] text-cyan-400 border border-cyan-500/20 px-1.5 py-px">
                      <Globe className="w-2.5 h-2.5" />{String(job.geoJson.country ?? "")}
                    </span>
                  )}
                  {dur !== null && <span className="text-[10px] text-primary/30 font-mono">{dur}s</span>}
                  {job.exitCode !== null && (
                    <span className={`text-[9px] font-mono ${job.exitCode === 0 ? "text-[#00ff88]" : "text-red-400"}`}>
                      exit {job.exitCode}
                    </span>
                  )}
                  <span className="text-[10px] text-primary/25 font-mono whitespace-nowrap">
                    {new Date(job.createdAt).toLocaleString()}
                  </span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-primary/40 shrink-0" />
                              : <ChevronDown className="w-3.5 h-3.5 text-primary/40 shrink-0" />}
                </div>

                {isExpanded && (
                  <div className="border-t border-primary/10">
                    <div className="flex items-center justify-between px-3 py-2 bg-black/20">
                      <div className="flex items-center gap-3 flex-wrap text-[10px] text-primary/40 font-mono">
                        <span>ID: {job.id.substring(0,8)}…</span>
                        <span>Category: {job.category}</span>
                        {job.geoJson && <span>Geo: {JSON.stringify(job.geoJson)}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => downloadEvidence(job.id)}
                          className="flex items-center gap-1 text-[10px] border border-primary/20 text-primary/50 hover:text-primary hover:border-primary/40 px-2 py-1 rounded-sm transition-colors">
                          <Download className="w-3 h-3" /> Evidence ZIP
                        </button>
                      </div>
                    </div>
                    {job.outputText ? (
                      <div className="bg-black/80 p-3 max-h-[400px] overflow-y-auto text-[11px] font-mono leading-relaxed whitespace-pre-wrap text-[#00ff88]/80 select-text">
                        {job.outputText.substring(0, 50_000)}
                        {job.outputText.length > 50_000 && "\n\n[... truncated — download evidence ZIP for full output ...]"}
                      </div>
                    ) : (
                      <div className="p-4 text-xs text-primary/25 text-center">No output stored</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <div className="flex items-center gap-2 justify-center pt-2">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="text-xs border border-primary/20 text-primary/50 hover:text-primary px-3 py-1 rounded-sm disabled:opacity-30 transition-colors">
            ← Previous
          </button>
          <span className="text-[10px] text-primary/30 font-mono">Page {page + 1}</span>
          <button disabled={jobs.length < LIMIT} onClick={() => setPage(p => p + 1)}
            className="text-xs border border-primary/20 text-primary/50 hover:text-primary px-3 py-1 rounded-sm disabled:opacity-30 transition-colors">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
