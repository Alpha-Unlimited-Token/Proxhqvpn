import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Shield, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, Play, Square,
  Globe, Zap, Database, Lock, RefreshCw
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
  1: { label: "Safe",       desc: "Read-only queries only — won't alter data", color: "text-primary" },
  2: { label: "Moderate",   desc: "May run heavy queries on the target DB",   color: "text-yellow-400" },
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
  const color = isError ? "text-red-400" : isWarning ? "text-yellow-400" : isSuccess ? "text-primary" : isInfo ? "text-white/60" : "text-white/40";
  return <div className={`text-xs font-mono leading-relaxed ${color}`}>{line}</div>;
}

export default function SqlmapScanner() {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [scanId, setScanId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  const [config, setConfig] = useState<ScanConfig>({
    url: "",
    level: 1,
    risk: 1,
    forms: true,
    randomAgent: true,
    crawl: 0,
    dbms: "",
    dumpAll: false,
  });

  const { data: status } = useQuery({
    queryKey: ["sqlmap-status"],
    queryFn: () => apiFetch("/api/sqlmap/status"),
  });

  const { data: scanData, refetch: refetchScan } = useQuery({
    queryKey: ["sqlmap-scan", scanId],
    queryFn: () => apiFetch(`/api/sqlmap/scan/${scanId}`),
    enabled: !!scanId,
    refetchInterval: (data: any) => (data?.done ? false : 2000),
  });

  const startScan = useMutation({
    mutationFn: (cfg: ScanConfig) =>
      apiFetch("/api/sqlmap/scan", {
        method: "POST",
        body: JSON.stringify({ ...cfg, batch: true }),
      }),
    onSuccess: (data) => {
      setScanId(data.scanId);
      setStep(3);
    },
    onError: (e: Error) => toast({ title: "Scan failed to start", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [scanData?.output]);

  const scanLines: string[] = scanData?.output ?? [];
  const scanDone = scanData?.done ?? false;
  const vulnerable = scanLines.some(l => /vulnerable|injection point found/i.test(l));
  const notVulnerable = scanDone && !vulnerable;

  const canProceed = step === 0 ? config.url.length > 6 && config.url.startsWith("http") : true;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center">
          <Search className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Vulnerability Scanner</h1>
          <div className="text-sm text-white/40 mt-0.5">
            Powered by SQLMap {status?.version ?? "…"} · For testing websites you own
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
                  done    ? "bg-primary/20 border-primary/40" :
                  active  ? "bg-primary/15 border-primary/50" :
                            "bg-white/[0.03] border-white/10"
                }`}>
                  {done
                    ? <CheckCircle className="w-3.5 h-3.5 text-primary" />
                    : <Icon className={`w-3.5 h-3.5 ${active ? "text-primary" : "text-white/25"}`} />
                  }
                </div>
                <span className={`text-xs font-medium hidden sm:block ${active ? "text-white/80" : done ? "text-primary/60" : "text-white/25"}`}>
                  {s}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px flex-1 mx-1 ${step > i ? "bg-primary/30" : "bg-white/8"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 0: Enter Target */}
      {step === 0 && (
        <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-6 space-y-5">
          <div>
            <div className="text-base font-semibold text-white mb-1">What website do you want to test?</div>
            <div className="text-sm text-white/40">Enter the full URL including http:// or https://</div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 focus-within:border-primary/40 transition-colors">
              <Globe className="w-4 h-4 text-white/30 shrink-0" />
              <input
                type="url"
                placeholder="https://your-website.com/login"
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
          <div className="text-xs text-white/30 leading-relaxed">
            Tip: For best results, use a page with a login form or a URL with parameters like
            <span className="font-mono text-white/40"> ?id=1</span>
          </div>
        </div>
      )}

      {/* Step 1: Configure */}
      {step === 1 && (
        <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-6 space-y-6">
          <div>
            <div className="text-base font-semibold text-white mb-1">Scan settings</div>
            <div className="text-sm text-white/40">Start with defaults — they work well for most websites</div>
          </div>

          {/* Level */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-white/70">Scan Depth</div>
              <div className="text-xs text-primary font-medium">{LEVEL_LABELS[config.level].label}</div>
            </div>
            <input
              type="range" min={1} max={5} step={1}
              value={config.level}
              onChange={e => setConfig(c => ({ ...c, level: Number(e.target.value) }))}
              className="w-full accent-primary"
            />
            <div className="text-xs text-white/35">{LEVEL_LABELS[config.level].desc}</div>
          </div>

          {/* Risk */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-white/70">Risk Level</div>
              <div className={`text-xs font-medium ${RISK_LABELS[config.risk].color}`}>{RISK_LABELS[config.risk].label}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(r => (
                <button
                  key={r}
                  onClick={() => setConfig(c => ({ ...c, risk: r }))}
                  className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    config.risk === r
                      ? `${RISK_LABELS[r].color} bg-white/5 border-white/15`
                      : "text-white/35 border-white/[0.06] hover:border-white/15"
                  }`}
                >
                  {RISK_LABELS[r].label}
                </button>
              ))}
            </div>
            <div className="text-xs text-white/35">{RISK_LABELS[config.risk].desc}</div>
          </div>

          {/* Common toggles */}
          <div className="space-y-2">
            {[
              { key: "forms",       label: "Auto-detect forms",     desc: "Scan all forms on the page automatically" },
              { key: "randomAgent", label: "Random browser ID",     desc: "Disguise scanner as a normal browser" },
            ].map(({ key, label, desc }) => (
              <div
                key={key}
                onClick={() => setConfig(c => ({ ...c, [key]: !c[key as keyof ScanConfig] }))}
                className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] cursor-pointer transition-all"
              >
                <div>
                  <div className="text-sm text-white/75 font-medium">{label}</div>
                  <div className="text-xs text-white/35 mt-0.5">{desc}</div>
                </div>
                <div className={`w-9 h-5 rounded-full border transition-all shrink-0 ${
                  config[key as keyof ScanConfig]
                    ? "bg-primary/30 border-primary/50"
                    : "bg-white/5 border-white/10"
                }`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white/80 mt-0.5 transition-all ${
                    config[key as keyof ScanConfig] ? "ml-4 bg-primary" : "ml-0.5"
                  }`} />
                </div>
              </div>
            ))}
          </div>

          {/* Advanced */}
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-2 text-xs text-white/30 hover:text-white/50 transition-colors"
          >
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Advanced options
          </button>
          {showAdvanced && (
            <div className="space-y-4 pt-1">
              <div className="space-y-2">
                <div className="text-xs text-white/50 font-medium">Database type (optional)</div>
                <select
                  value={config.dbms}
                  onChange={e => setConfig(c => ({ ...c, dbms: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white/70 focus:outline-none focus:border-primary/40"
                >
                  <option value="" className="bg-[#0d1610]">Auto-detect</option>
                  {DBMS_OPTIONS.filter(Boolean).map(d => (
                    <option key={d} value={d} className="bg-[#0d1610]">{d}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-white/50 font-medium">Page crawl depth</div>
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map(n => (
                    <button
                      key={n}
                      onClick={() => setConfig(c => ({ ...c, crawl: n }))}
                      className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-all ${
                        config.crawl === n
                          ? "text-primary border-primary/40 bg-primary/10"
                          : "text-white/35 border-white/[0.06] hover:border-white/15"
                      }`}
                    >
                      {n === 0 ? "Off" : `${n}`}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-white/30">How many links deep to follow from the target URL</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Review */}
      {step === 2 && (
        <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-6 space-y-5">
          <div>
            <div className="text-base font-semibold text-white mb-1">Ready to scan</div>
            <div className="text-sm text-white/40">Review your settings before launching</div>
          </div>
          <div className="space-y-2">
            {[
              { label: "Target URL",    value: config.url },
              { label: "Scan Depth",    value: `Level ${config.level} — ${LEVEL_LABELS[config.level].label}` },
              { label: "Risk Level",    value: `${config.risk} — ${RISK_LABELS[config.risk].label}` },
              { label: "Form scanning", value: config.forms ? "Enabled" : "Disabled" },
              { label: "Browser disguise", value: config.randomAgent ? "Enabled" : "Disabled" },
              { label: "Page crawl",    value: config.crawl === 0 ? "Disabled" : `Depth ${config.crawl}` },
              ...(config.dbms ? [{ label: "Database type", value: config.dbms }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2.5 border-b border-white/[0.05] last:border-0">
                <span className="text-sm text-white/40">{label}</span>
                <span className="text-sm text-white/80 font-medium font-mono truncate max-w-xs text-right">{value}</span>
              </div>
            ))}
          </div>
          <div className="bg-yellow-500/8 border border-yellow-500/15 rounded-xl p-4 text-xs text-yellow-400/70 leading-relaxed">
            Launching this scan will send HTTP requests to <strong className="text-yellow-400">{config.url}</strong>.
            Only continue if you own this website or have explicit written permission.
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Status bar */}
          <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border ${
            vulnerable        ? "bg-red-500/10 border-red-500/25" :
            scanDone          ? "bg-primary/10 border-primary/25" :
                                "bg-white/[0.03] border-white/[0.07]"
          }`}>
            {!scanDone ? (
              <><RefreshCw className="w-4 h-4 text-primary animate-spin shrink-0" />
                <span className="text-sm font-medium text-white/70">Scan in progress — this may take a few minutes…</span></>
            ) : vulnerable ? (
              <><AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-sm font-semibold text-red-400">SQL injection vulnerability found!</span></>
            ) : (
              <><CheckCircle className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-semibold text-primary">No vulnerabilities detected</span></>
            )}
          </div>

          {/* Terminal output */}
          <div className="bg-[#060b07] border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05] bg-white/[0.02]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-primary/50" />
              </div>
              <span className="text-xs text-white/30 font-mono ml-1">sqlmap output</span>
              {!scanDone && <div className="ml-auto flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-xs text-primary/60">Live</span>
              </div>}
            </div>
            <div ref={terminalRef} className="h-80 overflow-y-auto p-4 space-y-0.5">
              {scanLines.length === 0 ? (
                <div className="text-xs text-white/20 font-mono">Waiting for output…</div>
              ) : (
                scanLines.map((line, i) => <TerminalLine key={i} line={line} />)
              )}
            </div>
          </div>

          {scanDone && (
            <button
              onClick={() => { setStep(0); setScanId(null); setConfig({ url: "", level: 1, risk: 1, forms: true, randomAgent: true, crawl: 0, dbms: "", dumpAll: false }); }}
              className="w-full py-3 rounded-2xl border border-white/[0.08] text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.05] transition-all"
            >
              Start a new scan
            </button>
          )}
        </div>
      )}

      {/* Navigation buttons */}
      {step < 3 && (
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-6 py-3 rounded-2xl border border-white/[0.08] text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.05] transition-all"
            >
              Back
            </button>
          )}
          <button
            onClick={() => {
              if (step === 2) startScan.mutate(config);
              else setStep(s => s + 1);
            }}
            disabled={!canProceed || startScan.isPending}
            className={`flex-1 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 ${
              step === 2
                ? "bg-primary text-black hover:brightness-110 shadow-[0_0_30px_rgba(0,255,136,0.2)]"
                : "bg-white/[0.07] text-white/80 hover:bg-white/[0.1]"
            }`}
          >
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
