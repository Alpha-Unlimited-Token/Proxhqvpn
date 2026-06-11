// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Activity, Globe, Shield, TrendingUp, TrendingDown, Zap, AlertTriangle,
  Network, RefreshCw, ChevronDown, ChevronRight, Server, Lock, Cpu,
  Wifi, MapPin, Key, Radio,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string) {
  const r = await fetch(`${BASE}/api${path}`, { credentials: "include" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function formatBytes(b: number) {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(0)} KB`;
  return `${b} B`;
}
function formatMs(ms: number) {
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 1000).toFixed(1)}s`;
}
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const PROTO_COLOR: Record<string, string> = {
  TCP: "bg-[#00ff88]", UDP: "bg-blue-400", ICMP: "bg-purple-400",
  HTTPS: "bg-[#00ff88]", DNS: "bg-blue-400", HTTP: "bg-yellow-400",
  QUIC: "bg-purple-400", SSH: "bg-orange-400",
};
const SEV_COLOR: Record<string, string> = {
  critical: "text-red-400 border-red-500/30 bg-red-500/10",
  high:     "text-orange-400 border-orange-500/30 bg-orange-500/10",
  medium:   "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  low:      "text-green-400 border-green-500/30 bg-green-500/10",
};
const SEV_ROW: Record<string, string> = {
  critical: "border-red-400/20 bg-red-400/5",
  high:     "border-orange-400/20 bg-orange-400/5",
  medium:   "border-yellow-400/10 bg-yellow-400/3",
  low:      "border-primary/5 bg-primary/2",
};

type FlowFilter = "all" | "threats" | "blocked" | "active" | "silk";

export default function NetworkMonitor() {
  const [activeTab, setActiveTab] = usePersistedState<"flows" | "protocols" | "countries">("netmonitor-tab", "flows");
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [flowFilter, setFlowFilter] = useState<FlowFilter>("all");

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["netmon-stats"],
    queryFn: () => apiFetch("/network-monitor/stats"),
    refetchInterval: 5000,
  });
  const { data: allFlows = [], refetch: refetchFlows } = useQuery<any[]>({
    queryKey: ["netmon-flows"],
    queryFn: () => apiFetch("/network-monitor/flows"),
    refetchInterval: 5000,
  });
  const { data: timeline = [] } = useQuery<any[]>({
    queryKey: ["netmon-timeline"],
    queryFn: () => apiFetch("/network-monitor/timeline?hours=24"),
    refetchInterval: 30000,
  });
  const { data: protocols = [] } = useQuery<any[]>({
    queryKey: ["netmon-protocols"],
    queryFn: () => apiFetch("/network-monitor/protocols"),
    refetchInterval: 30000,
  });
  const { data: countries = [], isLoading: countriesLoading } = useQuery<any[]>({
    queryKey: ["netmon-countries"],
    queryFn: () => apiFetch("/network-monitor/countries"),
    refetchInterval: 60000,
  });

  const flows = allFlows.filter(f => {
    if (flowFilter === "threats")  return f.threat && f.status !== "blocked";
    if (flowFilter === "blocked")  return f.status === "blocked";
    if (flowFilter === "active")   return f.status === "active";
    if (flowFilter === "silk")     return f.silkWebTrapped;
    return true;
  });

  const maxTimeline = Math.max(...timeline.map((t: any) => t.bytesIn + t.bytesOut), 1);
  const maxProto    = protocols.length > 0 ? protocols[0].bytes : 1;
  const maxCountry  = countries.length > 0 ? countries[0].attacks : 1;

  const threatCount  = allFlows.filter(f => f.threat && f.status !== "blocked").length;
  const blockedCount = allFlows.filter(f => f.status === "blocked").length;
  const silkCount    = allFlows.filter(f => f.silkWebTrapped).length;

  return (
    <div className="p-4 md:p-6 space-y-5 font-mono min-h-screen">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Activity className="w-5 h-5 text-[#00ff88]" />
            <h1 className="text-lg font-bold text-primary tracking-tight">Network Monitor</h1>
            <Badge className="text-[9px] border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88] font-mono uppercase tracking-widest px-1.5">Live</Badge>
          </div>
          <p className="text-xs text-primary/40 max-w-xl leading-relaxed">
            Real-time traffic flow analysis across all GhostNet nodes — active connections, protocol breakdown, bandwidth timeline, and geographic routing intelligence.
          </p>
        </div>
        <button onClick={() => { refetchStats(); refetchFlows(); }}
          className="p-1.5 border border-primary/20 hover:border-[#00ff88]/40 rounded transition-colors text-primary/40 hover:text-[#00ff88]">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active Connections", value: stats?.activeConnections ?? "—",                icon: Network,      color: "text-[#00ff88]" },
          { label: "Bandwidth (↓)",      value: stats ? formatBytes(stats.totalBytesIn) : "—",  icon: TrendingDown, color: "text-blue-400" },
          { label: "Bandwidth (↑)",      value: stats ? formatBytes(stats.totalBytesOut) : "—", icon: TrendingUp,   color: "text-orange-400" },
          { label: "Blocked Today",      value: stats?.blockedConnections ?? "—",               icon: Shield,       color: stats?.blockedConnections > 0 ? "text-yellow-400" : "text-[#00ff88]" },
        ].map(s => (
          <div key={s.label} className="border border-primary/10 bg-primary/2 p-3 rounded-sm">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              <span className="text-[10px] text-primary/40 uppercase tracking-wider">{s.label}</span>
            </div>
            <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="border border-primary/10 p-4 rounded-sm">
        <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-3">Traffic Timeline (24h)</div>
        <div className="flex items-end gap-px h-20">
          {timeline.map((pt: any, i: number) => {
            const total = pt.bytesIn + pt.bytesOut;
            const pct = total / maxTimeline;
            const inPct = pt.bytesIn / (total || 1);
            return (
              <div key={i} className="flex-1 flex flex-col justify-end gap-px"
                title={`${new Date(pt.time).getHours()}:00 — ↓${formatBytes(pt.bytesIn)} ↑${formatBytes(pt.bytesOut)} | ${pt.connections} conns | ${pt.blocked} blocked`}>
                <div className="bg-orange-400/40 rounded-sm" style={{ height: `${Math.max(2, (1 - inPct) * pct * 100)}%` }} />
                <div className="bg-[#00ff88]/50 rounded-sm" style={{ height: `${Math.max(2, inPct * pct * 100)}%` }} />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-primary/25 font-mono">
          <span>-24h</span>
          <span className="flex gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#00ff88]/50 inline-block" />Inbound</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-400/40 inline-block" />Outbound</span>
          </span>
          <span>now</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-primary/10">
        {(["flows", "protocols", "countries"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              activeTab === tab ? "border-[#00ff88] text-[#00ff88]" : "border-transparent text-primary/40 hover:text-primary/60"
            }`}>
            {tab === "flows" ? "Active Flows" : tab === "protocols" ? "Protocol Mix" : "Countries"}
            {tab === "flows" && threatCount > 0 && (
              <span className="ml-1.5 px-1 py-0 text-[9px] bg-red-500/20 text-red-400 rounded">{threatCount}</span>
            )}
            {tab === "countries" && countries.length > 0 && (
              <span className="ml-1.5 px-1 py-0 text-[9px] bg-primary/10 text-primary/60 rounded">{countries.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── ACTIVE FLOWS ─────────────────────────────────────────────────────── */}
      {activeTab === "flows" && (
        <div className="space-y-2">

          {/* Filter bar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              ["all",      "All",         allFlows.length,  "text-primary/60"],
              ["threats",  "Threats",     threatCount,      "text-red-400"],
              ["blocked",  "Blocked",     blockedCount,     "text-orange-400"],
              ["active",   "Active",      allFlows.filter(f => f.status === "active").length, "text-[#00ff88]"],
              ["silk",     "Silk-Trapped", silkCount,       "text-purple-400"],
            ] as [FlowFilter, string, number, string][]).map(([key, label, count, color]) => (
              <button key={key} onClick={() => setFlowFilter(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded border transition-all uppercase tracking-wider ${
                  flowFilter === key
                    ? `${color} border-current bg-current/10`
                    : "text-primary/30 border-primary/10 hover:text-primary/50"
                }`}>
                {label}
                <span className="font-mono">{count}</span>
              </button>
            ))}
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-2 text-[10px] text-primary/25 uppercase tracking-wider px-2 pt-1">
            <span className="col-span-1">Proto</span>
            <span className="col-span-4">Source → Destination</span>
            <span className="col-span-1">Port</span>
            <span className="col-span-1">Bytes↑</span>
            <span className="col-span-1">Bytes↓</span>
            <span className="col-span-1">Age</span>
            <span className="col-span-2">Country</span>
            <span className="col-span-1">Sev</span>
          </div>

          {flows.length === 0 && (
            <div className="text-center py-12 text-primary/20 text-xs">
              No flows match filter "{flowFilter}"
            </div>
          )}

          {flows.map((flow: any) => {
            const isExpanded = expandedFlow === flow.id;
            const rowColor = flow.status === "blocked"
              ? "border-orange-400/20 bg-orange-400/5"
              : SEV_ROW[flow.severity] ?? "border-primary/5 bg-primary/2";

            return (
              <div key={flow.id} className={`border rounded-sm transition-all ${rowColor} ${isExpanded ? "border-primary/20" : ""}`}>
                {/* Row */}
                <div
                  className="grid grid-cols-12 gap-2 text-xs font-mono px-2 py-2 cursor-pointer hover:bg-primary/5 transition-colors"
                  onClick={() => setExpandedFlow(isExpanded ? null : flow.id)}>
                  <div className="col-span-1 flex items-center">
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${PROTO_COLOR[flow.protocol] ?? "bg-primary/20"} text-black`}>
                      {flow.protocol.slice(0, 4)}
                    </span>
                  </div>
                  <div className="col-span-4 text-primary/70 truncate flex items-center gap-1">
                    <span className="text-primary/50">{flow.flag}</span>
                    <span>{flow.srcIp}</span>
                    <span className="text-primary/30 mx-0.5">→</span>
                    <span className="text-[#00ff88]/80 truncate">{flow.destHost}</span>
                  </div>
                  <div className="col-span-1 text-primary/40 flex items-center">{flow.destPort || "—"}</div>
                  <div className="col-span-1 text-orange-400 flex items-center">{formatBytes(flow.bytesOut)}</div>
                  <div className="col-span-1 text-[#00ff88] flex items-center">{formatBytes(flow.bytesIn)}</div>
                  <div className="col-span-1 text-primary/35 flex items-center text-[10px]">{timeAgo(flow.timestamp)}</div>
                  <div className="col-span-2 text-primary/50 flex items-center gap-1 truncate">
                    <span>{flow.flag}</span>
                    <span className="truncate text-[10px]">{flow.country || "—"}</span>
                  </div>
                  <div className="col-span-1 flex items-center justify-between gap-1">
                    {flow.status === "blocked" ? (
                      <span className="text-[9px] px-1 py-0.5 rounded border border-orange-500/30 bg-orange-500/10 text-orange-400">BLK</span>
                    ) : flow.severity ? (
                      <span className={`text-[9px] px-1 py-0.5 rounded border ${SEV_COLOR[flow.severity] ?? ""}`}>
                        {flow.severity.slice(0, 3).toUpperCase()}
                      </span>
                    ) : <span className="text-primary/20">—</span>}
                    <ChevronDown className={`w-3 h-3 text-primary/20 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </div>

                {/* ── Expanded detail panel ─────────────────────────────────── */}
                {isExpanded && (
                  <div className="border-t border-primary/10 p-3 space-y-3 bg-black/30">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                      {/* Attacker (Source) */}
                      <div className="border border-red-500/15 bg-red-500/5 rounded p-3 space-y-1.5">
                        <div className="flex items-center gap-1.5 mb-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                          <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Attacker Source</span>
                        </div>
                        {[
                          ["IP Address",    flow.srcIp,                          "font-mono"],
                          ["Country",       `${flow.flag} ${flow.country || "Unknown"}`, ""],
                          ["City",          flow.city || "—",                    ""],
                          ["ISP / AS",      flow.isp || "—",                     "text-[10px]"],
                          ["Fingerprint",   flow.fingerprint || "—",             "font-mono text-[9px]"],
                          ["Probe Type",    flow.probeType?.replace(/_/g, " "),  "capitalize"],
                          ["Silk-Trapped",  flow.silkWebTrapped ? "Yes ⚠" : "No", flow.silkWebTrapped ? "text-purple-400" : ""],
                        ].map(([label, value, extra]) => value && (
                          <div key={label} className="flex justify-between gap-2">
                            <span className="text-[10px] text-primary/30 shrink-0">{label}</span>
                            <span className={`text-[10px] text-primary/70 text-right truncate ${extra}`}>{value}</span>
                          </div>
                        ))}
                      </div>

                      {/* GhostNode (Destination / Vultr server) */}
                      <div className="border border-[#00ff88]/15 bg-[#00ff88]/5 rounded p-3 space-y-1.5">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Server className="w-3.5 h-3.5 text-[#00ff88]" />
                          <span className="text-[10px] font-bold text-[#00ff88] uppercase tracking-widest">GhostNode (Vultr)</span>
                        </div>
                        {[
                          ["Node Name",    flow.destHost,                             "font-mono"],
                          ["Vultr IP",     flow.destIp || "—",                        "font-mono text-[#00ff88]"],
                          ["Region",       flow.destRegion || "—",                    ""],
                          ["Layer",        flow.destLayer === "inner" ? "Inner (Core)" : "Outer (Edge)", "capitalize"],
                          ["Hop Index",    flow.destHopIndex != null ? `#${flow.destHopIndex}` : "—", ""],
                          ["WG Port",      flow.destWgPort ? `UDP/${flow.destWgPort}` : "—", "font-mono"],
                          ["Status",       flow.destStatus || "—",                   "capitalize"],
                          ["Latency",      flow.destLatency ? `${flow.destLatency}ms` : "—", "font-mono"],
                          ["RAM Keys",     flow.destRamKey ? "✓ Loaded" : "Not loaded", flow.destRamKey ? "text-[#00ff88]" : "text-yellow-400/70"],
                          ["Beacon",       flow.destHasBeacon ? "✓ Active" : "Inactive", flow.destHasBeacon ? "text-[#00ff88]" : "text-primary/40"],
                        ].map(([label, value, extra]) => value && (
                          <div key={label} className="flex justify-between gap-2">
                            <span className="text-[10px] text-primary/30 shrink-0">{label}</span>
                            <span className={`text-[10px] text-primary/70 text-right truncate ${extra}`}>{value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Flow stats + actions */}
                      <div className="border border-blue-500/15 bg-blue-500/5 rounded p-3 space-y-1.5">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Wifi className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Flow Stats</span>
                        </div>
                        {[
                          ["Protocol",   flow.protocol,                      "font-mono"],
                          ["Dest Port",  flow.destPort ? String(flow.destPort) : "—", "font-mono"],
                          ["Bytes ↑",    formatBytes(flow.bytesOut),         "text-orange-400 font-mono"],
                          ["Bytes ↓",    formatBytes(flow.bytesIn),          "text-[#00ff88] font-mono"],
                          ["Duration",   formatMs(flow.duration),            "font-mono"],
                          ["Status",     flow.status,                        "capitalize"],
                          ["Severity",   flow.severity || "—",               "capitalize"],
                          ["Detected",   timeAgo(flow.timestamp),            ""],
                          ["Timestamp",  new Date(flow.timestamp).toLocaleString(), "text-[9px]"],
                        ].map(([label, value, extra]) => value && (
                          <div key={label} className="flex justify-between gap-2">
                            <span className="text-[10px] text-primary/30 shrink-0">{label}</span>
                            <span className={`text-[10px] text-primary/70 text-right truncate ${extra}`}>{value}</span>
                          </div>
                        ))}

                        {/* Actions */}
                        <div className="pt-2 flex flex-col gap-1.5 border-t border-primary/10 mt-2">
                          <a href={`${BASE}/firewall`}
                            className="w-full text-center text-[10px] px-2 py-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded transition-colors">
                            Block {flow.srcIp}
                          </a>
                          <a href={`${BASE}/ghost-trap`}
                            className="w-full text-center text-[10px] px-2 py-1.5 border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 rounded transition-colors">
                            View in GhostTrap
                          </a>
                          <a href={`${BASE}/nodes`}
                            className="w-full text-center text-[10px] px-2 py-1.5 border border-[#00ff88]/30 text-[#00ff88] hover:bg-[#00ff88]/5 rounded transition-colors">
                            View {flow.destHost} Node
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── PROTOCOL MIX ─────────────────────────────────────────────────────── */}
      {activeTab === "protocols" && (
        <div className="space-y-2">
          {protocols.length === 0 && (
            <div className="text-center py-12 text-primary/20 text-xs">No protocol data yet</div>
          )}
          {protocols.map((p: any) => (
            <div key={p.protocol} className="flex items-center gap-3">
              <div className="w-16 text-xs font-bold text-primary/70 font-mono">{p.protocol}</div>
              <div className="flex-1 h-5 bg-primary/5 rounded-sm overflow-hidden">
                <div className={`h-full ${PROTO_COLOR[p.protocol] ?? "bg-primary/30"} opacity-70 transition-all`}
                  style={{ width: `${(p.bytes / maxProto) * 100}%` }} />
              </div>
              <div className="w-16 text-right text-xs text-primary/50 font-mono">{formatBytes(p.bytes)}</div>
              <div className="w-10 text-right text-xs text-primary/30 font-mono">{p.pct}%</div>
              <div className="w-12 text-right text-[10px] text-primary/25">{p.count} hits</div>
            </div>
          ))}
        </div>
      )}

      {/* ── COUNTRIES ────────────────────────────────────────────────────────── */}
      {activeTab === "countries" && (
        <div className="space-y-2">
          {countriesLoading && (
            <div className="text-center py-12 text-primary/20 text-xs animate-pulse">
              Resolving IP geolocation…
            </div>
          )}
          {!countriesLoading && countries.length === 0 && (
            <div className="text-center py-12 space-y-2">
              <Globe className="w-8 h-8 text-primary/10 mx-auto" />
              <div className="text-xs text-primary/20">No attack traffic to geolocate yet.</div>
              <div className="text-[10px] text-primary/15">Countries appear here once GhostTrap or Beacon captures attacker IPs.</div>
            </div>
          )}

          {/* Summary bar */}
          {countries.length > 0 && (
            <div className="flex gap-3 text-[10px] text-primary/40 font-mono pb-2 border-b border-primary/10">
              <span><span className="text-primary/60">{countries.length}</span> countries</span>
              <span><span className="text-red-400">{countries.reduce((s: number, c: any) => s + c.attacks, 0)}</span> total attacks</span>
              <span><span className="text-orange-400">{countries.reduce((s: number, c: any) => s + c.blocked, 0)}</span> blocked</span>
              <span><span className="text-blue-400">{countries.reduce((s: number, c: any) => s + c.uniqueIps, 0)}</span> unique IPs</span>
            </div>
          )}

          {countries.map((c: any, idx: number) => {
            const isExpanded = expandedCountry === c.code;
            return (
              <div key={c.code}
                className={`border rounded-sm transition-all ${isExpanded ? "border-primary/20 bg-black/20" : "border-primary/5 bg-primary/2"}`}>
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-primary/5 transition-colors"
                  onClick={() => setExpandedCountry(isExpanded ? null : c.code)}>
                  {/* Rank */}
                  <div className="w-5 text-[10px] text-primary/20 font-mono text-right shrink-0">#{idx + 1}</div>
                  {/* Flag + name */}
                  <div className="text-lg shrink-0">{c.flag}</div>
                  <div className="w-28 shrink-0">
                    <div className="text-xs text-primary/70 font-mono truncate">{c.name}</div>
                    <div className="text-[9px] text-primary/30 font-mono">{c.code}</div>
                  </div>
                  {/* Bar */}
                  <div className="flex-1 h-4 bg-primary/5 rounded-sm overflow-hidden">
                    <div className="h-full bg-[#00ff88]/40 transition-all rounded-sm"
                      style={{ width: `${(c.attacks / maxCountry) * 100}%` }} />
                  </div>
                  {/* Stats */}
                  <div className="flex gap-3 shrink-0 text-[10px] font-mono">
                    <span className="text-red-400 w-16 text-right">{c.attacks} atk</span>
                    {c.blocked > 0 && <span className="text-orange-400 w-14 text-right">{c.blocked} blk</span>}
                    <span className="text-blue-400/60 w-12 text-right">{c.uniqueIps} IPs</span>
                    <span className="text-primary/30 w-16 text-right">{formatBytes(c.bytes)}</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-primary/20 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-primary/10 px-3 py-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Country stats */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] text-primary/30 uppercase tracking-widest mb-2">Attack Stats</div>
                        {[
                          ["Total Attacks",  c.attacks,                            "text-red-400"],
                          ["Blocked",        c.blocked,                            "text-orange-400"],
                          ["Unique IPs",     c.uniqueIps,                          "text-blue-400"],
                          ["Total Traffic",  formatBytes(c.bytes),                 "text-primary/60"],
                          ["Last Seen",      c.lastSeen ? timeAgo(c.lastSeen) : "—", "text-primary/60"],
                        ].map(([label, value, color]) => (
                          <div key={label} className="flex justify-between gap-4">
                            <span className="text-[10px] text-primary/30">{label}</span>
                            <span className={`text-[10px] font-mono font-bold ${color}`}>{value}</span>
                          </div>
                        ))}
                      </div>
                      {/* Top attacker IPs */}
                      <div>
                        <div className="text-[10px] text-primary/30 uppercase tracking-widest mb-2">Top Attacker IPs</div>
                        <div className="space-y-1">
                          {(c.topIps ?? []).map((ip: string) => (
                            <div key={ip} className="flex items-center justify-between gap-2 bg-red-500/5 border border-red-500/10 rounded px-2 py-1">
                              <span className="text-[10px] font-mono text-primary/60">{ip}</span>
                              <div className="flex gap-1.5">
                                <a href={`${BASE}/ghost-trap`}
                                  className="text-[9px] text-purple-400/70 hover:text-purple-400 border border-purple-500/20 rounded px-1.5 py-0.5 transition-colors">
                                  Trap
                                </a>
                                <a href={`${BASE}/firewall`}
                                  className="text-[9px] text-red-400/70 hover:text-red-400 border border-red-500/20 rounded px-1.5 py-0.5 transition-colors">
                                  Block
                                </a>
                              </div>
                            </div>
                          ))}
                          {(!c.topIps || c.topIps.length === 0) && (
                            <div className="text-[10px] text-primary/20">No IPs recorded</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
