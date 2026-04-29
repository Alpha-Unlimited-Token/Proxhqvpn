import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Layers, Play, RotateCcw, RefreshCw, ChevronDown, ChevronRight,
  Key, Shield, ShieldAlert, ShieldX, ShieldCheck, CheckCircle2, Clock,
  Zap, GitBranch, Crosshair, Hash, Network, Globe, BarChart2,
  AlertTriangle, ExternalLink, FileCode, Cpu, Link2,
  CircleDot, Database, Bitcoin, Sigma,
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn }       from "@/lib/utils";

// ── API helpers ───────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch<T>(p: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${p}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return r.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type MegaPhase =
  | "idle"
  | "phase_a_parallel"
  | "phase_b_advanced_ecdsa"
  | "phase_c_multichain"
  | "phase_d_spider"
  | "phase_e_deep_ecdsa"
  | "phase_f_contracts"
  | "phase_g_merge"
  | "complete"
  | "error";

interface PhaseResult {
  phase:        MegaPhase;
  label:        string;
  startedAt:    string;
  completedAt?: string;
  durationMs?:  number;
  stats:        Record<string, number>;
  skipped?:     boolean;
}

interface MegaState {
  runId:           string;
  startedAt:       string;
  completedAt?:    string;
  currentPhase:    MegaPhase;
  phasesCompleted: MegaPhase[];
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
      ecdsa:         Record<string, number>;
      advancedEcdsa: Record<string, number>;
      threat:        Record<string, number>;
      spider:        Record<string, number>;
      multiChain:    Record<string, number>;
      contracts:     Record<string, number>;
    };
  };
}

interface MegaFinding {
  source:    "ecdsa" | "advanced" | "threat" | "spider" | "multichain" | "contract";
  engine:    string;
  type:      string;
  severity:  "info" | "low" | "medium" | "high" | "critical";
  address:   string;
  title:     string;
  detail:    string;
  txHashes?: string[];
  extra?:    Record<string, unknown>;
  timestamp: string;
}

interface TopRisk {
  address:   string;
  riskScore: number;
  sources:   string[];
  findings:  number;
  chain?:    string;
  ensName?:  string;
}

interface MegaReport {
  totalAddresses:   number;
  totalSignatures:  number;
  findings:         MegaFinding[];
  recoveredKeys:    Array<{ address: string; privateKey: string; method: string; chain: string }>;
  publicKeys:       Record<string, string>;
  topRiskAddresses: TopRisk[];
  moduleStats: {
    ecdsa:         Record<string, number>;
    advancedEcdsa: Record<string, number>;
    threat:        Record<string, number>;
    spider:        Record<string, number>;
    multiChain:    Record<string, number>;
    contracts:     Record<string, number>;
  };
}

interface FindingsPage { total: number; page: number; limit: number; items: MegaFinding[]; }

// ── Phase metadata ─────────────────────────────────────────────────────────────
const PHASE_META: Record<MegaPhase, { short: string; label: string; icon: React.ElementType; color: string; pct: number }> = {
  idle:                  { short: "Ready",      label: "Idle",                                   icon: CircleDot,   color: "text-muted-foreground",  pct: 0   },
  phase_a_parallel:      { short: "A",          label: "A — ECDSA + Threat",                     icon: ShieldAlert, color: "text-orange-400",         pct: 10  },
  phase_b_advanced_ecdsa:{ short: "B",          label: "B — Advanced ECDSA Attacks",             icon: Zap,         color: "text-yellow-400",         pct: 25  },
  phase_c_multichain:    { short: "C",          label: "C — Multi-Chain Scan",                   icon: Globe,       color: "text-blue-400",           pct: 38  },
  phase_d_spider:        { short: "D",          label: "D — Adaptive Spider",                    icon: GitBranch,   color: "text-purple-400",         pct: 55  },
  phase_e_deep_ecdsa:    { short: "E",          label: "E — Deep ECDSA (discoveries)",           icon: Key,         color: "text-cyan-400",           pct: 73  },
  phase_f_contracts:     { short: "F",          label: "F — Contract Analysis",                  icon: FileCode,    color: "text-teal-400",           pct: 87  },
  phase_g_merge:         { short: "G",          label: "G — Cross-Reference & Report",           icon: Layers,      color: "text-primary",            pct: 95  },
  complete:              { short: "Done",       label: "Complete",                               icon: CheckCircle2,color: "text-green-400",          pct: 100 },
  error:                 { short: "Error",      label: "Error",                                  icon: ShieldX,     color: "text-red-400",            pct: 0   },
};

