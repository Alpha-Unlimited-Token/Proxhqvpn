import { useEffect, useState, useRef } from "react";
import {
  Activity, RefreshCw, Clock, AlertTriangle, Zap, Link,
  BarChart3, Filter, ChevronDown, Circle,
} from "lucide-react";

interface EventNode {
  id:             string;
  channel:        string;
  payload:        unknown;
  timestamp:      string;
  source:         string;
  correlationIds: string[];
}

interface CorrelatedChain {
  id:          string;
  events:      EventNode[];
  edges:       { from: string; to: string; relationship: string; confidence: number }[];
  severity:    "low" | "medium" | "high" | "critical";
  pattern:     string;
  detectedAt:  string;
  description: string;
}

interface GraphStats {
  totalEvents:       number;
  correlatedEvents:  number;
  activeChainsCount: number;
  topPattern:        string | null;
  timeWindowMinutes: number;
}

interface GraphSnapshot {
  nodes:  EventNode[];
  edges:  unknown[];
  chains: CorrelatedChain[];
  stats:  GraphStats;
}

interface BusStats {
  busStats: Record<string, number>;
  recentBus: EventNode[];
  timestamp: string;
}

const SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  low:      { bg: "bg-yellow-900/10", border: "border-yellow-700/40", text: "text-yellow-400", dot: "bg-yellow-400" },
  medium:   { bg: "bg-orange-900/10", border: "border-orange-700/40", text: "text-orange-400", dot: "bg-orange-400" },
  high:     { bg: "bg-red-900/10",    border: "border-red-700/40",    text: "text-red-400",    dot: "bg-red-400" },
  critical: { bg: "bg-red-900/20",    border: "border-red-500/50",    text: "text-red-300",    dot: "bg-red-300" },
};

const CHANNEL_LABELS: Record<string, string> = {
  "beacon.alert":           "Beacon Alert",
  "firewall.block":         "Firewall Block",
  "firewall.rule_change":   "Firewall Rule Change",
  "ztna.posture_check":     "ZTNA Posture Check",
  "ztna.deny":              "ZTNA Deny",
  "wireguard.config_issued":"WireGuard Config Issued",
  "wireguard.config_revoked":"WireGuard Config Revoked",
  "node.trust_change":      "Node Trust Change",
  "node.status_change":     "Node Status Change",
  "drift.detected":         "Drift Detected",
  "drift.remediated":       "Drift Remediated",
  "siem.event":             "SIEM Event",
  "ghost_trace.anomaly":    "GhostTrace Anomaly",
  "ghost_chain.kill_chain": "Kill Chain Detected",
  "canary.triggered":       "Canary Triggered",
  "threat_intel.ioc_match": "IOC Match",
  "audit.chain_entry":      "Audit Entry",
  "session.login":          "Session Login",
  "session.logout":         "Session Logout",
};

const CHANNEL_COLORS: Record<string, string> = {
  "beacon.alert":           "text-orange-400",
  "firewall.block":         "text-red-400",
  "firewall.rule_change":   "text-blue-400",
  "ztna.posture_check":     "text-green-400",
  "ztna.deny":              "text-red-300",
  "wireguard.config_issued":"text-green-300",
  "wireguard.config_revoked":"text-yellow-400",
  "node.trust_change":      "text-yellow-300",
  "drift.detected":         "text-orange-300",
  "drift.remediated":       "text-green-400",
  "siem.event":             "text-blue-300",
  "ghost_trace.anomaly":    "text-purple-400",
  "ghost_chain.kill_chain": "text-red-300",
  "canary.triggered":       "text-yellow-300",
  "threat_intel.ioc_match": "text-red-400",
};

