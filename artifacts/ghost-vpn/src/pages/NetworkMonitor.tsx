import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Activity, Globe, Shield, TrendingUp, TrendingDown, Zap, AlertTriangle,
  Network, Server, RefreshCw, ArrowUpDown, Clock,
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

const PROTO_COLOR: Record<string, string> = {
  HTTPS: "bg-[#00ff88]",
  DNS: "bg-blue-400",
  HTTP: "bg-yellow-400",
  QUIC: "bg-purple-400",
  SSH: "bg-orange-400",
  NTP: "bg-pink-400",
  SMTP: "bg-red-400",
  FTP: "bg-gray-400",
  ICMP: "bg-cyan-400",
  "TCP/Other": "bg-primary/30",
};

export default function NetworkMonitor() {
  const [activeTab, setActiveTab] = useState<"flows" | "protocols" | "countries">("flows");

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["netmon-stats"],
    queryFn: () => apiFetch("/network-monitor/stats"),
    refetchInterval: 5000,
  });

  const { data: flows = [] } = useQuery<any[]>({
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

  const { data: countries = [] } = useQuery<any[]>({
    queryKey: ["netmon-countries"],
    queryFn: () => apiFetch("/network-monitor/countries"),
    refetchInterval: 30000,
  });

  const maxTimeline = Math.max(...timeline.map((t: any) => t.bytesIn + t.bytesOut), 1);
  const maxProto = protocols.length > 0 ? protocols[0].bytes : 1;
  const maxCountry = countries.length > 0 ? countries[0].bytes : 1;

  return (
    <div className="p-4 md:p-6 space-y-6 font-mono min-h-screen">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Activity className="w-5 h-5 text-[#00ff88]" />
            <h1 className="text-lg font-bold text-primary tracking-tight">Network Monitor</h1>
            <Badge className="text-[9px] border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88] font-mono uppercase tracking-widest px-1.5">Live</Badge>
          </div>
          <p className="text-xs text-primary/40 max-w-xl leading-relaxed">
            Real-time traffic flow analysis across all VPN nodes — active connections, protocol breakdown, bandwidth timeline, and geographic routing intelligence.
          </p>
        </div>
        <button onClick={() => refetchStats()} className="p-1.5 border border-primary/20 hover:border-[#00ff88]/40 rounded transition-colors text-primary/40 hover:text-[#00ff88]">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active Connections", value: stats?.activeConnections ?? "—", icon: Network, color: "text-[#00ff88]" },
          { label: "Bandwidth (↓)", value: stats ? formatBytes(stats.totalBytesIn) : "—", icon: TrendingDown, color: "text-blue-400" },
          { label: "Bandwidth (↑)", value: stats ? formatBytes(stats.totalBytesOut) : "—", icon: TrendingUp, color: "text-orange-400" },
          { label: "Blocked Today", value: stats?.blockedConnections ?? "—", icon: Shield, color: stats?.blockedConnections > 0 ? "text-yellow-400" : "text-[#00ff88]" },
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
            const inPct = pt.bytesIn / total;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col justify-end gap-px"
                title={`${new Date(pt.time).getHours()}:00 — ↓${formatBytes(pt.bytesIn)} ↑${formatBytes(pt.bytesOut)} | ${pt.connections} conns | ${pt.blocked} blocked`}
              >
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
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              activeTab === tab ? "border-[#00ff88] text-[#00ff88]" : "border-transparent text-primary/40 hover:text-primary/60"
            }`}
          >
            {tab === "flows" ? "Active Flows" : tab === "protocols" ? "Protocol Mix" : "Countries"}
          </button>
        ))}
      </div>

      {activeTab === "flows" && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-12 gap-2 text-[10px] text-primary/30 uppercase tracking-wider px-2">
            <span className="col-span-1">Proto</span>
            <span className="col-span-3">Source → Destination</span>
            <span className="col-span-1">Port</span>
            <span className="col-span-2">Bytes ↑</span>
            <span className="col-span-2">Bytes ↓</span>
            <span className="col-span-1">Duration</span>
            <span className="col-span-1">Country</span>
            <span className="col-span-1">Threat</span>
          </div>
          {flows.map((flow: any) => (
            <div
              key={flow.id}
              className={`grid grid-cols-12 gap-2 text-xs font-mono px-2 py-2 rounded-sm border transition-colors ${
                flow.threat ? "border-red-400/30 bg-red-400/5" : "border-primary/5 bg-primary/2 hover:border-primary/15"
              }`}
            >
              <div className="col-span-1">
                <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${PROTO_COLOR[flow.protocol] || "bg-primary/20"} text-black`}>
                  {flow.protocol.slice(0, 5)}
                </span>
              </div>
              <div className="col-span-3 text-primary/70 truncate">{flow.srcIp} → {flow.destHost}</div>
              <div className="col-span-1 text-primary/40">{flow.destPort}</div>
              <div className="col-span-2 text-orange-400">{formatBytes(flow.bytesOut)}</div>
              <div className="col-span-2 text-[#00ff88]">{formatBytes(flow.bytesIn)}</div>
              <div className="col-span-1 text-primary/40">{formatMs(flow.duration)}</div>
              <div className="col-span-1 text-primary/50">{flow.country}</div>
              <div className="col-span-1">
                {flow.threat ? <span title={flow.threat}><AlertTriangle className="w-3.5 h-3.5 text-red-400" /></span> : <span className="text-[#00ff88]/30">—</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "protocols" && (
        <div className="space-y-2">
          {protocols.map((p: any) => (
            <div key={p.protocol} className="flex items-center gap-3">
              <div className="w-20 text-xs font-bold text-primary/70 font-mono">{p.protocol}</div>
              <div className="flex-1 h-5 bg-primary/5 rounded-sm overflow-hidden">
                <div
                  className={`h-full ${PROTO_COLOR[p.protocol] || "bg-primary/30"} opacity-70 transition-all`}
                  style={{ width: `${(p.bytes / maxProto) * 100}%` }}
                />
              </div>
              <div className="w-20 text-right text-xs text-primary/50 font-mono">{formatBytes(p.bytes)}</div>
              <div className="w-10 text-right text-xs text-primary/30 font-mono">{p.pct}%</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "countries" && (
        <div className="space-y-2">
          {countries.map((c: any) => (
            <div key={c.code} className="flex items-center gap-3">
              <div className="w-6 text-base">{c.flag}</div>
              <div className="w-24 text-xs text-primary/70 font-mono truncate">{c.name}</div>
              <div className="flex-1 h-5 bg-primary/5 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-[#00ff88]/50 transition-all"
                  style={{ width: `${(c.bytes / maxCountry) * 100}%` }}
                />
              </div>
              <div className="w-20 text-right text-xs text-primary/50 font-mono">{formatBytes(c.bytes)}</div>
              {c.blocked > 0 && (
                <div className="w-14 text-right text-xs text-red-400 font-mono">{c.blocked} blk</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
