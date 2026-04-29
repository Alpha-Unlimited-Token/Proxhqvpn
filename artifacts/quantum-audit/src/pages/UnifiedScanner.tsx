import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Layers, Play, RotateCcw, RefreshCw, ChevronDown, ChevronRight,
  Key, Shield, ShieldAlert, ShieldX, ShieldCheck, Activity,
  ExternalLink, AlertTriangle, CheckCircle2, Clock, Database,
  Zap, GitBranch, Crosshair, Hash, Network, Globe, BarChart2,
  TrendingUp, CircleDot, Search,
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn }       from "@/lib/utils";

// ── API ───────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch<T>(p: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${p}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return r.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type UnifiedPhase =
  | "idle" | "phase1_ecdsa_threat" | "phase2_spider_wave0"
  | "phase3_spider_expand" | "phase4_final_analysis"
  | "phase5_merge" | "complete" | "error";

interface PhaseResult {
  phase:        UnifiedPhase;
  startedAt:    string;
  completedAt?: string;
  durationMs?:  number;
  summary:      string;
  stats:        Record<string, number>;
}

interface UnifiedState {
  runId:           string;
  startedAt:       string;
  completedAt?:    string;
  currentPhase:    UnifiedPhase;
  phasesCompleted: UnifiedPhase[];
  phaseResults:    PhaseResult[];
  running:         boolean;
  error?:          string;
  seedCount:       number;
  log:             string[];
  hasReport:       boolean;
  configured:      boolean;
  reportSummary?:  {
    totalFindings:     number;
    recoveredKeys:     number;
    topRiskAddresses:  number;
    totalSignatures:   number;
    moduleStats: {
      ecdsa:   Record<string, number>;
      threat:  Record<string, number>;
      spider:  Record<string, number>;
    };
  };
}

interface UnifiedFinding {
  source:      "ecdsa" | "threat" | "spider";
  type:        string;
  severity:    "info" | "low" | "medium" | "high" | "critical";
  address:     string;
  title:       string;
  detail:      string;
  txHashes?:   string[];
  extra?:      Record<string, unknown>;
  timestamp:   string;
}

interface TopRiskAddress {
  address:   string;
  riskScore: number;
  sources:   string[];
  findings:  number;
  ensName?:  string;
}

interface UnifiedReport {
  totalAddresses:   number;
  totalSignatures:  number;
  findings:         UnifiedFinding[];
  recoveredKeys:    Array<{ address: string; privateKey: string; method: string }>;
  publicKeys:       Record<string, string>;
  topRiskAddresses: TopRiskAddress[];
  moduleStats: {
    ecdsa:  Record<string, number>;
    threat: Record<string, number>;
    spider: Record<string, number>;
  };
}

