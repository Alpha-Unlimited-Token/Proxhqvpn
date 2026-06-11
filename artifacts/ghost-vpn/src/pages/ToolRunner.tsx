// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Terminal, Play, Square, Copy, Check, ChevronRight, Loader2,
  Wifi, Globe, Key, Shield, Search, Network, Lock, Server,
  AlertTriangle, CheckCircle2, Clock, Trash2, Download,
  MapPin, History, CalendarDays, Bug, Radio, FileText, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const API = "/api/tool-runner";

interface FieldDef {
  id: string;
  label: string;
  type: "text" | "select" | "number" | "checkbox";
  placeholder?: string;
  defaultValue?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
}

interface ToolDef {
  id: string;
  name: string;
  binary: string;
  category: string;
  description: string;
  fields: FieldDef[];
  installed: boolean;
  warning?: string | null;
  timeoutMs: number;
}

interface GeoData {
  country: string;
  region: string;
  city: string;
  ll: [number, number];
  timezone?: string;
}

interface PendingApproval {
  approvalId: string;
  message: string;
  toolId: string;
  opts: Record<string, string>;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "Network Scanning":    Wifi,
  "Vulnerability Scanning": Shield,
  "Injection Testing":   Key,
  "Fuzzing":             Globe,
  "Subdomain Enumeration": Search,
  "HTTP Probing":        Server,
  "DNS":                 Network,
  "SSL / TLS":           Lock,
  "HTTP Client":         Globe,
  "OSINT":               Search,
  "Network":             Network,
  "Password Attacks":    Key,
  "Forensics & DFIR":    FileText,
  "Cryptography":        Lock,
  "Stress Testing":      Shield,
  "Wireless":            Radio,
  "Malware Analysis":    Bug,
  "Log Analysis":        FileText,
  "IDS/IPS Monitoring":  Shield,
  "Honeypot Monitoring": Shield,
  "Reporting/Export":    FileText,
};

const CATEGORY_COLORS: Record<string, string> = {
  "Network Scanning":       "text-blue-400   border-blue-500/30   bg-blue-900/10",
  "Vulnerability Scanning": "text-red-400    border-red-500/30    bg-red-900/10",
  "Injection Testing":      "text-orange-400 border-orange-500/30 bg-orange-900/10",
  "Fuzzing":                "text-yellow-400 border-yellow-500/30 bg-yellow-900/10",
  "Subdomain Enumeration":  "text-cyan-400   border-cyan-500/30   bg-cyan-900/10",
  "HTTP Probing":           "text-[#00ff88]  border-[#00ff88]/30  bg-[#00ff88]/5",
  "DNS":                    "text-purple-400 border-purple-500/30 bg-purple-900/10",
  "SSL / TLS":              "text-pink-400   border-pink-500/30   bg-pink-900/10",
  "HTTP Client":            "text-sky-400    border-sky-500/30    bg-sky-900/10",
  "OSINT":                  "text-amber-400  border-amber-500/30  bg-amber-900/10",
  "Network":                "text-teal-400   border-teal-500/30   bg-teal-900/10",
  "Password Attacks":       "text-red-400    border-red-500/30    bg-red-900/10",
  "Forensics & DFIR":       "text-violet-400 border-violet-500/30 bg-violet-900/10",
  "Cryptography":           "text-emerald-400 border-emerald-500/30 bg-emerald-900/10",
  "Stress Testing":         "text-orange-400 border-orange-500/30 bg-orange-900/10",
  "Wireless":               "text-sky-400    border-sky-500/30    bg-sky-900/10",
  "Malware Analysis":       "text-red-400    border-red-500/30    bg-red-900/10",
  "Log Analysis":           "text-lime-400   border-lime-500/30   bg-lime-900/10",
  "IDS/IPS Monitoring":     "text-orange-400 border-orange-500/30 bg-orange-900/10",
  "Honeypot Monitoring":    "text-amber-400  border-amber-500/30  bg-amber-900/10",
  "Reporting/Export":       "text-slate-400  border-slate-500/30  bg-slate-900/10",
};

