// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useRef } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Shield, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, Play, Globe, Zap,
  Database, Lock, RefreshCw, Square, Download,
  Wifi, FileText, XCircle,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    credentials: "include",
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${r.status}`);
  }
  return r.json();
}

type ScanConfig = {
  url: string;
  level: number;
  risk: number;
  forms: boolean;
  randomAgent: boolean;
  crawl: number;
  fullCrawl: boolean;
  portScan: boolean;
  dbms: string;
  dumpAll: boolean;
};

const LEVEL_LABELS: Record<number, { label: string; desc: string }> = {
  1: { label: "Basic",    desc: "Fast, minimal noise — good starting point" },
  2: { label: "Standard", desc: "Covers common injection patterns" },
  3: { label: "Deep",     desc: "Tests cookies, User-Agent, Referer headers" },
  4: { label: "Extended", desc: "Tests all HTTP parameters thoroughly" },
  5: { label: "Maximum",  desc: "Exhaustive — very slow, tests everything" },
};

const RISK_LABELS: Record<number, { label: string; desc: string; color: string }> = {
  1: { label: "Safe",       desc: "Read-only queries only — won't alter data",   color: "text-primary" },
  2: { label: "Moderate",   desc: "May run heavy queries on the target DB",      color: "text-yellow-400" },
  3: { label: "Aggressive", desc: "May trigger stacked queries — use carefully", color: "text-red-400" },
};

const DBMS_OPTIONS = ["", "MySQL", "PostgreSQL", "Microsoft SQL Server", "Oracle", "SQLite", "MariaDB"];
const STEP_ICONS = [Globe, Search, Database, Shield];
const STEPS = ["Enter Target", "Configure Scan", "Review & Launch", "Results"];

function TerminalLine({ line }: { line: string }) {
  const isWarning = /\[WARNING\]/i.test(line);
  const isError   = /\[ERROR\]/i.test(line);
  const isSuccess = /\[INFO\].*found|vulnerable|injection/i.test(line) || /\[SUCCESS\]/i.test(line);
  const isInfo    = /\[INFO\]/i.test(line);
  const isCancelled = /CANCELLED/i.test(line);
  const color = isCancelled ? "text-orange-400" : isError ? "text-red-400" : isWarning ? "text-yellow-400" : isSuccess ? "text-primary" : isInfo ? "text-white/88" : "text-white/78";
  return <div className={`text-xs font-mono leading-relaxed ${color}`}>{line}</div>;
}

function PortLine({ line }: { line: string }) {
  const isOpen  = /\d+\/tcp\s+open/i.test(line);
  const isInfo  = /\[PORT SCAN\]/.test(line);
  const color = isOpen ? "text-primary font-semibold" : isInfo ? "text-blue-400" : "text-white/83";
  return <div className={`text-xs font-mono leading-relaxed ${color}`}>{line}</div>;
}

function Toggle({ value, onChange, label, desc }: { value: boolean; onChange: () => void; label: string; desc: string }) {
  return (
    <div
      onClick={onChange}
      className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] cursor-pointer transition-all"
    >
      <div>
        <div className="text-sm text-white/93 font-medium">{label}</div>
        <div className="text-xs text-white/78 mt-0.5">{desc}</div>
      </div>
      <div className={`w-9 h-5 rounded-full border transition-all shrink-0 ${value ? "bg-primary/30 border-primary/50" : "bg-white/5 border-white/10"}`}>
        <div className={`w-3.5 h-3.5 rounded-full bg-white/80 mt-0.5 transition-all ${value ? "ml-4 bg-primary" : "ml-0.5"}`} />
      </div>
    </div>
  );
}

export default function SqlmapScanner() {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [scanId, setScanId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = usePersistedState<"sqli" | "ports">("sqlmap-tab", "sqli");
  const sqlRef = useRef<HTMLDivElement>(null);
  const portRef = useRef<HTMLDivElement>(null);

  const [config, setConfig] = useState<ScanConfig>({
    url: "", level: 1, risk: 1,
    forms: true, randomAgent: true,
    crawl: 0, fullCrawl: false,
    portScan: false,
    dbms: "", dumpAll: false,
  });

  const { data: status } = useQuery({
    queryKey: ["sqlmap-status"],
    queryFn: () => apiFetch("/api/sqlmap/status"),
  });

  const { data: scanData } = useQuery({
    queryKey: ["sqlmap-scan", scanId],
    queryFn: () => apiFetch(`/api/sqlmap/scan/${scanId}`),
    enabled: !!scanId,
    refetchInterval: (data: any) => (data?.done && data?.portDone ? false : 2000),
  });

  const startScan = useMutation({
    mutationFn: (cfg: ScanConfig) =>
      apiFetch("/api/sqlmap/scan", { method: "POST", body: JSON.stringify({ ...cfg, batch: true }) }),
    onSuccess: (data) => { setScanId(data.scanId); setStep(3); },
    onError: (e: Error) => toast({ title: "Scan failed to start", description: e.message, variant: "destructive" }),
  });

  const stopScan = useMutation({
    mutationFn: () => apiFetch(`/api/sqlmap/scan/${scanId}`, { method: "DELETE" }),
    onSuccess: () => toast({ title: "Scan cancelled", description: "The scan was stopped." }),
    onError: (e: Error) => toast({ title: "Stop failed", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (sqlRef.current) sqlRef.current.scrollTop = sqlRef.current.scrollHeight;
  }, [scanData?.output]);

  useEffect(() => {
    if (portRef.current) portRef.current.scrollTop = portRef.current.scrollHeight;
  }, [scanData?.portOutput]);

  const sqlLines: string[]  = scanData?.output ?? [];
  const portLines: string[] = scanData?.portOutput ?? [];
  const scanDone  = scanData?.done ?? false;
  const portDone  = scanData?.portDone ?? true;
  const allDone   = scanDone && portDone;
  const vulnerable = sqlLines.some(l => /vulnerable|injection point found/i.test(l));
  const openPorts  = portLines.filter(l => /\d+\/tcp\s+open/i.test(l));

  const canProceed = step === 0 ? config.url.length > 6 && config.url.startsWith("http") : true;

  function downloadReport(format: "html" | "json") {
    if (!scanId) return;
    const url = `${BASE}/api/sqlmap/scan/${scanId}/report?format=${format}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `proxhqvpn-scan-${scanId}.${format}`;
    a.click();
  }

  function resetScan() {
    setScanId(null);
    setStep(0);
    setActiveTab("sqli");
    setConfig({ url: "", level: 1, risk: 1, forms: true, randomAgent: true, crawl: 0, fullCrawl: false, portScan: false, dbms: "", dumpAll: false });
  }

  const crawlLabel = config.fullCrawl ? "Full site (all pages)" : config.crawl === 0 ? "Off" : `Depth ${config.crawl}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center">
          <Search className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Vulnerability Scanner</h1>
          <div className="text-sm text-white/78 mt-0.5">
            Powered by SQLMap {status?.version ?? "…"} + nmap · For testing websites you own
          </div>
        </div>
        {status?.installed && (
          <span className="ml-auto text-[11px] font-medium text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
            Ready
          </span>
        )}
      </div>

      {/* Warning banner */}
      <div className="flex gap-3 bg-yellow-500/8 border border-yellow-500/20 rounded-2xl px-5 py-4">
        <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-sm text-yellow-400/80 leading-relaxed">
          Only scan websites and web applications you own or have written permission to test.
          Unauthorized scanning is illegal.
        </p>
      </div>

      {/* Wizard steps */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = STEP_ICONS[i];
          const active = step === i;
          const done   = step > i;
          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 flex-1 ${i < STEPS.length - 1 ? "min-w-0" : ""}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                  done   ? "bg-primary/20 border-primary/40" :
                  active ? "bg-primary/15 border-primary/50" : "bg-white/[0.03] border-white/10"
                }`}>
                  {done ? <CheckCircle className="w-3.5 h-3.5 text-primary" /> : <Icon className={`w-3.5 h-3.5 ${active ? "text-primary" : "text-white/70"}`} />}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${active ? "text-white/93" : done ? "text-primary/60" : "text-white/70"}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`h-px flex-1 mx-1 ${step > i ? "bg-primary/30" : "bg-white/8"}`} />}
            </div>
          );
        })}
      </div>

      {/* ── Step 0: Enter Target ── */}
      {step === 0 && (
        <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-6 space-y-5">
          <div>
            <div className="text-base font-semibold text-white mb-1">What website do you want to test?</div>
            <div className="text-sm text-white/78">Enter the full URL including http:// or https://</div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 focus-within:border-primary/40 transition-colors">
              <Globe className="w-4 h-4 text-white/70 shrink-0" />
              <input
                type="url"
                placeholder="https://your-website.com"
                value={config.url}
                onChange={e => setConfig(c => ({ ...c, url: e.target.value }))}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
              />
            </div>
            {config.url && !config.url.startsWith("http") && (
              <p className="text-xs text-red-400/70 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> URL must start with http:// or https://
              </p>
            )}
          </div>
          <div className="text-xs text-white/70 leading-relaxed">
            Tip: For SQLi, use a page with a login form or a URL with parameters like
            <span className="font-mono text-white/78"> ?id=1</span>. For full site scanning, just enter the homepage.
          </div>
        </div>
      )}

      {/* ── Step 1: Configure ── */}
      {step === 1 && (
        <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-6 space-y-6">
          <div>
            <div className="text-base font-semibold text-white mb-1">Scan settings</div>
            <div className="text-sm text-white/78">Start with defaults — they work well for most websites</div>
          </div>

          {/* SQLi Level */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-white/88">Scan Depth</div>
              <div className="text-xs text-primary font-medium">{LEVEL_LABELS[config.level].label}</div>
            </div>
            <input type="range" min={1} max={5} step={1} value={config.level}
              onChange={e => setConfig(c => ({ ...c, level: Number(e.target.value) }))}
              className="w-full accent-primary" />
            <div className="text-xs text-white/78">{LEVEL_LABELS[config.level].desc}</div>
          </div>

          {/* Risk */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-white/88">Risk Level</div>
              <div className={`text-xs font-medium ${RISK_LABELS[config.risk].color}`}>{RISK_LABELS[config.risk].label}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(r => (
                <button key={r} onClick={() => setConfig(c => ({ ...c, risk: r }))}
                  className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    config.risk === r ? `${RISK_LABELS[r].color} bg-white/5 border-white/15` : "text-white/78 border-white/[0.06] hover:border-white/15"
                  }`}>
                  {RISK_LABELS[r].label}
                </button>
              ))}
            </div>
            <div className="text-xs text-white/78">{RISK_LABELS[config.risk].desc}</div>
          </div>

          {/* Common toggles */}
          <div className="space-y-2">
            <Toggle value={config.forms} onChange={() => setConfig(c => ({ ...c, forms: !c.forms }))}
              label="Auto-detect forms" desc="Scan all forms on the page automatically" />
            <Toggle value={config.randomAgent} onChange={() => setConfig(c => ({ ...c, randomAgent: !c.randomAgent }))}
              label="Random browser ID" desc="Disguise scanner as a normal browser" />
          </div>

          {/* Full site crawl */}
          <div className="space-y-3 border border-primary/15 bg-primary/[0.03] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-primary/60" />
              <div className="text-sm font-semibold text-white/93">Page Crawl &amp; Site Coverage</div>
            </div>

            <Toggle value={config.fullCrawl}
              onChange={() => setConfig(c => ({ ...c, fullCrawl: !c.fullCrawl, crawl: c.fullCrawl ? 0 : 10 }))}
              label="Full site crawl — scan ALL pages"
              desc="Follows every link and subpage on the site. Can be slow on large sites but finds hidden vulnerabilities." />

            {!config.fullCrawl && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/83 font-medium">Manual crawl depth</div>
                  <div className="text-xs text-primary font-mono">{config.crawl === 0 ? "Off (single page)" : `${config.crawl} links deep`}</div>
                </div>
                <input type="range" min={0} max={20} step={1} value={config.crawl}
                  onChange={e => setConfig(c => ({ ...c, crawl: Number(e.target.value) }))}
                  className="w-full accent-primary" />
                <div className="flex justify-between text-[10px] text-white/70 font-mono">
                  <span>Off</span><span>5</span><span>10</span><span>15</span><span>20</span>
                </div>
                <div className="text-xs text-white/70">
                  {config.crawl === 0 ? "Only scans the target URL — fast but may miss linked pages." :
                   config.crawl <= 3  ? "Follows up to " + config.crawl + " links deep — good for most sites." :
                   config.crawl <= 10 ? "Deep crawl — follows " + config.crawl + " levels of links." :
                                        "Very deep crawl — follows " + config.crawl + " levels. Slow on large sites."}
                </div>
              </div>
            )}

            {config.fullCrawl && (
              <div className="text-xs text-primary/60 flex items-center gap-1.5 mt-1">
                <Zap className="w-3 h-3" />
                Auto-crawl set to depth 10 — will follow all links found on the site.
              </div>
            )}
          </div>

          {/* Port scan */}
          <div className="border border-blue-500/15 bg-blue-500/[0.03] rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Wifi className="w-4 h-4 text-blue-400/60" />
              <div className="text-sm font-semibold text-white/93">Port Scan</div>
              <span className="text-[10px] text-blue-400 bg-blue-400/10 border border-blue-400/20 rounded-full px-2 py-0.5">nmap</span>
            </div>
            <Toggle value={config.portScan} onChange={() => setConfig(c => ({ ...c, portScan: !c.portScan }))}
              label="Scan for open ports"
              desc="Runs nmap against the target host — discovers open services (SSH, FTP, databases, etc.)" />
            {config.portScan && (
              <div className="text-xs text-blue-400/60 flex items-center gap-1.5">
                <Wifi className="w-3 h-3" />
                nmap will scan the top 1000 ports with service version detection (runs in parallel with SQLi scan).
              </div>
            )}
          </div>

          {/* Advanced */}
          <button onClick={() => setShowAdvanced(v => !v)} className="flex items-center gap-2 text-xs text-white/70 hover:text-white/50 transition-colors">
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Advanced options
          </button>
          {showAdvanced && (
            <div className="space-y-4 pt-1">
              <div className="space-y-2">
                <div className="text-xs text-white/83 font-medium">Database type (optional)</div>
                <select value={config.dbms} onChange={e => setConfig(c => ({ ...c, dbms: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white/88 focus:outline-none focus:border-primary/40">
                  <option value="" className="bg-[#0d1610]">Auto-detect</option>
                  {DBMS_OPTIONS.filter(Boolean).map(d => <option key={d} value={d} className="bg-[#0d1610]">{d}</option>)}
                </select>
              </div>
              <Toggle value={config.dumpAll} onChange={() => setConfig(c => ({ ...c, dumpAll: !c.dumpAll }))}
                label="Dump all database data"
                desc="If injection found, extract all tables and data (aggressive — use with permission only)" />
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Review ── */}
      {step === 2 && (
        <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-6 space-y-5">
          <div>
            <div className="text-base font-semibold text-white mb-1">Ready to scan</div>
            <div className="text-sm text-white/78">Review your settings before launching</div>
          </div>
          <div className="space-y-0">
            {[
              { label: "Target URL",      value: config.url },
              { label: "SQLi Level",      value: `Level ${config.level} — ${LEVEL_LABELS[config.level].label}` },
              { label: "Risk Level",      value: `${config.risk} — ${RISK_LABELS[config.risk].label}` },
              { label: "Form scanning",   value: config.forms ? "Enabled" : "Disabled" },
              { label: "Browser disguise",value: config.randomAgent ? "Enabled" : "Disabled" },
              { label: "Page crawl",      value: config.fullCrawl ? "Full site crawl (depth 10)" : config.crawl === 0 ? "Disabled (single page)" : `Depth ${config.crawl}` },
              { label: "Port scan",       value: config.portScan ? "Enabled — nmap top 1000 ports" : "Disabled" },
              ...(config.dbms ? [{ label: "Database type", value: config.dbms }] : []),
              ...(config.dumpAll ? [{ label: "Dump all data", value: "Enabled" }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2.5 border-b border-white/[0.05] last:border-0">
                <span className="text-sm text-white/78">{label}</span>
                <span className="text-sm text-white/93 font-medium font-mono truncate max-w-xs text-right">{value}</span>
              </div>
            ))}
          </div>
          <div className="bg-yellow-500/8 border border-yellow-500/15 rounded-xl p-4 text-xs text-yellow-400/70 leading-relaxed">
            This will send HTTP requests{config.portScan ? " and port probe packets" : ""} to{" "}
            <strong className="text-yellow-400">{config.url}</strong>.
            Only continue if you own this website or have explicit written permission.
          </div>
        </div>
      )}

      {/* ── Step 3: Results ── */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Status row */}
          <div className={`flex flex-wrap items-center gap-3 px-5 py-4 rounded-2xl border ${
            vulnerable ? "bg-red-500/10 border-red-500/25" :
            allDone    ? "bg-primary/10 border-primary/25" : "bg-white/[0.03] border-white/[0.07]"
          }`}>
            <div className="flex items-center gap-2 flex-1">
              {!allDone ? (
                <><RefreshCw className="w-4 h-4 text-primary animate-spin shrink-0" />
                  <span className="text-sm font-medium text-white/88">
                    {!scanDone ? "SQLi scan running…" : !portDone ? "Port scan running…" : "Processing…"}
                  </span></>
              ) : vulnerable ? (
                <><AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-sm font-semibold text-red-400">SQL injection vulnerability found!</span></>
              ) : (
                <><CheckCircle className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold text-primary">No SQL injection vulnerabilities detected</span></>
              )}
            </div>
            {openPorts.length > 0 && (
              <span className="text-xs text-blue-400 bg-blue-400/10 border border-blue-400/20 rounded-full px-2.5 py-1">
                {openPorts.length} open port{openPorts.length !== 1 ? "s" : ""} found
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.07] rounded-xl">
            <button onClick={() => setActiveTab("sqli")}
              className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "sqli" ? "bg-primary/15 text-primary" : "text-white/78 hover:text-white/60"
              }`}>
              <Database className="w-3.5 h-3.5" /> SQL Injection
            </button>
            {config.portScan && (
              <button onClick={() => setActiveTab("ports")}
                className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === "ports" ? "bg-blue-400/15 text-blue-400" : "text-white/78 hover:text-white/60"
                }`}>
                <Wifi className="w-3.5 h-3.5" />
                Port Scan
                {!portDone && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
                {openPorts.length > 0 && (
                  <span className="bg-blue-400/20 text-blue-400 text-[10px] rounded-full px-1.5">{openPorts.length}</span>
                )}
              </button>
            )}
          </div>

          {/* Terminal panel — SQLi */}
          {activeTab === "sqli" && (
            <div className="bg-[#060b07] border border-white/[0.07] rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05] bg-white/[0.02]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-primary/50" />
                </div>
                <span className="text-xs text-white/70 font-mono ml-1">sqlmap output</span>
                {!scanDone && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs text-primary/60">Live</span>
                  </div>
                )}
                {scanDone && <span className="ml-auto text-xs text-white/70 font-mono">done · {sqlLines.length} lines</span>}
              </div>
              <div ref={sqlRef} className="h-80 overflow-y-auto p-4 space-y-0.5">
                {sqlLines.length === 0 ? (
                  <div className="text-xs text-white/70 font-mono">Waiting for output…</div>
                ) : sqlLines.map((line, i) => <TerminalLine key={i} line={line} />)}
              </div>
            </div>
          )}

          {/* Terminal panel — Ports */}
          {activeTab === "ports" && config.portScan && (
            <div className="bg-[#060b0f] border border-blue-400/10 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-blue-400/10 bg-white/[0.02]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-400/30" />
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-300/20" />
                </div>
                <span className="text-xs text-blue-400/40 font-mono ml-1">nmap output</span>
                {!portDone && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    <span className="text-xs text-blue-400/60">Scanning</span>
                  </div>
                )}
                {portDone && openPorts.length > 0 && (
                  <span className="ml-auto text-xs text-blue-400 font-medium">{openPorts.length} open port{openPorts.length !== 1 ? "s" : ""}</span>
                )}
              </div>
              <div ref={portRef} className="h-80 overflow-y-auto p-4 space-y-0.5">
                {portLines.length === 0 ? (
                  <div className="text-xs text-blue-400/20 font-mono">Waiting for nmap…</div>
                ) : portLines.map((line, i) => <PortLine key={i} line={line} />)}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {!allDone && (
              <button
                onClick={() => stopScan.mutate()}
                disabled={stopScan.isPending}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-red-500/25 text-sm text-red-400 hover:bg-red-500/10 transition-all"
              >
                <Square className="w-4 h-4" />
                Stop Scan
              </button>
            )}

            {allDone && (
              <>
                <button
                  onClick={() => downloadReport("html")}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-primary/25 text-sm text-primary hover:bg-primary/10 transition-all"
                >
                  <Download className="w-4 h-4" />
                  Download HTML Report
                </button>
                <button
                  onClick={() => downloadReport("json")}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-white/[0.08] text-sm text-white/83 hover:text-white/80 hover:bg-white/[0.05] transition-all"
                >
                  <FileText className="w-4 h-4" />
                  Download JSON
                </button>
                <button
                  onClick={resetScan}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-white/[0.08] text-sm text-white/83 hover:text-white/80 hover:bg-white/[0.05] transition-all ml-auto"
                >
                  <XCircle className="w-4 h-4" />
                  New Scan
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Navigation buttons (steps 0-2) */}
      {step < 3 && (
        <div className="flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="px-6 py-3 rounded-2xl border border-white/[0.08] text-sm text-white/83 hover:text-white/80 hover:bg-white/[0.05] transition-all">
              Back
            </button>
          )}
          <button
            onClick={() => { if (step === 2) startScan.mutate(config); else setStep(s => s + 1); }}
            disabled={!canProceed || startScan.isPending}
            className={`flex-1 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 ${
              step === 2 ? "bg-primary text-black hover:brightness-110 shadow-[0_0_30px_rgba(0,255,136,0.2)]" : "bg-white/[0.07] text-white/93 hover:bg-white/[0.1]"
            }`}>
            {startScan.isPending ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Starting…</>
            ) : step === 2 ? (
              <><Play className="w-4 h-4" /> Launch Scan</>
            ) : (
              "Continue →"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
