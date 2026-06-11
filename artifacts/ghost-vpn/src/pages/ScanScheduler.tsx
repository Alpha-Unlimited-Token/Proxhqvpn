// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import {
  Calendar, Clock, Play, AlertTriangle, Loader2, Terminal,
  Plus, Trash2, Power, PowerOff, ChevronDown, ChevronUp, RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const API = "/api/tool-runner";

interface ToolDef { id: string; name: string; category: string; installed: boolean; }

interface Schedule {
  id: string;
  toolId: string;
  toolName: string;
  target: string | null;
  optsJson: Record<string, string> | null;
  cronExpr: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

interface ToolJob {
  id: string;
  toolId: string;
  toolName: string;
  target: string | null;
  status: string;
  exitCode: number | null;
  createdAt: string;
  completedAt: string | null;
}

const CRON_PRESETS = [
  { label: "Every hour",    value: "@hourly" },
  { label: "Every day at midnight", value: "@daily" },
  { label: "Every Monday",  value: "@weekly" },
  { label: "1st of month",  value: "@monthly" },
  { label: "Every 15 min",  value: "*/15 * * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Custom…",       value: "__custom__" },
];

function fmtDate(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

const STATUS_COLORS: Record<string, string> = {
  running:   "text-blue-400  border-blue-500/30",
  completed: "text-[#00ff88] border-[#00ff88]/30",
  failed:    "text-red-400   border-red-500/30",
  pending:   "text-yellow-400 border-yellow-500/30",
};

export default function ScanScheduler() {
  const [tools, setTools]         = useState<ToolDef[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [recentJobs, setRecentJobs] = useState<ToolJob[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [result, setResult]       = useState<string | null>(null);

  // Quick-launch state
  const [launchTool, setLaunchTool]   = useState("");
  const [launchTarget, setLaunchTarget] = useState("");
  const [launching, setLaunching]     = useState(false);

  // New schedule form state
  const [showNewForm, setShowNewForm]   = useState(false);
  const [newToolId, setNewToolId]       = useState("");
  const [newTarget, setNewTarget]       = useState("");
  const [newCronPreset, setNewCronPreset] = useState("@daily");
  const [newCronCustom, setNewCronCustom] = useState("");
  const [creating, setCreating]         = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [tr, sr, jr] = await Promise.all([
        fetch(`${API}/tools`,             { credentials: "include" }),
        fetch(`${API}/schedules`,         { credentials: "include" }),
        fetch(`${API}/history?limit=20`,  { credentials: "include" }),
      ]);
      if (tr.ok) setTools(await tr.json());
      if (sr.ok) setSchedules(await sr.json());
      if (jr.ok) setRecentJobs(await jr.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function launchScan() {
    if (!launchTool) return;
    const tool = tools.find(t => t.id === launchTool);
    if (!tool) return;
    setLaunching(true); setResult(null); setError(null);
    try {
      const r = await fetch(`${API}/run`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: launchTool,
          opts: launchTarget ? { target: launchTarget, url: launchTarget, domain: launchTarget } : {},
        }),
      });
      const data = await r.json();
      if (r.status === 202 && data.status === "pending_approval") {
        setResult(`Approval requested (ID: ${data.approvalId}). Admin must approve before execution.`);
      } else if (!r.ok) {
        throw new Error(data.error ?? "Failed to start scan");
      } else {
        setResult(`Scan launched — Job ID: ${data.jobId}. View live output in the Tool Runner.`);
        setTimeout(load, 2000);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLaunching(false);
    }
  }

  async function createSchedule() {
    if (!newToolId) return;
    const tool = tools.find(t => t.id === newToolId);
    if (!tool) return;
    const cronExpr = newCronPreset === "__custom__" ? newCronCustom.trim() : newCronPreset;
    if (!cronExpr) { setError("Cron expression is required."); return; }
    setCreating(true); setError(null);
    try {
      const opts: Record<string, string> = {};
      if (newTarget) { opts.target = newTarget; opts.url = newTarget; opts.domain = newTarget; }
      const r = await fetch(`${API}/schedules`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId: newToolId, opts, cronExpr }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to create schedule");
      setResult(`Schedule created for ${tool.name} (${cronExpr}).`);
      setShowNewForm(false);
      setNewToolId(""); setNewTarget(""); setNewCronPreset("@daily"); setNewCronCustom("");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function toggleSchedule(id: string, enabled: boolean) {
    try {
      const r = await fetch(`${API}/schedules/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, enabled } : s));
    } catch (e: any) { setError(e.message); }
  }

  async function deleteSchedule(id: string) {
    if (!confirm("Delete this schedule?")) return;
    try {
      const r = await fetch(`${API}/schedules/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch (e: any) { setError(e.message); }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 font-mono min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Calendar className="w-5 h-5 text-[#00ff88]" />
            <h1 className="text-lg font-bold text-primary tracking-tight">Scan Scheduler</h1>
            <Badge className="text-[9px] border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88] font-mono uppercase tracking-widest px-1.5">
              {schedules.filter(s => s.enabled).length} active
            </Badge>
          </div>
          <p className="text-xs text-primary/40 max-w-xl leading-relaxed">
            Launch immediate scans or create recurring scheduled runs. High-risk tools require admin approval.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs border border-primary/20 text-primary/50 hover:text-primary px-3 py-1.5 rounded-sm transition-colors">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

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
          <div>
            <label className="block text-[10px] text-primary/50 mb-1 font-mono uppercase tracking-wide">Tool</label>
            <select value={launchTool} onChange={e => setLaunchTool(e.target.value)}
              className="w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-[#00ff88]/40 rounded-sm">
              <option value="">Select tool…</option>
              {tools.filter(t => t.installed).map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] text-primary/50 mb-1 font-mono uppercase tracking-wide">Target (must be in scope)</label>
            <input value={launchTarget} onChange={e => setLaunchTarget(e.target.value)}
              placeholder="https://example.com or 203.0.113.1"
              className="w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm" />
          </div>
        </div>
        <button onClick={launchScan} disabled={!launchTool || launching}
          className="flex items-center gap-1.5 bg-[#00ff88] text-black hover:bg-[#00ff88]/80 font-mono text-xs px-4 py-2 font-bold disabled:opacity-40 transition-colors rounded-sm">
          {launching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {launching ? "Launching..." : "Launch Scan Now"}
        </button>
      </div>

      {/* Recurring Schedules */}
      <div className="border border-primary/10 rounded-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10 bg-black/20">
          <div className="text-[10px] text-primary/30 uppercase tracking-widest font-mono">
            Recurring Schedules ({schedules.length})
          </div>
          <button
            onClick={() => setShowNewForm(f => !f)}
            className="flex items-center gap-1.5 text-[10px] border border-[#00ff88]/30 text-[#00ff88] hover:bg-[#00ff88]/10 px-2.5 py-1 rounded-sm transition-colors"
          >
            {showNewForm ? <ChevronUp className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showNewForm ? "Cancel" : "New Schedule"}
          </button>
        </div>

        {/* New schedule form */}
        {showNewForm && (
          <div className="p-4 border-b border-primary/10 bg-black/30 space-y-3">
            <div className="text-[10px] text-primary/30 uppercase tracking-widest font-mono mb-2">New Recurring Schedule</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-primary/50 mb-1 font-mono uppercase">Tool</label>
                <select value={newToolId} onChange={e => setNewToolId(e.target.value)}
                  className="w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-[#00ff88]/40 rounded-sm">
                  <option value="">Select…</option>
                  {tools.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-primary/50 mb-1 font-mono uppercase">Frequency</label>
                <select value={newCronPreset} onChange={e => setNewCronPreset(e.target.value)}
                  className="w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-[#00ff88]/40 rounded-sm">
                  {CRON_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-primary/50 mb-1 font-mono uppercase">Target (optional)</label>
                <input value={newTarget} onChange={e => setNewTarget(e.target.value)}
                  placeholder="203.0.113.1 or example.com"
                  className="w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm" />
              </div>
            </div>
            {newCronPreset === "__custom__" && (
              <div>
                <label className="block text-[10px] text-primary/50 mb-1 font-mono uppercase">Custom Cron Expression</label>
                <input value={newCronCustom} onChange={e => setNewCronCustom(e.target.value)}
                  placeholder="0 3 * * 1  (3am every Monday)"
                  className="w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm" />
              </div>
            )}
            <button onClick={createSchedule} disabled={!newToolId || creating}
              className="flex items-center gap-1.5 bg-[#00ff88] text-black hover:bg-[#00ff88]/80 font-mono text-xs px-4 py-2 font-bold disabled:opacity-40 transition-colors rounded-sm">
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {creating ? "Creating..." : "Create Schedule"}
            </button>
          </div>
        )}

        {/* Schedule list */}
        {loading ? (
          <div className="flex items-center gap-2 text-primary/40 text-xs py-8 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading schedules...
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-xs text-primary/25 text-center py-8">
            No recurring schedules configured.
            <br /><span className="text-[10px] text-primary/15 mt-1 block">Click "New Schedule" above to create one.</span>
          </div>
        ) : (
          <div className="divide-y divide-primary/5">
            {schedules.map(s => (
              <div key={s.id} className={`flex items-center gap-3 px-4 py-2.5 ${!s.enabled ? "opacity-50" : ""}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.enabled ? "bg-[#00ff88]" : "bg-primary/20"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-primary font-mono">{s.toolName}</span>
                    {s.target && <span className="text-[10px] text-primary/40 font-mono truncate max-w-[160px]">{s.target}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-primary/30 font-mono">
                    <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{s.cronExpr}</span>
                    {s.nextRunAt && <span>next: {fmtDate(s.nextRunAt)}</span>}
                    {s.lastRunAt && <span>last: {fmtDate(s.lastRunAt)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleSchedule(s.id, !s.enabled)}
                    className={`p-1.5 border rounded-sm transition-colors text-[9px] flex items-center gap-1 ${
                      s.enabled
                        ? "border-yellow-500/30 text-yellow-400 hover:bg-yellow-900/20"
                        : "border-[#00ff88]/30 text-[#00ff88] hover:bg-[#00ff88]/10"
                    }`}
                    title={s.enabled ? "Disable" : "Enable"}
                  >
                    {s.enabled ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => deleteSchedule(s.id)}
                    className="p-1.5 border border-red-500/30 text-red-400 hover:bg-red-900/20 rounded-sm transition-colors"
                    title="Delete schedule"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Runs */}
      <div className="border border-primary/10 rounded-sm p-4">
        <div className="text-[10px] text-primary/30 uppercase tracking-widest font-mono mb-3">
          Recent Runs ({recentJobs.length})
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-primary/40 text-xs py-4 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
          </div>
        ) : recentJobs.length === 0 ? (
          <div className="text-xs text-primary/25 text-center py-6">No recent runs</div>
        ) : (
          <div className="space-y-1.5">
            {recentJobs.map(job => (
              <div key={job.id} className="flex items-center gap-3 border border-primary/8 rounded-sm p-2 text-[11px]">
                <span className={`text-[9px] border px-1.5 py-px font-mono uppercase ${STATUS_COLORS[job.status] ?? "border-primary/20 text-primary/40"}`}>
                  {job.status}
                </span>
                <span className="font-bold text-primary font-mono">{job.toolName}</span>
                {job.target && <span className="text-primary/40 font-mono truncate max-w-[200px] hidden sm:block">{job.target}</span>}
                {job.exitCode !== null && (
                  <span className={`text-[9px] font-mono ${job.exitCode === 0 ? "text-[#00ff88]/60" : "text-red-400/60"}`}>
                    exit:{job.exitCode}
                  </span>
                )}
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
