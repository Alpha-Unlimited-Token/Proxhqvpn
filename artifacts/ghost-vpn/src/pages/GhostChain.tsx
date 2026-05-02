// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useRef } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Target, AlertTriangle, ShieldOff, CheckCircle, Clock, ChevronRight,
  Loader2, Trash2, Globe, Lock, Code2, Database, Server, Link2,
  AlertOctagon, Info, Zap, BarChart2, GitMerge, Layers, Network,
  RefreshCw, Search, Copy, Terminal, FlaskConical, Atom,
} from "lucide-react";
import { getExploitPayload, type ExploitPayload } from "@/lib/exploitPayloads";

const QA_BASE_GC = import.meta.env.BASE_URL?.replace(/\/ghost-vpn\/?$/, "") ?? "";

function BlockchainKillChainPanel() {
  const [qa, setQa] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${QA_BASE_GC}/api/quantum-audit/cc-summary`, { credentials: "include" });
        if (r.ok) setQa(await r.json());
      } catch { /* best-effort */ }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  if (!qa) return null;
  const chainNames = Object.keys(qa.chains ?? {});
  if (!chainNames.length && !qa.runner?.running) return null;

  const stages = [
    { label: "Recon", detail: `${qa.signatures?.totalSigs ?? 0} ECDSA sigs harvested across ${chainNames.length} chains`, color: "text-blue-400" },
    { label: "Weaponise", detail: `Nonce-reuse analysis — algebraic private-key derivation from (r,s) pairs`, color: "text-yellow-400" },
    { label: "Exploit", detail: qa.keys?.recovered > 0 ? `${qa.keys.recovered} private key(s) confirmed recovered` : `0 keys confirmed — scan ${qa.progress?.pct ?? 0}% complete`, color: qa.keys?.recovered > 0 ? "text-red-400" : "text-primary/30" },
    { label: "Impact", detail: "Full wallet control — attacker can drain funds or impersonate wallet on any chain", color: "text-red-400/60" },
  ];

  return (
    <div className="border border-cyan-500/15 bg-black p-4 space-y-4 font-mono mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Atom className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] text-cyan-400/70 uppercase tracking-widest">Blockchain Kill-Chain — QuantumAudit</span>
        </div>
        <div className={`flex items-center gap-1 text-[9px] font-mono ${qa.runner?.running ? "text-[#00ff88]" : "text-primary/25"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${qa.runner?.running ? "bg-[#00ff88] animate-pulse" : "bg-primary/20"}`} />
          {qa.runner?.running ? "LIVE SCAN" : "IDLE"}
        </div>
      </div>

      {/* Kill chain stages */}
      <div className="flex flex-col md:flex-row gap-1 md:gap-0">
        {stages.map((s, i) => (
          <div key={s.label} className="flex md:flex-col items-start md:items-center gap-2 md:gap-1 flex-1">
            <div className={`text-[9px] font-bold uppercase border px-1.5 py-0.5 shrink-0 ${s.color === "text-primary/30" ? "border-primary/15 text-primary/25" : `border-current/30 ${s.color}`}`}>{i + 1}. {s.label}</div>
            {i < stages.length - 1 && <ChevronRight className="w-3 h-3 text-primary/20 shrink-0 md:hidden" />}
            <div className="text-[9px] text-primary/40 leading-relaxed md:text-center">{s.detail}</div>
          </div>
        ))}
      </div>

      {/* Chain entry nodes */}
      {chainNames.length > 0 && (
        <div>
          <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-2">Entry Node Chains</div>
          <div className="flex flex-wrap gap-1.5">
            {chainNames.sort((a, b) => (qa.chains[b] - qa.chains[a])).map((chain: string) => (
              <div key={chain} className="border border-cyan-500/20 px-2 py-1 text-[9px] font-mono flex items-center gap-1.5">
                <Network className="w-2.5 h-2.5 text-cyan-400/50" />
                <span className="text-cyan-400/70 capitalize">{chain}</span>
                <span className="text-primary/30">({qa.chains[chain]} txs)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {qa.progress?.unknownChain > 0 && (
        <div className="text-[9px] text-yellow-400/50 border border-yellow-400/10 bg-yellow-900/5 px-2 py-1.5">
          {qa.progress.unknownChain} unresolved hashes — chain identity unknown, attack vector unconfirmed
        </div>
      )}
    </div>
  );
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}/api${path}`, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

type ScanStatus = "pending" | "running" | "complete" | "error";
type Severity = "critical" | "high" | "medium" | "low" | "info";

interface Stage {
  name: string;
  status: "pending" | "running" | "complete" | "error";
  findings: number;
  durationMs?: number;
}

interface Finding {
  id: number;
  scanId: number;
  surface: string;
  surfaceType: string;
  findingType: string;
  severity: Severity;
  title: string;
  description: string;
  evidence?: string;
  remediation?: string;
  chainIdsJson?: string;
  businessImpact?: string;
}

interface ChainNode {
  id: string;
  label: string;
  severity: Severity;
  type: string;
}

interface ChainEdge {
  from: string;
  to: string;
  label: string;
}

interface ChainGraph {
  nodes: ChainNode[];
  edges: ChainEdge[];
}

interface Scan {
  id: number;
  target: string;
  scanStatus: ScanStatus;
  riskScore?: number;
  summary?: string;
  currentStage?: string;
  stages: Stage[];
  chainGraph: ChainGraph;
  findings: Finding[];
  startedAt: string;
  completedAt?: string;
}

interface ScanListItem {
  id: number;
  target: string;
  scanStatus: ScanStatus;
  riskScore?: number;
  startedAt: string;
  completedAt?: string;
}

const SEV_COLOR: Record<Severity, string> = {
  critical: "text-red-400 border-red-400/30 bg-red-400/10",
  high: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  medium: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  low: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  info: "text-primary/85 border-primary/40 bg-primary/10",
};

const SEV_DOT: Record<Severity, string> = {
  critical: "bg-red-400",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
  low: "bg-blue-400",
  info: "bg-primary/60",
};

const SEV_SCORE: Record<Severity, number> = { critical: 40, high: 20, medium: 8, low: 2, info: 0 };

const SURFACE_ICON: Record<string, React.ElementType> = {
  host: Globe,
  header: Server,
  path: Layers,
  tls: Lock,
  tech: Code2,
  subdomain: Network,
  api: Database,
};

function RiskGauge({ score }: { score: number }) {
  const clamp = Math.min(100, Math.max(0, score));
  const color = clamp >= 70 ? "#ef4444" : clamp >= 40 ? "#f97316" : clamp >= 20 ? "#facc15" : "#00ff88";
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (clamp / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r="36" strokeWidth="6" stroke="rgba(255,255,255,0.05)" fill="none" />
        <circle
          cx="48" cy="48" r="36" strokeWidth="6"
          stroke={color} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-bold font-mono" style={{ color }}>{clamp}</div>
        <div className="text-[9px] text-primary/55 uppercase tracking-wider">Risk</div>
      </div>
    </div>
  );
}

function ChainGraphView({ graph, findings }: { graph: ChainGraph; findings: Finding[] }) {
  if (!graph.nodes.length) return null;

  const findingMap: Record<string, Finding> = {};
  findings.forEach((f, i) => { findingMap[`F${i}`] = f; });

  const cols: ChainNode[][] = [];
  const placed = new Set<string>();
  const roots = graph.nodes.filter(n => !graph.edges.some(e => e.to === n.id));

  if (roots.length === 0) {
    cols.push([...graph.nodes]);
  } else {
    cols.push(roots);
    roots.forEach(r => placed.add(r.id));
    let frontier = roots;
    while (frontier.length > 0) {
      const next: ChainNode[] = [];
      for (const e of graph.edges) {
        if (placed.has(e.from) && !placed.has(e.to)) {
          const n = graph.nodes.find(nd => nd.id === e.to);
          if (n && !next.find(x => x.id === n.id)) {
            next.push(n);
            placed.add(n.id);
          }
        }
      }
      if (next.length) { cols.push(next); frontier = next; }
      else break;
    }
    const remaining = graph.nodes.filter(n => !placed.has(n.id));
    if (remaining.length) cols.push(remaining);
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-start gap-8 min-w-max p-4">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-3">
            {col.map(node => {
              const finding = findingMap[node.id];
              const sev = (node.severity || "info") as Severity;
              const outEdges = graph.edges.filter(e => e.from === node.id);
              return (
                <div key={node.id} className="relative">
                  <div className={`border rounded-sm p-3 w-44 text-xs font-mono ${SEV_COLOR[sev]}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${SEV_DOT[sev]}`} />
                      <span className="font-bold text-[10px] uppercase tracking-wide truncate">
                        {sev}
                      </span>
                    </div>
                    <div className="text-current leading-snug">{node.label}</div>
                    {outEdges.length > 0 && (
                      <div className="absolute -right-7 top-1/2 -translate-y-1/2 flex items-center">
                        <div className="w-5 border-t border-dashed border-primary/50" />
                        <ChevronRight className="w-3 h-3 text-primary/50 -ml-1" />
                      </div>
                    )}
                  </div>
                  {outEdges.map((e, ei) => (
                    <div key={ei} className="absolute -bottom-5 left-4 text-[9px] text-primary/55 whitespace-nowrap">
                      {ei === 0 ? e.label.slice(0, 28) : ""}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function StageTracker({ stages }: { stages: Stage[] }) {
  return (
    <div className="space-y-1.5">
      {stages.map((stage, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
            stage.status === "complete" ? "border-[#00ff88] bg-[#00ff88]/20" :
            stage.status === "running" ? "border-yellow-400 bg-yellow-400/20" :
            stage.status === "error" ? "border-red-400 bg-red-400/20" :
            "border-primary/40 bg-primary/10"
          }`}>
            {stage.status === "complete" && <CheckCircle className="w-3 h-3 text-[#00ff88]" />}
            {stage.status === "running" && <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />}
            {stage.status === "error" && <AlertOctagon className="w-3 h-3 text-red-400" />}
            {stage.status === "pending" && <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-mono font-bold ${
                stage.status === "complete" ? "text-[#00ff88]" :
                stage.status === "running" ? "text-yellow-400" :
                stage.status === "error" ? "text-red-400" : "text-primary/55"
              }`}>{stage.name}</span>
              {stage.status === "complete" && stage.findings > 0 && (
                <span className="text-[10px] text-primary/65 font-mono">{stage.findings} found</span>
              )}
              {stage.durationMs && (
                <span className="text-[10px] text-primary/45 font-mono">{(stage.durationMs / 1000).toFixed(1)}s</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "exploit">("details");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const sev = finding.severity as Severity;
  const Icon = SURFACE_ICON[finding.surfaceType] || Globe;
  const exploit = getExploitPayload(finding.findingType, finding.surface);

  const copyExploit = () => {
    if (!exploit) return;
    navigator.clipboard.writeText(exploit.code);
    setCopied(true);
    toast({ title: "Exploit code copied", description: "For authorized testing on your own systems only." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`border rounded-sm p-3 text-xs font-mono ${SEV_COLOR[sev]}`}>
      <div
        className="flex items-start justify-between gap-2 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start gap-2 min-w-0">
          <div className="mt-0.5 shrink-0">
            <Icon className="w-3.5 h-3.5 opacity-60" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[9px] font-bold uppercase border px-1 py-px rounded ${SEV_COLOR[sev]}`}>
                {sev}
              </span>
              <span className="font-bold text-current">{finding.title}</span>
              {exploit && (
                <span className="text-[9px] font-bold border border-orange-400/40 bg-orange-400/10 text-orange-400 px-1 py-px rounded flex items-center gap-0.5">
                  <Terminal className="w-2.5 h-2.5" />PoC
                </span>
              )}
            </div>
            <div className="text-current/60 mt-0.5 truncate">{finding.surface}</div>
          </div>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform text-current/40 ${expanded ? "rotate-90" : ""}`} />
      </div>

      <p className="text-current/70 mt-2 leading-relaxed">{finding.description}</p>

      {expanded && (
        <div className="mt-3 border-t border-current/20 pt-2.5">

          {/* Tab row */}
          <div className="flex gap-px mb-3">
            <button
              onClick={() => setActiveTab("details")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all ${
                activeTab === "details"
                  ? "bg-current/15 text-current"
                  : "text-current/35 hover:text-current/55"
              }`}
            >
              <Info className="w-3 h-3" />Details
            </button>
            {exploit && (
              <button
                onClick={() => setActiveTab("exploit")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all ${
                  activeTab === "exploit"
                    ? "bg-orange-400/15 text-orange-400 border border-orange-400/30"
                    : "text-orange-400/40 hover:text-orange-400/70"
                }`}
              >
                <FlaskConical className="w-3 h-3" />Exploit PoC
              </button>
            )}
          </div>

          {/* Details tab */}
          {activeTab === "details" && (
            <div className="space-y-2.5">
              {finding.businessImpact && (
                <div>
                  <div className="text-[10px] text-current/40 uppercase tracking-wide mb-1">Business Impact</div>
                  <p className="text-current/80 leading-relaxed">{finding.businessImpact}</p>
                </div>
              )}
              {finding.evidence && (
                <div>
                  <div className="text-[10px] text-current/40 uppercase tracking-wide mb-1">Evidence</div>
                  <pre className="text-[10px] bg-black/30 p-2 rounded overflow-x-auto whitespace-pre-wrap text-current/60">{finding.evidence}</pre>
                </div>
              )}
              {finding.remediation && (
                <div>
                  <div className="text-[10px] text-current/40 uppercase tracking-wide mb-1">Remediation</div>
                  <p className="text-[#00ff88]/80 leading-relaxed">{finding.remediation}</p>
                </div>
              )}
            </div>
          )}

          {/* Exploit PoC tab */}
          {activeTab === "exploit" && exploit && (
            <div className="space-y-2.5">

              {/* Disclaimer */}
              <div className="flex items-start gap-2 border border-orange-400/20 bg-orange-400/5 rounded-sm px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400/70 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-bold text-orange-400/80 uppercase tracking-wide">Authorized Testing Only</div>
                  <div className="text-[10px] text-orange-400/50 mt-0.5 leading-relaxed">
                    Run this code only against systems you own or have explicit written permission to test. Unauthorized use is illegal under the CFAA and similar laws.
                  </div>
                </div>
              </div>

              {/* Attack category + language */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold border border-orange-400/30 text-orange-400/80 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {exploit.category}
                  </span>
                  <span className="text-[9px] text-primary/60 border border-primary/35 px-1.5 py-0.5 rounded uppercase">
                    {exploit.lang}
                  </span>
                </div>
                <button
                  onClick={copyExploit}
                  className="flex items-center gap-1.5 text-[10px] border border-orange-400/30 text-orange-400/60 hover:text-orange-400 hover:border-orange-400/50 px-2 py-1 rounded-sm transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              {/* Code block */}
              <div className="relative">
                <pre className="text-[10px] bg-black/50 border border-orange-400/15 p-3 rounded overflow-x-auto whitespace-pre text-orange-400/70 leading-relaxed max-h-72 overflow-y-auto">
                  {exploit.code}
                </pre>
              </div>

              {/* Attacker note */}
              {exploit.note && (
                <div className="text-[10px] text-primary/65 leading-relaxed border-l-2 border-orange-400/40 pl-2.5">
                  <span className="text-orange-400/75 font-bold">Why it works: </span>{exploit.note}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export default function GhostChain() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [target, setTarget] = usePersistedState<string>("ghostchain-target", "");
  const [activeScanId, setActiveScanId] = usePersistedState<number | null>("ghostchain-scanid", null);
  const [filterSev, setFilterSev] = usePersistedState<Severity | "all">("ghostchain-sev", "all");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: scans = [], refetch: refetchScans } = useQuery<ScanListItem[]>({
    queryKey: ["attack-chain-scans"],
    queryFn: () => apiFetch("/attack-chain/scans"),
  });

  const { data: activeScan, refetch: refetchActive } = useQuery<Scan>({
    queryKey: ["attack-chain-scan", activeScanId],
    queryFn: () => apiFetch(`/attack-chain/scan/${activeScanId}`),
    enabled: !!activeScanId,
    refetchInterval: activeScanId ? (query) => {
      const status = (query.state.data as Scan | undefined)?.scanStatus;
      return status === "running" || status === "pending" ? 2000 : false;
    } : false,
  });

  const startMut = useMutation({
    mutationFn: (t: string) => apiFetch("/attack-chain/scan", { method: "POST", body: JSON.stringify({ target: t }) }),
    onSuccess: (data) => {
      setActiveScanId(data.scanId);
      refetchScans();
      toast({ title: "Scan Started", description: `Ghost Chain analyzing ${data.target}` });
    },
    onError: (err: Error) => toast({ title: "Scan Failed", description: err.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/attack-chain/scan/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      refetchScans();
      if (activeScanId) { setActiveScanId(null); }
      toast({ title: "Scan Deleted" });
    },
  });

  const handleScan = () => {
    if (!target.trim()) return;
    startMut.mutate(target.trim());
  };

  const findings = activeScan?.findings || [];
  const filteredFindings = filterSev === "all" ? findings : findings.filter(f => f.severity === filterSev);

  const sevCounts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  findings.forEach(f => { sevCounts[f.severity as Severity] = (sevCounts[f.severity as Severity] || 0) + 1; });

  const chainEdgeCount = activeScan?.chainGraph?.edges?.length || 0;

  return (
    <div className="p-4 md:p-6 space-y-6 font-mono min-h-screen">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <GitMerge className="w-5 h-5 text-[#00ff88]" />
            <h1 className="text-lg font-bold text-primary tracking-tight">Ghost Chain</h1>
            <Badge className="text-[9px] border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88] font-mono uppercase tracking-widest px-1.5">
              Kill Chain AI
            </Badge>
          </div>
          <p className="text-xs text-primary/65 leading-relaxed max-w-xl">
            Automated multi-stage attack surface discovery and kill chain correlation. Finds every exploitable path
            from exposed credentials to full server compromise — and shows exactly how they connect.
          </p>
        </div>
      </div>

      {/* ── Scan Input ────────────────────────────────────────────────── */}
      <div className="border border-primary/20 p-4 rounded-sm bg-primary/2">
        <div className="text-[10px] text-primary/65 uppercase tracking-widest mb-3">Target</div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/50" />
            <input
              value={target}
              onChange={e => setTarget(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleScan(); }}
              placeholder="example.com or https://app.example.com"
              className="w-full bg-black/40 border border-primary/20 text-primary text-sm font-mono pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/40 rounded-sm"
            />
          </div>
          <Button
            onClick={handleScan}
            disabled={startMut.isPending || !target.trim()}
            className="bg-[#00ff88] hover:bg-[#00ff88]/80 text-black font-bold font-mono text-xs px-5 rounded-sm"
          >
            {startMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 mr-1.5" />Analyze</>}
          </Button>
        </div>
        <div className="mt-2 text-[10px] text-primary/50">
          Runs 5-stage kill chain analysis: surface discovery → fingerprinting → vuln testing → chain correlation → impact assessment
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Scan History ─────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-2">
          <div className="text-[10px] text-primary/65 uppercase tracking-widest mb-2">Scan History</div>
          {scans.length === 0 ? (
            <div className="border border-primary/10 p-5 text-center rounded-sm">
              <Search className="w-5 h-5 text-primary/40 mx-auto mb-2" />
              <span className="text-xs text-primary/45">No scans yet</span>
            </div>
          ) : (
            scans.map(scan => (
              <div
                key={scan.id}
                onClick={() => setActiveScanId(scan.id)}
                className={`border p-3 rounded-sm cursor-pointer transition-all ${
                  activeScanId === scan.id
                    ? "border-[#00ff88]/40 bg-[#00ff88]/5"
                    : "border-primary/10 hover:border-primary/20"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-primary truncate">{scan.target}</span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteMut.mutate(scan.id); }}
                    className="text-primary/40 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {scan.scanStatus === "running" ? (
                    <span className="flex items-center gap-1 text-[10px] text-yellow-400">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />Running
                    </span>
                  ) : scan.scanStatus === "complete" ? (
                    <span className="flex items-center gap-1 text-[10px] text-[#00ff88]">
                      <CheckCircle className="w-2.5 h-2.5" />Complete
                    </span>
                  ) : (
                    <span className="text-[10px] text-red-400">Error</span>
                  )}
                  {scan.riskScore != null && (
                    <span className={`text-[10px] font-bold ml-auto ${
                      scan.riskScore >= 60 ? "text-red-400" : scan.riskScore >= 30 ? "text-yellow-400" : "text-[#00ff88]"
                    }`}>Risk {scan.riskScore}</span>
                  )}
                </div>
                <div className="text-[10px] text-primary/50 mt-0.5">
                  {new Date(scan.startedAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Active Scan Results ──────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {!activeScanId ? (
            <div className="border border-primary/10 p-12 text-center rounded-sm">
              <GitMerge className="w-8 h-8 text-primary/35 mx-auto mb-3" />
              <div className="text-sm text-primary/55">Enter a target to begin kill chain analysis</div>
              <div className="text-xs text-primary/40 mt-1">Results appear here as each stage completes</div>
            </div>
          ) : !activeScan ? (
            <div className="border border-primary/10 p-8 text-center rounded-sm">
              <Loader2 className="w-6 h-6 text-primary/55 mx-auto animate-spin" />
            </div>
          ) : (
            <>
              {/* Scan header */}
              <div className="border border-primary/20 p-4 rounded-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Globe className="w-4 h-4 text-[#00ff88]" />
                      <span className="text-sm font-bold text-primary">{activeScan.target}</span>
                      <span className={`text-[10px] border px-1.5 py-px rounded-sm font-bold ${
                        activeScan.scanStatus === "running" ? "border-yellow-400/30 text-yellow-400" :
                        activeScan.scanStatus === "complete" ? "border-[#00ff88]/30 text-[#00ff88]" :
                        "border-red-400/30 text-red-400"
                      }`}>
                        {activeScan.scanStatus === "running" ? `${activeScan.currentStage || "Running"}...` :
                         activeScan.scanStatus === "complete" ? "Analysis Complete" : "Error"}
                      </span>
                    </div>
                    {activeScan.summary && (
                      <p className="text-xs text-primary/75 leading-relaxed">{activeScan.summary}</p>
                    )}
                  </div>
                  {activeScan.riskScore != null && (
                    <RiskGauge score={activeScan.riskScore} />
                  )}
                </div>

                {/* Stage tracker */}
                <div className="mt-4 pt-4 border-t border-primary/10">
                  <div className="text-[10px] text-primary/60 uppercase tracking-wider mb-3">Pipeline Progress</div>
                  <StageTracker stages={activeScan.stages || []} />
                </div>
              </div>

              {/* Summary stats */}
              {activeScan.scanStatus === "complete" && findings.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {(["critical", "high", "medium", "low", "info"] as Severity[]).map(sev => (
                    <button
                      key={sev}
                      onClick={() => setFilterSev(filterSev === sev ? "all" : sev)}
                      className={`border rounded-sm p-2 text-center transition-all ${
                        filterSev === sev ? SEV_COLOR[sev] : "border-primary/10 bg-primary/2 hover:border-primary/20"
                      }`}
                    >
                      <div className={`text-xl font-bold font-mono ${filterSev !== sev ? (sevCounts[sev] > 0 ? "text-primary" : "text-primary/20") : ""}`}>
                        {sevCounts[sev]}
                      </div>
                      <div className="text-[9px] uppercase tracking-wide mt-0.5 opacity-60">{sev}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* Attack chain graph */}
              {activeScan.scanStatus === "complete" && chainEdgeCount > 0 && (
                <div className="border border-primary/20 rounded-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10 bg-primary/3">
                    <div className="flex items-center gap-2">
                      <Network className="w-3.5 h-3.5 text-[#00ff88]" />
                      <span className="text-[11px] font-bold text-primary uppercase tracking-wide">Attack Chain Graph</span>
                      <span className="text-[10px] text-primary/55">{chainEdgeCount} chain{chainEdgeCount !== 1 ? "s" : ""} identified</span>
                    </div>
                  </div>
                  <div className="bg-black/30">
                    <ChainGraphView graph={activeScan.chainGraph} findings={findings} />
                  </div>
                  <div className="px-4 py-2.5 border-t border-primary/10 bg-primary/2">
                    <p className="text-[10px] text-primary/55 leading-relaxed">
                      Arrows show how findings chain into escalating attack paths. A single low-severity finding can become critical
                      when combined with others on the same target.
                    </p>
                  </div>
                </div>
              )}

              {/* Findings list */}
              {findings.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-primary/65 uppercase tracking-widest">
                      Findings {filterSev !== "all" && <span className="text-primary/45">— filtered: {filterSev}</span>}
                    </div>
                    {filterSev !== "all" && (
                      <button onClick={() => setFilterSev("all")} className="text-[10px] text-primary/50 hover:text-primary/75">
                        Clear filter
                      </button>
                    )}
                  </div>
                  {filteredFindings.length === 0 ? (
                    <div className="text-xs text-primary/45 text-center py-4">No {filterSev} findings</div>
                  ) : (
                    filteredFindings.map(f => <FindingCard key={f.id} finding={f} />)
                  )}
                </div>
              )}

              {/* No findings */}
              {activeScan.scanStatus === "complete" && findings.length === 0 && (
                <div className="border border-[#00ff88]/20 bg-[#00ff88]/5 p-6 rounded-sm text-center">
                  <CheckCircle className="w-6 h-6 text-[#00ff88] mx-auto mb-2" />
                  <div className="text-sm text-[#00ff88]/80 font-bold">No significant vulnerabilities detected</div>
                  <p className="text-xs text-primary/55 mt-1">Target passed all automated checks. Consider a manual penetration test for comprehensive coverage.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── How It Differs ────────────────────────────────────────────── */}
      {!activeScanId && (
        <div className="border border-primary/10 p-4 rounded-sm">
          <div className="text-[10px] text-primary/65 uppercase tracking-widest mb-4">Why Ghost Chain Goes Beyond Traditional Scanners</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {[
              {
                icon: Layers,
                title: "Multi-Stage Pipeline",
                desc: "Not just one test — 5 coordinated stages discover surfaces, fingerprint tech, test vulnerabilities, correlate chains, and assess business impact in one pass.",
              },
              {
                icon: GitMerge,
                title: "Attack Chain Correlation",
                desc: "Individual findings are analyzed together. A leaked .env + an accessible admin panel = full compromise pathway. Ghost Chain shows the complete kill chain.",
              },
              {
                icon: BarChart2,
                title: "Business Impact Framing",
                desc: "Every finding answers 'what can an attacker actually do?' Not just CVSS scores — real-world exploitation consequences are explained in plain language.",
              },
            ].map(s => (
              <div key={s.title} className="flex gap-3">
                <s.icon className="w-4 h-4 text-[#00ff88]/75 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[#00ff88]/90 font-bold text-[11px] uppercase tracking-wide mb-1">{s.title}</div>
                  <span className="text-primary/65 leading-relaxed">{s.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <BlockchainKillChainPanel />
    </div>
  );
}