const PHASE_ORDER: MegaPhase[] = [
  "phase_a_parallel","phase_b_advanced_ecdsa","phase_c_multichain",
  "phase_d_spider","phase_e_deep_ecdsa","phase_f_contracts","phase_g_merge","complete",
];

const SEV: Record<string, { color: string; bg: string }> = {
  critical: { color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30"       },
  high:     { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  medium:   { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  low:      { color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30"     },
  info:     { color: "text-gray-400",   bg: "bg-gray-500/10 border-gray-500/30"     },
};

const SRC: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  ecdsa:      { label: "ECDSA",       icon: Key,        color: "text-yellow-400" },
  advanced:   { label: "Advanced",    icon: Zap,        color: "text-orange-400" },
  threat:     { label: "Threat",      icon: Crosshair,  color: "text-red-400"    },
  spider:     { label: "Spider",      icon: GitBranch,  color: "text-blue-400"   },
  multichain: { label: "Multi-chain", icon: Globe,      color: "text-purple-400" },
  contract:   { label: "Contract",    icon: FileCode,   color: "text-teal-400"   },
};

// ── Module cards definition ────────────────────────────────────────────────────
const MODULES = [
  { icon: Key,       color: "text-yellow-400", label: "ECDSA Bulk Scan",         desc: "BigQuery nonce-reuse across 2,089 seeds" },
  { icon: Zap,       color: "text-orange-400", label: "Advanced Attacks",        desc: "Lattice, bias, weak-k, polynomial nonce, r-collision" },
  { icon: Globe,     color: "text-blue-400",   label: "Multi-Chain Scanner",     desc: "Bitcoin, Solana/Ed25519, Polkadot/Schnorr, Monero" },
  { icon: Crosshair, color: "text-red-400",    label: "Threat Scanner",          desc: "Bridge exploits, mixers, OFAC sanctions, flash loans" },
  { icon: GitBranch, color: "text-purple-400", label: "Adaptive Spider",         desc: "Graph BFS crawler, sig harvest, counterparty discovery" },
  { icon: Key,       color: "text-cyan-400",   label: "Deep ECDSA (Phase E)",    desc: "ECDSA + advanced on all spider-discovered wallets" },
  { icon: FileCode,  color: "text-teal-400",   label: "Contract Analysis",       desc: "Solidity source fetch + deep vulnerability patterns" },
  { icon: Layers,    color: "text-primary",    label: "Cross-Reference Engine",  desc: "Merge, deduplicate, score — all sources unified" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function PhaseStepper({ current, completed }: { current: MegaPhase; completed: MegaPhase[] }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 flex-wrap">
      {PHASE_ORDER.map((phase, i) => {
        const meta = PHASE_META[phase];
        const Icon = meta.icon;
        const isDone    = completed.includes(phase);
        const isCurrent = current === phase;
        return (
          <div key={phase} className="flex items-center gap-1 shrink-0">
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all",
              isDone    ? "bg-green-500/15 text-green-400 border border-green-500/30" :
              isCurrent ? "bg-primary/15 text-primary border border-primary/30 animate-pulse" :
                          "bg-muted/40 text-muted-foreground border border-border/30",
            )}>
              {isDone
                ? <CheckCircle2 className="w-3 h-3" />
                : isCurrent ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
              <span>{meta.short}</span>
            </div>
            {i < PHASE_ORDER.length - 1 && (
              <div className={cn("w-3 h-px shrink-0", isDone ? "bg-green-500/40" : "bg-border/40")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FindingCard({ f }: { f: MegaFinding }) {
  const [open, setOpen] = useState(false);
  const sev = SEV[f.severity]  ?? SEV.info;
  const src = SRC[f.source]    ?? SRC.ecdsa;
  const SrcI = src.icon;

  return (
    <div className={cn("border rounded-md overflow-hidden text-sm", sev.bg)}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-white/5 transition-colors">
        <SrcI className={cn("w-4 h-4 mt-0.5 shrink-0", src.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5 text-xs">
            <span className={cn("font-bold uppercase", sev.color)}>{f.severity}</span>
            <span className="text-muted-foreground">·</span>
            <span className={cn("font-medium", src.color)}>{src.label}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{f.engine}</span>
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
              {f.address.slice(0,16)}…{f.address.slice(-6)}<ExternalLink className="w-3 h-3" />
            </a>
            {f.txHashes?.slice(0, 2).map((h, i) => (
              <>
                <span key={`l${i}`} className="text-muted-foreground">TX {i+1}:</span>
                <a key={`v${i}`} href={`https://etherscan.io/tx/${h}`} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 truncate">
                  {h.slice(0,16)}…<ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </>
            ))}
          </div>
          {(f.extra?.privateKey) && (
            <div className="p-2 rounded bg-red-500/20 border border-red-500/40 font-mono text-xs break-all">
              <span className="text-red-300 font-bold">RECOVERED KEY: </span>
              <span className="text-red-200">{String(f.extra.privateKey)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModuleStatGrid({ stats, label, icon: Icon, color }: {
  stats: Record<string, number>; label: string; icon: React.ElementType; color: string;
}) {
  if (!stats || Object.keys(stats).length === 0) return null;
  return (
    <div className="p-4 rounded-lg border border-border/50 bg-card/40 space-y-3">
      <div className={cn("flex items-center gap-2 text-sm font-semibold", color)}>
        <Icon className="w-4 h-4" />{label}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {Object.entries(stats).map(([k, v]) => (
          <>
            <span key={`k${k}`} className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1").trim()}:</span>
            <span key={`v${k}`} className="font-mono font-medium">{Number(v ?? 0).toLocaleString()}</span>
          </>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type Tab = "overview" | "findings" | "keys" | "risk" | "log";

export default function UnifiedScanner() {
  const [tab,  setTab]  = useState<Tab>("overview");
  const [page, setPage] = useState(0);
  const [sevF, setSevF] = useState("");
  const [srcF, setSrcF] = useState("");
  const [freshStart, setFreshStart] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const qc     = useQueryClient();

  const statusQ = useQuery<MegaState>({
    queryKey: ["mega-status"],
    queryFn:  () => apiFetch("/api/quantum-audit/unified/status"),
    refetchInterval: 4000,
  });

  const reportQ = useQuery<MegaReport>({
    queryKey: ["mega-report"],
    queryFn:  () => apiFetch("/api/quantum-audit/unified/report"),
    enabled:  !!statusQ.data?.hasReport,
  });

  const findingsQ = useQuery<FindingsPage>({
    queryKey: ["mega-findings", page, sevF, srcF],
    queryFn:  () => apiFetch(
      `/api/quantum-audit/unified/report/findings?page=${page}&limit=50${sevF ? `&severity=${sevF}` : ""}${srcF ? `&source=${srcF}` : ""}`
    ),
    enabled: !!statusQ.data?.hasReport,
  });

  const startMut = useMutation({
    mutationFn: () => apiFetch("/api/quantum-audit/unified/start", {
      method: "POST", body: JSON.stringify({ reset: freshStart }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mega-status"] }); setTab("log"); },
  });

  const resetMut = useMutation({
    mutationFn: () => apiFetch("/api/quantum-audit/unified/reset", { method: "POST" }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["mega-status"] });
      qc.invalidateQueries({ queryKey: ["mega-report"] });
      qc.invalidateQueries({ queryKey: ["mega-findings"] });
    },
  });

  const status  = statusQ.data;
  const report  = reportQ.data;
  const running = status?.running ?? false;
  const phase   = status?.currentPhase ?? "idle";
  const meta    = PHASE_META[phase] ?? PHASE_META.idle;
  const PhIcon  = meta.icon;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [status?.log]);

  useEffect(() => {
    if (phase === "complete" && status?.hasReport) {
      qc.invalidateQueries({ queryKey: ["mega-report"] });
      qc.invalidateQueries({ queryKey: ["mega-findings"] });
    }
  }, [phase, status?.hasReport, qc]);

  const totalKeys = (report?.recoveredKeys.length ?? 0) + (report?.recoveredKeys.filter(k => k.chain !== "ethereum").length ?? 0);

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            Mega Unified Scanner
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            7-phase pipeline — every engine, all chains, one report
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {MODULES.map(m => {
              const MI = m.icon;
              return (
                <span key={m.label} className={cn("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted/40 border border-border/30", m.color)}>
                  <MI className="w-3 h-3" />{m.label}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {phase === "complete" && !running && (
            <button onClick={() => resetMut.mutate()}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1.5 rounded border border-border/40">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={freshStart} onChange={e => setFreshStart(e.target.checked)} className="w-3 h-3 accent-primary" />
            Fresh start
          </label>
          <Button
            onClick={() => startMut.mutate()}
            disabled={running || startMut.isPending || !status?.configured}
            size="lg" className="gap-2"
          >
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? meta.short : phase === "complete" ? "Re-run All" : "Run All Scans"}
          </Button>
        </div>
      </div>

      {/* ── Not configured ───────────────────────────────────────────────── */}
      {status && !status.configured && (
        <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-sm text-yellow-300">
          BigQuery credentials required (GOOGLE_BIGQUERY_KEY).
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {(startMut.error || status?.error) && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-300">
          {String(startMut.error ?? status?.error ?? "")}
        </div>
      )}

      {/* ── Phase stepper + progress bar ─────────────────────────────────── */}
      {status && phase !== "idle" && (
        <div className="space-y-3 p-4 rounded-lg border border-border/40 bg-card/30">
          <PhaseStepper current={phase} completed={status.phasesCompleted} />
          <div className="flex items-center gap-3">
            <PhIcon className={cn("w-4 h-4 shrink-0", meta.color, running && "animate-pulse")} />
            <span className={cn("text-sm font-medium", meta.color)}>{meta.label}</span>
            <span className="ml-auto text-xs text-muted-foreground">{meta.pct}%</span>
          </div>
          <Progress value={meta.pct} className="h-1.5" />
          {status.seedCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {status.seedCount.toLocaleString()} seeds · started {new Date(status.startedAt).toLocaleString()}
              {status.completedAt && ` · done ${new Date(status.completedAt).toLocaleString()}`}
            </p>
          )}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!running && phase === "idle" && (
        <div className="flex flex-col items-center py-12 text-center text-muted-foreground space-y-4">
          <Layers className="w-16 h-16 opacity-10" />
          <p className="text-xl font-semibold">All 8 engines ready</p>
          <p className="text-sm max-w-xl leading-relaxed">
            Runs every scanning engine in a 7-phase pipeline. Each phase feeds its outputs into the next —
            threat-flagged addresses become spider seeds, spider discoveries get deep ECDSA analysis,
            contract addresses get Solidity source analysis. One run, everything covered.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mt-2 max-w-2xl w-full">
            {MODULES.map(({ icon: Icon, color, label, desc }) => (
              <div key={label} className="p-3 rounded-lg border border-border/40 bg-card/30 space-y-1 text-left">
                <div className={cn("flex items-center gap-1.5 font-semibold", color)}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </div>
                <p className="text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Summary bar ──────────────────────────────────────────────────── */}
      {status?.reportSummary && (() => {
        const ms = status.reportSummary.moduleStats;
        return (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: "Findings",    value: status.reportSummary.totalFindings,    icon: ShieldAlert, color: "text-orange-400" },
              { label: "Keys",        value: status.reportSummary.recoveredKeys,    icon: Key,         color: "text-red-400"    },
              { label: "Signatures",  value: status.reportSummary.totalSignatures,  icon: Hash,        color: "text-yellow-400" },
              { label: "High-Risk",   value: status.reportSummary.topRiskAddresses, icon: Network,     color: "text-purple-400" },
              { label: "Adv. Hits",   value: ms.advancedEcdsa?.findings ?? 0,       icon: Zap,         color: "text-cyan-400"   },
              { label: "Contracts",   value: ms.contracts?.findings ?? 0,           icon: FileCode,    color: "text-teal-400"   },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="p-3 rounded-lg border border-border/40 bg-card/40">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Icon className={cn("w-3.5 h-3.5", color)} />{label}
                </div>
                <p className={cn("text-xl font-bold font-mono", color)}>{Number(value ?? 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      {(status?.hasReport || (status?.phaseResults?.length ?? 0) > 0) && (
        <>
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit flex-wrap">
            {(["overview","findings","keys","risk","log"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {t === "overview" && "Overview"}
                {t === "findings" && `Findings${findingsQ.data ? ` (${findingsQ.data.total})` : ""}`}
                {t === "keys"     && `Keys${report ? ` (${report.recoveredKeys.length})` : ""}`}
                {t === "risk"     && `Top Risk${report ? ` (${report.topRiskAddresses.length})` : ""}`}
                {t === "log"      && "Run Log"}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
          {tab === "overview" && (
            <div className="space-y-6">

              {/* Phase timeline */}
              {(status?.phaseResults?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Phase Timeline</h3>
                  <div className="space-y-2">
                    {(status?.phaseResults ?? []).map((p, i) => {
                      const m = PHASE_META[p.phase] ?? PHASE_META.idle;
                      const MI = m.icon;
                      return (
                        <div key={i} className={cn("flex items-start gap-3 p-3 rounded-lg border",
                          p.skipped ? "border-border/20 bg-muted/20 opacity-60" : "border-border/40 bg-card/30")}>
                          <MI className={cn("w-4 h-4 mt-0.5 shrink-0", m.color)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className={cn("text-sm font-semibold", m.color)}>{m.label}</span>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {p.skipped && <span className="text-muted-foreground/60">skipped</span>}
                                {p.durationMs && !p.skipped && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />{(p.durationMs / 1000).toFixed(1)}s
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{p.label}</p>
                            {Object.keys(p.stats).length > 0 && !p.skipped && (
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs font-mono">
                                {Object.entries(p.stats).map(([k, v]) => (
                                  <span key={k} className="text-muted-foreground">
                                    {k.replace(/([A-Z])/g, " $1").toLowerCase()}: <span className="text-foreground font-medium">{Number(v).toLocaleString()}</span>
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

              {/* Module stats grid */}
              {report && (
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Module Stats</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    <ModuleStatGrid label="ECDSA Bulk"       stats={report.moduleStats.ecdsa}         icon={Key}       color="text-yellow-400" />
                    <ModuleStatGrid label="Advanced ECDSA"   stats={report.moduleStats.advancedEcdsa}  icon={Zap}       color="text-orange-400" />
                    <ModuleStatGrid label="Threat Scanner"   stats={report.moduleStats.threat}         icon={Crosshair} color="text-red-400"    />
                    <ModuleStatGrid label="Adaptive Spider"  stats={report.moduleStats.spider}         icon={GitBranch} color="text-purple-400" />
                    <ModuleStatGrid label="Multi-Chain"      stats={report.moduleStats.multiChain}     icon={Globe}     color="text-blue-400"   />
                    <ModuleStatGrid label="Contract Analysis"stats={report.moduleStats.contracts}      icon={FileCode}  color="text-teal-400"   />
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
                  {report.recoveredKeys.slice(0,5).map((k, i) => (
                    <div key={i} className="font-mono text-xs space-y-0.5 bg-black/30 p-2 rounded mb-2">
                      <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                        <span>Address:
                          <a href={`https://etherscan.io/address/${k.address}`} target="_blank" rel="noopener noreferrer"
                            className="ml-1 text-primary hover:underline">{k.address.slice(0,14)}…</a>
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted/40">{k.method}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted/40">{k.chain}</span>
                      </div>
                      <div className="break-all text-red-200 mt-0.5">{k.privateKey}</div>
                    </div>
                  ))}
                  {report.recoveredKeys.length > 5 && (
                    <p className="text-xs text-muted-foreground">…and {report.recoveredKeys.length - 5} more. See Keys tab.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── FINDINGS ─────────────────────────────────────────────────── */}
          {tab === "findings" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <select value={sevF} onChange={e => { setSevF(e.target.value); setPage(0); }}
                  className="text-xs px-2 py-1.5 rounded border border-border bg-card text-foreground">
                  <option value="">All severities</option>
                  {["critical","high","medium","low","info"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={srcF} onChange={e => { setSrcF(e.target.value); setPage(0); }}
                  className="text-xs px-2 py-1.5 rounded border border-border bg-card text-foreground">
                  <option value="">All sources</option>
                  {Object.keys(SRC).map(s => <option key={s} value={s}>{SRC[s].label}</option>)}
                </select>
                {(sevF || srcF) && (
                  <button onClick={() => { setSevF(""); setSrcF(""); setPage(0); }}
                    className="text-xs px-2 py-1.5 rounded border border-border/40 text-muted-foreground hover:text-foreground">
                    Clear
                  </button>
                )}
                {findingsQ.data && (
                  <span className="text-xs text-muted-foreground self-center ml-1">
                    {findingsQ.data.total.toLocaleString()} findings
                  </span>
                )}
              </div>
              {findingsQ.data?.items.length === 0 && (
                <p className="text-muted-foreground text-sm py-8 text-center">No findings match filters.</p>
              )}
              {findingsQ.data?.items.map((f, i) => <FindingCard key={i} f={f} />)}
              {findingsQ.data && findingsQ.data.total > 50 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {page * 50 + 1}–{Math.min((page + 1) * 50, findingsQ.data.total)} of {findingsQ.data.total}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * 50 >= findingsQ.data.total}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── KEYS ─────────────────────────────────────────────────────── */}
          {tab === "keys" && (
            <div className="space-y-4">
              {report && report.recoveredKeys.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-3">
                    <Key className="w-4 h-4" /> Recovered Private Keys ({report.recoveredKeys.length})
                  </h3>
                  {report.recoveredKeys.map((k, i) => (
                    <div key={i} className="mb-2 p-3 rounded-lg border border-red-500/30 bg-red-500/5 font-mono text-xs space-y-1">
                      <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                        <a href={`https://etherscan.io/address/${k.address}`} target="_blank" rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1">
                          {k.address}<ExternalLink className="w-3 h-3" />
                        </a>
                        <span className="px-1.5 py-0.5 bg-muted/40 rounded">{k.method}</span>
                        <span className="px-1.5 py-0.5 bg-muted/40 rounded">{k.chain}</span>
                      </div>
                      <div className="break-all text-red-200">{k.privateKey}</div>
                    </div>
                  ))}
                </div>
              )}
              {report && Object.keys(report.publicKeys).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-yellow-400 flex items-center gap-2 mb-3">
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
                <div className="flex items-center gap-3 p-8 text-muted-foreground justify-center">
                  <ShieldCheck className="w-6 h-6 text-green-400" />
                  No keys extracted — all targets appear to use deterministic RFC 6979 signing.
                </div>
              )}
            </div>
          )}

          {/* ── TOP RISK ─────────────────────────────────────────────────── */}
          {tab === "risk" && (
            <div className="space-y-1.5">
              {report?.topRiskAddresses.map((a, i) => {
                const rc = a.riskScore >= 80 ? "text-red-400" : a.riskScore >= 40 ? "text-orange-400" : a.riskScore >= 20 ? "text-yellow-400" : "text-blue-400";
                return (
                  <div key={a.address} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card/30">
                    <span className="w-6 text-xs text-muted-foreground text-right shrink-0">{i+1}</span>
                    <a href={`https://etherscan.io/address/${a.address}`} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-xs text-primary hover:underline flex items-center gap-1 shrink-0">
                      {a.address.slice(0,16)}…<ExternalLink className="w-3 h-3" />
                    </a>
                    {a.ensName && <span className="text-xs text-muted-foreground shrink-0">{a.ensName}</span>}
                    <div className="ml-auto flex items-center gap-3 text-xs">
                      <div className="flex gap-1 flex-wrap">
                        {a.sources.slice(0, 4).map(s => {
                          const [src] = s.split("/");
                          const cfg = SRC[src];
                          if (!cfg) return null;
                          const SI = cfg.icon;
                          return <SI key={s} className={cn("w-3.5 h-3.5", cfg.color)} title={s} />;
                        })}
                      </div>
                      <span className="text-muted-foreground">{a.findings} findings</span>
                      <span className={cn("font-mono font-bold", rc)}>score {a.riskScore}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── LOG ──────────────────────────────────────────────────────── */}
          {tab === "log" && (
            <div ref={logRef}
              className="font-mono text-xs bg-black/40 border border-border/40 rounded-lg p-4 max-h-[65vh] overflow-y-auto space-y-0.5">
              {(status?.log ?? []).map((line, i) => (
                <div key={i} className={cn(
                  line.includes("FATAL") || line.includes("ERROR")       ? "text-red-400" :
                  line.includes("complete") || line.includes("✔")        ? "text-green-400" :
                  line.includes("RECOVERED") || line.includes("key")     ? "text-yellow-400" :
                  line.includes("╔") || line.includes("╚")               ? "text-primary font-semibold" :
                  line.includes("critical") || line.includes("CRITICAL") ? "text-red-300" :
                  line.includes("[ECDSA]")    ? "text-yellow-300/80" :
                  line.includes("[Threat]")   ? "text-orange-300/80" :
                  line.includes("[Spider]")   ? "text-blue-300/80" :
                  line.includes("[Advanced]") ? "text-cyan-300/80" :
                  line.includes("[MultiChain]") ? "text-purple-300/80" :
                  line.includes("[Contract]") ? "text-teal-300/80" :
                  "text-muted-foreground",
                )}>{line}</div>
              ))}
              {(status?.log?.length ?? 0) === 0 && (
                <span className="text-muted-foreground">No log entries yet — start a scan.</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
