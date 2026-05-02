// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, ShieldAlert, ShieldCheck, ShieldX,
  AlertTriangle, Activity, Zap, RefreshCw,
  ChevronDown, ChevronRight, ExternalLink,
  Cpu, Flame, GitMerge, Layers, Crosshair,
  TrendingUp, Clock, CheckCircle2, XCircle,
  CircleDot, BarChart2, Search, Play,
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn }       from "@/lib/utils";

// ── API helpers ───────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) {
    const text = await r.text().catch(() => r.statusText);
    throw new Error(text || r.statusText);
  }
  return r.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

type ThreatSeverity = "info" | "low" | "medium" | "high" | "critical";

interface ThreatFinding {
  category:         string;
  severity:         ThreatSeverity;
  title:            string;
  detail:           string;
  txHash?:          string;
  blockNumber?:     number;
  timestamp?:       string;
  counterparty?:    string;
  counterpartyName?: string;
  valueETH?:        number;
  lossUSD?:         number;
}

interface AddressThreatProfile {
  address:       string;
  riskScore:     number;
  riskLevel:     "clean" | "low" | "medium" | "high" | "critical";
  findings:      ThreatFinding[];
  txsScanned:    number;
  scanTimestamp: string;
}

interface ThreatScanSummary {
  totalAddresses:    number;
  scannedAt:         string;
  durationMs:        number;
  riskBreakdown:     Record<string, number>;
  topFindings:       ThreatFinding[];
  highRiskAddresses: AddressThreatProfile[];
  allProfiles:       AddressThreatProfile[];
}

