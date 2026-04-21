import { useState, useRef, useEffect, useCallback, DragEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  ScanSearch, ShieldAlert, Globe2,
  Wifi, WifiOff, Play, Loader2, Square,
  Download, RotateCcw, Layers, Bug,
  ArrowRight, FileText, CheckCircle,
  Upload, PackageSearch, AlertTriangle, ShieldCheck,
  FileCode2, Key, XCircle, ChevronDown, ChevronUp,
} from "lucide-react";

const BASE        = import.meta.env.BASE_URL.replace(/\/$/, "");
const SCRAPER_URL = `${import.meta.env.BASE_URL}AlphaWebScraper.html`;

type Tab       = "scanner" | "verifier" | "scraper" | "appscan";
type ScanMode  = "network" | "security" | "exploits" | "all";
type JobStatus = "idle" | "running" | "complete" | "error" | "cancelled";

interface TorStatus { connected: boolean; ip: string | null }

// ── Tor badge ─────────────────────────────────────────────────────────────────
function TorBadge({ status }: { status: TorStatus | null }) {
  if (!status) return <span className="text-[9px] text-primary/30 font-mono animate-pulse">CHECKING TOR…</span>;
  return status.connected ? (
    <span className="flex items-center gap-1 text-[9px] font-mono text-purple-400 border border-purple-500/30 bg-purple-900/20 px-2 py-0.5 rounded">
      <Wifi className="w-2.5 h-2.5" /> TOR ACTIVE · {status.ip}
    </span>
  ) : (
    <span className="flex items-center gap-1 text-[9px] font-mono text-red-400/60 border border-red-500/20 px-2 py-0.5 rounded">
      <WifiOff className="w-2.5 h-2.5" /> TOR OFFLINE
    </span>
  );
}

// ── Output terminal ───────────────────────────────────────────────────────────
function TermOut({ text, label }: { text: string | null; label?: string }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [text]);
  if (!text) return null;
  return (
    <div className="mt-4">
      {label && <div className="text-[9px] text-primary/30 font-mono uppercase tracking-widest mb-1">{label}</div>}
      <pre ref={ref} className="text-[10px] font-mono text-primary/80 bg-black border border-primary/10 rounded p-3 overflow-auto max-h-[500px] whitespace-pre-wrap leading-relaxed">
        {text}
      </pre>
    </div>
  );
}

// ── Universal Scanner tab ─────────────────────────────────────────────────────
interface ScannerTabProps {
  useTor: boolean;
  onReportReady: (jobId: string) => void;
}

