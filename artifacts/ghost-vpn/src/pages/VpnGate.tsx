import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Globe, RefreshCw, Download, Zap, Users, Clock,
  Radio, Activity, Shield, Filter, Star, Wifi
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string) {
  const r = await fetch(`${BASE}/api${path}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

interface VpnGateServer {
  hostname: string;
  ip: string;
  score: number;
  ping: number;
  speedMbps: number;
  country: string;
  countryCode: string;
  sessions: number;
  totalUsers: number;
  totalTrafficGb: number;
  logType: string;
  operator: string;
  message: string;
  hasOvpn: boolean;
  ovpnConfigB64: string;
}

interface Stats {
  totalServers: number;
  countries: number;
  avgPingMs: number;
  avgSpeedMbps: number;
  totalSessions: number;
  topCountries: { code: string; count: number }[];
  cacheAgeSeconds: number;
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  try {
    return String.fromCodePoint(...code.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0)));
  } catch {
    return "🌐";
  }
}

function speedColor(mbps: number): string {
  if (mbps >= 100) return "text-primary";
  if (mbps >= 30) return "text-cyan-400";
  if (mbps >= 5) return "text-yellow-400";
  return "text-red-400/70";
}

function pingColor(ms: number): string {
  if (ms <= 30) return "text-primary";
  if (ms <= 80) return "text-cyan-400";
  if (ms <= 150) return "text-yellow-400";
  return "text-red-400/70";
}

function logBadgeColor(logType: string): string {
  const lt = logType?.toLowerCase() || "";
  if (lt.includes("2week") || lt.includes("month")) return "text-yellow-400/70 border-yellow-400/30";
  if (lt === "nolog" || lt === "no") return "text-primary border-primary/30";
  return "text-primary/40 border-primary/20";
}

function VpnGateNodeCard({
  server,
  onConnect,
}: {
  server: VpnGateServer;
  onConnect: (server: VpnGateServer) => void;
}) {
  return (
    <div className="relative bg-black border border-primary/15 hover:border-primary/40 rounded-none p-3 flex flex-col gap-2 overflow-hidden transition-all duration-200 group">
      <div className="node-scan-bar opacity-0 group-hover:opacity-100" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[9px] border border-cyan-400/30 px-1 py-0.5 uppercase tracking-wider shrink-0 text-cyan-400">
            VPG
          </span>
          <span className="text-[11px] font-mono">{countryFlag(server.countryCode)}</span>
          <span className="font-mono text-[10px] text-primary/80 truncate">{server.countryCode}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-[9px] font-mono ${pingColor(server.ping)}`}>{server.ping}ms</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-primary">{server.ip}</span>
        <span className={`text-[10px] font-mono font-bold ${speedColor(server.speedMbps)}`}>
          {server.speedMbps >= 1000
            ? `${(server.speedMbps / 1000).toFixed(1)}Gbps`
            : `${server.speedMbps}Mbps`}
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-primary/40 truncate max-w-[100px]">{server.operator || "anon"}</span>
        <span className={`text-[9px] border px-1 ${logBadgeColor(server.logType)}`}>
          {server.logType || "?"}
        </span>
      </div>

      <div className="border-t border-primary/10 pt-1.5 flex items-center justify-between gap-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="beacon-container shrink-0 scale-75">
              <div className="beacon-core" />
              <div className="beacon-ring" />
            </div>
            <span className="text-[8px] text-cyan-400/50 uppercase">BCN</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="spider-orbit-container shrink-0 scale-75">
              <div className="spider-dot" />
            </div>
            <span className="text-[8px] text-primary/50 uppercase">SPD</span>
          </div>
        </div>
        <span className="text-[9px] font-mono text-primary/30">
          {server.sessions > 0 ? `${server.sessions}s` : "—"}
        </span>
      </div>

      <div className="flex items-center justify-between text-[9px] font-mono">
        <span className="text-primary/25">#{server.score.toLocaleString()}</span>
        {server.hasOvpn && (
          <button
            onClick={() => onConnect(server)}
            className="flex items-center gap-0.5 text-primary/50 hover:text-primary border border-primary/20 hover:border-primary/50 px-1.5 py-0.5 transition-colors"
          >
            <Download className="w-2.5 h-2.5" />
            <span className="text-[8px] uppercase">OVPN</span>
          </button>
        )}
      </div>
    </div>
  );
}