interface FindingsPage {
  total: number;
  page:  number;
  limit: number;
  items: UnifiedFinding[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASE_META: Record<UnifiedPhase, { label: string; icon: React.ElementType; color: string; pct: number }> = {
  idle:                  { label: "Idle",                          icon: CircleDot,   color: "text-muted-foreground", pct: 0   },
  phase1_ecdsa_threat:   { label: "Phase 1 — ECDSA + Threat scan", icon: ShieldAlert, color: "text-orange-400",       pct: 15  },
  phase2_spider_wave0:   { label: "Phase 2 — Spider wave 0",       icon: GitBranch,   color: "text-blue-400",         pct: 35  },
  phase3_spider_expand:  { label: "Phase 3 — Spider expanding",    icon: Network,     color: "text-purple-400",       pct: 65  },
  phase4_final_analysis: { label: "Phase 4 — Deep ECDSA pass",     icon: Key,         color: "text-yellow-400",       pct: 82  },
  phase5_merge:          { label: "Phase 5 — Building report",     icon: Layers,      color: "text-primary",          pct: 95  },
  complete:              { label: "Complete",                       icon: CheckCircle2,color: "text-green-400",        pct: 100 },
  error:                 { label: "Error",                          icon: ShieldX,     color: "text-red-400",          pct: 0   },
};

const SEV_CFG: Record<string, { color: string; bg: string }> = {
  critical: { color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30"       },
  high:     { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  medium:   { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  low:      { color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30"     },
  info:     { color: "text-gray-400",   bg: "bg-gray-500/10 border-gray-500/30"     },
};

const SOURCE_CFG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  ecdsa:  { label: "ECDSA",   icon: Key,       color: "text-yellow-400" },
  threat: { label: "Threat",  icon: Crosshair, color: "text-orange-400" },
  spider: { label: "Spider",  icon: GitBranch, color: "text-blue-400"   },
};

const PHASE_ORDER: UnifiedPhase[] = [
  "phase1_ecdsa_threat",
  "phase2_spider_wave0",
  "phase3_spider_expand",
  "phase4_final_analysis",
  "phase5_merge",
  "complete",
];

// ── Sub-components ────────────────────────────────────────────────────────────

function PhaseStepper({ current, completed }: { current: UnifiedPhase; completed: UnifiedPhase[] }) {
  return (
    <div className="flex items-start gap-1 overflow-x-auto pb-1">
      {PHASE_ORDER.map((phase, i) => {
        const meta = PHASE_META[phase];
        const Icon = meta.icon;
        const isDone    = completed.includes(phase);
        const isCurrent = current === phase;

        return (
          <div key={phase} className="flex items-center gap-1 shrink-0">
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all",
              isDone    ? "bg-green-500/15 text-green-400 border border-green-500/30" :
              isCurrent ? "bg-primary/15 text-primary border border-primary/30 animate-pulse" :
                          "bg-muted/40 text-muted-foreground border border-border/30",
            )}>
              {isDone
                ? <CheckCircle2 className="w-3.5 h-3.5" />
                : isCurrent ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{meta.label.split("—")[0].trim()}</span>
              <span className="md:hidden">{i + 1}</span>
            </div>
            {i < PHASE_ORDER.length - 1 && (
              <div className={cn("w-4 h-px shrink-0", isDone ? "bg-green-500/40" : "bg-border/40")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FindingCard({ f }: { f: UnifiedFinding }) {
  const [open, setOpen] = useState(false);
  const sev  = SEV_CFG[f.severity] ?? SEV_CFG.info;
  const src  = SOURCE_CFG[f.source] ?? SOURCE_CFG.spider;
  const SrcIcon = src.icon;

  return (
    <div className={cn("border rounded-md overflow-hidden text-sm", sev.bg)}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-white/5 transition-colors">
        <SrcIcon className={cn("w-4 h-4 mt-0.5 shrink-0", src.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className={cn("text-xs font-bold uppercase", sev.color)}>{f.severity}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className={cn("text-xs font-medium", src.color)}>{src.label}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{f.type.replace(/_/g, " ")}</span>
          </div>
          <p className="font-medium truncate">{f.title}</p>
        </div>
        {open ? <ChevronDown className="w-4 h-4 shrink-0 mt-0.5" /> : <ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 border-t border-current/10 space-y-2 bg-black/20">
          <p className="text-xs text-muted-foreground">{f.detail}</p>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Address:</span>
            <a href={`https://etherscan.io/address/${f.address}`} target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1">
              {f.address.slice(0,14)}…{f.address.slice(-6)}<ExternalLink className="w-3 h-3" />
            </a>
            {f.txHashes?.slice(0, 2).map((h, i) => (
              <>
                <span key={`l${i}`} className="text-muted-foreground">TX {i+1}:</span>
                <a key={`v${i}`} href={`https://etherscan.io/tx/${h}`} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 truncate">
                  {h.slice(0,14)}…<ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </>
            ))}
          </div>
          {(f.extra as any)?.recoveredKey && (
            <div className="p-2 rounded bg-red-500/20 border border-red-500/40 font-mono text-xs break-all">
              <span className="text-red-300 font-bold">RECOVERED KEY: </span>
              <span className="text-red-200">{(f.extra as any).recoveredKey}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModuleStatCard({ label, stats, icon: Icon, color }: {
  label: string; stats: Record<string, number>; icon: React.ElementType; color: string;
}) {
  return (
    <div className="p-4 rounded-lg border border-border/50 bg-card/50 space-y-3">
      <div className={cn("flex items-center gap-2 text-sm font-semibold", color)}>
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {Object.entries(stats).map(([k, v]) => (
          <>
            <span key={`k${k}`} className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1").trim()}:</span>
            <span key={`v${k}`} className="font-mono font-medium">{Number(v).toLocaleString()}</span>
          </>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UnifiedScanner() {
  const [tab, setTab]     = useState<"overview" | "findings" | "keys" | "risk" | "log">("overview");
  const [findingsPage, setFindingsPage] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter]     = useState<string>("");
  const [resetOnStart, setResetOnStart]     = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const qc     = useQueryClient();

  const statusQ = useQuery<UnifiedState>({
    queryKey: ["unified-status"],
    queryFn:  () => apiFetch("/api/quantum-audit/unified/status"),
    refetchInterval: 4000,
  });

  const reportQ = useQuery<UnifiedReport>({
    queryKey: ["unified-report"],
    queryFn:  () => apiFetch("/api/quantum-audit/unified/report"),
    enabled:  !!statusQ.data?.hasReport,
  });

  const findingsQ = useQuery<FindingsPage>({
    queryKey: ["unified-findings", findingsPage, severityFilter, sourceFilter],
    queryFn:  () => apiFetch(
      `/api/quantum-audit/unified/report/findings?page=${findingsPage}&limit=50${severityFilter ? `&severity=${severityFilter}` : ""}${sourceFilter ? `&source=${sourceFilter}` : ""}`
    ),
    enabled: !!statusQ.data?.hasReport,
  });

  const startMut = useMutation({
    mutationFn: () => apiFetch("/api/quantum-audit/unified/start", {
      method: "POST", body: JSON.stringify({ reset: resetOnStart }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unified-status"] });
      setTab("log");
    },
  });

  const resetMut = useMutation({
    mutationFn: () => apiFetch("/api/quantum-audit/unified/reset", { method: "POST" }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["unified-status"] });
      qc.invalidateQueries({ queryKey: ["unified-report"] });
      qc.invalidateQueries({ queryKey: ["unified-findings"] });
    },
  });

  const status   = statusQ.data;
  const report   = reportQ.data;
  const isRunning = status?.running ?? false;
  const phase    = status?.currentPhase ?? "idle";
  const phaseMeta = PHASE_META[phase] ?? PHASE_META.idle;
  const PhaseIcon = phaseMeta.icon;

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [status?.log]);

  // Refresh report when scan completes
  useEffect(() => {
    if (phase === "complete" && status?.hasReport) {
      qc.invalidateQueries({ queryKey: ["unified-report"] });
      qc.invalidateQueries({ queryKey: ["unified-findings"] });
    }
  }, [phase, status?.hasReport, qc]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            Unified Scanner
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ECDSA nonce-reuse + threat analysis + adaptive spider — all running in sequence, feeding each other
          </p>
        </div>
        <div className="flex items-center gap-2">
          {phase === "complete" && !isRunning && (
            <button
              onClick={() => resetMut.mutate()}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded border border-border/40 hover:border-border"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
          {!isRunning && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={resetOnStart}
                onChange={e => setResetOnStart(e.target.checked)}
                className="w-3 h-3 accent-primary" />
              Fresh start
            </label>
          )}
          <Button
            onClick={() => startMut.mutate()}
            disabled={isRunning || startMut.isPending || !status?.configured}
            className="gap-2"
          >
            {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isRunning ? `Running — ${phaseMeta.label}` : phase === "complete" ? "Re-run" : "Run All Scans"}
          </Button>
        </div>
      </div>

      {/* Not configured */}
      {status && !status.configured && (
        <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-sm text-yellow-300">
          BigQuery credentials required (GOOGLE_BIGQUERY_KEY).
        </div>
      )}

      {/* Error */}
      {(startMut.error || status?.error) && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-300">
          {String(startMut.error ?? status?.error ?? "")}
        </div>
      )}

      {/* Phase stepper + progress */}
      {status && phase !== "idle" && (
        <div className="space-y-3 p-4 rounded-lg border border-border/40 bg-card/30">
          <PhaseStepper current={phase} completed={status.phasesCompleted} />
          <div className="flex items-center gap-3">
            <PhaseIcon className={cn("w-4 h-4 shrink-0", phaseMeta.color, isRunning && "animate-pulse")} />
            <span className={cn("text-sm font-medium", phaseMeta.color)}>{phaseMeta.label}</span>
            <span className="ml-auto text-xs text-muted-foreground">{phaseMeta.pct}%</span>
          </div>
          <Progress value={phaseMeta.pct} className="h-1.5" />
          {status.seedCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {status.seedCount.toLocaleString()} seed addresses · started {new Date(status.startedAt).toLocaleString()}
              {status.completedAt && ` · completed ${new Date(status.completedAt).toLocaleString()}`}
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isRunning && phase === "idle" && (
        <div className="flex flex-col items-center py-16 text-center text-muted-foreground space-y-4">
          <Layers className="w-14 h-14 opacity-15" />
          <p className="text-xl font-medium">All scanners ready</p>
          <p className="text-sm max-w-lg">
            Runs everything in one pipeline: ECDSA nonce-reuse and threat scan run first in parallel, then the adaptive spider
            expands from seeds + threat-flagged high-risk addresses, and finally a second ECDSA pass covers newly discovered wallets.
            Each module feeds its findings into the next.
          </p>
          <div className="grid grid-cols-3 gap-3 text-xs mt-2 max-w-lg w-full">
            {[
              { icon: Key,       color: "text-yellow-400", label: "ECDSA Bulk Scan",  desc: "Nonce reuse, r-collision, key recovery" },
              { icon: Crosshair, color: "text-orange-400", label: "Threat Scanner",   desc: "Bridge exploits, mixers, OFAC sanctions" },
              { icon: GitBranch, color: "text-blue-400",   label: "Adaptive Spider",  desc: "Graph crawler, signature harvest, clusters" },
            ].map(({ icon: Icon, color, label, desc }) => (
              <div key={label} className="p-3 rounded-lg border border-border/40 bg-card/30 space-y-1 text-left">
                <div className={cn("flex items-center gap-1.5 font-semibold", color)}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </div>
                <p className="text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report summary bar */}
      {status?.reportSummary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Findings",    value: status.reportSummary.totalFindings,    icon: ShieldAlert, color: "text-orange-400" },
            { label: "Recovered Keys", value: status.reportSummary.recoveredKeys, icon: Key,         color: "text-red-400"    },
            { label: "High-Risk Addrs",value: status.reportSummary.topRiskAddresses, icon: Network, color: "text-yellow-400" },
            { label: "Signatures",  value: status.reportSummary.totalSignatures,  icon: Hash,        color: "text-purple-400" },
            { label: "ECDSA Vuln",  value: status.reportSummary.moduleStats.ecdsa.vulnerable ?? 0,   icon: Zap, color: "text-primary" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="p-4 rounded-lg border border-border/40 bg-card/40">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Icon className={cn("w-3.5 h-3.5", color)} />{label}
              </div>
              <p className={cn("text-2xl font-bold font-mono", color)}>{Number(value).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      {(status?.hasReport || status?.phaseResults?.length > 0) && (
        <>
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit flex-wrap">
            {(["overview", "findings", "keys", "risk", "log"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {t === "overview" && "Overview"}
                {t === "findings" && `Findings${findingsQ.data ? ` (${findingsQ.data.total})` : ""}`}
                {t === "keys"     && `Keys${report ? ` (${report.recoveredKeys.length + Object.keys(report.publicKeys).length})` : ""}`}
                {t === "risk"     && `Top Risk${report ? ` (${report.topRiskAddresses.length})` : ""}`}
                {t === "log"      && "Run Log"}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {tab === "overview" && (
            <div className="space-y-6">
              {/* Phase timeline */}
              {status?.phaseResults?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Phase Timeline</h3>
                  <div className="space-y-2">
                    {status.phaseResults.map((p, i) => {
                      const meta = PHASE_META[p.phase] ?? PHASE_META.idle;
                      const Icon = meta.icon;
                      return (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-card/30">
                          <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", meta.color)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-medium">{meta.label}</span>
                              {p.durationMs && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />{(p.durationMs / 1000).toFixed(1)}s
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{p.summary}</p>
                            {Object.keys(p.stats).length > 0 && (
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs font-mono">
                                {Object.entries(p.stats).map(([k, v]) => (
                                  <span key={k} className="text-muted-foreground">
                                    {k.replace(/([A-Z])/g, " $1").trim()}: <span className="text-foreground">{Number(v).toLocaleString()}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Module stats */}
              {report && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Module Breakdown</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <ModuleStatCard label="ECDSA Scanner"   stats={report.moduleStats.ecdsa}  icon={Key}       color="text-yellow-400" />
                    <ModuleStatCard label="Threat Scanner"  stats={report.moduleStats.threat} icon={Crosshair} color="text-orange-400" />
                    <ModuleStatCard label="Adaptive Spider" stats={report.moduleStats.spider} icon={GitBranch} color="text-blue-400"   />
                  </div>
                </div>
              )}

              {/* Recovered keys alert */}
              {report && report.recoveredKeys.length > 0 && (
                <div className="p-4 rounded-lg border border-red-500/40 bg-red-500/10">
                  <div className="flex items-center gap-2 text-red-300 font-bold mb-3">
                    <Key className="w-5 h-5" />
                    {report.recoveredKeys.length} Private Key{report.recoveredKeys.length !== 1 ? "s" : ""} Recovered
                  </div>
                  {report.recoveredKeys.map((k, i) => (
                    <div key={i} className="font-mono text-xs space-y-0.5 bg-black/30 p-2 rounded mb-2">
                      <div className="text-muted-foreground">
                        Address: <a href={`https://etherscan.io/address/${k.address}`} target="_blank" rel="noopener noreferrer"
                          className="text-primary hover:underline">{k.address.slice(0,14)}…</a>
                        <span className="ml-2 text-muted-foreground">via {k.method}</span>
                      </div>
                      <div className="break-all text-red-200">{k.privateKey}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Findings tab */}
          {tab === "findings" && (
            <div className="space-y-3">
              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                <select value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); setFindingsPage(0); }}
                  className="text-xs px-2 py-1.5 rounded border border-border bg-card text-foreground">
                  <option value="">All severities</option>
                  {["critical","high","medium","low","info"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setFindingsPage(0); }}
                  className="text-xs px-2 py-1.5 rounded border border-border bg-card text-foreground">
                  <option value="">All sources</option>
                  {["ecdsa","threat","spider"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {(severityFilter || sourceFilter) && (
                  <button onClick={() => { setSeverityFilter(""); setSourceFilter(""); setFindingsPage(0); }}
                    className="text-xs px-2 py-1.5 rounded border border-border/40 text-muted-foreground hover:text-foreground">
                    Clear filters
                  </button>
                )}
              </div>
              {findingsQ.data?.items.length === 0 && <p className="text-muted-foreground text-sm">No findings match filters.</p>}
              {findingsQ.data?.items.map((f, i) => <FindingCard key={i} f={f} />)}
              {findingsQ.data && findingsQ.data.total > 50 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Showing {findingsPage * 50 + 1}–{Math.min((findingsPage + 1) * 50, findingsQ.data.total)} of {findingsQ.data.total}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setFindingsPage(p => Math.max(0, p - 1))} disabled={findingsPage === 0}>Prev</Button>
                    <Button variant="outline" size="sm" onClick={() => setFindingsPage(p => p + 1)} disabled={(findingsPage + 1) * 50 >= findingsQ.data.total}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Keys tab */}
          {tab === "keys" && (
            <div className="space-y-4">
              {report && report.recoveredKeys.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Key className="w-4 h-4" /> Recovered Private Keys ({report.recoveredKeys.length})
                  </h3>
                  {report.recoveredKeys.map((k, i) => (
                    <div key={i} className="mb-2 p-3 rounded-lg border border-red-500/30 bg-red-500/5 font-mono text-xs space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>Address:</span>
                        <a href={`https://etherscan.io/address/${k.address}`} target="_blank" rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1">
                          {k.address}<ExternalLink className="w-3 h-3" />
                        </a>
                        <span className="ml-auto">via {k.method}</span>
                      </div>
                      <div className="break-all text-red-200">{k.privateKey}</div>
                    </div>
                  ))}
                </div>
              )}
              {report && Object.keys(report.publicKeys).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Extracted Public Keys ({Object.keys(report.publicKeys).length})
                  </h3>
                  {Object.entries(report.publicKeys).map(([addr, key]) => (
                    <div key={addr} className="mb-2 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 font-mono text-xs space-y-1">
                      <a href={`https://etherscan.io/address/${addr}`} target="_blank" rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1">
                        {addr}<ExternalLink className="w-3 h-3" />
                      </a>
                      <div className="break-all text-muted-foreground">{key}</div>
                    </div>
                  ))}
                </div>
              )}
              {report && report.recoveredKeys.length === 0 && Object.keys(report.publicKeys).length === 0 && (
                <div className="flex items-center gap-2 p-6 text-muted-foreground">
                  <ShieldCheck className="w-5 h-5 text-green-400" />
                  No keys extracted — target wallets appear to use RFC 6979 deterministic signing.
                </div>
              )}
            </div>
          )}

          {/* Risk tab */}
          {tab === "risk" && (
            <div className="space-y-2">
              {report?.topRiskAddresses.map((a, i) => {
                const riskColor = a.riskScore >= 80 ? "text-red-400" : a.riskScore >= 40 ? "text-orange-400" : a.riskScore >= 20 ? "text-yellow-400" : "text-blue-400";
                return (
                  <div key={a.address} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card/30">
                    <span className="w-6 text-xs text-muted-foreground text-right shrink-0">{i+1}</span>
                    <a href={`https://etherscan.io/address/${a.address}`} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-xs text-primary hover:underline flex items-center gap-1 shrink-0">
                      {a.address.slice(0,14)}…<ExternalLink className="w-3 h-3" />
                    </a>
                    {a.ensName && <span className="text-xs text-muted-foreground">{a.ensName}</span>}
                    <div className="ml-auto flex items-center gap-3 text-xs">
                      <div className="flex gap-1">
                        {a.sources.map(s => {
                          const src = SOURCE_CFG[s];
                          if (!src) return null;
                          const SI = src.icon;
                          return <SI key={s} className={cn("w-3.5 h-3.5", src.color)} title={src.label} />;
                        })}
                      </div>
                      <span className="text-muted-foreground">{a.findings} findings</span>
                      <span className={cn("font-mono font-bold", riskColor)}>score: {a.riskScore}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Log tab */}
          {tab === "log" && (
            <div ref={logRef}
              className="font-mono text-xs bg-black/40 border border-border/40 rounded-lg p-4 max-h-[60vh] overflow-y-auto space-y-0.5">
              {(status?.log ?? []).map((line, i) => (
                <div key={i} className={cn(
                  line.includes("ERROR") || line.includes("FATAL") ? "text-red-400" :
                  line.includes("complete") || line.includes("DONE") || line.includes("Complete") ? "text-green-400" :
                  line.includes("critical") || line.includes("RECOVERED") || line.includes("key") ? "text-yellow-400" :
                  line.includes("Phase") || line.includes("===") ? "text-primary" :
                  "text-muted-foreground",
                )}>{line}</div>
              ))}
              {(status?.log?.length ?? 0) === 0 && (
                <span className="text-muted-foreground">No log entries yet — start a scan to see live progress.</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
