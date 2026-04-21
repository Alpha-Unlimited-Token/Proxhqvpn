import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  ScanSearch, ShieldAlert, Globe2,
  Wifi, WifiOff, Play, Loader2, Square,
  Download, RotateCcw, Layers, Bug,
  ArrowRight, FileText, CheckCircle,
} from "lucide-react";

const BASE        = import.meta.env.BASE_URL.replace(/\/$/, "");
const SCRAPER_URL = `${import.meta.env.BASE_URL}AlphaWebScraper.html`;

type Tab       = "scanner" | "verifier" | "scraper";
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
      </div>
    </div>
  );
}
