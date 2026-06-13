// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useEffect, useState, useRef, useCallback } from "react";
import {
  Zap, RefreshCw, Activity, AlertTriangle, CheckCircle2,
  Send, Filter, Clock, BarChart3, Circle,
} from "lucide-react";

interface BusEvent {
  channel: string;
  payload: unknown;
  timestamp: string;
  source: string;
}

interface ChannelStat { channel: string; count: number; }
interface GroupStat    { group: string; channels: ChannelStat[]; total: number; }

interface BusStats {
  raw:            Record<string, number>;
  grouped:        GroupStat[];
  totalEvents:    number;
  activeChannels: number;
  totalChannels:  number;
  timestamp:      string;
}

interface BusHealth {
  health:         "healthy" | "degraded" | "alert";
  totalEvents:    number;
  activeChannels: number;
  recentThreats:  number;
  last5minEvents: number;
  timestamp:      string;
}

const CHANNEL_COLORS: Record<string, string> = {
  "beacon.alert":             "text-orange-400",
  "firewall.block":           "text-red-400",
  "firewall.rule_change":     "text-blue-400",
  "ztna.posture_check":       "text-green-400",
  "ztna.deny":                "text-red-300",
  "wireguard.config_issued":  "text-green-300",
  "wireguard.config_revoked": "text-yellow-400",
  "node.trust_change":        "text-yellow-300",
  "node.status_change":       "text-cyan-400",
  "drift.detected":           "text-orange-300",
  "drift.remediated":         "text-green-400",
  "siem.event":               "text-blue-300",
  "ghost_trace.anomaly":      "text-purple-400",
  "ghost_chain.kill_chain":   "text-red-300",
  "canary.triggered":         "text-yellow-300",
  "threat_intel.ioc_match":   "text-red-400",
  "audit.chain_entry":        "text-gray-400",
  "session.login":            "text-green-300",
  "session.logout":           "text-gray-400",
};

const GROUP_COLORS: Record<string, { border: string; bg: string; header: string }> = {
  "Security Events":  { border: "border-red-500/25",    bg: "bg-red-500/5",    header: "text-red-400" },
  "Access Control":   { border: "border-blue-500/25",   bg: "bg-blue-500/5",   header: "text-blue-400" },
  "Infrastructure":   { border: "border-yellow-500/25", bg: "bg-yellow-500/5", header: "text-yellow-400" },
  "Platform":         { border: "border-green-500/25",  bg: "bg-green-500/5",  header: "text-green-400" },
};

