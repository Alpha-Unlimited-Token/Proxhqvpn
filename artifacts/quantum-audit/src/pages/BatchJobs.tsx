import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Play, Pause, X, Trash2, Download, FileText, RefreshCw,
  ShieldAlert, CheckCircle, AlertTriangle, Clock, Upload,
  BarChart3, Key, ChevronDown, ChevronUp, Eye, Copy, FolderOpen,
  Zap, Search, Lock
} from "lucide-react";

const BASE = () => (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
const trunc = (s: string, n = 16) => !s ? "" : s.length > n * 2 + 3 ? s.slice(0, n) + "…" + s.slice(-n) : s;
const cp = (s: string) => navigator.clipboard?.writeText(s).catch(() => {});
const fmtNum = (n: number) => n.toLocaleString();

// ── Types ────────────────────────────────────────────────────────────────────
type Job = {
  id: number;
  name: string;
  sourceName: string | null;
  status: "pending" | "running" | "paused" | "completed" | "cancelled" | "failed";
  totalTargets: number;
  completedCount: number;
  vulnerableCount: number;
  cleanCount: number;
  errorCount: number;
  cursor: number;
  reportDir: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
};

type Finding = {
  id: number;
  jobId: number;
  target: string;
  detectedChain: string | null;
  displayName: string | null;
  schemeLabel: string | null;
  signatureScheme: string | null;
  hasVulnerability: boolean;
  vulnerabilityCount: number;
  recoveredPrivateKey: string | null;
  recoveredNonceK: string | null;
  sharedRValue: string | null;
  scanError: string | null;
  execMs: number | null;
  scannedAt: string;
};

type ReportFile = { name: string; size: number };

// ── Helpers ──────────────────────────────────────────────────────────────────
function statusColor(s: Job["status"]) {
  return s === "completed"  ? "bg-green-500/20 text-green-400 border-green-500/30"
       : s === "running"    ? "bg-primary/20 text-primary border-primary/30"
       : s === "pending"    ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
       : s === "paused"     ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
       : s === "cancelled"  ? "bg-muted/20 text-muted-foreground border-border/30"
       :                      "bg-red-500/20 text-red-400 border-red-500/30";
}

function statusIcon(s: Job["status"]) {
  if (s === "completed") return <CheckCircle className="w-3.5 h-3.5" />;
  if (s === "running")   return <RefreshCw   className="w-3.5 h-3.5 animate-spin" />;
  if (s === "pending")   return <Clock       className="w-3.5 h-3.5" />;
  if (s === "paused")    return <Pause       className="w-3.5 h-3.5" />;
  if (s === "failed")    return <AlertTriangle className="w-3.5 h-3.5" />;
  return <X className="w-3.5 h-3.5" />;
}

function pct(job: Job) {
  if (!job.totalTargets) return 0;
  return Math.min(100, Math.round((job.completedCount / job.totalTargets) * 100));
}

function eta(job: Job): string {
  if (job.status !== "running" || !job.startedAt) return "";
  const elapsed = Date.now() - new Date(job.startedAt).getTime();
  const rate = job.completedCount / (elapsed / 1000); // per second
  if (rate <= 0) return "";
  const remaining = (job.totalTargets - job.completedCount) / rate;
  if (remaining > 3600) return `~${Math.round(remaining / 3600)}h`;
  if (remaining > 60)   return `~${Math.round(remaining / 60)}m`;
  return `~${Math.round(remaining)}s`;
}

function parseTargets(raw: string): string[] {
  return raw.split(/[\n\r,]+/)
    .map(l => l.replace(/#.*$/, "").trim())
    .filter(l => l.length >= 10)
    .filter((v, i, a) => a.indexOf(v) === i);
}

// ── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job, onRefresh }: { job: Job; onRefresh: () => void }) {
  const [expanded,  setExpanded]  = useState(false);
  const [findings,  setFindings]  = useState<Finding[]>([]);
  const [reports,   setReports]   = useState<ReportFile[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [expFind,   setExpFind]   = useState<number | null>(null);

  const loadFindings = async () => {
    setLoading(true);
    const res = await fetch(`${BASE()}/api/quantum-audit/batch-jobs/${job.id}/findings`);
    const j = await res.json();
    setFindings(j.findings ?? []);
    setLoading(false);
  };

  const loadReports = async () => {
    const res = await fetch(`${BASE()}/api/quantum-audit/batch-jobs/${job.id}/report-files`);
    const j = await res.json();
    setReports(j.files ?? []);
  };

  useEffect(() => {
    if (expanded) { loadFindings(); loadReports(); }
  }, [expanded]);

  const control = async (action: "pause" | "resume" | "cancel") => {
    await fetch(`${BASE()}/api/quantum-audit/batch-jobs/${job.id}/${action}`, { method: "POST" });
    onRefresh();
  };

  const deleteJob = async () => {
    if (!confirm(`Delete job "${job.name}"? This will remove all results.`)) return;
    await fetch(`${BASE()}/api/quantum-audit/batch-jobs/${job.id}`, { method: "DELETE" });
    onRefresh();
  };

  const downloadFile = (filename: string) => {
    window.open(`${BASE()}/api/quantum-audit/batch-jobs/${job.id}/download/${filename}`, "_blank");
  };

  const p = pct(job);
  const etaStr = eta(job);

  return (
    <Card className={`border ${job.vulnerableCount > 0 ? "border-red-500/40" : "border-border/50"} bg-card/50`}>
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Badge className={`text-[10px] font-mono flex items-center gap-1 flex-shrink-0 ${statusColor(job.status)}`}>
              {statusIcon(job.status)} {job.status.toUpperCase()}
            </Badge>
            <div className="min-w-0">
              <p className="font-mono font-bold text-sm truncate">{job.name}</p>
              {job.sourceName && <p className="text-xs text-muted-foreground font-mono">{job.sourceName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {job.status === "running"  && <Button size="sm" variant="outline" onClick={() => control("pause")}  className="h-7 text-xs gap-1"><Pause className="w-3 h-3"/>Pause</Button>}
            {job.status === "paused"   && <Button size="sm" variant="outline" onClick={() => control("resume")} className="h-7 text-xs gap-1 text-primary border-primary/40"><Play  className="w-3 h-3"/>Resume</Button>}
            {job.status === "pending"  && <Button size="sm" variant="outline" onClick={() => control("cancel")} className="h-7 text-xs gap-1 text-destructive border-destructive/40"><X className="w-3 h-3"/>Cancel</Button>}
            <Button size="sm" variant="ghost" onClick={deleteJob} className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3"/></Button>
            <Button size="sm" variant="ghost" onClick={() => setExpanded(p => !p)} className="h-7 text-xs gap-1">
              {expanded ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-5 gap-2 text-center">
          {[
            { label: "Total",     val: fmtNum(job.totalTargets),   cls: "text-foreground" },
            { label: "Scanned",   val: fmtNum(job.completedCount), cls: "text-primary" },
            { label: "Vulns",     val: fmtNum(job.vulnerableCount),cls: job.vulnerableCount > 0 ? "text-red-400 font-bold" : "text-muted-foreground" },
            { label: "Clean",     val: fmtNum(job.cleanCount),     cls: "text-green-400" },
            { label: "Errors",    val: fmtNum(job.errorCount),     cls: "text-yellow-400" },
          ].map(s => (
            <div key={s.label} className="bg-muted/20 rounded p-1.5">
              <p className={`text-sm font-bold font-mono ${s.cls}`}>{s.val}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {job.status !== "pending" && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>{p}% complete</span>
              <span>{etaStr && `ETA ${etaStr}`}{job.completedAt && `Completed ${new Date(job.completedAt).toLocaleString()}`}</span>
            </div>
            <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${job.vulnerableCount > 0 ? "bg-red-500" : "bg-primary"}`} style={{ width: `${p}%` }} />
            </div>
          </div>
        )}

        {/* Vulnerable alert */}
        {job.vulnerableCount > 0 && (
          <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/30">
            <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs font-mono text-red-400 font-bold">
              ⚠ {fmtNum(job.vulnerableCount)} target(s) with cryptographic vulnerabilities detected
              {job.status !== "completed" && " — scan still in progress"}
            </p>
          </div>
        )}

        {/* Report saved notification */}
        {job.status === "completed" && job.reportDir && (
          <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/30 text-xs font-mono text-green-400">
            <FolderOpen className="w-4 h-4 flex-shrink-0" />
            Full report saved to ProxHQ reports folder — see Downloads below
          </div>
        )}

        {/* Expanded detail */}
        {expanded && (
          <div className="space-y-4 pt-2 border-t border-border/30">

            {/* Download report files */}
            {reports.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-mono font-bold text-primary flex items-center gap-1.5"><Download className="w-3 h-3"/>Saved Report Files</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {reports.map(f => (
                    <button key={f.name} onClick={() => downloadFile(f.name)}
                      className="flex items-center gap-2 p-2.5 rounded border border-border/40 hover:border-primary/50 bg-muted/10 hover:bg-primary/5 transition-all text-left">
                      <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-bold truncate">{f.name}</p>
                        <p className="text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Findings */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono font-bold text-red-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-3 h-3"/>Vulnerability Findings ({findings.length})
                </p>
                <Button size="sm" variant="ghost" onClick={loadFindings} className="h-6 text-[10px] gap-1">
                  <RefreshCw className="w-3 h-3"/>Refresh
                </Button>
              </div>

              {loading && <p className="text-xs text-muted-foreground font-mono">Loading findings…</p>}

              {!loading && findings.length === 0 && (
                <p className="text-xs text-muted-foreground font-mono italic">
                  {job.status === "completed" ? "No vulnerabilities found." : "No vulnerabilities detected so far."}
                </p>
              )}

              {findings.map((f, i) => (
                <div key={f.id} className={`border rounded-lg overflow-hidden ${expFind === i ? "border-red-500/50" : "border-red-500/20"} bg-red-500/5`}>
                  <button className="w-full flex items-center justify-between p-3 text-left" onClick={() => setExpFind(p => p === i ? null : i)}>
                    <div className="flex items-center gap-2 min-w-0">
                      <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <code className="text-xs font-mono text-foreground">{trunc(f.target, 18)}</code>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {f.displayName && <span className="text-[10px] text-muted-foreground">{f.displayName.split("(")[0].trim()}</span>}
                          {f.schemeLabel && <Badge className="text-[9px] bg-orange-500/20 text-orange-400 border-orange-500/30">{f.schemeLabel}</Badge>}
                          {f.recoveredPrivateKey && <Badge className="text-[9px] bg-red-500/30 text-red-300 border-red-500/40">🔑 KEY RECOVERED</Badge>}
                        </div>
                      </div>
                    </div>
                    {expFind === i ? <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />}
                  </button>

                  {expFind === i && (
                    <div className="px-4 pb-4 space-y-3 border-t border-red-500/20 pt-3">
                      <div className="space-y-1.5 text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-32 flex-shrink-0">Full target:</span>
                          <code className="text-foreground break-all flex-1">{f.target}</code>
                          <button onClick={() => cp(f.target)}><Copy className="w-3 h-3 text-muted-foreground hover:text-primary"/></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-32 flex-shrink-0">Chain:</span>
                          <span>{f.displayName ?? f.detectedChain ?? "Unknown"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-32 flex-shrink-0">Vuln count:</span>
                          <span className="text-red-400 font-bold">{f.vulnerabilityCount}</span>
                        </div>
                      </div>

                      {f.recoveredPrivateKey && (
                        <div className="bg-black/60 border border-red-500/50 rounded-lg p-3 space-y-2">
                          <p className="text-xs font-mono font-bold text-red-400 flex items-center gap-1.5">
                            <Key className="w-3.5 h-3.5"/> RECOVERED CRYPTOGRAPHIC MATERIAL
                          </p>
                          <div className="space-y-1.5 text-xs font-mono">
                            <div className="flex items-start gap-2">
                              <span className="text-red-300/70 w-28 flex-shrink-0">Private Key:</span>
                              <code className="text-red-300 break-all flex-1">{f.recoveredPrivateKey}</code>
                              <button onClick={() => cp(f.recoveredPrivateKey!)}><Copy className="w-3 h-3 text-red-400 hover:text-red-200"/></button>
                            </div>
                            {f.recoveredNonceK && (
                              <div className="flex items-start gap-2">
                                <span className="text-muted-foreground w-28 flex-shrink-0">Nonce k:</span>
                                <code className="text-orange-300 break-all flex-1">{f.recoveredNonceK}</code>
                                <button onClick={() => cp(f.recoveredNonceK!)}><Copy className="w-3 h-3 text-muted-foreground hover:text-primary"/></button>
                              </div>
                            )}
                            {f.sharedRValue && (
                              <div className="flex items-start gap-2">
                                <span className="text-muted-foreground w-28 flex-shrink-0">Shared R:</span>
                                <code className="text-yellow-300 break-all flex-1">{f.sharedRValue}</code>
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] text-red-400/60 mt-2">
                            Recovered via nonce-reuse algebraic attack. Math: k=(s₁-s₂)·(z₁-z₂)⁻¹ mod n → d=(s₁·k-z₁)·r⁻¹ mod n
                          </p>
                        </div>
                      )}

                      {f.sharedRValue && !f.recoveredPrivateKey && (
                        <div className="bg-muted/20 border border-orange-500/30 rounded p-3 text-xs font-mono">
                          <p className="text-orange-400 font-bold">Nonce Reuse Confirmed — Shared R Value:</p>
                          <code className="text-orange-300 break-all">{f.sharedRValue}</code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── New Job Form ──────────────────────────────────────────────────────────────
function NewJobForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName]       = useState("");
  const [raw, setRaw]         = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const fileRef               = useRef<HTMLInputElement>(null);

  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => setRaw(String(e.target?.result ?? ""));
    reader.readAsText(file);
    if (!name) setName(file.name.replace(/\.(txt|csv|json)$/, ""));
  };

  const submit = async () => {
    const targets = parseTargets(raw);
    if (!name.trim()) { setError("Name required"); return; }
    if (targets.length === 0) { setError("No valid targets found"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${BASE()}/api/quantum-audit/batch-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), targets, sourceName: name.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setName(""); setRaw("");
      onCreated();
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  const targets = parseTargets(raw);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3"><CardTitle className="text-sm font-mono flex items-center gap-2"><Upload className="w-4 h-4 text-primary"/>Queue New Batch Job</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-muted-foreground">JOB NAME</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Attacker wallets Q1 2026" className="font-mono text-xs" />
          </div>
          <div
            className="border-2 border-dashed border-primary/30 hover:border-primary/60 bg-primary/5 rounded-lg p-3 flex items-center justify-center gap-2 cursor-pointer text-xs font-mono transition-all"
            onClick={() => fileRef.current?.click()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }}
            onDragOver={e => e.preventDefault()}
          >
            <Upload className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Drop .txt file or click to browse</span>
            <input ref={fileRef} type="file" accept=".txt,.csv,text/plain" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-muted-foreground">OR PASTE ADDRESSES / TX HASHES (one per line)</label>
          <Textarea value={raw} onChange={e => setRaw(e.target.value)} placeholder="0x... one per line, # comments ignored" className="font-mono text-xs h-24 resize-none" />
          {raw && <p className="text-xs font-mono text-muted-foreground">{targets.length} valid targets parsed</p>}
        </div>
        {error && <p className="text-xs text-destructive font-mono">{error}</p>}
        <Button onClick={submit} disabled={loading || !name.trim() || targets.length === 0} className="bg-primary text-black hover:bg-primary/90 font-bold gap-2">
          {loading ? <><RefreshCw className="w-4 h-4 animate-spin"/>Queuing…</> : <><Zap className="w-4 h-4"/>Queue {targets.length > 0 ? fmtNum(targets.length) : ""} Targets</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BatchJobs() {
  const [jobs,     setJobs]     = useState<Job[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [showNew,  setShowNew]  = useState(false);
  const pollRef                 = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch(`${BASE()}/api/quantum-audit/batch-jobs`);
      if (res.status === 403 || res.status === 401) {
        setError("Access denied — this section is restricted to the head admin account only.");
        setLoading(false); return;
      }
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        setError("Access denied — you must be signed in as head admin to view this section.");
        setLoading(false); return;
      }
      const j = await res.json();
      setJobs(j.jobs ?? []);
      setError(null);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadJobs();
    // Auto-refresh every 8s while any job is running/pending
    pollRef.current = setInterval(() => {
      loadJobs();
    }, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadJobs]);

  const activeJobs   = jobs.filter(j => j.status === "running" || j.status === "pending");
  const totalVulns   = jobs.reduce((a, j) => a + j.vulnerableCount, 0);
  const totalScanned = jobs.reduce((a, j) => a + j.completedCount, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-mono">Autonomous Scan Jobs</h1>
            <p className="text-sm text-muted-foreground">
              Head Admin — Private. Jobs run autonomously in the background. Results and full reports (including any recovered private keys) are auto-saved to your ProxHQ reports folder when each job completes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadJobs} variant="outline" size="sm" className="gap-1.5 text-xs font-mono">
            <RefreshCw className="w-3 h-3"/>Refresh
          </Button>
          <Button onClick={() => setShowNew(p => !p)} className="bg-primary text-black hover:bg-primary/90 font-bold gap-2 text-sm">
            <Upload className="w-4 h-4"/>New Job
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      {jobs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Jobs",    val: jobs.length,              cls: "text-foreground" },
            { label: "Active",        val: activeJobs.length,        cls: "text-primary" },
            { label: "Total Scanned", val: fmtNum(totalScanned),     cls: "text-foreground" },
            { label: "Vulnerabilities Found", val: fmtNum(totalVulns), cls: totalVulns > 0 ? "text-red-400 font-bold" : "text-green-400" },
          ].map(s => (
            <div key={s.label} className="bg-muted/20 border border-border/40 rounded-lg p-3 text-center">
              <p className={`text-xl font-bold font-mono ${s.cls}`}>{s.val}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Active scan notice */}
      {activeJobs.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
          <RefreshCw className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-mono font-bold">{activeJobs.length} job(s) scanning autonomously</p>
            <p className="text-xs text-muted-foreground">Processing continues in the background even when you're not logged in. Auto-refresh every 8s.</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4 flex gap-2 items-start">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-mono font-bold text-sm text-destructive">Access Restricted</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New job form */}
      {showNew && <NewJobForm onCreated={() => { setShowNew(false); loadJobs(); }} />}

      {/* Loading */}
      {loading && (
        <div className="py-12 text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="font-mono text-sm text-muted-foreground">Loading jobs…</p>
        </div>
      )}

      {/* Job list */}
      {!loading && !error && jobs.length === 0 && (
        <div className="py-16 text-center space-y-3 text-muted-foreground">
          <BarChart3 className="w-12 h-12 mx-auto opacity-30" />
          <div>
            <p className="font-mono font-bold text-foreground">No batch jobs yet</p>
            <p className="text-sm mt-1">The attacker files are being queued on server startup. Click Refresh in a moment.</p>
          </div>
          <Button onClick={loadJobs} variant="outline" size="sm" className="gap-1.5"><RefreshCw className="w-3 h-3"/>Refresh</Button>
        </div>
      )}

      {!loading && !error && jobs.map(job => (
        <JobCard key={job.id} job={job} onRefresh={loadJobs} />
      ))}
    </div>
  );
}
