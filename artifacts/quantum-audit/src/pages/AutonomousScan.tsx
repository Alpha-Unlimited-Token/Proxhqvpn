import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  Play, Square, RefreshCw, Activity, Key, Globe, Search,
  GitBranch, Clock, Zap, AlertTriangle, CheckCircle, Database,
  TrendingUp, Shield, Cpu, Loader2, ExternalLink, ArrowRight,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

async function apiFetch(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`/api/quantum-audit${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(e.error ?? res.statusText);
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CrossEngineFlows {
  e1ToE3: number; e1ToE4: number;
  e2ToE3: number; e2ToE4: number;
  e3ToE2: number; e3ToE4: number; e3ToE1: number;
  e4ToE3: number; e4ToE1: number;
  crossNonceHits: number;
}

interface PoolStats {
  osintQueue:      number;
  peelQueue:       number;
  e1Queue:         number;
  multiChainQueue: number;
  urlQueue:        number;
  rValues:         number;
  confirmedKeys:   number;
}

interface AutonomousStatus {
  running:           boolean;
  startedAt:         string | null;
  uptimeHours:       number;
  windowsCompleted:  number;
  totalFindings:     number;
  recoveredKeys:     number;
  lastBlockScanned:  number;
  lowestBlockCovered: number;
  blocksRemaining:   number;
  osintRuns:         number;
  peelRuns:          number;
  hybridRuns:        number;
  errors:            number;
  pendingUrls:       number;
  statusMessage:     string;
  estimatedBlocksPerHour: number;
  progressPct:       number;
  seededWallets?:    number;
  crossEngineFlows?: CrossEngineFlows;
  poolStats?:        PoolStats;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function Stat({
  label, value, sub, icon: Icon, accent, warn, good,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: boolean;
  warn?: boolean;
  good?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border p-4 flex flex-col gap-1",
      accent ? "border-violet-500/40 bg-violet-950/20" :
      warn   ? "border-amber-500/40 bg-amber-950/20" :
      good   ? "border-emerald-500/40 bg-emerald-950/20" :
              "border-gray-700/50 bg-gray-900/40",
    )}>
      <div className="flex items-center gap-2 text-gray-400 text-xs">
        <Icon className={cn("w-3.5 h-3.5",
          accent ? "text-violet-400" :
          warn   ? "text-amber-400" :
          good   ? "text-emerald-400" : "text-gray-400",
        )} />
        {label}
      </div>
      <div className={cn("text-2xl font-bold tabular-nums",
        accent ? "text-violet-200" :
        warn   ? "text-amber-200" :
        good   ? "text-emerald-200" : "text-white",
      )}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

// ── Engine row ────────────────────────────────────────────────────────────────

function EngineRow({
  icon: Icon, color, label, runs, detail,
}: {
  icon: React.ElementType;
  color: string;
  label: string;
  runs: number;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-800/60 last:border-0">
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white font-medium">{label}</div>
        <div className="text-xs text-gray-500">{detail}</div>
      </div>
      <div className="text-sm font-mono text-gray-300">{runs.toLocaleString()} runs</div>
    </div>
  );
}

// ── Cross-engine flow row ─────────────────────────────────────────────────────

function FlowRow({ from, to, count, detail }: { from: string; to: string; count: number; detail: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-800/40 last:border-0 text-xs">
      <span className="font-mono text-blue-400 w-4 text-center">{from}</span>
      <ArrowRight className="w-3 h-3 text-gray-600 shrink-0" />
      <span className="font-mono text-emerald-400 w-4 text-center">{to}</span>
      <span className="text-gray-500 flex-1">{detail}</span>
      <span className="font-mono text-gray-300 tabular-nums">{count.toLocaleString()}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AutonomousScan() {
  const [status, setStatus]     = useState<AutonomousStatus | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await apiFetch("/sig-engine/autonomous/status");
      setStatus(s);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, status?.running ? 8_000 : 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus, status?.running]);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      await apiFetch("/sig-engine/autonomous/start", "POST", {
        resumeFromSave:        true,
        windowSize:            50,
        pauseBetweenWindowsMs: 3000,
        osintEveryNWindows:    10,
        peelEveryNWindows:     20,
        hybridEveryNWindows:   40,
        // no maxRuntimeMs — runs forever
      });
      await fetchStatus();
    } catch (e) {
      setError(String(e));
    } finally {
      setStarting(false);
    }
  }

  async function stop() {
    setStopping(true);
    try {
      await apiFetch("/sig-engine/autonomous/stop", "POST");
      await fetchStatus();
    } catch (e) {
      setError(String(e));
    } finally {
      setStopping(false);
    }
  }

  const isRunning = status?.running ?? false;
  const uptimeStr = status?.uptimeHours != null
    ? `${Math.floor(status.uptimeHours)}h ${Math.round((status.uptimeHours % 1) * 60)}m`
    : "—";
  const f = status?.crossEngineFlows;
  const p = status?.poolStats;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            Autonomous Scan Control
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Self-healing 5-engine scan — runs indefinitely without supervision.
            Auto-restarts after crashes or block wraps. Stop is permanent until manually resumed.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setLoading(true); fetchStatus().finally(() => setLoading(false)); }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors">
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh
          </button>
          {isRunning ? (
            <button onClick={stop} disabled={stopping}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors">
              {stopping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
              Stop
            </button>
          ) : (
            <button onClick={start} disabled={starting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">
              {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Resume
            </button>
          )}
        </div>
      </div>

      {/* Live status pill */}
      {status && (
        <div className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm",
          isRunning
            ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
            : "border-gray-700/50 bg-gray-900/40 text-gray-400",
        )}>
          {isRunning ? (
            <>
              <Activity className="w-4 h-4 animate-pulse" />
              <span className="font-medium">RUNNING</span>
              <span className="text-gray-400">·</span>
              <span className="text-xs text-emerald-400/80 truncate flex-1">{status.statusMessage}</span>
              <span className="text-xs text-emerald-600 shrink-0 flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Auto-restarts on any exit
              </span>
            </>
          ) : (
            <>
              <Clock className="w-4 h-4" />
              <span className="flex-1">{status.statusMessage || "Stopped — auto-restart is paused until Resume is clicked"}</span>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-500/40 bg-red-950/20 text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {status && (
        <>
          {/* Block progress */}
          <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span>Block coverage — scanning backward indefinitely, wraps on block 0</span>
              <span className="font-mono">
                {(status.lowestBlockCovered || 0).toLocaleString()} → {(status.lastBlockScanned || 0).toLocaleString()}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-emerald-500 transition-all duration-1000"
                style={{ width: `${Math.max(2, status.progressPct)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <span>{status.windowsCompleted.toLocaleString()} windows completed</span>
              <span>~{(status.estimatedBlocksPerHour || 0).toLocaleString()} blocks/hr</span>
            </div>
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={Clock}     label="Uptime"         value={uptimeStr}
              sub={`Started ${status.startedAt ? new Date(status.startedAt).toLocaleTimeString() : "—"}`} />
            <Stat icon={Activity}  label="Windows"        value={status.windowsCompleted} sub="50 blocks each" />
            <Stat icon={Key}       label="Keys Recovered" value={status.recoveredKeys}
              good={status.recoveredKeys > 0} sub="confirmed private keys" />
            <Stat icon={Zap}       label="Findings"       value={status.totalFindings}
              accent sub="all engines combined" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={AlertTriangle} label="Errors"          value={status.errors}
              warn={status.errors > 10} sub="auto-retried with backoff" />
            <Stat icon={Globe}         label="URLs Queued"     value={p?.urlQueue ?? status.pendingUrls}
              sub="pending for Engine 2" />
            <Stat icon={Shield}        label="Your Wallets"    value={status.seededWallets ?? 0}
              good={(status.seededWallets ?? 0) > 0}
              sub="loaded from your uploads — all 5 engines" />
            <Stat icon={Database}      label="R-Values Seen"   value={p?.rValues ?? 0}
              accent sub="cross-engine nonce registry" />
          </div>

          {/* Cross-engine pool */}
          {p && (
            <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
              {[
                { label: "OSINT queue",       value: p.osintQueue,       color: "text-amber-300"  },
                { label: "Peel queue",        value: p.peelQueue,        color: "text-red-300"    },
                { label: "E1 queue",          value: p.e1Queue,          color: "text-blue-300"   },
                { label: "⛓ Multi-chain Q",  value: p.multiChainQueue ?? 0, color: "text-cyan-300" },
                { label: "URL queue",         value: p.urlQueue,         color: "text-purple-300" },
                { label: "R-values",          value: p.rValues,          color: "text-violet-300" },
                { label: "Conf. keys",        value: p.confirmedKeys,    color: "text-emerald-300" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg border border-gray-700/50 bg-gray-900/40 px-3 py-2 text-center">
                  <div className={cn("text-lg font-bold tabular-nums", color)}>{value.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Per-engine runs */}
          <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-4">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              Engine Run Counts
            </h2>
            <EngineRow icon={Activity}   color="bg-violet-600"  label="Engine 1 — Block Scanner"
              runs={status.windowsCompleted}
              detail="Every window · nonce reuse / weak-k / r-collision / bias / polynomial" />
            <EngineRow icon={Globe}      color="bg-blue-600"    label="Engine 2 — Web Signature Spider"
              runs={Math.floor(status.windowsCompleted / 3)}
              detail="Auto-chained from tx-embedded URLs + E3 source URLs · BFS crawl" />
            <EngineRow icon={Search}     color="bg-amber-600"   label="Engine 3 — OSINT Spider"
              runs={status.osintRuns}
              detail="Every 10 windows · GitHub / Pastebin / ENS / OP_RETURN / cross-engine addresses" />
            <EngineRow icon={GitBranch}  color="bg-red-600"     label="Engine 4 — Peel Chain Tracer"
              runs={status.peelRuns}
              detail="Every 20 windows · nonce-reuse + r-collision + E2/E3 derived addresses" />
            <EngineRow icon={Cpu}        color="bg-emerald-600" label="Hybrid Worm Engine"
              runs={status.hybridRuns}
              detail="Every 40 windows · all 4 engines as coordinated worm swarm" />
          </div>

          {/* Cross-engine flows */}
          {f && (
            <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-4">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-gray-400" />
                Cross-Engine Intelligence Flows
                {f.crossNonceHits > 0 && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400 font-medium">
                    <Zap className="w-3 h-3" />
                    {f.crossNonceHits} cross-nonce hit{f.crossNonceHits !== 1 ? "s" : ""}
                  </span>
                )}
              </h2>
              <div className="space-y-0">
                <FlowRow from="E1" to="E3" count={f.e1ToE3} detail="signing addresses → OSINT lookup" />
                <FlowRow from="E1" to="E4" count={f.e1ToE4} detail="nonce-reuse + r-collision addrs → peel chain" />
                <FlowRow from="E2" to="E3" count={f.e2ToE3} detail="page-context ETH addrs → OSINT" />
                <FlowRow from="E2" to="E4" count={f.e2ToE4} detail="found private key addrs → peel chain" />
                <FlowRow from="E3" to="E2" count={f.e3ToE2} detail="finding source URLs → web spider crawl" />
                <FlowRow from="E3" to="E4" count={f.e3ToE4} detail="OSINT-derived key addrs → peel chain" />
                <FlowRow from="E3" to="E1" count={f.e3ToE1} detail="suspicious addrs → E1 targeted scan" />
                <FlowRow from="E4" to="E3" count={f.e4ToE3} detail="hop outgoing addrs → OSINT" />
                <FlowRow from="E4" to="E1" count={f.e4ToE1} detail="hop nonce-reuse addrs → E1 deep scan" />
              </div>
            </div>
          )}

          {/* Operation details */}
          <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-4 text-xs text-gray-400 space-y-2">
            <div className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-400" />
              Autonomous Operation Details
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
              <div><span className="text-gray-300">Mode:</span> Endless — no time cap, runs until Stop is clicked</div>
              <div><span className="text-gray-300">Crash recovery:</span> Auto-restarts after 30 s on any unexpected exit</div>
              <div><span className="text-gray-300">Boot behavior:</span> Auto-starts 90 s after server boot</div>
              <div><span className="text-gray-300">Stop behavior:</span> Permanent — watchdog pauses until Resume is clicked</div>
              <div><span className="text-gray-300">Window size:</span> 50 blocks per Engine 1 pass</div>
              <div><span className="text-gray-300">Pause between windows:</span> 3 s (anti-rate-limit)</div>
              <div><span className="text-gray-300">RPC backoff:</span> Exponential 3 s → 60 s on 429s</div>
              <div><span className="text-gray-300">Block wrap:</span> Restarts from latest block after reaching block 0</div>
              <div><span className="text-gray-300">Auto-save:</span> Every 5 minutes</div>
              <div><span className="text-gray-300">Resume on restart:</span> Yes — picks up from last saved block</div>
              <div><span className="text-gray-300">State file:</span> <code className="text-violet-300">sig-cache/autonomous-state.json</code></div>
              <div><span className="text-gray-300">Findings file:</span> <code className="text-violet-300">sig-cache/autonomous-findings.json</code></div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-800">
              <div className="text-gray-300 mb-1">Headless monitoring (VPN / curl):</div>
              <code className="block text-[11px] text-violet-300 bg-gray-800/60 rounded px-2 py-1.5 break-all">
                curl -H "X-Admin-Token: $SESSION_SECRET" https://[domain]/api/quantum-audit/sig-engine/autonomous/status
              </code>
            </div>
          </div>

          {/* Results link */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <CheckCircle className="w-3.5 h-3.5 text-gray-600" />
            Findings auto-saved to disk — view them in the{" "}
            <Link href="/sig-miner"
              className="text-violet-400 hover:text-violet-300 inline-flex items-center gap-0.5">
              Sig Miner Suite <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          </div>
        </>
      )}

      {!status && !error && (
        <div className="flex items-center justify-center py-20 text-gray-500 text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading status…
        </div>
      )}
    </div>
  );
}