const COUNTRIES = [
  "US","JP","KR","DE","FR","GB","CA","AU","NL","SE","CH","SG","IN","BR","IT",
  "ES","PL","RU","HK","TW","UA","TH","VN","ID","MY","TR","MX","PH","NG","ZA",
];

export default function VpnGate() {
  const [countryFilter, setCountryFilter] = useState("");
  const [maxPingFilter, setMaxPingFilter] = useState("");
  const [minSpeedFilter, setMinSpeedFilter] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const { data: stats, refetch: refetchStats } = useQuery<Stats>({
    queryKey: ["vpngate-stats"],
    queryFn: () => apiFetch("/vpngate/stats"),
    refetchInterval: 5 * 60 * 1000,
    retry: 2,
  });

  const queryKey = ["vpngate-servers", countryFilter, maxPingFilter, minSpeedFilter];
  const { data, isFetching, refetch, error } = useQuery<{
    servers: VpnGateServer[];
    total: number;
    shown: number;
    cacheAgeSeconds: number;
  }>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({ limit: "500" });
      if (countryFilter) params.set("country", countryFilter);
      if (maxPingFilter) params.set("maxPing", maxPingFilter);
      if (minSpeedFilter) params.set("minSpeed", minSpeedFilter);
      return apiFetch(`/vpngate/servers?${params}`);
    },
    refetchInterval: 5 * 60 * 1000,
    retry: 2,
  });

  const servers = useMemo(() => data?.servers || [], [data]);

  const handleConnect = (server: VpnGateServer) => {
    const url = `${BASE}/api/vpngate/servers/${server.ip}/config`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `vpngate-${server.countryCode}-${server.ip}.ovpn`;
    a.click();
  };

  const handleClearRefresh = async () => {
    await fetch(`${BASE}/api/vpngate/cache`, { method: "DELETE" });
    refetch();
    refetchStats();
  };

  const hasFilters = countryFilter || maxPingFilter || minSpeedFilter;

  return (
    <div className="flex flex-col gap-4 h-full pb-8">
      <div className="border border-primary/10 bg-black/20 rounded-sm px-3 py-2.5 shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              VPN Gate Swarm
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-primary/50">NODES:</span>
              <span className="text-cyan-400">{isFetching ? "…" : (data?.total ?? "—")}</span>
              <span className="text-primary/30 mx-1">|</span>
              <span className="text-primary/50">COUNTRIES:</span>
              <span className="text-primary">{stats?.countries ?? "—"}</span>
              <span className="text-primary/30 mx-1">|</span>
              <span className="text-primary/50">SESSIONS:</span>
              <span className="text-primary">{stats?.totalSessions?.toLocaleString() ?? "—"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-primary/30 border border-primary/15 px-2 py-1 uppercase">
              FREE · ACADEMIC · UNIVERSITY OF TSUKUBA
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearRefresh}
              disabled={isFetching}
              className="border-primary/30 text-primary hover:bg-primary/10 text-xs"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              SYNC
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
        {[
          { label: "LIVE NODES", value: stats?.totalServers?.toLocaleString() ?? "—", icon: Globe, color: "text-cyan-400" },
          { label: "AVG PING", value: stats ? `${stats.avgPingMs}ms` : "—", icon: Clock, color: "text-primary" },
          { label: "AVG SPEED", value: stats ? `${stats.avgSpeedMbps} Mbps` : "—", icon: Zap, color: "text-primary" },
          { label: "COUNTRIES", value: stats?.countries ?? "—", icon: Activity, color: "text-primary" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="border border-primary/10 bg-black/20 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-3 h-3 ${color}`} />
              <span className="text-[9px] font-mono text-primary/40 uppercase tracking-widest">{label}</span>
            </div>
            <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="border border-primary/10 bg-black/20 rounded-sm px-3 py-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-primary/40" />
            <span className="text-[10px] font-mono text-primary/40 uppercase">FILTER</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowCountryPicker(!showCountryPicker)}
              className="border border-primary/20 bg-black/50 text-primary text-[10px] font-mono px-3 py-1.5 hover:border-primary/40 min-w-[90px] text-left uppercase"
            >
              {countryFilter ? `${countryFlag(countryFilter)} ${countryFilter}` : "ALL COUNTRIES"}
            </button>
            {showCountryPicker && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-black border border-primary/30 grid grid-cols-5 gap-0.5 p-1 max-h-48 overflow-y-auto">
                <button
                  onClick={() => { setCountryFilter(""); setShowCountryPicker(false); }}
                  className="text-[10px] font-mono px-2 py-1 text-primary/50 hover:bg-primary/10 col-span-5 text-left uppercase"
                >
                  ALL
                </button>
                {COUNTRIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setCountryFilter(c); setShowCountryPicker(false); }}
                    className={`text-[10px] font-mono px-2 py-1 hover:bg-primary/10 uppercase transition-colors ${countryFilter === c ? "bg-primary/20 text-primary" : "text-primary/60"}`}
                  >
                    {countryFlag(c)} {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-primary/40">PING ≤</span>
            <Input
              value={maxPingFilter}
              onChange={(e) => setMaxPingFilter(e.target.value)}
              placeholder="ms"
              className="border-primary/20 bg-black/50 text-primary text-[10px] h-7 w-16 font-mono focus-visible:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-primary/40">SPEED ≥</span>
            <Input
              value={minSpeedFilter}
              onChange={(e) => setMinSpeedFilter(e.target.value)}
              placeholder="Mbps"
              className="border-primary/20 bg-black/50 text-primary text-[10px] h-7 w-20 font-mono focus-visible:ring-primary/30"
            />
          </div>

          {hasFilters && (
            <button
              onClick={() => { setCountryFilter(""); setMaxPingFilter(""); setMinSpeedFilter(""); }}
              className="text-[10px] font-mono text-red-400/60 hover:text-red-400 border border-red-400/20 hover:border-red-400/40 px-2 py-1 uppercase transition-colors"
            >
              CLEAR
            </button>
          )}

          <span className="ml-auto text-[9px] font-mono text-primary/25">
            SHOWING {servers.length} / {data?.total ?? "—"} · CACHE {data?.cacheAgeSeconds ?? 0}s AGO
          </span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        <div
          className="flex-1 overflow-y-auto rounded-sm border border-primary/10 bg-black/20 p-2"
          style={{ maxHeight: "calc(100vh - 320px)" }}
        >
          {error ? (
            <div className="flex flex-col items-center justify-center h-48 text-red-400/50 font-mono text-xs gap-3">
              <Globe className="w-8 h-8 opacity-30" />
              <span className="uppercase tracking-widest">VPN Gate Unreachable</span>
              <span className="text-primary/30 text-[10px]">The academic API may be temporarily unavailable</span>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="border-primary/30 text-xs">
                Retry
              </Button>
            </div>
          ) : isFetching && servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-primary/30 font-mono text-xs gap-3">
              <Globe className="w-8 h-8 opacity-30 animate-pulse" />
              <span className="uppercase tracking-widest">Syncing with VPN Gate Network…</span>
              <span className="text-primary/20 text-[9px]">Fetching 6,000+ live node data</span>
            </div>
          ) : servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-primary/30 font-mono text-xs gap-3">
              <Filter className="w-8 h-8 opacity-30" />
              <span className="uppercase tracking-widest">No nodes match filter</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
              {servers.map((server, idx) => (
                <VpnGateNodeCard
                  key={`${server.ip}-${idx}`}
                  server={server}
                  onConnect={handleConnect}
                />
              ))}
            </div>
          )}
        </div>

        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-3">
          <div className="border border-primary/20 bg-black p-3 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 flex items-center gap-2">
              <Star className="w-3 h-3" />
              Top Countries
            </div>
            {stats?.topCountries.slice(0, 10).map(({ code, count }) => (
              <div key={code} className="flex items-center gap-2">
                <button
                  onClick={() => setCountryFilter(code)}
                  className="flex items-center gap-2 flex-1 group"
                >
                  <span className="text-[10px] font-mono text-primary/60 w-6">{countryFlag(code)}</span>
                  <span className="text-[10px] font-mono text-primary/60 group-hover:text-primary transition-colors uppercase w-8">{code}</span>
                  <div className="flex-1 bg-primary/10 h-1">
                    <div
                      className="bg-cyan-400/50 h-1"
                      style={{ width: `${Math.min(100, (count / (stats.topCountries[0]?.count || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-primary/40 w-8 text-right">{count}</span>
                </button>
              </div>
            ))}
          </div>

          <div className="border border-primary/20 bg-black p-3 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 flex items-center gap-2">
              <Shield className="w-3 h-3" />
              Shield Integration
            </div>
            <p className="text-[9px] font-mono text-primary/40 leading-relaxed">
              VPN Gate nodes act as the outer shield layer. Your real server IP is hidden behind these
              6,000+ volunteer relays. Download any node's .ovpn config to route traffic through it.
            </p>
            <div className="border border-primary/10 p-2 space-y-1">
              <div className="flex justify-between text-[9px] font-mono">
                <span className="text-primary/40">SHIELD TYPE</span>
                <span className="text-cyan-400">OUTER RELAY</span>
              </div>
              <div className="flex justify-between text-[9px] font-mono">
                <span className="text-primary/40">PROTOCOL</span>
                <span className="text-primary">OpenVPN</span>
              </div>
              <div className="flex justify-between text-[9px] font-mono">
                <span className="text-primary/40">CREDENTIAL</span>
                <span className="text-primary">vpn / vpn</span>
              </div>
              <div className="flex justify-between text-[9px] font-mono">
                <span className="text-primary/40">COST</span>
                <span className="text-primary">FREE</span>
              </div>
            </div>
          </div>

          <div className="border border-primary/20 bg-black p-3 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 flex items-center gap-2">
              <Wifi className="w-3 h-3" />
              Connect
            </div>
            <div className="space-y-1.5 text-[9px] font-mono text-primary/40 leading-relaxed">
              <p>1. Click OVPN on any node card</p>
              <p>2. Open in OpenVPN Connect (free)</p>
              <p>3. Username: <span className="text-primary">vpn</span> / Password: <span className="text-primary">vpn</span></p>
              <p>4. Traffic exits from that country's IP</p>
            </div>
            <div className="border border-cyan-400/20 p-2 text-[9px] font-mono text-cyan-400/60 mt-2">
              ↑ Combine with your 10 own nodes for full moving-target defense
            </div>
          </div>

          <div className="border border-primary/20 bg-black p-3 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 flex items-center gap-2">
              <Radio className="w-3 h-3" />
              Swarm Stats
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] font-mono">
              {([
                ["TOTAL", stats?.totalServers ?? "—"],
                ["SHOWN", servers.length],
                ["COUNTRIES", stats?.countries ?? "—"],
                ["SESSIONS", stats?.totalSessions?.toLocaleString() ?? "—"],
                ["AVG PING", stats ? `${stats.avgPingMs}ms` : "—"],
                ["AVG SPEED", stats ? `${stats.avgSpeedMbps}M` : "—"],
              ] as [string, string | number][]).map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-primary/40">{label}</span>
                  <span className="text-primary">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