function ChainCard({ chain }: { chain: CorrelatedChain }) {
  const [expanded, setExpanded] = useState(false);
  const sc = SEVERITY_COLORS[chain.severity] ?? SEVERITY_COLORS.medium;
  return (
    <div className={`rounded-lg border p-4 ${sc.bg} ${sc.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sc.dot}`} />
          <div>
            <div className={`font-semibold text-sm ${sc.text}`}>
              {chain.description}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
              <Clock className="w-3 h-3" />
              {new Date(chain.detectedAt).toLocaleString()}
              <span className="text-gray-600">•</span>
              {chain.events.length} event{chain.events.length !== 1 ? "s" : ""}
              <span className="text-gray-600">•</span>
              <span className="font-mono">{chain.pattern}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded border font-mono uppercase ${sc.text} ${sc.border}`}>
            {chain.severity}
          </span>
          <button onClick={() => setExpanded(v => !v)} className="text-gray-500 hover:text-gray-300 transition-colors">
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 space-y-1 border-t border-white/5 pt-3">
          {chain.events.map((e, i) => (
            <div key={e.id} className="flex items-center gap-2 text-xs">
              <span className="text-gray-600 font-mono w-4">{i + 1}.</span>
              <span className={CHANNEL_COLORS[e.channel] ?? "text-gray-400"}>
                {CHANNEL_LABELS[e.channel] ?? e.channel}
              </span>
              <span className="text-gray-600">—</span>
              <span className="text-gray-500">{e.source}</span>
              <span className="text-gray-700">•</span>
              <span className="text-gray-600">{new Date(e.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventRow({ event }: { event: EventNode }) {
  const color = CHANNEL_COLORS[event.channel] ?? "text-gray-400";
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-gray-800 last:border-0 text-xs">
      <span className="text-gray-600 font-mono w-20 flex-shrink-0">
        {new Date(event.timestamp).toLocaleTimeString()}
      </span>
      <span className={`font-mono flex-shrink-0 w-48 truncate ${color}`}>
        {CHANNEL_LABELS[event.channel] ?? event.channel}
      </span>
      <span className="text-gray-500 flex-shrink-0">{event.source}</span>
      {event.correlationIds.length > 0 && (
        <span className="flex items-center gap-1 text-blue-400 flex-shrink-0">
          <Link className="w-3 h-3" /> {event.correlationIds.length}
        </span>
      )}
    </div>
  );
}

export default function EventGraph() {
  const [snapshot, setSnapshot]   = useState<GraphSnapshot | null>(null);
  const [busStats, setBusStats]   = useState<BusStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [window_, setWindow]      = useState(30);
  const [tab, setTab]             = useState<"chains" | "events" | "stats">("chains");
  const [filterSev, setFilterSev] = useState<string>("all");
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [snapRes, statsRes] = await Promise.all([
        fetch(`/api/events/graph?window=${window_}`, { credentials: "include" }),
        fetch("/api/events/stats", { credentials: "include" }),
      ]);
      if (snapRes.ok) setSnapshot(await snapRes.json());
      if (statsRes.ok) setBusStats(await statsRes.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [window_]);

  const chains = filterSev === "all"
    ? (snapshot?.chains ?? [])
    : (snapshot?.chains ?? []).filter(c => c.severity === filterSev);

  const recentEvents = (snapshot?.nodes ?? [])
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 50);

  const stats = snapshot?.stats;
  const topBusChannels = busStats
    ? Object.entries(busStats.busStats)
        .filter(([, count]) => count > 0)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
    : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-green-400 flex items-center gap-2">
            <Activity className="w-6 h-6" /> Global Event Graph
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Cross-system event correlation — detects kill chains, ZTNA bypass attempts, drift cascades, and anomaly patterns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={window_}
            onChange={e => setWindow(Number(e.target.value))}
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-300"
          >
            <option value={15}>Last 15m</option>
            <option value={30}>Last 30m</option>
            <option value={60}>Last 1h</option>
            <option value={360}>Last 6h</option>
            <option value={1440}>Last 24h</option>
          </select>
          <button onClick={load} disabled={loading} className="flex items-center gap-2 text-sm text-gray-400 hover:text-green-400 transition-colors border border-gray-700 rounded-lg px-3 py-1.5 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-white font-mono">{stats.totalEvents}</div>
            <div className="text-gray-400 text-xs mt-1">Events ({stats.timeWindowMinutes}m)</div>
          </div>
          <div className={`border rounded-lg p-4 text-center ${stats.correlatedEvents > 0 ? "bg-blue-900/10 border-blue-700/40" : "bg-gray-900 border-gray-700"}`}>
            <div className={`text-3xl font-bold font-mono ${stats.correlatedEvents > 0 ? "text-blue-400" : "text-gray-600"}`}>{stats.correlatedEvents}</div>
            <div className="text-gray-400 text-xs mt-1">Correlated</div>
          </div>
          <div className={`border rounded-lg p-4 text-center ${stats.activeChainsCount > 0 ? "bg-orange-900/10 border-orange-700/40" : "bg-gray-900 border-gray-700"}`}>
            <div className={`text-3xl font-bold font-mono ${stats.activeChainsCount > 0 ? "text-orange-400" : "text-gray-600"}`}>{stats.activeChainsCount}</div>
            <div className="text-gray-400 text-xs mt-1">Active Chains</div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-sm font-bold text-gray-300 font-mono truncate">{stats.topPattern ?? "—"}</div>
            <div className="text-gray-400 text-xs mt-1">Top Pattern</div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-800">
        {(["chains", "events", "stats"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? "border-green-500 text-green-400" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {t === "chains" && `Correlated Chains (${snapshot?.chains.length ?? 0})`}
            {t === "events" && `Recent Events (${snapshot?.nodes.length ?? 0})`}
            {t === "stats"  && "Channel Stats"}
          </button>
        ))}
      </div>

      {/* Tab: Correlated chains */}
      {tab === "chains" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-400">Severity:</span>
            {["all", "critical", "high", "medium", "low"].map(s => (
              <button
                key={s}
                onClick={() => setFilterSev(s)}
                className={`text-xs px-2 py-1 rounded border transition-colors capitalize ${
                  filterSev === s
                    ? "border-green-500/40 bg-green-500/10 text-green-300"
                    : "border-gray-700 text-gray-500 hover:border-gray-600"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {chains.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <Zap className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No correlated chains detected in the last {window_} minutes.</p>
              <p className="text-xs mt-1">The platform is monitoring {Object.keys(CHANNEL_LABELS).length} event channels continuously.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {chains.map(c => <ChainCard key={c.id} chain={c} />)}
            </div>
          )}
        </div>
      )}

      {/* Tab: Recent events */}
      {tab === "events" && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3 text-xs text-gray-500 font-mono border-b border-gray-800 pb-2">
            <span className="w-20">Time</span>
            <span className="w-48">Channel</span>
            <span>Source</span>
          </div>
          {recentEvents.length === 0 ? (
            <p className="text-center text-gray-600 py-8 text-sm">No events in the selected window. Events are generated by platform activity.</p>
          ) : (
            recentEvents.map(e => <EventRow key={e.id} event={e} />)
          )}
        </div>
      )}

      {/* Tab: Channel stats */}
      {tab === "stats" && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-green-400" /> Event Channel Activity
            </h3>
            {topBusChannels.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-4">No channel activity yet. Events are generated as the platform processes requests.</p>
            ) : (
              <div className="space-y-2">
                {topBusChannels.map(([channel, count]) => {
                  const maxCount = topBusChannels[0]?.[1] ?? 1;
                  const pct = Math.round((count / maxCount) * 100);
                  const color = CHANNEL_COLORS[channel] ?? "text-gray-400";
                  return (
                    <div key={channel} className="flex items-center gap-3">
                      <span className={`font-mono text-xs w-48 flex-shrink-0 truncate ${color}`}>
                        {CHANNEL_LABELS[channel] ?? channel}
                      </span>
                      <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-green-500/50 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 font-mono w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {busStats && (
            <p className="text-xs text-gray-600">
              Stats updated: {new Date(busStats.timestamp).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
