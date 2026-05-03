// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useRef } from "react";
import {
  Server, Cpu, ShieldAlert, Network, ChevronRight,
  CheckCircle2, XCircle, AlertTriangle, Clock, Zap,
  Globe, Lock, Unlock, Eye, Code2, GitBranch,
  Loader2, Play, Plus, Trash2, BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MethodProbe {
  method:      string;
  status:      "OPEN" | "AUTH_REQUIRED" | "DISABLED" | "ERROR" | "TIMEOUT";
  latencyMs:   number;
  namespace?:  string;
  dangerous:   boolean;
  description: string;
}

interface SecurityFinding {
  severity:    string;
  title:       string;
  detail:      string;
  remediation: string;
  cve?:        string;
  method?:     string;
}

interface StructureLayer {
  name:        string;
  description: string;
  components:  string[];
}

interface NodeService {
  name:         string;
  protocol:     string;
  inferredPort: number;
  status:       string;
  risk:         string;
}

interface CrackResult {
  endpoint:     string;
  reachable:    boolean;
  useTls:       boolean;
  corsPolicy?:  string;
  authRequired: boolean;
  fingerprint: {
    chain:          string;
    network:        string;
    nodeFamily:     string;
    clientName:     string;
    clientVersion:  string;
    chainId?:       number;
    latestBlock?:   number;
    syncStatus:     string;
    peerCount?:     number;
    nodeRole:       string;
    isArchive:      boolean;
    isMev:          boolean;
    consensus:      string;
    storageBackend: string;
  };
  methods:  MethodProbe[];
  structure: {
    layers:   StructureLayer[];
    services: NodeService[];
    ports:    { port: number; service: string; protocol: string; risk: string }[];
    internalModules: string[];
    dataFlow:        { from: string; to: string; label: string }[];
  };
  findings: SecurityFinding[];
  summary: {
    critical: number; high: number; medium: number; low: number; info: number;
    openMethods: number; dangerousMethods: number;
  };
  durationMs: number;
}

interface Counterparty {
  address: string;
  chain:   string;
  txCount: number;
  role:    string;
  source:  string;
}

interface DiscoveredNode {
  address:       string;
  ip:            string;
  chain:         string;
  nodeType:      string;
  rpcEndpoints:  string[];
  matchedWallet: string;
  matchReason:   string;
}

interface CrackAttempt {
  node:      DiscoveredNode;
  endpoint:  string;
  attempted: boolean;
  reachable: boolean;
  result?:   CrackResult;
  error?:    string;
}

interface PipelineResult {
  walletAddress:  string;
  walletChain:    string;
  scannedAt:      string;
  durationMs:     number;
  phases: {
    counterpartyDiscovery: { durationMs: number; found: number };
    nodeRegistryLookup:    { durationMs: number; found: number };
    nodeCracking:          { durationMs: number; attempted: number; reachable: number };
  };
  counterparties:  Counterparty[];
  discoveredNodes: DiscoveredNode[];
  crackAttempts:  CrackAttempt[];
  aggregateSummary: {
    totalNodes: number; reachableNodes: number;
    critical: number; high: number; medium: number; low: number; info: number;
    openMethods: number; dangerousMethods: number;
  };
  allFindings: Array<{
    nodeEndpoint: string; nodeChain: string; nodeClient: string;
    severity: string; title: string; detail: string; remediation: string;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/40",
  HIGH:     "bg-orange-500/20 text-orange-400 border-orange-500/40",
  MEDIUM:   "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  LOW:      "bg-blue-500/20 text-blue-400 border-blue-500/40",
  INFO:     "bg-slate-500/20 text-slate-400 border-slate-500/40",
};

const SEV_ICONS: Record<string, typeof ShieldAlert> = {
  CRITICAL: ShieldAlert,
  HIGH:     AlertTriangle,
  MEDIUM:   Eye,
  LOW:      Clock,
  INFO:     CheckCircle2,
};

const METHOD_STATUS_COLOR: Record<string, string> = {
  OPEN:          "text-green-400",
  AUTH_REQUIRED: "text-yellow-400",
  DISABLED:      "text-slate-600",
  ERROR:         "text-red-400",
  TIMEOUT:       "text-orange-400",
};

function SevBadge({ sev }: { sev: string }) {
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase", SEV_COLORS[sev] ?? SEV_COLORS.INFO)}>
      {sev}
    </span>
  );
}

function PipelineStep({ step, label, value, done, active }: {
  step: number; label: string; value?: string; done: boolean; active: boolean;
}) {
  return (
    <div className={cn("flex items-start gap-3 p-3 rounded-lg border transition-all", done ? "border-cyan-500/40 bg-cyan-500/5" : active ? "border-yellow-500/40 bg-yellow-500/5 animate-pulse" : "border-border/30 bg-muted/5")}>
      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5", done ? "bg-cyan-500 text-black" : active ? "bg-yellow-500 text-black" : "bg-muted/30 text-muted-foreground")}>
        {done ? <CheckCircle2 className="w-4 h-4" /> : active ? <Loader2 className="w-4 h-4 animate-spin" /> : step}
      </div>
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        {value && <div className="text-xs text-muted-foreground mt-0.5">{value}</div>}
      </div>
    </div>
  );
}

function NodeCard({ attempt, onSelect }: { attempt: CrackAttempt; onSelect: () => void }) {
  const r = attempt.result;
  const fp = r?.fingerprint;
  const total = r ? r.summary.critical + r.summary.high + r.summary.medium : 0;
  const worst = r?.summary.critical ? "CRITICAL" : r?.summary.high ? "HIGH" : r?.summary.medium ? "MEDIUM" : r?.summary.low ? "LOW" : "CLEAN";
  const worstColor = worst === "CRITICAL" ? "border-red-500/60 bg-red-500/5" : worst === "HIGH" ? "border-orange-500/50 bg-orange-500/5" : worst === "MEDIUM" ? "border-yellow-500/50 bg-yellow-500/5" : attempt.reachable ? "border-green-500/40 bg-green-500/5" : "border-border/30 bg-muted/5";

  return (
    <button onClick={onSelect} className={cn("w-full text-left p-4 rounded-xl border transition-all hover:brightness-110", worstColor)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-xs font-mono text-cyan-300 truncate max-w-[200px]">{attempt.endpoint}</span>
        </div>
        <SevBadge sev={worst} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        {fp && <span>{fp.clientName}</span>}
        {fp && <span>·</span>}
        {fp && <span>{fp.network}</span>}
        {fp && <span>·</span>}
        {r && <span>{r.summary.openMethods} methods open</span>}
        {!attempt.reachable && <span className="text-red-400">Unreachable</span>}
      </div>
      {total > 0 && (
        <div className="mt-2 flex gap-1.5">
          {r!.summary.critical > 0 && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">{r!.summary.critical}C</span>}
          {r!.summary.high     > 0 && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">{r!.summary.high}H</span>}
          {r!.summary.medium   > 0 && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">{r!.summary.medium}M</span>}
          {r!.summary.low      > 0 && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">{r!.summary.low}L</span>}
        </div>
      )}
      <div className="mt-2 text-[10px] text-muted-foreground/50">{attempt.node.matchReason}</div>
    </button>
  );
}

// ── Method table ──────────────────────────────────────────────────────────────

function MethodTable({ methods }: { methods: MethodProbe[] }) {
  const namespaces = [...new Set(methods.map(m => m.namespace ?? "other"))].sort();
  const [ns, setNs] = useState("all");
  const visible = ns === "all" ? methods : methods.filter(m => (m.namespace ?? "other") === ns);
  const openCount = visible.filter(m => m.status === "OPEN").length;
  const dangerOpen = visible.filter(m => m.status === "OPEN" && m.dangerous).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {["all", ...namespaces].map(n => (
          <button key={n} onClick={() => setNs(n)} className={cn("px-2 py-0.5 rounded text-[11px] border transition-all", ns === n ? "border-cyan-500 bg-cyan-500/10 text-cyan-400" : "border-border/30 text-muted-foreground hover:border-border")}>
            {n}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground self-center">
          {openCount} open · {dangerOpen} dangerous
        </span>
      </div>
      <div className="rounded-lg border border-border/30 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/30 bg-muted/10">
              <th className="text-left px-3 py-2 text-muted-foreground font-medium">Method</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium">Status</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium">Latency</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium hidden md:table-cell">Description</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m, i) => (
              <tr key={m.method} className={cn("border-b border-border/20 last:border-0", i % 2 === 0 ? "" : "bg-muted/5", m.dangerous && m.status === "OPEN" ? "bg-red-500/5" : "")}>
                <td className="px-3 py-2 font-mono">
                  <span className={m.dangerous ? "text-orange-400" : "text-foreground"}>{m.method}</span>
                  {m.dangerous && <span className="ml-1 text-[9px] text-orange-500 border border-orange-500/30 px-1 rounded">DANGER</span>}
                </td>
                <td className={cn("px-3 py-2 font-medium", METHOD_STATUS_COLOR[m.status])}>
                  {m.status}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{m.latencyMs}ms</td>
                <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">{m.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Structure viewer ──────────────────────────────────────────────────────────

function StructureView({ structure }: { structure: CrackResult["structure"] }) {
  return (
    <div className="space-y-4">
      {structure.layers.map((layer, i) => (
        <div key={i} className="rounded-xl border border-border/30 p-4 bg-muted/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded bg-cyan-500/20 flex items-center justify-center text-[10px] text-cyan-400 font-bold">{i + 1}</div>
            <h4 className="font-semibold text-sm text-foreground">{layer.name}</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{layer.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {layer.components.map((c, j) => (
              <span key={j} className={cn("text-[11px] px-2 py-0.5 rounded border", c.includes("EXPOSED") ? "border-red-500/40 bg-red-500/10 text-red-400" : c.includes("⚠️") ? "border-orange-500/40 bg-orange-500/10 text-orange-400" : "border-border/30 bg-muted/10 text-muted-foreground")}>
                {c}
              </span>
            ))}
          </div>
        </div>
      ))}

      {structure.dataFlow.length > 0 && (
        <div className="rounded-xl border border-border/30 p-4 bg-muted/5">
          <h4 className="font-semibold text-sm text-foreground mb-3">Data Flow</h4>
          <div className="space-y-1.5">
            {structure.dataFlow.map((edge, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-cyan-400">{edge.from}</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <span className="font-mono text-purple-400">{edge.to}</span>
                <span className="text-muted-foreground italic">({edge.label})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/30 p-4 bg-muted/5">
          <h4 className="font-semibold text-sm text-foreground mb-3">Inferred Services</h4>
          <div className="space-y-2">
            {structure.services.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{s.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">:{s.inferredPort}</span>
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px]", s.risk === "high" ? "bg-red-500/20 text-red-400" : s.risk === "medium" ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400")}>
                    {s.risk}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border/30 p-4 bg-muted/5">
          <h4 className="font-semibold text-sm text-foreground mb-3">Internal Modules</h4>
          <div className="flex flex-wrap gap-1">
            {structure.internalModules.map((m, i) => (
              <span key={i} className={cn("text-[11px] px-2 py-0.5 rounded border", m.includes("EXPOSED") ? "border-red-500/40 text-red-400 bg-red-500/5" : "border-border/30 text-muted-foreground bg-muted/5")}>
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Node detail panel ─────────────────────────────────────────────────────────

function NodeDetail({ attempt }: { attempt: CrackAttempt }) {
  const r = attempt.result;
  const fp = r?.fingerprint;

  if (!attempt.reachable || !r) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
        <XCircle className="w-10 h-10 text-red-500/50" />
        <p className="text-sm">Node unreachable at {attempt.endpoint}</p>
        {attempt.error && <p className="text-xs text-muted-foreground/60">{attempt.error}</p>}
      </div>
    );
  }

  return (
    <Tabs defaultValue="fingerprint" className="w-full">
      <TabsList className="h-8 text-xs bg-muted/20 border border-border/30">
        <TabsTrigger value="fingerprint" className="h-6 text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">Fingerprint</TabsTrigger>
        <TabsTrigger value="structure"   className="h-6 text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">Structure</TabsTrigger>
        <TabsTrigger value="methods"     className="h-6 text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">Methods ({r.methods.length})</TabsTrigger>
        <TabsTrigger value="findings"    className="h-6 text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
          Findings {r.summary.critical + r.summary.high + r.summary.medium + r.summary.low > 0 && `(${r.summary.critical + r.summary.high + r.summary.medium + r.summary.low})`}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="fingerprint" className="mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            ["Chain / Network",    fp?.network ?? "—"],
            ["Client",             fp?.clientName ?? "—"],
            ["Version",            fp?.clientVersion ?? "—"],
            ["Node Role",          fp?.nodeRole ?? "—"],
            ["Consensus",          fp?.consensus ?? "—"],
            ["Storage Backend",    fp?.storageBackend ?? "—"],
            ["Chain ID",           fp?.chainId?.toString() ?? "—"],
            ["Latest Block / Slot",fp?.latestBlock?.toLocaleString() ?? "—"],
            ["Sync Status",        fp?.syncStatus ?? "—"],
            ["Peer Count",         fp?.peerCount?.toString() ?? "—"],
            ["Archive Node",       fp?.isArchive ? "Yes" : "No"],
            ["MEV / Flashbots",    fp?.isMev ? "Yes" : "No"],
            ["TLS",                r.useTls ? "✓ HTTPS" : "✗ Plaintext HTTP"],
            ["Auth Required",      r.authRequired ? "Yes" : "No"],
            ["CORS Policy",        r.corsPolicy ?? "none detected"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2 text-xs border-b border-border/20 pb-1.5">
              <span className="text-muted-foreground">{label}</span>
              <span className={cn("font-mono text-right", value === "✗ Plaintext HTTP" ? "text-red-400" : value === "✓ HTTPS" ? "text-green-400" : value === "Yes" && label === "MEV / Flashbots" ? "text-purple-400" : value === "Yes" && label === "Archive Node" ? "text-cyan-400" : "text-foreground")}>
                {value}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          <span className="text-[11px] bg-muted/20 border border-border/30 px-2 py-1 rounded">{r.summary.openMethods} open methods</span>
          {r.summary.dangerousMethods > 0 && <span className="text-[11px] bg-red-500/10 border border-red-500/30 text-red-400 px-2 py-1 rounded">{r.summary.dangerousMethods} dangerous open</span>}
          <span className="text-[11px] bg-muted/20 border border-border/30 px-2 py-1 rounded">{r.durationMs}ms scan</span>
        </div>
      </TabsContent>

      <TabsContent value="structure" className="mt-4">
        <StructureView structure={r.structure} />
      </TabsContent>

      <TabsContent value="methods" className="mt-4">
        <MethodTable methods={r.methods} />
      </TabsContent>

      <TabsContent value="findings" className="mt-4">
        {r.findings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
            <CheckCircle2 className="w-8 h-8 text-green-500/60" />
            <p className="text-sm">No security findings</p>
          </div>
        ) : (
          <div className="space-y-3">
            {r.findings.map((f, i) => {
              const Icon = SEV_ICONS[f.severity] ?? Eye;
              return (
                <div key={i} className={cn("rounded-xl border p-4", SEV_COLORS[f.severity])}>
                  <div className="flex items-start gap-3">
                    <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SevBadge sev={f.severity} />
                        <span className="text-sm font-semibold">{f.title}</span>
                        {f.method && <span className="text-[10px] font-mono text-muted-foreground">{f.method}</span>}
                      </div>
                      <p className="text-xs mt-2 text-muted-foreground">{f.detail}</p>
                      <div className="mt-2 text-xs border-t border-current/20 pt-2">
                        <span className="font-medium">Fix: </span>{f.remediation}
                      </div>
                      {f.cve && <div className="mt-1 text-[10px] text-muted-foreground">Ref: {f.cve}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NodeCracker() {
  const [walletAddress, setWalletAddress]   = useState("");
  const [extraEndpoints, setExtraEndpoints] = useState<string[]>([]);
  const [newEndpoint, setNewEndpoint]       = useState("");
  const [maxNodes, setMaxNodes]             = useState(8);
  const [running, setRunning]               = useState(false);
  const [phase, setPhase]                   = useState(0); // 0=idle 1=cp 2=nodes 3=crack 4=done
  const [result, setResult]                 = useState<PipelineResult | null>(null);
  const [singleEndpoint, setSingleEndpoint] = useState("");
  const [singleResult, setSingleResult]     = useState<CrackResult | null>(null);
  const [singleRunning, setSingleRunning]   = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<CrackAttempt | null>(null);
  const [mode, setMode]                     = useState<"pipeline" | "direct">("pipeline");
  const abortRef = useRef(false);

  async function runPipeline() {
    if (!walletAddress.trim()) return;
    setRunning(true);
    setResult(null);
    setSelectedAttempt(null);
    abortRef.current = false;
    setPhase(1);

    try {
      const r = await fetch("/api/node-cracker/wallet-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address:        walletAddress.trim(),
          maxNodes,
          extraEndpoints,
        }),
      });
      setPhase(4);
      if (!r.ok) throw new Error(await r.text());
      const data: PipelineResult = await r.json();
      setResult(data);
      if (data.crackAttempts.length > 0) setSelectedAttempt(data.crackAttempts[0]);
    } catch (e: any) {
      console.error(e);
    } finally {
      setRunning(false);
      setPhase(0);
    }
  }

  async function runDirect() {
    if (!singleEndpoint.trim()) return;
    setSingleRunning(true);
    setSingleResult(null);
    try {
      const r = await fetch("/api/node-cracker/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: singleEndpoint.trim() }),
      });
      if (!r.ok) throw new Error(await r.text());
      setSingleResult(await r.json());
    } catch (e: any) {
      console.error(e);
    } finally {
      setSingleRunning(false);
    }
  }

  const summary = result?.aggregateSummary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border border-cyan-500/30 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Node Cracker</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Wallet → counterparty extraction → live node registry cross-reference → full RPC fingerprint, method surface
          mapping, and structural reverse engineering. Covers EVM, Solana, and Bitcoin across every major chain.
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2">
        <Button size="sm" variant={mode === "pipeline" ? "default" : "outline"} onClick={() => setMode("pipeline")} className={mode === "pipeline" ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40" : ""}>
          <GitBranch className="w-3.5 h-3.5 mr-1.5" />Wallet Pipeline
        </Button>
        <Button size="sm" variant={mode === "direct" ? "default" : "outline"} onClick={() => setMode("direct")} className={mode === "direct" ? "bg-purple-500/20 text-purple-400 border-purple-500/40" : ""}>
          <Server className="w-3.5 h-3.5 mr-1.5" />Direct Endpoint Crack
        </Button>
      </div>

      {/* Pipeline mode */}
      {mode === "pipeline" && (
        <div className="space-y-6">
          {/* Config panel */}
          <div className="rounded-2xl border border-border/40 bg-card/60 p-6 space-y-5">
            <h2 className="font-semibold flex items-center gap-2">
              <Network className="w-4 h-4 text-cyan-400" />Pipeline Configuration
            </h2>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Target Wallet Address (any chain)</Label>
              <Input
                value={walletAddress}
                onChange={e => setWalletAddress(e.target.value)}
                placeholder="3ec8R6jR… or 0xabcd… or 1BvBMSE…"
                className="font-mono text-sm bg-muted/10 border-border/40"
              />
              <p className="text-[11px] text-muted-foreground">Solana (base58), EVM (0x…), Bitcoin/Litecoin/Dogecoin addresses all supported. Auto-detected.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Extra RPC Endpoints to Crack (optional)</Label>
              <div className="space-y-1.5">
                {extraEndpoints.map((ep, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 text-xs font-mono text-cyan-300 bg-muted/10 border border-border/30 rounded px-2 py-1.5">{ep}</span>
                    <button onClick={() => setExtraEndpoints(ep2 => ep2.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newEndpoint}
                    onChange={e => setNewEndpoint(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && newEndpoint.trim()) { setExtraEndpoints(ep => [...ep, newEndpoint.trim()]); setNewEndpoint(""); } }}
                    placeholder="https://my-node.example.com:8545"
                    className="flex-1 font-mono text-xs bg-muted/10 border-border/40"
                  />
                  <Button size="sm" variant="outline" onClick={() => { if (newEndpoint.trim()) { setExtraEndpoints(ep => [...ep, newEndpoint.trim()]); setNewEndpoint(""); } }}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Max nodes to crack: {maxNodes}</Label>
                <input type="range" min={1} max={20} value={maxNodes} onChange={e => setMaxNodes(+e.target.value)} className="w-40 accent-cyan-500" />
              </div>
            </div>

            <Button onClick={runPipeline} disabled={running || !walletAddress.trim()} className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500/30">
              {running ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Running pipeline…</> : <><Play className="w-4 h-4 mr-2" />Launch Pipeline</>}
            </Button>
          </div>

          {/* Pipeline progress */}
          {(running || result) && (
            <div className="rounded-2xl border border-border/40 bg-card/60 p-6 space-y-3">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Pipeline Progress</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <PipelineStep step={1} label="Counterparty Discovery" done={!!result || phase > 1}  active={phase === 1}
                  value={result ? `${result.phases.counterpartyDiscovery.found} addresses found in ${result.phases.counterpartyDiscovery.durationMs}ms` : undefined} />
                <PipelineStep step={2} label="Node Registry Lookup"   done={!!result || phase > 2}  active={phase === 2}
                  value={result ? `${result.phases.nodeRegistryLookup.found} nodes matched in ${result.phases.nodeRegistryLookup.durationMs}ms` : undefined} />
                <PipelineStep step={3} label="Node Cracking"          done={!!result || phase > 3}  active={phase === 3}
                  value={result ? `${result.phases.nodeCracking.reachable}/${result.phases.nodeCracking.attempted} reachable in ${result.phases.nodeCracking.durationMs}ms` : undefined} />
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-6">
              {/* Aggregate summary */}
              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Nodes Cracked",    value: summary.reachableNodes,   color: "text-cyan-400" },
                    { label: "Critical",          value: summary.critical,         color: "text-red-400" },
                    { label: "High",              value: summary.high,             color: "text-orange-400" },
                    { label: "Medium",            value: summary.medium,           color: "text-yellow-400" },
                    { label: "Open Methods",      value: summary.openMethods,      color: "text-green-400" },
                    { label: "Dangerous Open",    value: summary.dangerousMethods, color: "text-orange-400" },
                    { label: "Counterparties",    value: result.counterparties.length, color: "text-purple-400" },
                    { label: "Scan Time",         value: `${(result.durationMs / 1000).toFixed(1)}s`, color: "text-muted-foreground" },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl border border-border/30 bg-muted/10 p-3 text-center">
                      <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <Tabs defaultValue="nodes">
                <TabsList className="bg-muted/20 border border-border/30">
                  <TabsTrigger value="nodes"        className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">Cracked Nodes</TabsTrigger>
                  <TabsTrigger value="counterparties" className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">Counterparties</TabsTrigger>
                  <TabsTrigger value="all-findings" className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">All Findings ({result.allFindings.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="nodes" className="mt-4">
                  {result.crackAttempts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                      <Server className="w-8 h-8 text-muted-foreground/30" />
                      <p className="text-sm">No nodes discovered for this wallet</p>
                      <p className="text-xs text-muted-foreground/60">Try adding manual RPC endpoints above</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        {result.crackAttempts.map((a, i) => (
                          <NodeCard key={i} attempt={a} onSelect={() => setSelectedAttempt(a)} />
                        ))}
                      </div>
                      <div className="lg:col-span-2 rounded-2xl border border-border/40 bg-card/60 p-5">
                        {selectedAttempt ? (
                          <>
                            <div className="mb-4 flex items-center gap-2">
                              <Server className="w-4 h-4 text-cyan-400" />
                              <span className="text-sm font-mono text-cyan-300">{selectedAttempt.endpoint}</span>
                            </div>
                            <NodeDetail attempt={selectedAttempt} />
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                            Select a node on the left to inspect
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="counterparties" className="mt-4">
                  <div className="rounded-lg border border-border/30 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/30 bg-muted/10">
                          <th className="text-left px-3 py-2 text-muted-foreground">Address</th>
                          <th className="text-left px-3 py-2 text-muted-foreground">Chain</th>
                          <th className="text-left px-3 py-2 text-muted-foreground">Txs</th>
                          <th className="text-left px-3 py-2 text-muted-foreground">Source</th>
                          <th className="text-left px-3 py-2 text-muted-foreground">Node Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.counterparties.map((c, i) => {
                          const match = result.discoveredNodes.find(n => n.address === c.address);
                          return (
                            <tr key={i} className={cn("border-b border-border/20 last:border-0", match ? "bg-cyan-500/5" : "")}>
                              <td className="px-3 py-2 font-mono text-foreground">{c.address.slice(0, 20)}…</td>
                              <td className="px-3 py-2 text-muted-foreground">{c.chain}</td>
                              <td className="px-3 py-2 text-muted-foreground">{c.txCount}</td>
                              <td className="px-3 py-2 text-muted-foreground">{c.source}</td>
                              <td className="px-3 py-2">{match ? <span className="text-cyan-400 text-[10px] font-medium">✓ {match.nodeType}</span> : <span className="text-muted-foreground/40">—</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="all-findings" className="mt-4">
                  {result.allFindings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                      <CheckCircle2 className="w-8 h-8 text-green-500/50" />
                      <p className="text-sm">No findings across any cracked node</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {result.allFindings
                        .sort((a, b) => {
                          const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
                          return (order[a.severity as keyof typeof order] ?? 5) - (order[b.severity as keyof typeof order] ?? 5);
                        })
                        .map((f, i) => (
                          <div key={i} className={cn("rounded-xl border p-4", SEV_COLORS[f.severity])}>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <SevBadge sev={f.severity} />
                              <span className="text-sm font-semibold">{f.title}</span>
                              <span className="text-[10px] text-muted-foreground ml-auto">{f.nodeClient} · {f.nodeChain}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{f.detail}</p>
                            <div className="mt-2 text-xs border-t border-current/20 pt-2">
                              <span className="font-medium">Fix: </span>{f.remediation}
                            </div>
                            <div className="mt-1 text-[10px] text-muted-foreground/50 font-mono">{f.nodeEndpoint}</div>
                          </div>
                        ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      )}

      {/* Direct mode */}
      {mode === "direct" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/40 bg-card/60 p-6 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-400" />Direct Node Crack
            </h2>
            <p className="text-xs text-muted-foreground">Paste any blockchain RPC endpoint URL. The cracker auto-detects the chain (EVM / Solana / Bitcoin), fingerprints the client, maps all exposed methods, reconstructs the internal architecture, and reports security findings.</p>
            <div className="flex gap-2">
              <Input
                value={singleEndpoint}
                onChange={e => setSingleEndpoint(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") runDirect(); }}
                placeholder="https://my-geth-node.example.com:8545  or  http://192.168.1.10:8899"
                className="flex-1 font-mono text-sm bg-muted/10 border-border/40"
              />
              <Button onClick={runDirect} disabled={singleRunning || !singleEndpoint.trim()} className="bg-purple-500/20 text-purple-400 border border-purple-500/40 hover:bg-purple-500/30">
                {singleRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cracking…</> : <><Zap className="w-4 h-4 mr-2" />Crack Node</>}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                "https://eth.llamarpc.com",
                "https://api.mainnet-beta.solana.com",
                "https://bsc-dataseed.binance.org",
                "https://polygon.llamarpc.com",
                "https://arb1.arbitrum.io/rpc",
                "https://mainnet.optimism.io",
                "https://api.avax.network/ext/bc/C/rpc",
              ].map(ep => (
                <button key={ep} onClick={() => setSingleEndpoint(ep)} className="text-[10px] font-mono text-muted-foreground bg-muted/10 border border-border/30 hover:border-border px-2 py-1 rounded transition-all">
                  {ep}
                </button>
              ))}
            </div>
          </div>

          {singleRunning && (
            <div className="flex items-center justify-center h-32 gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              <span className="text-sm">Probing endpoint, mapping methods, reconstructing structure…</span>
            </div>
          )}

          {singleResult && (
            <div className="rounded-2xl border border-border/40 bg-card/60 p-6">
              <div className="flex items-center gap-3 mb-5">
                <Server className="w-5 h-5 text-purple-400" />
                <span className="font-mono text-sm text-purple-300">{singleResult.endpoint}</span>
                <div className="flex gap-1.5 ml-auto">
                  {singleResult.useTls ? <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30">TLS</span> : <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">NO TLS</span>}
                  {singleResult.authRequired ? <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/30">AUTH</span> : <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded border border-orange-500/30">NO AUTH</span>}
                  <span className="text-[10px] bg-muted/20 text-muted-foreground px-2 py-0.5 rounded border border-border/30">{singleResult.durationMs}ms</span>
                </div>
              </div>

              {!singleResult.reachable ? (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <XCircle className="w-4 h-4" /> Endpoint unreachable — no known RPC methods responded
                </div>
              ) : (
                <NodeDetail attempt={{
                  node:      { address: singleResult.endpoint, ip: "", chain: singleResult.fingerprint.nodeFamily, nodeType: singleResult.fingerprint.nodeRole, rpcEndpoints: [singleResult.endpoint], matchedWallet: "", matchReason: "direct" },
                  endpoint:  singleResult.endpoint,
                  attempted: true,
                  reachable: true,
                  result:    singleResult,
                }} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