function defaultOpts(fields: FieldDef[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (const f of fields) o[f.id] = f.defaultValue ?? "";
  return o;
}

export default function ToolRunner() {
  const [tools, setTools]                     = useState<ToolDef[]>([]);
  const [selectedTool, setSelectedTool]       = useState<ToolDef | null>(null);
  const [opts, setOpts]                       = useState<Record<string, string>>({});
  const [running, setRunning]                 = useState(false);
  const [output, setOutput]                   = useState<string[]>([]);
  const [jobId, setJobId]                     = useState<string | null>(null);
  const [dbJobId, setDbJobId]                 = useState<string | null>(null);
  const [exitCode, setExitCode]               = useState<number | null>(null);
  const [copied, setCopied]                   = useState(false);
  const [activeCategory, setActiveCategory]   = useState<string | null>(null);
  const [searchQ, setSearchQ]                 = useState("");
  const [error, setError]                     = useState<string | null>(null);
  const [scopeError, setScopeError]           = useState<string | null>(null);
  const [geoData, setGeoData]                 = useState<GeoData | null>(null);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [checkingApproval, setCheckingApproval] = useState(false);
  const esRef   = useRef<EventSource | null>(null);
  const termRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch(`${API}/tools`, { credentials: "include" })
      .then(r => r.json())
      .then(setTools)
      .catch(() => setError("Failed to load tools. Ensure you are signed in with Command Center Pro."));
  }, []);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [output]);

  const categories = [...new Set(tools.map(t => t.category))];
  const installedCount = tools.filter(t => t.installed).length;

  const filteredTools = tools.filter(t => {
    if (activeCategory && t.category !== activeCategory) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    }
    return true;
  });

  function selectTool(t: ToolDef) {
    setSelectedTool(t);
    setOpts(defaultOpts(t.fields));
    setOutput([]);
    setJobId(null);
    setDbJobId(null);
    setExitCode(null);
    setError(null);
    setScopeError(null);
    setGeoData(null);
    setPendingApproval(null);
  }

  async function runTool(approvedToken?: string) {
    if (!selectedTool) return;
    setRunning(true);
    setOutput([`[proxhqvpn] Launching ${selectedTool.name}...\n`]);
    setJobId(null);
    setDbJobId(null);
    setExitCode(null);
    setError(null);
    setScopeError(null);
    setGeoData(null);
    if (!approvedToken) setPendingApproval(null);

    try {
      const body: Record<string, unknown> = { toolId: selectedTool.id, opts };
      if (approvedToken) body.approvedToken = approvedToken;

      const res = await fetch(`${API}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();

      // Pending approval (202)
      if (res.status === 202 && data.status === "pending_approval") {
        setPendingApproval({
          approvalId: data.approvalId,
          message: data.message ?? "This scan requires admin approval.",
          toolId: selectedTool.id,
          opts,
        });
        setRunning(false);
        return;
      }

      // Out-of-scope target (422)
      if (res.status === 422 && data.code === "target_out_of_scope") {
        setScopeError(data.error ?? "Target is not in your authorized scope list.");
        setRunning(false);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Failed to start tool.");
        setRunning(false);
        return;
      }

      const id = data.jobId as string;
      setJobId(id);
      if (data.dbJobId) setDbJobId(data.dbJobId as string);
      setOutput(prev => [...prev,
        `[proxhqvpn] Command: ${data.command}\n`,
        `[proxhqvpn] Job ID: ${id}\n\n`,
      ]);

      // Show GeoIP if available
      if (data.geoData && typeof data.geoData === "object") {
        setGeoData(data.geoData as GeoData);
      }

      // Clear pending approval once we successfully ran
      setPendingApproval(null);

      // Open SSE stream
      if (esRef.current) esRef.current.close();
      const es = new EventSource(`${API}/stream/${id}`, { withCredentials: true } as EventSourceInit);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data) as { text?: string; done?: boolean; exitCode?: number };
          if (payload.text) setOutput(prev => [...prev, payload.text!]);
          if (payload.done) {
            setExitCode(payload.exitCode ?? 0);
            setRunning(false);
            es.close();
          }
        } catch { /* ignore parse errors */ }
      };
      es.onerror = () => {
        setRunning(false);
        es.close();
      };
    } catch (e: any) {
      setError(e.message);
      setRunning(false);
    }
  }

  async function checkApprovalStatus() {
    if (!pendingApproval) return;
    setCheckingApproval(true);
    try {
      const res = await fetch(`${API}/approvals/${pendingApproval.approvalId}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to check approval status."); return; }
      if (data.status === "approved") {
        // Re-submit with the approval token
        await runTool(pendingApproval.approvalId);
      } else if (data.status === "rejected") {
        setPendingApproval(null);
        setError("Your approval request was rejected by admin.");
      } else {
        setError(`Approval is still ${data.status}. Try again after admin reviews it.`);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCheckingApproval(false);
    }
  }

  async function saveOutput() {
    if (!dbJobId || output.length === 0) return;
    const text = output.join("");
    try {
      await fetch(`${API}/output/save/${dbJobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, chunkIndex: 0 }),
      });
    } catch { /* non-critical */ }
  }

  const killJob = useCallback(async () => {
    if (!jobId) return;
    esRef.current?.close();
    await fetch(`${API}/kill/${jobId}`, { method: "DELETE", credentials: "include" });
    setRunning(false);
    setOutput(prev => [...prev, "\n[proxhqvpn] Process killed by user.\n"]);
  }, [jobId]);

  function copyOutput() {
    navigator.clipboard.writeText(output.join("")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadOutput() {
    const blob = new Blob([output.join("")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTool?.id ?? "tool"}-output-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    saveOutput();
  }

  function clearOutput() {
    setOutput([]);
    setJobId(null);
    setDbJobId(null);
    setExitCode(null);
  }

  return (
    <div className="p-4 md:p-6 space-y-5 font-mono min-h-screen">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <Terminal className="w-5 h-5 text-[#00ff88]" />
            <h1 className="text-lg font-bold text-primary tracking-tight">Parrot Tool Runner</h1>
            <Badge className="text-[9px] border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88] font-mono uppercase tracking-widest px-1.5">
              {installedCount} / {tools.length} installed
            </Badge>
          </div>
          <p className="text-xs text-primary/40 max-w-xl leading-relaxed">
            Run real security tool binaries directly from the server — live streaming output, structured forms, no CLI required.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a href="/tool-history" className="flex items-center gap-1.5 text-[10px] text-primary/40 border border-primary/10 px-2.5 py-1.5 rounded-sm hover:border-primary/30 hover:text-primary/70 transition-colors">
            <History className="w-3 h-3" />Scan History
          </a>
          <a href="/scan-scheduler" className="flex items-center gap-1.5 text-[10px] text-primary/40 border border-primary/10 px-2.5 py-1.5 rounded-sm hover:border-primary/30 hover:text-primary/70 transition-colors">
            <CalendarDays className="w-3 h-3" />Scheduler
          </a>
          <div className="flex items-center gap-1.5 text-[10px] text-primary/30 border border-primary/10 px-3 py-1.5 rounded-sm">
            <AlertTriangle className="w-3 h-3 text-orange-400" />
            Authorized testing only
          </div>
        </div>
      </div>

      {/* Scope error banner */}
      {scopeError && (
        <div className="border border-orange-500/40 bg-orange-900/10 text-orange-400 text-xs p-3 rounded-sm space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold mb-0.5">Target Out of Scope</div>
              <div className="text-orange-300/80">{scopeError}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <a href="/tool-scope" className="text-[10px] border border-orange-500/30 px-2 py-1 rounded-sm hover:bg-orange-900/20 transition-colors">
              → Manage Scope List
            </a>
            <button onClick={() => setScopeError(null)} className="text-[10px] border border-primary/20 px-2 py-1 rounded-sm hover:bg-primary/5 transition-colors text-primary/40">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* General error banner */}
      {error && (
        <div className="border border-red-500/30 bg-red-900/10 text-red-400 text-xs p-3 rounded-sm flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Pending approval banner */}
      {pendingApproval && (
        <div className="border border-yellow-500/40 bg-yellow-900/10 text-yellow-300 text-xs p-4 rounded-sm space-y-3">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 shrink-0 mt-0.5 text-yellow-400" />
            <div>
              <div className="font-bold text-yellow-400 mb-1">Pending Admin Approval</div>
              <div className="text-yellow-300/80 leading-relaxed">{pendingApproval.message}</div>
              <div className="mt-1 text-[10px] text-yellow-300/50 font-mono">
                Approval ID: {pendingApproval.approvalId}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={checkApprovalStatus}
              disabled={checkingApproval}
              variant="outline"
              className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-900/20 font-mono text-[10px] px-3 py-1.5 h-auto flex items-center gap-1.5"
            >
              {checkingApproval ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {checkingApproval ? "Checking..." : "Check Status & Run if Approved"}
            </Button>
            <a href="/tool-approvals" className="text-[10px] border border-yellow-500/30 px-3 py-1.5 rounded-sm hover:bg-yellow-900/20 transition-colors text-yellow-400">
              View Approval Queue
            </a>
            <button onClick={() => setPendingApproval(null)} className="text-[10px] border border-primary/15 px-3 py-1.5 rounded-sm hover:bg-primary/5 transition-colors text-primary/30">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* GeoIP banner */}
      {geoData && (
        <div className="border border-[#00ff88]/20 bg-[#00ff88]/5 text-[#00ff88]/80 text-xs p-3 rounded-sm flex items-start gap-2">
          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#00ff88]" />
          <div>
            <span className="font-bold text-[#00ff88]">GeoIP — </span>
            {[geoData.city, geoData.region, geoData.country].filter(Boolean).join(", ")}
            {geoData.ll && <span className="text-[#00ff88]/50 ml-2 text-[10px]">({geoData.ll[0].toFixed(4)}, {geoData.ll[1].toFixed(4)})</span>}
            {geoData.timezone && <span className="text-[#00ff88]/50 ml-2 text-[10px]">· {geoData.timezone}</span>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* ── Left panel: tool selector ─────────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-3">

          {/* Search + category filter */}
          <div className="space-y-2">
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search tools..."
              className="w-full bg-black/40 border border-primary/20 text-primary text-xs font-mono px-3 py-2 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm"
            />
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setActiveCategory(null)}
                className={`text-[9px] border px-2 py-0.5 rounded-sm font-mono uppercase tracking-wide transition-colors ${!activeCategory ? "border-[#00ff88]/40 text-[#00ff88] bg-[#00ff88]/8" : "border-primary/15 text-primary/30 hover:border-primary/30"}`}
              >
                All
              </button>
              {categories.map(cat => {
                const color = CATEGORY_COLORS[cat] ?? "text-primary/40 border-primary/20";
                const active = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(active ? null : cat)}
                    className={`text-[9px] border px-2 py-0.5 rounded-sm font-mono uppercase tracking-wide transition-colors ${active ? color : "border-primary/15 text-primary/30 hover:border-primary/30"}`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tool list */}
          <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
            {filteredTools.length === 0 && (
              <div className="text-xs text-primary/25 p-4 text-center border border-primary/10 rounded-sm">No tools match</div>
            )}
            {filteredTools.map(t => {
              const Icon = CATEGORY_ICONS[t.category] ?? Terminal;
              const color = CATEGORY_COLORS[t.category] ?? "text-primary/40 border-primary/20";
              const selected = selectedTool?.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => selectTool(t)}
                  className={`w-full text-left border rounded-sm p-2.5 transition-colors flex items-start gap-2.5 ${
                    selected
                      ? "border-[#00ff88]/40 bg-[#00ff88]/5"
                      : "border-primary/10 bg-primary/1 hover:border-primary/20 hover:bg-primary/3"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${color.match(/text-[^\s]+/)?.[0] ?? "text-primary/40"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-primary font-mono">{t.name}</span>
                      {t.installed ? (
                        <span className="text-[8px] border border-[#00ff88]/40 text-[#00ff88] px-1 py-px bg-[#00ff88]/5 flex items-center gap-0.5">
                          <CheckCircle2 className="w-2 h-2" />Ready
                        </span>
                      ) : (
                        <span className="text-[8px] border border-red-500/30 text-red-400 px-1 py-px bg-red-900/5">Not installed</span>
                      )}
                    </div>
                    <div className="text-[10px] text-primary/40 mt-0.5 leading-relaxed line-clamp-2">{t.description}</div>
                  </div>
                  {selected && <ChevronRight className="w-3 h-3 text-[#00ff88] shrink-0 mt-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right panel: form + output ─────────────────────────────────────── */}
        <div className="lg:col-span-8 space-y-3">

          {!selectedTool ? (
            <div className="border border-primary/10 rounded-sm p-12 text-center">
              <Terminal className="w-10 h-10 text-primary/10 mx-auto mb-3" />
              <div className="text-sm text-primary/25">Select a tool to configure and run</div>
              <div className="text-xs text-primary/15 mt-1">{installedCount} tools ready on this server</div>
              <div className="mt-4 flex items-center justify-center gap-3">
                <a href="/tool-scope" className="text-[10px] border border-primary/15 text-primary/30 px-3 py-1.5 rounded-sm hover:border-[#00ff88]/30 hover:text-[#00ff88]/60 transition-colors">
                  Configure Scope List
                </a>
                <a href="/scan-scheduler" className="text-[10px] border border-primary/15 text-primary/30 px-3 py-1.5 rounded-sm hover:border-[#00ff88]/30 hover:text-[#00ff88]/60 transition-colors">
                  Schedule a Scan
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* Tool header */}
              <div className={`border rounded-sm p-3 ${CATEGORY_COLORS[selectedTool.category] ?? "border-primary/10"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-primary font-mono">{selectedTool.name}</span>
                      <span className={`text-[9px] border px-1.5 py-px font-mono uppercase ${CATEGORY_COLORS[selectedTool.category] ?? ""}`}>
                        {selectedTool.category}
                      </span>
                      <span className="text-[9px] text-primary/30 font-mono">timeout: {Math.round(selectedTool.timeoutMs / 1000)}s</span>
                    </div>
                    <div className="text-xs text-primary/50 mt-1">{selectedTool.description}</div>
                  </div>
                  {selectedTool.installed ? (
                    <span className="text-[9px] border border-[#00ff88]/40 text-[#00ff88] px-2 py-1 bg-[#00ff88]/5 whitespace-nowrap flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5" />Installed
                    </span>
                  ) : (
                    <span className="text-[9px] border border-red-500/30 text-red-400 px-2 py-1 bg-red-900/5 whitespace-nowrap shrink-0">Not installed</span>
                  )}
                </div>
                {selectedTool.warning && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-orange-400 border border-orange-500/20 bg-orange-900/10 px-2 py-1 rounded-sm">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {selectedTool.warning}
                  </div>
                )}
              </div>

              {/* Form */}
              <div className="border border-primary/10 rounded-sm p-4 bg-black/20 space-y-3">
                <div className="text-[10px] text-primary/30 uppercase tracking-widest font-mono mb-2">Configuration</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedTool.fields.map(f => (
                    <div key={f.id} className={f.type === "text" && f.id === "url" ? "md:col-span-2" : ""}>
                      <label className="block text-[10px] text-primary/50 mb-1 font-mono uppercase tracking-wide">
                        {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
                      </label>
                      {f.type === "select" ? (
                        <select
                          value={opts[f.id] ?? f.defaultValue ?? ""}
                          onChange={e => setOpts(prev => ({ ...prev, [f.id]: e.target.value }))}
                          className="w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-[#00ff88]/40 rounded-sm"
                        >
                          {f.options?.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : f.type === "checkbox" ? (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={opts[f.id] === "true"}
                            onChange={e => setOpts(prev => ({ ...prev, [f.id]: e.target.checked ? "true" : "false" }))}
                            className="accent-[#00ff88]"
                          />
                          <span className="text-xs text-primary/50 font-mono">{f.hint ?? f.label}</span>
                        </label>
                      ) : (
                        <input
                          type={f.type}
                          value={opts[f.id] ?? ""}
                          onChange={e => setOpts(prev => ({ ...prev, [f.id]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm"
                        />
                      )}
                      {f.hint && f.type !== "checkbox" && (
                        <div className="text-[9px] text-primary/25 mt-0.5">{f.hint}</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Run / Kill */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {!running ? (
                    <Button
                      onClick={() => runTool()}
                      disabled={!selectedTool.installed}
                      className="bg-[#00ff88] text-black hover:bg-[#00ff88]/80 font-mono text-xs px-4 py-2 h-auto font-bold flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Run {selectedTool.name}
                    </Button>
                  ) : (
                    <Button
                      onClick={killJob}
                      variant="outline"
                      className="border-red-500/40 text-red-400 hover:bg-red-900/20 font-mono text-xs px-4 py-2 h-auto flex items-center gap-1.5"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Kill Process
                    </Button>
                  )}
                  {running && (
                    <span className="flex items-center gap-1.5 text-xs text-[#00ff88]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Running...
                    </span>
                  )}
                  {!running && exitCode !== null && (
                    <span className={`flex items-center gap-1.5 text-xs font-mono ${exitCode === 0 ? "text-[#00ff88]" : "text-red-400"}`}>
                      {exitCode === 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      Exit code: {exitCode}
                    </span>
                  )}
                  {dbJobId && !running && exitCode !== null && (
                    <a
                      href={`/tool-history`}
                      className="text-[10px] text-primary/30 border border-primary/10 px-2 py-1.5 rounded-sm hover:border-primary/30 hover:text-primary/60 transition-colors flex items-center gap-1"
                    >
                      <History className="w-3 h-3" />View in History
                    </a>
                  )}
                </div>
              </div>

              {/* Terminal output */}
              {output.length > 0 && (
                <div className="border border-primary/10 rounded-sm overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10 bg-black/40">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-[#00ff88]" />
                      <span className="text-[10px] text-primary/40 font-mono uppercase tracking-wide">
                        Output {running ? "— live" : `— ${output.join("").split("\n").length} lines`}
                      </span>
                      {running && <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={copyOutput}
                        className="p-1.5 border border-primary/15 text-primary/40 hover:text-primary/70 hover:border-primary/30 rounded-sm transition-colors"
                        title="Copy output"
                      >
                        {copied ? <Check className="w-3 h-3 text-[#00ff88]" /> : <Copy className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={downloadOutput}
                        className="p-1.5 border border-primary/15 text-primary/40 hover:text-primary/70 hover:border-primary/30 rounded-sm transition-colors"
                        title="Download & save output"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      <button
                        onClick={clearOutput}
                        className="p-1.5 border border-primary/15 text-primary/40 hover:text-primary/70 hover:border-primary/30 rounded-sm transition-colors"
                        title="Clear output"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div
                    ref={termRef}
                    className="bg-black/80 p-4 overflow-y-auto max-h-[500px] text-[11px] font-mono leading-relaxed whitespace-pre-wrap text-[#00ff88]/90 select-text"
                    style={{ fontFamily: "'Courier New', 'Lucida Console', monospace" }}
                  >
                    {output.join("")}
                    {running && <span className="animate-pulse text-[#00ff88]">█</span>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tool status grid */}
      <div className="border border-primary/10 rounded-sm p-4">
        <div className="text-[10px] text-primary/30 uppercase tracking-widest font-mono mb-3">Server Tool Status</div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {tools.map(t => (
            <button
              key={t.id}
              onClick={() => selectTool(t)}
              className={`text-left border rounded-sm p-2 transition-colors hover:border-[#00ff88]/30 ${t.installed ? "border-primary/15 bg-primary/2" : "border-red-500/15 bg-red-900/5"}`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${t.installed ? "bg-[#00ff88]" : "bg-red-400"}`} />
                <span className="text-[10px] font-bold font-mono text-primary">{t.name}</span>
              </div>
              <div className="text-[9px] text-primary/30 font-mono">{t.category}</div>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