function ScannerTab({ useTor, onReportReady }: ScannerTabProps) {
  const { toast }   = useToast();
  const [mode, setMode]         = useState<ScanMode>("network");
  const [target, setTarget]     = useState("");
  const [ports, setPorts]       = useState("1-10000");
  const [extraFlags, setExtra]  = useState("");
  const [status, setStatus]     = useState<JobStatus>("idle");
  const [cmd, setCmd]           = useState<string | null>(null);
  const [output, setOutput]     = useState<string | null>(null);
  const [htmlReady, setHtmlReady] = useState(false);
  const [currentJobId, setJobId]  = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const cancelScan = useCallback(async () => {
    stopPolling();
    if (currentJobId) {
      try {
        await fetch(`${BASE}/api/alpha/scan/${currentJobId}`, { method: "DELETE", credentials: "include" });
      } catch {}
    }
    setStatus("idle");
    setOutput(null);
    setCmd(null);
    setHtmlReady(false);
    setJobId(null);
  }, [currentJobId]);

  const run = useCallback(async () => {
    if (!target.trim()) { toast({ title: "Target required", variant: "destructive" }); return; }
    stopPolling();
    setStatus("running"); setOutput(null); setCmd(null); setHtmlReady(false); setJobId(null);

    const body: Record<string, any> = { mode, useTor, extraFlags };
    if (mode === "network" || mode === "all") { body.targetIp = target.trim(); body.ports = ports; }
    else body.target = target.trim();

    try {
      const r = await fetch(`${BASE}/api/alpha/scan`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { toast({ title: "Error", description: d.error, variant: "destructive" }); setStatus("error"); return; }
      setCmd(d.cmd);
      setJobId(d.jobId);
      toast({ title: "Alpha Scanner launched", description: `Job ${d.jobId} · ${mode}${useTor ? " · Tor" : ""}` });

      pollRef.current = setInterval(async () => {
        try {
          const pr = await fetch(`${BASE}/api/alpha/scan/${d.jobId}`, { credentials: "include" });
          const pd = await pr.json();
          if (pd.htmlReady) setHtmlReady(true);
          if (pd.status !== "running") {
            setStatus(pd.status as JobStatus);
            setOutput(pd.output ?? "No output");
            if (pd.htmlReady) { setHtmlReady(true); onReportReady(d.jobId); }
            stopPolling();
          }
        } catch {}
      }, 4000);
    } catch (e: any) {
      setStatus("error"); setOutput("Error: " + e.message);
    }
  }, [mode, target, ports, useTor, extraFlags, toast, onReportReady]);

  const downloadHtml = async () => {
    if (!currentJobId) return;
    const r = await fetch(`${BASE}/api/alpha/scan/${currentJobId}/html`, { credentials: "include" });
    if (!r.ok) { toast({ title: "Report not ready", variant: "destructive" }); return; }
    const html = await r.text();
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `alpha-scan-${currentJobId}.html`; a.click();
    URL.revokeObjectURL(url);
  };

  const MODES: { id: ScanMode; label: string; desc: string }[] = [
    { id: "network",  label: "Network Scan",  desc: "Ports · services · banners" },
    { id: "security", label: "Security Audit", desc: "Misconfigs · keys · secrets" },
    { id: "exploits", label: "Exploit Scan",   desc: "200+ vuln patterns · chains" },
    { id: "all",      label: "Full Scan",      desc: "Network + security + exploits" },
  ];

  const statusColor: Record<JobStatus, string> = {
    idle: "text-primary/30", running: "text-yellow-400 animate-pulse",
    complete: "text-green-400", error: "text-red-400", cancelled: "text-primary/40",
  };

  return (
    <div className="space-y-5">
      <div className="text-[10px] text-primary/40 font-mono border border-primary/10 rounded px-3 py-2 bg-primary/5 leading-relaxed">
        Alpha Universal Scanner™ v4.0 — 35+ languages · 200+ vuln patterns · multi-step exploit chains ·
        network port scanning · service fingerprinting. Generates a full HTML report that can be piped directly into the Vulnerability Verifier.
        {useTor && <span className="ml-2 text-purple-400 font-bold">[ ROUTING VIA TOR ]</span>}
      </div>

      {/* Mode picker */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`text-left border rounded px-3 py-2 transition-colors ${mode === m.id ? "border-primary bg-primary/10 text-primary" : "border-primary/20 text-primary/50 hover:border-primary/40 hover:text-primary/70"}`}>
            <div className="text-[10px] font-mono font-bold uppercase">{m.label}</div>
            <div className="text-[9px] text-primary/40 mt-0.5">{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-[9px] text-primary/40 font-mono uppercase block mb-1">
            {mode === "network" || mode === "all" ? "Target IP / Hostname" : "Target Path or URL"}
          </label>
          <input value={target} onChange={e => setTarget(e.target.value)}
            placeholder={mode === "network" || mode === "all" ? "192.168.1.1  or  example.com" : "/path/to/code  or  https://example.com"}
            className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary/50 rounded" />
        </div>
        {(mode === "network" || mode === "all") && (
          <div className="w-44">
            <label className="text-[9px] text-primary/40 font-mono uppercase block mb-1">Port Range</label>
            <input value={ports} onChange={e => setPorts(e.target.value)} placeholder="1-10000"
              className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary/50 rounded" />
          </div>
        )}
      </div>

      <div>
        <label className="text-[9px] text-primary/40 font-mono uppercase block mb-1">Extra Flags (optional)</label>
        <input value={extraFlags} onChange={e => setExtra(e.target.value)} placeholder="--lang cpp  ·  --deep  ·  --config-audit"
          className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary/50 rounded" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {status === "running" ? (
          <button onClick={cancelScan}
            className="flex items-center gap-2 px-5 py-2 bg-red-500/90 text-white text-[10px] font-mono uppercase tracking-widest hover:bg-red-500 transition-colors rounded">
            <Square className="w-3.5 h-3.5 fill-white" />
            Stop Scan
          </button>
        ) : (
          <button onClick={run}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-black text-[10px] font-mono uppercase tracking-widest hover:bg-primary/80 transition-colors rounded">
            <Play className="w-3.5 h-3.5" />
            Run Scanner
          </button>
        )}

        {status === "running" && (
          <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-yellow-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            SCANNING
          </span>
        )}
        {status === "complete" && <span className="text-[10px] font-mono uppercase text-green-400">✓ COMPLETE</span>}
        {status === "error"     && <span className="text-[10px] font-mono uppercase text-red-400">✗ ERROR</span>}
        {status === "cancelled" && <span className="text-[10px] font-mono uppercase text-primary/40">◼ STOPPED</span>}

        {/* Report actions — appear when HTML report is ready */}
        {htmlReady && currentJobId && (
          <>
            <button onClick={downloadHtml}
              className="flex items-center gap-1.5 text-[9px] font-mono text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/40 px-3 py-1.5 transition-colors rounded">
              <Download className="w-3 h-3" /> Download HTML Report
            </button>
            <button onClick={() => onReportReady(currentJobId)}
              className="flex items-center gap-1.5 text-[9px] font-mono text-green-400 border border-green-500/30 bg-green-900/10 hover:bg-green-900/20 px-3 py-1.5 transition-colors rounded">
              <ArrowRight className="w-3 h-3" /> Send to Verifier
            </button>
          </>
        )}

        {(status === "complete" || status === "error" || status === "cancelled") && (
          <button onClick={() => { setStatus("idle"); setOutput(null); setCmd(null); setHtmlReady(false); setJobId(null); }}
            className="flex items-center gap-1 text-[9px] text-primary/40 hover:text-primary font-mono">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {cmd && (
        <div className="text-[9px] font-mono text-primary/30 border border-primary/10 rounded px-3 py-1.5 bg-primary/5 break-all">
          <span className="text-primary/20">CMD › </span>{cmd}
        </div>
      )}

      {/* HTML report ready notice */}
      {htmlReady && (
        <div className="flex items-center gap-2 text-[10px] font-mono text-green-400 border border-green-500/20 bg-green-900/10 px-3 py-2 rounded">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          HTML report generated — click <strong>Send to Verifier</strong> to probe every finding against the live target, or <strong>Download</strong> to save it.
        </div>
      )}

      <TermOut text={output} label="Scanner Output" />
    </div>
  );
}

// ── Vuln Verifier tab ─────────────────────────────────────────────────────────
interface VerifierTabProps {
  useTor: boolean;
  prefillJobId: string | null;
  onConsumed: () => void;
}

function VerifierTab({ useTor, prefillJobId, onConsumed }: VerifierTabProps) {
  const { toast }   = useToast();
  const [reportHtml, setReportHtml] = useState("");
  const [targetUrl, setTargetUrl]   = useState("");
  const [status, setStatus]         = useState<JobStatus>("idle");
  const [output, setOutput]         = useState<string | null>(null);
  const [jsonResult, setJson]       = useState<any>(null);
  const [htmlReport, setHtmlRep]    = useState<string | null>(null);
  const [cmd, setCmd]               = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const pollRef                     = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef                     = useRef<HTMLInputElement>(null);

  const stop = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  // Auto-load when a scan report becomes available from the Scanner tab
  useEffect(() => {
    if (!prefillJobId) return;
    setLoading(true);
    fetch(`${BASE}/api/alpha/scan/${prefillJobId}/html`, { credentials: "include" })
      .then(r => {
        if (!r.ok) throw new Error("Report not ready");
        return r.text();
      })
      .then(html => {
        setReportHtml(html);
        toast({ title: "Report loaded from Scanner", description: `${(html.length / 1024).toFixed(0)} KB — ready to verify` });
        onConsumed();
      })
      .catch(() => toast({ title: "Could not load report", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [prefillJobId]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setReportHtml(ev.target?.result as string ?? "");
    reader.readAsText(f);
  };

  const run = useCallback(async () => {
    if (!reportHtml.trim()) { toast({ title: "Paste or load a scan report first", variant: "destructive" }); return; }
    stop();
    setStatus("running"); setOutput(null); setJson(null); setHtmlRep(null);

    try {
      const r = await fetch(`${BASE}/api/alpha/verify`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportHtml, targetUrl: targetUrl || undefined, useTor }),
      });
      const d = await r.json();
      if (!r.ok) { toast({ title: "Error", description: d.error, variant: "destructive" }); setStatus("error"); return; }
      setCmd(d.cmd);
      toast({ title: "Verification launched", description: `Job ${d.jobId}${useTor ? " · via Tor" : ""}` });

      pollRef.current = setInterval(async () => {
        try {
          const pr = await fetch(`${BASE}/api/alpha/verify/${d.jobId}`, { credentials: "include" });
          const pd = await pr.json();
          if (pd.status !== "running") {
            setStatus(pd.status as JobStatus);
            setOutput(pd.output ?? "No output");
            if (pd.jsonResult)  setJson(pd.jsonResult);
            if (pd.htmlReport)  setHtmlRep(pd.htmlReport);
            stop();
          }
        } catch {}
      }, 4000);
    } catch (e: any) {
      setStatus("error"); setOutput("Error: " + e.message);
    }
  }, [reportHtml, targetUrl, useTor, toast]);

  const downloadExposure = () => {
    if (!htmlReport) return;
    const blob = new Blob([htmlReport], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "exposure-report.html"; a.click();
    URL.revokeObjectURL(url);
  };

  const statusColor: Record<JobStatus, string> = {
    idle: "text-primary/30", running: "text-yellow-400 animate-pulse",
    complete: "text-green-400", error: "text-red-400",
  };

  return (
    <div className="space-y-5">
      <div className="text-[10px] text-primary/40 font-mono border border-primary/10 rounded px-3 py-2 bg-primary/5 leading-relaxed">
        Alpha Vulnerability Verifier™ v2.0 — reads an Alpha Scanner HTML report and <strong className="text-primary/60">actively probes</strong> every
        finding against the live target (TLS handshakes, TCP banner grabs, HTTP headers, SQL error probes, SSRF checks).
        Produces a color-coded exposure report.
        {useTor && <span className="ml-2 text-purple-400 font-bold">[ ROUTING VIA TOR ]</span>}
      </div>

      {/* Source — loaded from scanner or upload */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-[9px] text-primary/40 font-mono uppercase">Scan Report HTML</label>
          <button onClick={() => fileRef.current?.click()}
            className="text-[9px] font-mono text-primary/50 border border-primary/20 px-2 py-0.5 hover:border-primary/50 hover:text-primary transition-colors rounded">
            Upload File
          </button>
          <input ref={fileRef} type="file" accept=".html" className="hidden" onChange={onFile} />
          {loading && <span className="text-[9px] font-mono text-yellow-400 animate-pulse">Loading from scanner…</span>}
          {reportHtml && !loading && (
            <span className="flex items-center gap-1 text-[9px] text-green-400 font-mono">
              <FileText className="w-3 h-3" /> {(reportHtml.length / 1024).toFixed(0)} KB loaded
            </span>
          )}
        </div>
        <textarea value={reportHtml} onChange={e => setReportHtml(e.target.value)}
          placeholder="Paste your Alpha Scanner HTML report here — or run a scan on the Scanner tab and click 'Send to Verifier'."
          rows={reportHtml ? 4 : 6}
          className="w-full bg-black border border-primary/20 text-primary/70 text-[10px] font-mono px-2 py-2 focus:outline-none focus:border-primary/50 rounded resize-y" />
      </div>

      <div>
        <label className="text-[9px] text-primary/40 font-mono uppercase block mb-1">Target URL Override (optional)</label>
        <input value={targetUrl} onChange={e => setTargetUrl(e.target.value)}
          placeholder="https://target.example.com — leave blank to use URL embedded in report"
          className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary/50 rounded" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={run} disabled={status === "running" || loading}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-black text-[10px] font-mono uppercase tracking-widest hover:bg-primary/80 disabled:opacity-50 transition-colors rounded">
          {status === "running" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
          {status === "running" ? "Probing…" : "Verify Findings"}
        </button>
        {status !== "idle" && (
          <span className={`text-[10px] font-mono uppercase ${statusColor[status]}`}>
            {status === "running" ? "● PROBING LIVE TARGET" : status === "complete" ? "✓ COMPLETE" : "✗ ERROR"}
          </span>
        )}
        {htmlReport && (
          <button onClick={downloadExposure}
            className="flex items-center gap-1.5 text-[9px] font-mono text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/40 px-3 py-1.5 transition-colors rounded">
            <Download className="w-3 h-3" /> Download Exposure Report
          </button>
        )}
      </div>

      {cmd && (
        <div className="text-[9px] font-mono text-primary/30 border border-primary/10 rounded px-3 py-1.5 bg-primary/5 break-all">
          <span className="text-primary/20">CMD › </span>{cmd}
        </div>
      )}

      {/* JSON result summary */}
      {jsonResult && (
        <div className="border border-primary/20 rounded p-4 space-y-3">
          <div className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest">
            Exposure Report — {jsonResult.target ?? "Unknown Target"}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Checked",        val: jsonResult.stats?.total           ?? "—" },
              { label: "Exposed",        val: jsonResult.stats?.exposed         ?? "—", alert: true },
              { label: "With Data",      val: jsonResult.stats?.verified        ?? "—" },
              { label: "False Positives",val: jsonResult.stats?.false_positives ?? "—" },
            ].map(({ label, val, alert }) => (
              <div key={label} className={`border rounded p-2 text-center ${alert && Number(val) > 0 ? "border-red-500/40 bg-red-900/10" : "border-primary/15"}`}>
                <div className={`text-[20px] font-bold font-mono ${alert && Number(val) > 0 ? "text-red-400" : "text-primary"}`}>{String(val)}</div>
                <div className="text-[8px] text-primary/30 font-mono uppercase mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          {jsonResult.cdn?.detected && (
            <div className="text-[9px] text-yellow-400 font-mono border border-yellow-500/20 bg-yellow-900/10 px-3 py-1.5 rounded">
              CDN DETECTED: {jsonResult.cdn.name} — some findings may be edge false-positives
            </div>
          )}
          {jsonResult.results?.filter((r: any) => r.exposed_data).map((r: any, i: number) => (
            <div key={i} className="border border-red-500/20 rounded p-3 bg-red-900/5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-mono text-red-400 font-bold">EXPOSED</span>
                <span className="text-[9px] font-mono text-primary/60">{r.finding?.title}</span>
                <span className="ml-auto text-[8px] font-mono text-red-400/60 border border-red-500/20 px-1 rounded">{r.finding?.severity}</span>
              </div>
              <pre className="text-[9px] font-mono text-primary/60 whitespace-pre-wrap break-all leading-relaxed mt-1">
                {JSON.stringify(r.exposed_data, null, 2).substring(0, 1000)}
              </pre>
            </div>
          ))}
        </div>
      )}

      <TermOut text={output} label="Verifier Output" />
    </div>
  );
}

// ── Web Scraper tab ───────────────────────────────────────────────────────────
function ScraperTab() {
  return (
    <div className="space-y-3">
      <div className="text-[10px] text-primary/40 font-mono border border-primary/10 rounded px-3 py-2 bg-primary/5 leading-relaxed">
        Alpha Web Scraper™ — browser-based crawler with built-in SQLite. Captures pages, links, emails, phone numbers,
        OpenGraph data, JSON-LD, forms, and assets into 14 queryable tables. Export as .sqlite, CSV, or JSON.
      </div>
      <div className="text-[9px] text-purple-400 font-mono border border-purple-500/20 bg-purple-900/10 px-3 py-1.5 rounded">
        Enable the 🧅 <strong>Tor Mode</strong> toggle inside the scraper (top-right) to route all fetches through Tor circuits.
        Open this dashboard in Tor Browser for full end-to-end anonymity.
      </div>
      <div className="border border-primary/15 rounded overflow-hidden" style={{ height: "800px" }}>
        <iframe src={SCRAPER_URL} title="Alpha Web Scraper"
          className="w-full h-full border-0 bg-black"
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups" />
      </div>
    </div>
  );
}

// ── App Scanner tab ───────────────────────────────────────────────────────────
type AppJobStatus = "idle" | "uploading" | "running" | "complete" | "error";

interface AppFinding {
  layer:   string;
  sev:     "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title:   string;
  detail:  string;
  file?:   string;
  line?:   number;
  snippet?: string;
  cve?:    string;
}

interface AppScanResult {
  total_findings: number;
  by_severity:    Record<string, number>;
  app_info:       {
    languages:   string[];
    frameworks:  string[];
    databases:   string[];
    cloud:       string[];
    total_files: number;
    total_lines: number;
    test_files:  number;
  };
  findings: AppFinding[];
}

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "text-red-400 border-red-500/40 bg-red-900/10",
  HIGH:     "text-orange-400 border-orange-500/40 bg-orange-900/10",
  MEDIUM:   "text-yellow-400 border-yellow-500/40 bg-yellow-900/10",
  LOW:      "text-blue-400 border-blue-500/40 bg-blue-900/10",
  INFO:     "text-primary/40 border-primary/20 bg-primary/5",
};
const SEV_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };

function AppFindingRow({ f }: { f: AppFinding }) {
  const [open, setOpen] = useState(false);
  const cls = SEV_COLORS[f.sev] || SEV_COLORS.INFO;
  const layerIcon =
    f.layer === "Dependency CVE" ? <PackageSearch className="w-3 h-3 shrink-0" /> :
    f.layer === "Secret Detection" ? <Key className="w-3 h-3 shrink-0" /> :
    f.layer === "SAST"            ? <FileCode2 className="w-3 h-3 shrink-0" /> :
    <AlertTriangle className="w-3 h-3 shrink-0" />;

  return (
    <div className={`border rounded mb-1 ${cls}`}>
      <button className="w-full flex items-start gap-2 px-3 py-2 text-left" onClick={() => setOpen(o => !o)}>
        <span className="text-[9px] font-mono font-bold uppercase shrink-0 mt-0.5 w-16">{f.sev}</span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-primary/60 shrink-0">
          {layerIcon} {f.layer}
        </span>
        <span className="flex-1 text-[10px] font-mono text-primary/90 truncate">{f.title}</span>
        {f.cve && <span className="text-[8px] font-mono text-primary/30 border border-primary/15 px-1 rounded shrink-0">{f.cve}</span>}
        {open ? <ChevronUp className="w-3 h-3 shrink-0 text-primary/30" /> : <ChevronDown className="w-3 h-3 shrink-0 text-primary/30" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          <div className="text-[10px] text-primary/60 font-mono">{f.detail}</div>
          {f.file && (
            <div className="text-[9px] font-mono text-primary/30">
              {f.file}{f.line ? `:${f.line}` : ""}
            </div>
          )}
          {f.snippet && (
            <pre className="text-[9px] font-mono text-primary/60 bg-black border border-primary/10 rounded p-2 overflow-auto whitespace-pre-wrap break-all leading-relaxed">
              {f.snippet}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function AppScannerTab() {
  const { toast }           = useToast();
  const [status, setStatus] = useState<AppJobStatus>("idle");
  const [jobId, setJobId]   = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [result, setResult] = useState<AppScanResult | null>(null);
  const [htmlReady, setHtmlReady] = useState(false);
  const [jsonReady, setJsonReady] = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [sevFilter, setSevFilter] = useState<string>("ALL");
  const fileRef  = useRef<HTMLInputElement>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const reset = () => {
    stopPolling();
    setStatus("idle"); setJobId(null); setFilename(null); setOutput(null);
    setResult(null); setHtmlReady(false); setJsonReady(false);
  };

  const uploadAndScan = useCallback(async (file: File) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowed = ["zip","tar","gz","tgz","bz2"];
    if (!ext || !allowed.includes(ext)) {
      toast({ title: "Invalid file type", description: "Upload a .zip, .tar.gz, or .tgz archive", variant: "destructive" });
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum archive size is 100 MB", variant: "destructive" });
      return;
    }

    reset();
    setStatus("uploading");
    setFilename(file.name);

    const form = new FormData();
    form.append("archive", file);

    try {
      const r = await fetch(`${BASE}/api/alpha/app-scan`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const d = await r.json();
      if (!r.ok) {
        toast({ title: "Upload failed", description: d.error, variant: "destructive" });
        setStatus("error");
        return;
      }
      setJobId(d.jobId);
      setStatus("running");
      toast({ title: "App scan started", description: `${file.name} · Job ${d.jobId}` });

      pollRef.current = setInterval(async () => {
        try {
          const pr = await fetch(`${BASE}/api/alpha/app-scan/${d.jobId}`, { credentials: "include" });
          const pd = await pr.json();
          if (pd.htmlReady) setHtmlReady(true);
          if (pd.jsonReady) setJsonReady(true);
          if (pd.status !== "running") {
            setStatus(pd.status as AppJobStatus);
            setOutput(pd.output ?? "No output");
            stopPolling();
            // Fetch JSON summary for display
            if (pd.jsonReady) {
              try {
                const jr = await fetch(`${BASE}/api/alpha/app-scan/${d.jobId}/json`, { credentials: "include" });
                if (jr.ok) setResult(await jr.json());
              } catch {}
            }
          }
        } catch {}
      }, 3000);
    } catch (e: any) {
      setStatus("error");
      setOutput("Error: " + e.message);
    }
  }, [toast]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) uploadAndScan(f);
    e.target.value = "";
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) uploadAndScan(f);
  };

  const downloadReport = async (fmt: "html" | "json") => {
    if (!jobId) return;
    const r = await fetch(`${BASE}/api/alpha/app-scan/${jobId}/${fmt}`, { credentials: "include" });
    if (!r.ok) { toast({ title: "Report not ready", variant: "destructive" }); return; }
    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `app-scan-${jobId}.${fmt}`; a.click();
    URL.revokeObjectURL(url);
  };

  const filteredFindings = result
    ? (sevFilter === "ALL" ? result.findings : result.findings.filter(f => f.sev === sevFilter))
        .slice().sort((a, b) => (SEV_ORDER[a.sev] ?? 9) - (SEV_ORDER[b.sev] ?? 9))
    : [];

  const SEVS = ["CRITICAL","HIGH","MEDIUM","LOW","INFO"];

  return (
    <div className="space-y-5">
      {/* Description */}
      <div className="text-[10px] text-primary/40 font-mono border border-primary/10 rounded px-3 py-2 bg-primary/5 leading-relaxed">
        <strong className="text-primary/70">Alpha App Scanner™ v1.0</strong> — Upload a ZIP or TAR archive of any application.
        Runs 3 deep analysis layers:
        <span className="text-orange-400 font-bold"> ① Dependency CVE detection</span> (npm, pip, Go, Ruby, Java) ·
        <span className="text-red-400 font-bold"> ② Secret &amp; credential scanning</span> (AWS/GCP/Stripe/JWT/private keys/passwords) ·
        <span className="text-yellow-400 font-bold"> ③ SAST static analysis</span> (SQL injection, XSS, RCE, path traversal, deserialization in 8 languages).
        Generates a full HTML + JSON report.
      </div>

      {/* Upload zone */}
      {status === "idle" && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-lg py-12 cursor-pointer transition-colors
            ${dragOver ? "border-primary bg-primary/5" : "border-primary/20 hover:border-primary/40"}`}
        >
          <Upload className={`w-10 h-10 ${dragOver ? "text-primary" : "text-primary/30"}`} />
          <div className="text-center">
            <div className="text-sm font-mono text-primary/60 font-bold">Drop your application archive here</div>
            <div className="text-[10px] font-mono text-primary/30 mt-1">
              .zip · .tar.gz · .tgz · .bz2 · max 100 MB
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/30 text-primary text-[10px] font-mono uppercase tracking-widest hover:bg-primary/20 rounded transition-colors">
            <Upload className="w-3 h-3" /> Browse File
          </button>
          <input ref={fileRef} type="file" accept=".zip,.tar,.gz,.tgz,.bz2" className="hidden" onChange={onFileChange} />
        </div>
      )}

      {/* Status */}
      {status === "uploading" && (
        <div className="flex items-center gap-3 text-[10px] font-mono text-yellow-400 border border-yellow-500/20 bg-yellow-900/10 px-4 py-3 rounded">
          <Loader2 className="w-4 h-4 animate-spin" />
          Uploading <strong>{filename}</strong> and initializing scan...
        </div>
      )}
      {status === "running" && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-[10px] font-mono text-yellow-400 border border-yellow-500/20 bg-yellow-900/10 px-4 py-3 rounded">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>
              Scanning <strong>{filename}</strong> — Job {jobId}
              <span className="ml-2 text-primary/40">Running dependency CVE, secret detection, and SAST analysis...</span>
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[9px] font-mono text-primary/40">
            <div className="border border-orange-500/20 bg-orange-900/5 rounded px-2 py-1.5 flex items-center gap-1.5">
              <PackageSearch className="w-3 h-3 text-orange-400" /> Dependency CVE scan
            </div>
            <div className="border border-red-500/20 bg-red-900/5 rounded px-2 py-1.5 flex items-center gap-1.5">
              <Key className="w-3 h-3 text-red-400" /> Secret detection
            </div>
            <div className="border border-yellow-500/20 bg-yellow-900/5 rounded px-2 py-1.5 flex items-center gap-1.5">
              <FileCode2 className="w-3 h-3 text-yellow-400" /> SAST analysis
            </div>
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-3 text-[10px] font-mono text-red-400 border border-red-500/20 bg-red-900/10 px-4 py-3 rounded">
          <XCircle className="w-4 h-4 shrink-0" />
          Scan failed — see output below
          <button onClick={reset} className="ml-auto flex items-center gap-1 text-primary/40 hover:text-primary">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
      )}

      {/* Results header */}
      {status === "complete" && result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-[10px] font-mono text-green-400 font-bold">
              SCAN COMPLETE — {result.total_findings} findings in {filename}
            </span>
            {htmlReady && (
              <button onClick={() => downloadReport("html")}
                className="flex items-center gap-1.5 text-[9px] font-mono text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/40 px-3 py-1.5 transition-colors rounded">
                <Download className="w-3 h-3" /> HTML Report
              </button>
            )}
            {jsonReady && (
              <button onClick={() => downloadReport("json")}
                className="flex items-center gap-1.5 text-[9px] font-mono text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/40 px-3 py-1.5 transition-colors rounded">
                <Download className="w-3 h-3" /> JSON Report
              </button>
            )}
            <button onClick={reset}
              className="flex items-center gap-1 text-[9px] text-primary/40 hover:text-primary font-mono ml-auto">
              <RotateCcw className="w-3 h-3" /> Scan Another App
            </button>
          </div>

          {/* Severity stats */}
          <div className="grid grid-cols-5 gap-2">
            {SEVS.map(s => (
              <div key={s} className={`border rounded p-2 text-center cursor-pointer transition-colors ${SEV_COLORS[s]} ${sevFilter === s ? "ring-1 ring-current" : ""}`}
                onClick={() => setSevFilter(sevFilter === s ? "ALL" : s)}>
                <div className="text-lg font-bold font-mono">{result.by_severity[s] ?? 0}</div>
                <div className="text-[8px] uppercase mt-0.5">{s}</div>
              </div>
            ))}
          </div>

          {/* App fingerprint */}
          {result.app_info && (
            <div className="border border-primary/15 rounded p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] font-mono">
              {result.app_info.languages?.length > 0 && (
                <div>
                  <div className="text-primary/30 uppercase text-[8px] mb-1">Languages</div>
                  <div className="text-primary/80">{result.app_info.languages.join(", ")}</div>
                </div>
              )}
              {result.app_info.frameworks?.length > 0 && (
                <div>
                  <div className="text-primary/30 uppercase text-[8px] mb-1">Frameworks</div>
                  <div className="text-primary/80">{result.app_info.frameworks.join(", ")}</div>
                </div>
              )}
              {result.app_info.databases?.length > 0 && (
                <div>
                  <div className="text-primary/30 uppercase text-[8px] mb-1">Databases</div>
                  <div className="text-primary/80">{result.app_info.databases.join(", ")}</div>
                </div>
              )}
              <div>
                <div className="text-primary/30 uppercase text-[8px] mb-1">Size</div>
                <div className="text-primary/80">
                  {result.app_info.total_files?.toLocaleString()} files ·{" "}
                  {result.app_info.total_lines?.toLocaleString()} lines
                </div>
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-mono text-primary/30 uppercase">Filter:</span>
            <button onClick={() => setSevFilter("ALL")}
              className={`text-[9px] font-mono px-2 py-0.5 border rounded transition-colors ${sevFilter === "ALL" ? "border-primary text-primary bg-primary/10" : "border-primary/20 text-primary/40 hover:border-primary/40"}`}>
              All ({result.total_findings})
            </button>
            {SEVS.filter(s => (result.by_severity[s] ?? 0) > 0).map(s => (
              <button key={s} onClick={() => setSevFilter(sevFilter === s ? "ALL" : s)}
                className={`text-[9px] font-mono px-2 py-0.5 border rounded transition-colors ${SEV_COLORS[s]} ${sevFilter === s ? "ring-1 ring-current" : "opacity-60"}`}>
                {s} ({result.by_severity[s]})
              </button>
            ))}
          </div>

          {/* Findings list */}
          <div className="space-y-0.5">
            {filteredFindings.length === 0 ? (
              <div className="flex items-center gap-2 text-[10px] font-mono text-green-400 border border-green-500/20 bg-green-900/10 px-3 py-2 rounded">
                <ShieldCheck className="w-3.5 h-3.5" /> No findings for this severity filter
              </div>
            ) : (
              filteredFindings.map((f, i) => <AppFindingRow key={i} f={f} />)
            )}
          </div>
        </div>
      )}

      {/* Raw output terminal */}
      {output && (
        <div className="mt-4">
          <div className="text-[9px] text-primary/30 font-mono uppercase tracking-widest mb-1">Scanner Output</div>
          <pre className="text-[10px] font-mono text-primary/70 bg-black border border-primary/10 rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap leading-relaxed">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AlphaTools() {
  const [tab, setTab]             = useState<Tab>("scanner");
  const [useTor, setUseTor]       = useState(false);
  const [torStatus, setTorStatus] = useState<TorStatus | null>(null);
  // Scanner → Verifier handoff: jobId that has a fresh HTML report
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);

  // Poll Tor status every 20s
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${BASE}/api/alpha/tor-status`, { credentials: "include" });
        if (r.ok) setTorStatus(await r.json());
      } catch {}
    };
    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  }, []);

  // When scanner reports a finished HTML report, switch to verifier and auto-load
  const handleReportReady = useCallback((jobId: string) => {
    setPendingJobId(jobId);
    setTab("verifier");
  }, []);

  const TABS: { id: Tab; label: string; icon: React.ElementType; dot?: boolean }[] = [
    { id: "scanner",  label: "Universal Scanner",  icon: ScanSearch },
    { id: "verifier", label: "Vuln Verifier",      icon: Bug, dot: !!pendingJobId },
    { id: "scraper",  label: "Web Scraper",        icon: Globe2 },
    { id: "appscan",  label: "App Scanner",        icon: PackageSearch },
  ];

  return (
    <div className="space-y-5 font-mono max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold tracking-widest uppercase text-primary flex items-center gap-2">
            <Layers className="w-5 h-5" /> Alpha Toolkit
          </h1>
          <p className="text-xs text-primary/40 mt-0.5">
            Universal Scanner → HTML report → Vuln Verifier pipeline · Web Scraper · all tools Tor-cloakable
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TorBadge status={torStatus} />
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-[9px] font-mono text-primary/50 uppercase tracking-widest">Tor Cloak</span>
            <div onClick={() => setUseTor(v => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${useTor ? "bg-purple-600" : "bg-primary/20"}`}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${useTor ? "translate-x-5" : ""}`} />
            </div>
          </label>
        </div>
      </div>

      {/* Tor banner */}
      {useTor && (
        <div className="flex items-center gap-2 text-[10px] font-mono text-purple-300 border border-purple-500/30 bg-purple-900/20 px-4 py-2 rounded">
          <Wifi className="w-3.5 h-3.5 shrink-0 text-purple-400" />
          <span>
            <strong>Tor Cloak ON</strong> — nmap, SQLmap, Alpha Scanner, and Vuln Verifier traffic all exit through Tor (SOCKS5 127.0.0.1:9050).
            {!torStatus?.connected && <span className="text-yellow-400 ml-2">⚠ Tor appears offline — restart may be needed.</span>}
          </span>
        </div>
      )}

      {/* Workflow hint */}
      <div className="flex items-center gap-2 text-[9px] font-mono text-primary/30 border border-primary/10 rounded px-3 py-2">
        <ScanSearch className="w-3 h-3 shrink-0" />
        Scanner generates HTML report
        <ArrowRight className="w-3 h-3 shrink-0" />
        click <strong className="text-primary/50">Send to Verifier</strong>
        <ArrowRight className="w-3 h-3 shrink-0" />
        Verifier actively probes every finding against the live target
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-primary/15">
        {TABS.map(({ id, label, icon: Icon, dot }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`relative flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-widest border-b-2 transition-colors ${tab === id ? "border-primary text-primary bg-primary/5" : "border-transparent text-primary/40 hover:text-primary/70"}`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
            {dot && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse absolute top-2 right-2" />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === "scanner"  && <ScannerTab useTor={useTor} onReportReady={handleReportReady} />}
        {tab === "verifier" && (
          <VerifierTab
            useTor={useTor}
            prefillJobId={pendingJobId}
            onConsumed={() => setPendingJobId(null)}
          />
        )}
        {tab === "scraper"  && <ScraperTab />}
        {tab === "appscan"  && <AppScannerTab />}
      </div>
    </div>
  );
}
