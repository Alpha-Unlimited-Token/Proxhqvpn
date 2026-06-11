// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { Calendar, Clock, Play, AlertTriangle, Loader2, Terminal, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const API = "/api/tool-runner";

interface ToolDef {
  id: string;
  name: string;
  category: string;
  installed: boolean;
}

interface ScheduledJob {
  id: string;
  toolId: string;
  toolName: string;
  target: string | null;
  status: string;
  createdAt: string;
  startedAt: string;
}

export default function ScanScheduler() {
  const [tools, setTools]         = useState<ToolDef[]>([]);
  const [jobs, setJobs]           = useState<ScheduledJob[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [runNow, setRunNow]       = useState(false);
  const [selectedTool, setSelectedTool] = useState("");
  const [target, setTarget]       = useState("");
  const [launching, setLaunching] = useState(false);
  const [result, setResult]       = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [tr, jr] = await Promise.all([
        fetch(`${API}/tools`, { credentials: "include" }),
        fetch(`${API}/history?limit=10`, { credentials: "include" }),
      ]);
      if (tr.ok) setTools(await tr.json());
      if (jr.ok) setJobs(await jr.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function launchScan() {
    if (!selectedTool) return;
    const tool = tools.find(t => t.id === selectedTool);
    if (!tool) return;
    setLaunching(true); setResult(null); setError(null);
    try {
      const r = await fetch(`${API}/run`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId: selectedTool, opts: target ? { target, url: target, domain: target } : {} }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.status === "pending_approval") {
          setResult(`Approval requested (ID: ${data.approvalId}). An admin must approve this scan before it runs.`);
        } else {
          throw new Error(data.error ?? "Failed to start scan");
        }
      } else {
        setResult(`Scan started — Job ID: ${data.jobId}. View live output in the Parrot Tool Runner.`);
        setTimeout(load, 2000);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLaunching(false);
    }
  }

  const STATUS_COLORS: Record<string, string> = {
    running:   "text-blue-400 border-blue-500/30",
    completed: "text-[#00ff88] border-[#00ff88]/30",
    failed:    "text-red-400 border-red-500/30",
  };

  return (
    <div className="p-4 md:p-6 space-y-5 font-mono min-h-screen">
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <Calendar className="w-5 h-5 text-[#00ff88]" />
        <h1 className="text-lg font-bold text-primary tracking-tight">Scan Scheduler</h1>
        <Badge className="text-[9px] border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88] font-mono uppercase tracking-widest px-1.5">
          {jobs.length} recent runs
        </Badge>
      </div>
      <p className="text-xs text-primary/40 max-w-xl leading-relaxed -mt-3">
        Launch immediate scans or schedule recurring tool runs. High-risk tools require admin approval before execution.
      </p>

      {error && (
        <div className="border border-red-500/30 bg-red-900/10 text-red-400 text-xs p-3 rounded-sm flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}
      {result && (
        <div className="border border-[#00ff88]/30 bg-[#00ff88]/5 text-[#00ff88] text-xs p-3 rounded-sm flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 shrink-0" />{result}
        </div>
      )}

      {/* Quick Launch */}
      <div className="border border-primary/10 rounded-sm p-4 bg-black/20 space-y-3">
        <div className="text-[10px] text-primary/30 uppercase tracking-widest font-mono">Quick Launch</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="block text-[10px] text-primary/50 mb-1 font-mono uppercase tracking-wide">Tool</label>
            <select value={selectedTool} onChange={e => setSelectedTool(e.target.value)}
              className="w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-[#00ff88]/40 rounded-sm">
              <option value="">Select tool…</option>
              {tools.filter(t => t.installed).map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] text-primary/50 mb-1 font-mono uppercase tracking-wide">Target (optional)</label>
            <input value={target} onChange={e => setTarget(e.target.value)}
              placeholder="https://example.com or 203.0.113.1 (must be in scope)"
              className="w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm" />
          </div>
        </div>
        <button onClick={launchScan} disabled={!selectedTool || launching}
          className="flex items-center gap-1.5 bg-[#00ff88] text-black hover:bg-[#00ff88]/80 font-mono text-xs px-4 py-2 font-bold disabled:opacity-40 transition-colors rounded-sm">
          {launching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {launching ? "Launching..." : "Launch Scan"}
        </button>
      </div>

      {/* Recurring Schedule Info */}
      <div className="border border-primary/10 rounded-sm p-4 bg-black/10">
        <div className="text-[10px] text-primary/30 uppercase tracking-widest font-mono mb-3">Recurring Schedules</div>
        <div className="space-y-2">
          {[
            { name: "Daily DNS Check",    tool: "dig",        freq: "Daily at 00:00 UTC",   status: "active" },
            { name: "Weekly Port Scan",   tool: "nmap",       freq: "Monday 02:00 UTC",      status: "active" },
            { name: "HTTPS Cert Check",   tool: "openssl",    freq: "Every 6 hours",         status: "paused" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3 border border-primary/8 rounded-sm p-2.5 text-[11px]">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.status === "active" ? "bg-[#00ff88]" : "bg-primary/20"}`} />
              <span className="font-bold text-primary font-mono flex-1">{s.name}</span>
              <span className="text-primary/40 font-mono">{s.tool}</span>
              <div className="flex items-center gap-1 text-primary/30">
                <Clock className="w-3 h-3" />
                <span>{s.freq}</span>
              </div>
              <span className={`text-[9px] border px-1.5 py-px font-mono uppercase ${s.status === "active" ? "text-[#00ff88] border-[#00ff88]/30" : "text-primary/30 border-primary/15"}`}>
                {s.status}
              </span>
            </div>
          ))}
          <div className="text-[10px] text-primary/20 mt-2 flex items-center gap-1.5">
            <Shield className="w-3 h-3" />
            Recurring schedules require admin configuration. Contact your admin to set up automated scan schedules.
          </div>
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="border border-primary/10 rounded-sm p-4">
        <div className="text-[10px] text-primary/30 uppercase tracking-widest font-mono mb-3">Recent Runs</div>
        {loading ? (
          <div className="flex items-center gap-2 text-primary/40 text-xs py-4 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-xs text-primary/25 text-center py-6">No recent runs</div>
        ) : (
          <div className="space-y-1.5">
            {jobs.map(job => (
              <div key={job.id} className="flex items-center gap-3 border border-primary/8 rounded-sm p-2 text-[11px]">
                <span className={`text-[9px] border px-1.5 py-px font-mono uppercase ${STATUS_COLORS[job.status] ?? "border-primary/20 text-primary/40"}`}>
                  {job.status}
                </span>
                <span className="font-bold text-primary font-mono">{job.toolName}</span>
                {job.target && <span className="text-primary/40 font-mono truncate max-w-[200px] hidden sm:block">{job.target}</span>}
                <span className="text-primary/25 font-mono ml-auto whitespace-nowrap">
                  {new Date(job.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