interface ScanStatus {
  running:    boolean;
  progress:   number;
  phase:      string;
  error:      string | null;
  hasReport:  boolean;
  reportFile: string | null;
  log:        string[];
  configured: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SEV_CONFIG: Record<ThreatSeverity, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  info:     { label: "Info",     color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30",   icon: CircleDot },
  low:      { label: "Low",      color: "text-green-400",  bg: "bg-green-500/10 border-green-500/30", icon: CheckCircle2 },
  medium:   { label: "Medium",   color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", icon: AlertTriangle },
  high:     { label: "High",     color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", icon: ShieldAlert },
  critical: { label: "Critical", color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30",     icon: ShieldX },
};

const RISK_COLOR: Record<string, string> = {
  clean:    "text-green-400",
  low:      "text-blue-400",
  medium:   "text-yellow-400",
  high:     "text-orange-400",
  critical: "text-red-500",
};

const CATEGORY_LABEL: Record<string, string> = {
  bridge_exploit:      "Bridge Exploit",
  mixing_service:      "Mixing Service",
  known_exploiter:     "Known Exploiter",
  flash_loan_provider: "Flash Loan",
  defi_exploit_target: "DeFi Exploit",
  token_drainer:       "Token Drainer",
  mev_bot:             "MEV Bot",
  darknet_market:      "Darknet Market",
  sanctioned:          "OFAC Sanctioned",
  rug_pull:            "Rug Pull",
  governance_attacker: "Governance Attack",
  cross_chain_bridge:  "Cross-Chain Bridge",
  high_value_transfer: "High-Value Transfer",
  anomalous_pattern:   "Anomalous Pattern",
};

const CATEGORY_ICON: Record<string, React.ElementType> = {
  bridge_exploit:      GitMerge,
  mixing_service:      Layers,
  known_exploiter:     Crosshair,
  flash_loan_provider: Zap,
  defi_exploit_target: Flame,
  token_drainer:       ShieldX,
  mev_bot:             Cpu,
  sanctioned:          ShieldAlert,
  governance_attacker: TrendingUp,
  high_value_transfer: BarChart2,
  anomalous_pattern:   Activity,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: ThreatSeverity }) {
  const cfg = SEV_CONFIG[severity];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border", cfg.bg, cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function RiskScoreMeter({ score, level }: { score: number; level: string }) {
  const color = {
    clean: "bg-green-500", low: "bg-blue-500", medium: "bg-yellow-500",
    high: "bg-orange-500", critical: "bg-red-500",
  }[level] ?? "bg-gray-500";

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className={cn("text-xs font-mono font-bold", RISK_COLOR[level])}>{score}</span>
    </div>
  );
}

function FindingRow({ f, expanded }: { f: ThreatFinding; expanded?: boolean }) {
  const [open, setOpen] = useState(!!expanded);
  const CatIcon = CATEGORY_ICON[f.category] ?? ShieldAlert;

  return (
    <div className="border border-border/50 rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-accent/50 transition-colors"
      >
        <CatIcon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={f.severity} />
            <span className="text-xs text-muted-foreground">{CATEGORY_LABEL[f.category] ?? f.category}</span>
          </div>
          <p className="text-sm font-medium mt-1 truncate">{f.title}</p>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 text-sm space-y-2 border-t border-border/30 bg-card/30">
          <p className="text-muted-foreground">{f.detail}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
            {f.txHash && (
              <div className="col-span-2 flex items-center gap-2">
                <span className="text-muted-foreground">TX:</span>
                <a
                  href={`https://etherscan.io/tx/${f.txHash}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 truncate"
                >
                  {f.txHash.slice(0, 20)}…{f.txHash.slice(-6)}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}
            {f.counterparty && (
              <div className="col-span-2 flex items-center gap-2">
                <span className="text-muted-foreground">Counterparty:</span>
                <a
                  href={`https://etherscan.io/address/${f.counterparty}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 truncate"
                >
                  {f.counterpartyName ?? `${f.counterparty.slice(0,12)}…`}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}
            {f.valueETH !== undefined && (
              <>
                <span className="text-muted-foreground">Value:</span>
                <span className="text-foreground">{f.valueETH.toFixed(4)} ETH</span>
              </>
            )}
            {f.lossUSD !== undefined && (
              <>
                <span className="text-muted-foreground">Protocol loss:</span>
                <span className="text-red-400">${(f.lossUSD / 1e6).toFixed(0)}M USD</span>
              </>
            )}
            {f.blockNumber !== undefined && (
              <>
                <span className="text-muted-foreground">Block:</span>
                <a
                  href={`https://etherscan.io/block/${f.blockNumber}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  #{f.blockNumber.toLocaleString()}
                </a>
              </>
            )}
            {f.timestamp && (
              <>
                <span className="text-muted-foreground">Time:</span>
                <span>{new Date(f.timestamp).toLocaleString()}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AddressProfileCard({ profile }: { profile: AddressThreatProfile }) {
  const [open, setOpen] = useState(false);
  const riskCfg = SEV_CONFIG[profile.riskLevel as ThreatSeverity] ?? SEV_CONFIG.info;

  return (
    <div className={cn("border rounded-lg overflow-hidden", riskCfg.bg)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/20 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-xs font-mono font-bold uppercase px-2 py-0.5 rounded border", riskCfg.bg, riskCfg.color)}>
              {profile.riskLevel}
            </span>
            <a
              href={`https://etherscan.io/address/${profile.address}`}
              target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
            >
              {profile.address.slice(0, 12)}…{profile.address.slice(-6)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="mt-1 flex items-center gap-4">
            <RiskScoreMeter score={profile.riskScore} level={profile.riskLevel} />
            <span className="text-xs text-muted-foreground">{profile.findings.length} finding{profile.findings.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-border/30">
          {profile.findings.map((f, i) => <FindingRow key={i} f={f} />)}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ThreatScanner() {
  const [tab, setTab] = useState<"overview" | "high-risk" | "all" | "top-findings">("overview");
  const qc = useQueryClient();
  const pollRef = useRef<number | null>(null);

  const statusQ = useQuery<ScanStatus>({
    queryKey: ["threat-status"],
    queryFn:  () => apiFetch("/api/quantum-audit/threat-scan/status"),
    refetchInterval: 5000,
  });

  const reportQ = useQuery<ThreatScanSummary>({
    queryKey: ["threat-report"],
    queryFn:  () => apiFetch("/api/quantum-audit/threat-scan/report"),
    enabled:  !!statusQ.data?.hasReport,
  });

  const startMut = useMutation({
    mutationFn: () => apiFetch("/api/quantum-audit/threat-scan/start", { method: "POST" }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["threat-status"] }),
  });

  const status = statusQ.data;
  const report = reportQ.data;

  const isRunning = status?.running ?? false;
  const hasReport = status?.hasReport ?? false;

  // Auto-refresh report when scan completes
  useEffect(() => {
    if (!isRunning && hasReport) {
      qc.invalidateQueries({ queryKey: ["threat-report"] });
    }
  }, [isRunning, hasReport, qc]);

  const riskOrder: AddressThreatProfile["riskLevel"][] = ["critical", "high", "medium", "low", "clean"];

  function renderOverview() {
    if (!report) return null;
    const breakdown = report.riskBreakdown;
    const total = report.totalAddresses;

    const catCounts: Record<string, number> = {};
    for (const f of report.topFindings) {
      catCounts[f.category] = (catCounts[f.category] ?? 0) + 1;
    }

    return (
      <div className="space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {riskOrder.map(level => {
            const count = breakdown[level] ?? 0;
            const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
            const cfg   = SEV_CONFIG[level as ThreatSeverity] ?? SEV_CONFIG.info;
            return (
              <div key={level} className={cn("p-4 rounded-lg border", cfg.bg)}>
                <p className={cn("text-xs font-semibold uppercase tracking-wider", cfg.color)}>{level}</p>
                <p className="text-3xl font-bold font-mono mt-1">{count}</p>
                <p className="text-xs text-muted-foreground mt-1">{pct}% of targets</p>
              </div>
            );
          })}
        </div>

        {/* Scan metadata */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Activity className="w-4 h-4" />{total.toLocaleString()} addresses scanned</span>
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{(report.durationMs / 1000).toFixed(1)}s scan time</span>
          <span className="flex items-center gap-1"><Shield className="w-4 h-4" />{new Date(report.scannedAt).toLocaleString()}</span>
        </div>

        {/* Category breakdown */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Finding Categories</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(catCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => {
                const Icon = CATEGORY_ICON[cat] ?? ShieldAlert;
                return (
                  <div key={cat} className="flex items-center gap-2 p-2 rounded-md border border-border/50 bg-card/50">
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate">{CATEGORY_LABEL[cat] ?? cat}</span>
                    <span className="ml-auto font-mono text-xs font-bold text-primary">{count}</span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Top 5 critical findings */}
        {report.topFindings.slice(0, 5).length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Top Critical Findings</h3>
            <div className="space-y-2">
              {report.topFindings.slice(0, 5).map((f, i) => <FindingRow key={i} f={f} />)}
            </div>
            {report.topFindings.length > 5 && (
              <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setTab("top-findings")}>
                View all {report.topFindings.length} top findings →
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono flex items-center gap-2">
            <Crosshair className="w-6 h-6 text-primary" />
            Threat Scanner
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Multi-vector blockchain attack detection — bridge exploits, flash loans, mixers, sanctioned addresses, MEV, and more
          </p>
        </div>
        <Button
          onClick={() => startMut.mutate()}
          disabled={isRunning || startMut.isPending || !status?.configured}
          className="gap-2"
        >
          {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {isRunning ? "Scan running…" : "Run Threat Scan"}
        </Button>
      </div>

      {/* Not configured */}
      {status && !status.configured && (
        <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-sm text-yellow-300">
          BigQuery credentials not configured — GOOGLE_BIGQUERY_KEY environment variable required to run threat scans.
        </div>
      )}

      {/* Error */}
      {status?.error && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-300 flex items-start gap-2">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{status.error}</span>
        </div>
      )}

      {/* Start error */}
      {startMut.error && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-300">
          {String(startMut.error)}
        </div>
      )}

      {/* Progress */}
      {isRunning && (
        <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium">{status?.phase ?? "Running…"}</span>
            <span className="ml-auto text-sm font-mono text-muted-foreground">{status?.progress ?? 0}%</span>
          </div>
          <Progress value={status?.progress ?? 0} className="h-2" />
          {status?.log && status.log.length > 0 && (
            <div className="font-mono text-xs text-muted-foreground max-h-24 overflow-y-auto space-y-0.5">
              {status.log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </div>
      )}

      {/* No report yet */}
      {!isRunning && !hasReport && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-3">
          <Search className="w-12 h-12 opacity-20" />
          <p className="text-lg font-medium">No threat scan results yet</p>
          <p className="text-sm max-w-md">
            Click "Run Threat Scan" to launch a 6-pass BigQuery analysis against the 2,089 micro-target addresses: bridge exploits, flash loans, mixers, OFAC sanctions, MEV bots, and high-value transfers.
          </p>
        </div>
      )}

      {/* Report loaded */}
      {report && (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit flex-wrap">
            {(["overview", "high-risk", "top-findings", "all"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "overview"     && "Overview"}
                {t === "high-risk"    && `High Risk (${(report.riskBreakdown.critical ?? 0) + (report.riskBreakdown.high ?? 0)})`}
                {t === "top-findings" && `Top Findings (${report.topFindings.length})`}
                {t === "all"          && `All Profiles (${report.allProfiles.length})`}
              </button>
            ))}
          </div>

          {tab === "overview" && renderOverview()}

          {tab === "high-risk" && (
            <div className="space-y-3">
              {report.highRiskAddresses.length === 0 ? (
                <div className="flex items-center gap-2 p-6 text-muted-foreground">
                  <ShieldCheck className="w-5 h-5 text-green-400" />
                  No high-risk or critical addresses found.
                </div>
              ) : (
                report.highRiskAddresses
                  .sort((a, b) => b.riskScore - a.riskScore)
                  .map(p => <AddressProfileCard key={p.address} profile={p} />)
              )}
            </div>
          )}

          {tab === "top-findings" && (
            <div className="space-y-2">
              {report.topFindings.map((f, i) => <FindingRow key={i} f={f} />)}
            </div>
          )}

          {tab === "all" && (
            <div className="space-y-2">
              {report.allProfiles
                .filter(p => p.riskLevel !== "clean")
                .sort((a, b) => b.riskScore - a.riskScore)
                .map(p => <AddressProfileCard key={p.address} profile={p} />)}
              {report.allProfiles.filter(p => p.riskLevel !== "clean").length === 0 && (
                <div className="flex items-center gap-2 p-6 text-muted-foreground">
                  <ShieldCheck className="w-5 h-5 text-green-400" />
                  All scanned addresses appear clean.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
