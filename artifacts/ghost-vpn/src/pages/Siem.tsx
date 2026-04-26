import { useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Database, AlertTriangle, Shield, Activity, Clock,
  RefreshCw, Search, Filter, ChevronRight,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch(path: string) {
  const r = await fetch(`${BASE}/api${path}`, { credentials: "include" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

type SiemEvent = {
  id: string;
  source: string;
  eventType: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  details: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

const SEV_COLOR = {
  critical: "text-red-400 border-red-400/30 bg-red-400/8",
  high: "text-orange-400 border-orange-400/30 bg-orange-400/8",
  medium: "text-yellow-400 border-yellow-400/30 bg-yellow-400/8",
  low: "text-blue-400 border-blue-400/30 bg-blue-400/8",
  info: "text-primary/50 border-primary/15 bg-primary/3",
};

const SEV_DOT = {
  critical: "bg-red-400",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
  low: "bg-blue-400",
  info: "bg-primary/30",
};

const SOURCE_COLOR: Record<string, string> = {
  "Beacon Monitor": "text-purple-400",
  "Ghost Trace": "text-[#00ff88]",
  "Firewall": "text-blue-400",
  "Ghost Chain": "text-orange-400",
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

export default function Siem() {
  const [sevFilter, setSevFilter] = usePersistedState<string>("siem-sev", "all");
  const [sourceFilter, setSourceFilter] = usePersistedState<string>("siem-source", "all");
  const [search, setSearch] = usePersistedState<string>("siem-search", "");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: events = [], isLoading, refetch } = useQuery<SiemEvent[]>({
    queryKey: ["siem-events", sevFilter, sourceFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100" });
      if (sevFilter !== "all") params.set("severity", sevFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      return apiFetch(`/siem/events?${params}`);
    },
    refetchInterval: 15_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["siem-stats"],
    queryFn: () => apiFetch("/siem/stats"),
    refetchInterval: 30_000,
  });

  const { data: timeline = [] } = useQuery<any[]>({
    queryKey: ["siem-timeline"],
    queryFn: () => apiFetch("/siem/timeline"),
    refetchInterval: 60_000,
  });

  const filteredEvents = events.filter(e =>
    search ? (e.title.toLowerCase().includes(search.toLowerCase()) || e.details.toLowerCase().includes(search.toLowerCase())) : true
  );

  const maxTimelineBar = Math.max(...timeline.map((t: any) => t.total), 1);

  return (
    <div className="p-4 md:p-6 space-y-6 font-mono min-h-screen">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Database className="w-5 h-5 text-[#00ff88]" />
            <h1 className="text-lg font-bold text-primary tracking-tight">Security Event Log</h1>
            <Badge className="text-[9px] border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88] font-mono uppercase tracking-widest px-1.5">SIEM</Badge>
          </div>
          <p className="text-xs text-primary/40 max-w-xl leading-relaxed">
            Unified security event timeline aggregating alerts from Beacon Monitor, Ghost Trace, Firewall, and Ghost Chain — all in one searchable log.
          </p>
        </div>
        <button onClick={() => refetch()} className="p-1.5 border border-primary/20 hover:border-[#00ff88]/40 rounded transition-colors text-primary/40 hover:text-[#00ff88]">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Events (24h)", value: stats?.total24h ?? "—", icon: Activity, color: "text-[#00ff88]" },
          { label: "Critical", value: stats?.bySeverity?.critical ?? 0, icon: AlertTriangle, color: "text-red-400" },
          { label: "High", value: stats?.bySeverity?.high ?? 0, icon: Shield, color: "text-orange-400" },
          { label: "Sources", value: stats?.sources?.length ?? 4, icon: Database, color: "text-blue-400" },
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

      {/* Timeline bar chart */}
      <div className="border border-primary/10 p-4 rounded-sm">
        <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-3">Event Volume (24h by severity)</div>
        <div className="flex items-end gap-px h-14">
          {timeline.map((pt: any, i: number) => (
            <div key={i} className="flex-1 flex flex-col justify-end gap-px" title={`${pt.hour}:00 — ${pt.total} events`}>
              {pt.critical > 0 && <div className="bg-red-400/80" style={{ height: `${(pt.critical / maxTimelineBar) * 56}px` }} />}
              {pt.high > 0 && <div className="bg-orange-400/60" style={{ height: `${(pt.high / maxTimelineBar) * 56}px` }} />}
              {pt.medium > 0 && <div className="bg-yellow-400/50" style={{ height: `${(pt.medium / maxTimelineBar) * 56}px` }} />}
              {pt.low > 0 && <div className="bg-blue-400/40" style={{ height: `${(pt.low / maxTimelineBar) * 56}px` }} />}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-primary/20 font-mono">
          <span>0:00</span><span>12:00</span><span>now</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search events..."
            className="bg-black/40 border border-primary/20 text-primary text-xs font-mono pl-8 pr-3 py-1.5 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm w-52"
          />
        </div>
        <div className="flex gap-1">
          {["all", "critical", "high", "medium", "low"].map(s => (
            <button
              key={s}
              onClick={() => setSevFilter(s)}
              className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-sm border transition-all font-mono ${
                sevFilter === s
                  ? s === "all" ? "border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88]" :
                    s === "critical" ? "border-red-400/40 bg-red-400/10 text-red-400" :
                    s === "high" ? "border-orange-400/40 bg-orange-400/10 text-orange-400" :
                    s === "medium" ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-400" :
                    "border-blue-400/40 bg-blue-400/10 text-blue-400"
                  : "border-primary/15 text-primary/30 hover:border-primary/25"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {stats?.sources && (
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="bg-black border border-primary/20 text-primary/60 text-xs font-mono px-2 py-1.5 rounded-sm focus:outline-none focus:border-[#00ff88]/40"
          >
            <option value="all">All Sources</option>
            {stats.sources.map((s: string) => <option key={s} value={s.toLowerCase().replace(" ", "_")}>{s}</option>)}
          </select>
        )}
      </div>

      {/* Events */}
      <div className="space-y-1.5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 border border-primary/10 animate-pulse rounded-sm" />
          ))
        ) : filteredEvents.length === 0 ? (
          <div className="border border-primary/10 p-8 text-center rounded-sm">
            <Activity className="w-6 h-6 text-primary/20 mx-auto mb-2" />
            <span className="text-xs text-primary/25">No events matching current filters</span>
          </div>
        ) : (
          filteredEvents.map(event => (
            <div
              key={event.id}
              className={`border rounded-sm text-xs font-mono overflow-hidden ${SEV_COLOR[event.severity]}`}
            >
              <div
                className="flex items-start gap-3 p-3 cursor-pointer"
                onClick={() => setExpanded(expanded === event.id ? null : event.id)}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${SEV_DOT[event.severity]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-bold uppercase ${SOURCE_COLOR[event.source] || "text-primary/50"}`}>{event.source}</span>
                    <span className="font-bold text-current">{event.title}</span>
                  </div>
                  <div className="text-current/60 mt-0.5 truncate">{event.details}</div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-current/40 text-[10px]">{timeAgo(event.timestamp)}</span>
                  <ChevronRight className={`w-3.5 h-3.5 text-current/30 transition-transform ${expanded === event.id ? "rotate-90" : ""}`} />
                </div>
              </div>
              {expanded === event.id && event.metadata && (
                <div className="border-t border-current/20 px-3 py-2 bg-black/20">
                  <pre className="text-[10px] text-current/50 whitespace-pre-wrap">{JSON.stringify(event.metadata, null, 2)}</pre>
                  <div className="text-[10px] text-current/30 mt-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(event.timestamp).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
