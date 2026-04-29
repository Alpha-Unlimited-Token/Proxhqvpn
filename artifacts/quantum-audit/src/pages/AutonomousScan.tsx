import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  Play, Square, RefreshCw, Activity, Key, Globe, Search,
  GitBranch, Clock, Zap, AlertTriangle, CheckCircle, Database,
  TrendingUp, Shield, Cpu, Loader2, ExternalLink,
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

interface AutonomousStatus {
  running:          boolean;
  startedAt:        string | null;
  uptimeHours:      number;
  windowsCompleted: number;
  totalFindings:    number;
  recoveredKeys:    number;
  lastBlockScanned: number;
  lowestBlockCovered: number;
  blocksRemaining:  number;
  osintRuns:        number;
  peelRuns:         number;
  hybridRuns:       number;
  errors:           number;
  pendingUrls:      number;
  statusMessage:    string;
  estimatedBlocksPerHour: number;
  progressPct:      number;
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

// ── Main component ────────────────────────────────────────────────────────────

export default function AutonomousScan() {
  const [status, setStatus]   = useState<AutonomousStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
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

  // Poll every 8 seconds while running, 30 seconds while idle
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
        maxRuntimeMs:          72 * 3_600_000,   // 72 hours
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
            Self-cycling 5-engine scan — runs overnight without supervision.
            Saves progress every 5 minutes and auto-resumes on restart.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchStatus} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors">
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh
          </button>
          {isRunning ? (
            <button onClick={stop} disabled={stopping}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors">
              {stopping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
              Stop Runner
            </button>
          ) : (
            <button onClick={start} disabled={starting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">
              {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Start Runner
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
              <span className="text-xs text-emerald-400/80 truncate">{status.statusMessage}</span>
            </>
          ) : (
            <>
              <Clock className="w-4 h-4" />
              <span>Idle — {status.statusMessage || "not started"}</span>
            </>
          )}
          {isRunning && (
            <div className="ml-auto text-xs text-emerald-500">
              Auto-saving every 5 min
            </div>
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
          {/* Progress bar */}
          <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span>Block coverage progress</span>
              <span className="font-mono">
                Block {(status.lowestBlockCovered || 0).toLocaleString()} →{" "}
                {(status.lastBlockScanned || 0).toLocaleString()}
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
            <Stat icon={Clock}     label="Uptime"         value={uptimeStr}                   sub={`Started ${status.startedAt ? new Date(status.startedAt).toLocaleTimeString() : "—"}`} />
            <Stat icon={Activity}  label="Windows"        value={status.windowsCompleted}      sub="50-block each" />
            <Stat icon={Key}       label="Keys Recovered" value={status.recoveredKeys}          good={status.recoveredKeys > 0} sub="confirmed private keys" />
            <Stat icon={Zap}       label="Findings"       value={status.totalFindings}          accent sub="all engine combined" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={AlertTriangle} label="Errors"     value={status.errors}                warn={status.errors > 10} sub="auto-retried with backoff" />
            <Stat icon={Globe}     label="Pending URLs"   value={status.pendingUrls}            sub="queued for Engine 2" />
            <Stat icon={Shield}    label="Latest Block"   value={(status.lastBlockScanned || 0).toLocaleString()} sub="last E1 window top" />
            <Stat icon={Database}  label="Lowest Covered" value={(status.lowestBlockCovered || 0).toLocaleString()} sub="scanning backward" />
          </div>

          {/* Per-engine runs */}
          <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-4">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              Engine Run Counts
            </h2>
            <div>
              <EngineRow icon={Activity}   color="bg-violet-600" label="Engine 1 — Block Scanner"
                runs={status.windowsCompleted} detail="Runs every window · ECDSA nonce reuse / weak-k / r-collision / bias" />
              <EngineRow icon={Globe}      color="bg-blue-600"   label="Engine 2 — Web Signature Spider"
                runs={Math.floor(status.windowsCompleted / 3)} detail="Auto-chained from Engine 1 tx-embedded URLs · BFS crawl" />
              <EngineRow icon={Search}     color="bg-amber-600"  label="Engine 3 — OSINT Spider"
                runs={status.osintRuns} detail={`Every 10 windows · GitHub / Pastebin / ENS / OP_RETURN`} />
              <EngineRow icon={GitBranch}  color="bg-red-600"    label="Engine 4 — Peel Chain Tracer"
                runs={status.peelRuns} detail="Every 20 windows on nonce-reuse addresses · hop-by-hop fund flow" />
              <EngineRow icon={Cpu}        color="bg-emerald-600" label="Hybrid Worm Engine"
                runs={status.hybridRuns} detail="Every 40 windows · all 4 engines as coordinated worm swarm" />
            </div>
          </div>

          {/* How it runs */}
          <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-4 text-xs text-gray-400 space-y-2">
            <div className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-400" />
              Autonomous Operation Details
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
              <div><span className="text-gray-300">Window size:</span> 50 blocks per Engine 1 pass</div>
              <div><span className="text-gray-300">Pause between windows:</span> 3 seconds (anti-rate-limit)</div>
              <div><span className="text-gray-300">OSINT cooldown:</span> 30 seconds before each OSINT run</div>
              <div><span className="text-gray-300">Peel chain cooldown:</span> 60 seconds before each trace</div>
              <div><span className="text-gray-300">RPC backoff:</span> Exponential (3s → 60s max) on 429s</div>
              <div><span className="text-gray-300">State file:</span> <code className="text-violet-300">proxhq-reports/sig-cache/autonomous-state.json</code></div>
              <div><span className="text-gray-300">Findings file:</span> <code className="text-violet-300">proxhq-reports/sig-cache/autonomous-findings.json</code></div>
              <div><span className="text-gray-300">Log file:</span> <code className="text-violet-300">proxhq-reports/sig-cache/autonomous-run.log</code></div>
              <div><span className="text-gray-300">Auto-save:</span> Every 5 minutes</div>
              <div><span className="text-gray-300">Max runtime:</span> 72 hours (auto-restarts on server reboot)</div>
              <div><span className="text-gray-300">Resume on restart:</span> Yes — picks up from last saved block</div>
              <div><span className="text-gray-300">Auth bypass:</span> SESSION_SECRET token (VPN headless access)</div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-800">
              <div className="text-gray-300 mb-1">External monitoring (from VPN / curl):</div>
              <code className="block text-[11px] text-violet-300 bg-gray-800/60 rounded px-2 py-1.5 break-all">
                curl -H "X-Admin-Token: $SESSION_SECRET" https://[domain]/api/quantum-audit/sig-engine/autonomous/status
              </code>
            </div>
          </div>

          {/* Results file links */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <CheckCircle className="w-3.5 h-3.5 text-gray-600" />
            Results auto-saved to disk — view them in the
            {" "}
            <Link href="/sig-miner"
              className="text-violet-400 hover:text-violet-300 inline-flex items-center gap-0.5">
              Sig Miner Suite <ExternalLink className="w-2.5 h-2.5" />
            </Link>
            {" "}page after stopping the runner.
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