const HEALTH_STYLES = {
  healthy:  { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400", dot: "bg-green-400" },
  degraded: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400", dot: "bg-yellow-400" },
  alert:    { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", dot: "bg-red-400" },
};

const ALL_CHANNELS = Object.keys(CHANNEL_COLORS);

export default function ServiceBus() {
  const [stats,   setStats]   = useState<BusStats | null>(null);
  const [health,  setHealth]  = useState<BusHealth | null>(null);
  const [events,  setEvents]  = useState<BusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<"live" | "channels" | "publish">("channels");
  const [filterCh, setFilterCh] = useState("all");
  const [publishing, setPublishing] = useState(false);
  const [pubResult,  setPubResult]  = useState<string | null>(null);
  const [testCh,     setTestCh]     = useState("siem.event");
  const [testPayload, setTestPayload] = useState('{"test":true}');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, hRes, eRes] = await Promise.all([
        fetch("/api/service-bus/stats",  { credentials: "include" }),
        fetch("/api/service-bus/health", { credentials: "include" }),
        fetch("/api/service-bus/recent?limit=60", { credentials: "include" }),
      ]);
      if (sRes.ok) setStats(await sRes.json());
      if (hRes.ok) setHealth(await hRes.json());
      if (eRes.ok) { const d = await eRes.json(); setEvents((d.events ?? []).slice().reverse()); }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 10_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const filteredEvents = filterCh === "all" ? events : events.filter(e => e.channel === filterCh);

  async function publish() {
    let payload: unknown;
    try { payload = JSON.parse(testPayload); } catch { return setPubResult("Invalid JSON payload"); }
    setPublishing(true); setPubResult(null);
    const r = await fetch("/api/service-bus/publish", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: testCh, payload }),
    });
    const d = await r.json();
    setPubResult(r.ok ? `✓ Published to ${d.channel}` : `Error: ${d.error}`);
    setPublishing(false);
    load();
  }

  const hs = health ? HEALTH_STYLES[health.health] : HEALTH_STYLES.healthy;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-green-400 flex items-center gap-2">
            <Zap className="w-6 h-6" /> Internal Service Bus
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Real-time in-process event routing connecting all platform subsystems.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 text-sm text-gray-400 hover:text-green-400 border border-gray-700 rounded-lg px-3 py-2 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Health + summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {health && (
          <div className={`border rounded-xl p-4 flex items-center gap-3 col-span-2 sm:col-span-1 ${hs.bg} ${hs.border}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${hs.dot} animate-pulse`} />
            <div>
              <div className={`text-sm font-bold uppercase ${hs.text}`}>{health.health}</div>
              <div className="text-gray-500 text-xs">Bus Status</div>
            </div>
          </div>
        )}
        {[
          { label: "Total Events",     value: stats?.totalEvents    ?? "—" },
          { label: "Active Channels",  value: stats ? `${stats.activeChannels} / ${stats.totalChannels}` : "—" },
          { label: "Recent Threats",   value: health?.recentThreats  ?? "—" },
        ].map(c => (
          <div key={c.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white font-mono">{String(c.value)}</div>
            <div className="text-gray-400 text-xs mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {(["channels", "live", "publish"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? "border-green-500 text-green-400" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}>
            {t === "channels" ? "Channel Throughput" : t === "live" ? `Live Feed (${filteredEvents.length})` : "Test Publish"}
          </button>
        ))}
      </div>

      {/* Tab: Channel Throughput */}
      {tab === "channels" && (
        <div className="space-y-4">
          {(stats?.grouped ?? []).map(group => {
            const gc = GROUP_COLORS[group.group] ?? { border: "border-gray-700", bg: "bg-gray-900", header: "text-gray-300" };
            const maxCount = Math.max(...group.channels.map(c => c.count), 1);
            return (
              <div key={group.group} className={`border rounded-xl overflow-hidden ${gc.border}`}>
                <div className={`flex items-center justify-between px-4 py-2.5 border-b ${gc.border} ${gc.bg}`}>
                  <div className={`text-xs font-bold uppercase tracking-widest ${gc.header}`}>{group.group}</div>
                  <div className={`text-xs font-mono ${gc.header}`}>{group.total} events</div>
                </div>
                <div className="divide-y divide-gray-800">
                  {group.channels.map(({ channel, count }) => {
                    const pct = Math.round((count / maxCount) * 100);
                    const color = CHANNEL_COLORS[channel] ?? "text-gray-400";
                    return (
                      <div key={channel} className="flex items-center gap-3 px-4 py-2">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${count > 0 ? "bg-green-400 animate-pulse" : "bg-gray-700"}`} />
                        <span className={`font-mono text-xs flex-shrink-0 w-52 truncate ${color}`}>{channel}</span>
                        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500/60 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 font-mono w-8 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Live Feed */}
      {tab === "live" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <select value={filterCh} onChange={e => setFilterCh(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300">
              <option value="all">All channels</option>
              {ALL_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 text-xs text-gray-500 font-mono">
              <span className="w-20">Time</span>
              <span className="w-52">Channel</span>
              <span className="w-24">Source</span>
              <span>Payload</span>
            </div>
            {filteredEvents.length === 0 ? (
              <div className="py-12 text-center text-gray-600">
                <Activity className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No events yet — platform activity generates events automatically.</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-800">
                {filteredEvents.map((e, i) => {
                  const color = CHANNEL_COLORS[e.channel] ?? "text-gray-400";
                  return (
                    <div key={i} className="flex items-start gap-3 px-4 py-2 text-xs hover:bg-gray-800/40">
                      <span className="text-gray-600 font-mono w-20 flex-shrink-0">
                        {new Date(e.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`font-mono w-52 flex-shrink-0 truncate ${color}`}>{e.channel}</span>
                      <span className="text-gray-500 w-24 flex-shrink-0 truncate">{e.source}</span>
                      <span className="text-gray-600 font-mono truncate">{JSON.stringify(e.payload)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-600 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Auto-refreshes every 10 seconds.
          </p>
        </div>
      )}

      {/* Tab: Test Publish */}
      {tab === "publish" && (
        <div className="max-w-xl space-y-4">
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-4 py-3 text-xs text-yellow-300">
            Publish a test event into the bus to verify subscribers and event graph correlation.
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Channel</label>
              <select value={testCh} onChange={e => setTestCh(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300">
                {ALL_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Payload (JSON)</label>
              <textarea rows={4} value={testPayload} onChange={e => setTestPayload(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 font-mono resize-none" />
            </div>
            <button onClick={publish} disabled={publishing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-400 text-sm hover:bg-green-500/20 disabled:opacity-50 transition-colors">
              {publishing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Publish Event
            </button>
            {pubResult && (
              <div className={`text-sm px-3 py-2 rounded border ${pubResult.startsWith("✓") ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                {pubResult}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
