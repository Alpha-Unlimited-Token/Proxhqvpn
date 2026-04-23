import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe, RefreshCw, Zap, Users, Clock,
  Radio, Activity, Shield, Filter, Star, Wifi,
  Play, Square, AlertCircle, CheckCircle, Loader,
  ChevronDown, Layers, Ghost, Lock, Eye,
  ArrowDown, ArrowRight, Cpu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}/api${path}`, opts);
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

interface ConnectionState {
  status: "disconnected" | "connecting" | "connected" | "error";
  serverIp: string | null;
  country: string | null;
  countryCode: string | null;
  ping: number | null;
  speedMbps: number | null;
  connectedAt: string | null;
  error: string | null;
  pid: number | null;
  ovpnAvailable: boolean;
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  try {
    return String.fromCodePoint(...code.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0)));
  } catch { return "🌐"; }
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
  isBest,
  isConnected,
}: {
  server: VpnGateServer;
  onConnect: (server: VpnGateServer) => void;
  isBest?: boolean;
  isConnected?: boolean;
}) {
  return (
    <div className={`
      relative bg-black border rounded-none p-3 flex flex-col gap-2 overflow-hidden
      transition-all duration-200 group
      ${isConnected
        ? "border-primary shadow-[0_0_16px_rgba(0,255,0,0.25)]"
        : isBest
        ? "border-cyan-400/50 shadow-[0_0_10px_rgba(0,255,255,0.15)]"
        : "border-primary/15 hover:border-primary/40"}
    `}>
      <div className="node-scan-bar opacity-0 group-hover:opacity-100" />

      {isBest && !isConnected && (
        <div className="absolute top-0 right-0 bg-cyan-400/20 border-l border-b border-cyan-400/40 px-1.5 py-0.5">
          <span className="text-[8px] font-mono text-cyan-400 uppercase tracking-wider">BEST</span>
        </div>
      )}
      {isConnected && (
        <div className="absolute top-0 right-0 bg-primary/20 border-l border-b border-primary/40 px-1.5 py-0.5">
          <span className="text-[8px] font-mono text-primary uppercase tracking-wider flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
            LIVE
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[9px] border px-1 py-0.5 uppercase tracking-wider shrink-0 ${isBest ? "text-cyan-400 border-cyan-400/40" : "text-cyan-400 border-cyan-400/20"}`}>
            VPG
          </span>
          <span className="text-[11px] font-mono">{countryFlag(server.countryCode)}</span>
          <span className="font-mono text-[10px] text-primary/80 truncate">{server.countryCode}</span>
        </div>
        <span className={`text-[9px] font-mono ${pingColor(server.ping)}`}>{server.ping}ms</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-primary">{server.ip}</span>
        <span className={`text-[10px] font-mono font-bold ${speedColor(server.speedMbps)}`}>
          {server.speedMbps >= 1000 ? `${(server.speedMbps / 1000).toFixed(1)}G` : `${server.speedMbps}M`}
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-primary/40 truncate max-w-[90px]">{server.operator || "anon"}</span>
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
        <span className="text-[9px] font-mono text-primary/30">{server.sessions > 0 ? `${server.sessions}s` : "—"}</span>
      </div>

      <div className="flex items-center justify-between gap-1">
        <button
          onClick={() => onConnect(server)}
          className="flex-1 flex items-center justify-center gap-0.5 text-primary/50 hover:text-primary border border-primary/20 hover:border-primary/50 py-0.5 transition-colors"
        >
          <Play className="w-2.5 h-2.5" />
          <span className="text-[8px] uppercase font-mono">CONNECT</span>
        </button>
      </div>

      <div className="text-[9px] font-mono text-primary/20">#{server.score.toLocaleString()}</div>
    </div>
  );
}

const COUNTRIES = [
  "US","JP","KR","DE","FR","GB","CA","AU","NL","SE","CH","SG","IN","BR","IT",
  "ES","PL","RU","HK","TW","UA","TH","VN","ID","MY","TR","MX","PH","NG","ZA",
];

const LOG_TYPES = [
  { value: "all", label: "ALL LOG TYPES" },
  { value: "2weeks", label: "2-WEEK LOG" },
  { value: "nolog", label: "NO LOG" },
];

export default function VpnGate() {
  const [countryFilter, setCountryFilter] = useState("");
  const [maxPingFilter, setMaxPingFilter] = useState("");
  const [minSpeedFilter, setMinSpeedFilter] = useState("");
  const [logTypeFilter, setLogTypeFilter] = useState("all");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showLogPicker, setShowLogPicker] = useState(false);
  const [bestIp, setBestIp] = useState<string | null>(null);

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: stats, refetch: refetchStats } = useQuery<Stats>({
    queryKey: ["vpngate-stats"],
    queryFn: () => apiFetch("/vpngate/stats"),
    refetchInterval: 5 * 60 * 1000,
    retry: 2,
  });

  const { data: connData, refetch: refetchConn } = useQuery<ConnectionState>({
    queryKey: ["vpngate-connection"],
    queryFn: () => apiFetch("/vpngate/connection"),
    refetchInterval: 3000,
  });

  const queryKey = ["vpngate-servers", countryFilter, maxPingFilter, minSpeedFilter, logTypeFilter];
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
      if (logTypeFilter !== "all") params.set("logType", logTypeFilter);
      return apiFetch(`/vpngate/servers?${params}`);
    },
    refetchInterval: 5 * 60 * 1000,
    retry: 2,
  });

  const servers = useMemo(() => data?.servers || [], [data]);

  const connectMutation = useMutation({
    mutationFn: (body: { ip?: string; auto?: boolean; country?: string }) =>
      apiFetch("/vpngate/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      toast({ title: "Connecting...", description: `→ ${data.server?.ip} (${data.server?.country})` });
      qc.invalidateQueries({ queryKey: ["vpngate-connection"] });
    },
    onError: (e: any) => {
      let msg = e.message;
      try { const j = JSON.parse(e.message); msg = j.error || msg; } catch {}
      toast({ title: "Connection Error", description: msg, variant: "destructive" });
      qc.invalidateQueries({ queryKey: ["vpngate-connection"] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiFetch("/vpngate/disconnect", { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Disconnected", description: "VPN Gate connection closed" });
      qc.invalidateQueries({ queryKey: ["vpngate-connection"] });
    },
  });

  const handleAutoConnect = async () => {
    const params = new URLSearchParams();
    if (countryFilter) params.set("country", countryFilter);
    if (maxPingFilter) params.set("maxPing", maxPingFilter);
    try {
      const best = await apiFetch(`/vpngate/servers/best?${params}`);
      setBestIp(best.ip);
      connectMutation.mutate({ ip: best.ip });
    } catch {
      toast({ title: "Error", description: "Could not find best server", variant: "destructive" });
    }
  };

  const handleConnect = (server: VpnGateServer) => {
    setBestIp(server.ip);
    connectMutation.mutate({ ip: server.ip });
  };

  const handleClearRefresh = async () => {
    await fetch(`${BASE}/api/vpngate/cache`, { method: "DELETE" });
    refetch();
    refetchStats();
    toast({ title: "Refreshed", description: "Fetching latest VPN Gate servers" });
  };

  const connStatus = connData?.status ?? "disconnected";
  const hasFilters = countryFilter || maxPingFilter || minSpeedFilter || logTypeFilter !== "all";

  const connStatusColor = {
    connected: "text-primary border-primary/40 bg-primary/10",
    connecting: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
    error: "text-red-400 border-red-400/40 bg-red-400/10",
    disconnected: "text-primary/40 border-primary/20",
  }[connStatus];

  const connStatusIcon = {
    connected: <CheckCircle className="w-3 h-3" />,
    connecting: <Loader className="w-3 h-3 animate-spin" />,
    error: <AlertCircle className="w-3 h-3" />,
    disconnected: <Square className="w-3 h-3" />,
  }[connStatus];

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
            <span className="text-[9px] font-mono text-primary/30 border border-primary/15 px-2 py-1 uppercase hidden sm:block">
              FREE · ACADEMIC · UNIVERSITY OF TSUKUBA
            </span>
            <Button variant="outline" size="sm" onClick={handleClearRefresh} disabled={isFetching}
              className="border-primary/30 text-primary hover:bg-primary/10 text-xs">
              <RefreshCw className={`w-3 h-3 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              SYNC
            </Button>
          </div>
        </div>
      </div>

      <div className="border border-primary/10 bg-black/20 rounded-sm px-3 py-2.5 shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 border px-2 py-1 text-[10px] font-mono uppercase ${connStatusColor}`}>
              {connStatusIcon}
              <span>{connStatus}</span>
              {connData?.serverIp && (
                <span className="text-primary/60 ml-1">
                  {countryFlag(connData.countryCode || "")} {connData.serverIp}
                </span>
              )}
            </div>
            {connData?.connectedAt && (
              <span className="text-[9px] font-mono text-primary/40">
                since {new Date(connData.connectedAt).toLocaleTimeString()}
              </span>
            )}
            {connData?.error && connStatus === "error" && (
              <span className="text-[9px] font-mono text-red-400/60 max-w-xs truncate">{connData.error}</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={handleAutoConnect}
              disabled={connectMutation.isPending || connStatus === "connecting" || connStatus === "connected"}
              size="sm"
              className="bg-primary/10 border border-primary/40 text-primary hover:bg-primary/20 text-xs font-mono uppercase"
            >
              <Star className="w-3 h-3 mr-1" />
              BEST SERVER
            </Button>

            {(connStatus === "connected" || connStatus === "connecting") ? (
              <Button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                size="sm"
                variant="destructive"
                className="text-xs font-mono uppercase border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
              >
                <Square className="w-3 h-3 mr-1" />
                DISCONNECT
              </Button>
            ) : null}

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
              onClick={() => { setShowCountryPicker(!showCountryPicker); setShowLogPicker(false); }}
              className="border border-primary/20 bg-black/50 text-primary text-[10px] font-mono px-3 py-1.5 hover:border-primary/40 min-w-[100px] text-left uppercase flex items-center gap-1"
            >
              {countryFilter ? `${countryFlag(countryFilter)} ${countryFilter}` : "ALL COUNTRIES"}
              <ChevronDown className="w-2.5 h-2.5 ml-auto text-primary/40" />
            </button>
            {showCountryPicker && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-black border border-primary/30 grid grid-cols-5 gap-0.5 p-1 max-h-48 overflow-y-auto min-w-[180px]">
                <button
                  onClick={() => { setCountryFilter(""); setShowCountryPicker(false); }}
                  className="text-[10px] font-mono px-2 py-1 text-primary/50 hover:bg-primary/10 col-span-5 text-left uppercase"
                >
                  ALL COUNTRIES
                </button>
                {COUNTRIES.map((c) => (
                  <button key={c} onClick={() => { setCountryFilter(c); setShowCountryPicker(false); }}
                    className={`text-[10px] font-mono px-2 py-1 hover:bg-primary/10 uppercase transition-colors ${countryFilter === c ? "bg-primary/20 text-primary" : "text-primary/60"}`}>
                    {countryFlag(c)} {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => { setShowLogPicker(!showLogPicker); setShowCountryPicker(false); }}
              className="border border-primary/20 bg-black/50 text-primary text-[10px] font-mono px-3 py-1.5 hover:border-primary/40 min-w-[110px] text-left uppercase flex items-center gap-1"
            >
              {LOG_TYPES.find((l) => l.value === logTypeFilter)?.label ?? "ALL LOG TYPES"}
              <ChevronDown className="w-2.5 h-2.5 ml-auto text-primary/40" />
            </button>
            {showLogPicker && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-black border border-primary/30 p-1 min-w-[140px]">
                {LOG_TYPES.map((lt) => (
                  <button key={lt.value} onClick={() => { setLogTypeFilter(lt.value); setShowLogPicker(false); }}
                    className={`block w-full text-[10px] font-mono px-2 py-1.5 hover:bg-primary/10 uppercase text-left transition-colors ${logTypeFilter === lt.value ? "bg-primary/20 text-primary" : "text-primary/60"}`}>
                    {lt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-primary/40">PING ≤</span>
            <Input value={maxPingFilter} onChange={(e) => setMaxPingFilter(e.target.value)}
              placeholder="ms"
              className="border-primary/20 bg-black/50 text-primary text-[10px] h-7 w-16 font-mono focus-visible:ring-primary/30" />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-primary/40">SPEED ≥</span>
            <Input value={minSpeedFilter} onChange={(e) => setMinSpeedFilter(e.target.value)}
              placeholder="Mbps"
              className="border-primary/20 bg-black/50 text-primary text-[10px] h-7 w-20 font-mono focus-visible:ring-primary/30" />
          </div>

          {hasFilters && (
            <button onClick={() => { setCountryFilter(""); setMaxPingFilter(""); setMinSpeedFilter(""); setLogTypeFilter("all"); }}
              className="text-[10px] font-mono text-red-400/60 hover:text-red-400 border border-red-400/20 hover:border-red-400/40 px-2 py-1 uppercase transition-colors">
              CLEAR
            </button>
          )}

          <span className="ml-auto text-[9px] font-mono text-primary/25">
            {servers.length} / {data?.total ?? "—"} · CACHE {data?.cacheAgeSeconds ?? 0}s AGO
          </span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto rounded-sm border border-primary/10 bg-black/20 p-2"
          style={{ maxHeight: "calc(100vh - 420px)" }}>
          {error ? (
            <div className="flex flex-col items-center justify-center h-48 text-red-400/50 font-mono text-xs gap-3">
              <Globe className="w-8 h-8 opacity-30" />
              <span className="uppercase tracking-widest">VPN Gate Unreachable</span>
              <span className="text-primary/30 text-[10px]">The academic API may be temporarily unavailable</span>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="border-primary/30 text-xs">Retry</Button>
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
                  isBest={server.ip === (bestIp ?? servers[0]?.ip)}
                  isConnected={connData?.serverIp === server.ip && connStatus === "connected"}
                />
              ))}
            </div>
          )}
        </div>

        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-3">
          <div className="border border-primary/20 bg-black p-3 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 flex items-center gap-2">
              <Star className="w-3 h-3" />
              Top Countries
            </div>
            {stats?.topCountries.slice(0, 10).map(({ code, count }) => (
              <div key={code} className="flex items-center gap-2">
                <button onClick={() => setCountryFilter(code)} className="flex items-center gap-2 flex-1 group">
                  <span className="text-[10px] font-mono text-primary/60 w-5">{countryFlag(code)}</span>
                  <span className="text-[10px] font-mono text-primary/60 group-hover:text-primary transition-colors w-7">{code}</span>
                  <div className="flex-1 bg-primary/10 h-1">
                    <div className="bg-cyan-400/50 h-1"
                      style={{ width: `${Math.min(100, (count / (stats.topCountries[0]?.count || 1)) * 100)}%` }} />
                  </div>
                  <span className="text-[9px] font-mono text-primary/40 w-7 text-right">{count}</span>
                </button>
              </div>
            ))}
          </div>

          <div className="border border-primary/20 bg-black p-3 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 flex items-center gap-2">
              <Shield className="w-3 h-3" />
              Shield Layer
            </div>
            <div className="text-[9px] font-mono text-primary/40 leading-relaxed">
              VPN Gate nodes are your outer shield. Your real server is hidden behind 6,000+ volunteer relays.
            </div>
            <div className="border border-primary/10 p-2 space-y-1">
              {[
                ["LAYER", "OUTER RELAY"],
                ["PROTOCOL", "OpenVPN"],
                ["USERNAME", "vpn"],
                ["PASSWORD", "vpn"],
                ["COST", "FREE"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-[9px] font-mono">
                  <span className="text-primary/40">{k}</span>
                  <span className="text-primary">{v}</span>
                </div>
              ))}
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

          <GhostChainPanel />

          <NodeDoubleHopPanel />
        </div>
      </div>
    </div>
  );
}

// ── Ghost Chain Panel ──────────────────────────────────────────────────────────

interface GhostChainServer {
  ip: string;
  country: string;
  countryCode: string;
  ping: number;
  speedMbps: number;
  role: string;
}

interface GhostChainMask {
  name: string;
  position: string;
  mechanism: string;
  effect: string;
  hops: number;
}

interface GhostChainData {
  generatedAt: string;
  hops: number;
  description: string;
  masks: GhostChainMask[];
  relay: GhostChainServer;
  exit: GhostChainServer;
  configs: {
    torVeiledOvpn: string;
    exitOvpn: string;
    proxychainsConf: string;
    linuxScript: string;
    windowsScript: string;
  };
}

function GhostChainPanel() {
  const [expanded, setExpanded] = useState(false);
  const [chain, setChain] = useState<GhostChainData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  async function activateGhostChain(c: GhostChainData) {
    try {
      const r = await fetch(`${BASE}/api/vpngate/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: c.relay.ip, torVeil: true }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "Ghost Chain Activated", description: "Server-side relay + Tor veil enabled." });
    } catch (e: any) {
      toast({ title: "Activation Failed", description: e.message, variant: "destructive" });
    }
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BASE}/api/vpngate/ghost-chain`);
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to generate Ghost Chain");
      }
      const data = await r.json();
      setChain(data.ghostChain);
      setExpanded(true);
      toast({ title: "Ghost Chain Ready", description: `${data.ghostChain.hops}-hop chain built. Press ACTIVATE to enable server-side.` });
    } catch (e: any) {
      setError(e.message);
      toast({ title: "Ghost Chain Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const hopNodes = chain
    ? [
        { label: "YOUR DEVICE", sub: "WireGuard client", color: "text-primary", icon: Cpu },
        { label: "PROXHQVPN SERVER", sub: "Your server", color: "text-cyan-400", icon: Shield },
        { label: "TOR VEIL", sub: "3 Tor relays — Mask 1", color: "text-yellow-400", icon: Eye },
        { label: `VPNGATE RELAY`, sub: `${chain.relay.country} · ${chain.relay.ip}`, color: "text-orange-400", icon: Globe },
        { label: "RELAY VEIL", sub: "OpenVPN chain — Mask 2", color: "text-yellow-400", icon: Lock },
        { label: `VPNGATE EXIT`, sub: `${chain.exit.country} · ${chain.exit.ip}`, color: "text-green-400", icon: Globe },
        { label: "DESTINATION", sub: "Sees only exit IP", color: "text-primary/60", icon: Wifi },
      ]
    : null;

  return (
    <div className="border border-yellow-400/30 bg-black p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ghost className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-yellow-400">Ghost Chain</span>
        </div>
        {chain && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[9px] font-mono text-primary/40 hover:text-primary flex items-center gap-0.5"
          >
            {expanded ? "COLLAPSE" : "EXPAND"}
            <ChevronDown className={`w-2.5 h-2.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {/* Description */}
      <div className="text-[9px] font-mono text-primary/40 leading-relaxed">
        Two invisible veils intercept traffic between every hop.
        VPNGate never sees your server IP. The destination never sees VPNGate.
      </div>

      {/* Chain diagram (always visible when chain exists) */}
      {chain && hopNodes && (
        <div className="space-y-1">
          {hopNodes.map((node, i) => {
            const isVeil = node.label.includes("VEIL");
            const Icon = node.icon;
            return (
              <div key={i} className="flex flex-col items-center">
                <div className={`w-full flex items-center gap-1.5 px-1.5 py-1 ${
                  isVeil
                    ? "border border-dashed border-yellow-400/30 bg-yellow-400/5"
                    : "border border-primary/10 bg-black/40"
                }`}>
                  <Icon className={`w-2.5 h-2.5 shrink-0 ${node.color}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-[8px] font-mono font-bold uppercase ${node.color}`}>{node.label}</div>
                    <div className="text-[7px] font-mono text-primary/30 truncate">{node.sub}</div>
                  </div>
                  {isVeil && (
                    <div className="text-[7px] font-mono text-yellow-400/60 border border-yellow-400/20 px-1 py-0.5 shrink-0">MASK</div>
                  )}
                </div>
                {i < hopNodes.length - 1 && (
                  <div className={`w-px h-2 ${isVeil || hopNodes[i + 1]?.label.includes("VEIL") ? "bg-yellow-400/40" : "bg-primary/20"}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Expanded: server details + downloads */}
      {chain && expanded && (
        <div className="space-y-2 border-t border-primary/10 pt-2">
          {/* Relay server */}
          <div className="border border-orange-400/20 bg-orange-400/5 p-2 space-y-1">
            <div className="text-[8px] font-mono text-orange-400 uppercase">Relay Server — Mask 1 Exit</div>
            {[
              ["COUNTRY", `${countryFlag(chain.relay.countryCode)} ${chain.relay.country}`],
              ["IP", chain.relay.ip],
              ["PING", `${chain.relay.ping}ms`],
              ["SPEED", `${chain.relay.speedMbps} Mbps`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-[8px] font-mono">
                <span className="text-primary/30">{k}</span>
                <span className="text-primary/70 truncate max-w-[100px]">{v}</span>
              </div>
            ))}
          </div>

          {/* Exit server */}
          <div className="border border-green-400/20 bg-green-400/5 p-2 space-y-1">
            <div className="text-[8px] font-mono text-green-400 uppercase">Exit Server — Only IP Website Sees</div>
            {[
              ["COUNTRY", `${countryFlag(chain.exit.countryCode)} ${chain.exit.country}`],
              ["IP", chain.exit.ip],
              ["PING", `${chain.exit.ping}ms`],
              ["SPEED", `${chain.exit.speedMbps} Mbps`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-[8px] font-mono">
                <span className="text-primary/30">{k}</span>
                <span className="text-primary/70 truncate max-w-[100px]">{v}</span>
              </div>
            ))}
          </div>

          {/* Mask summaries */}
          <div className="space-y-1">
            {chain.masks.map((mask, i) => (
              <div key={i} className="border border-yellow-400/15 bg-yellow-400/5 p-1.5 space-y-0.5">
                <div className="text-[8px] font-mono text-yellow-400 uppercase">{mask.name}</div>
                <div className="text-[7px] font-mono text-primary/40 leading-relaxed">{mask.effect}</div>
              </div>
            ))}
          </div>

          {/* Activate button */}
          <div className="space-y-1 pt-1">
            <div className="text-[8px] font-mono text-yellow-400/50 uppercase pb-0.5">Server-Side Activation</div>
            <button
              onClick={() => activateGhostChain(chain)}
              className="w-full flex items-center justify-center gap-1.5 text-[9px] font-mono py-2 px-2 border border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10 uppercase font-bold transition-colors"
            >
              <Zap className="w-3 h-3" />
              ACTIVATE GHOST CHAIN
            </button>
            <p className="text-[8px] font-mono text-primary/20 text-center">Chain activates server-side instantly — no downloads</p>
          </div>

          <button
            onClick={generate}
            disabled={loading}
            className="w-full text-[8px] font-mono py-1 border border-yellow-400/20 text-yellow-400/50 hover:bg-yellow-400/10 uppercase transition-colors"
          >
            <RefreshCw className={`w-2 h-2 inline mr-1 ${loading ? "animate-spin" : ""}`} />
            REGENERATE NEW CHAIN
          </button>
        </div>
      )}

      {/* Error state */}
      {error && !chain && (
        <div className="text-[9px] font-mono text-red-400/70 border border-red-400/20 p-2">
          {error}
        </div>
      )}

      {/* Generate button */}
      {!chain && (
        <button
          onClick={generate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2 border border-yellow-400/40 text-yellow-400/70 hover:bg-yellow-400/10 hover:text-yellow-400 transition-colors font-mono text-[10px] uppercase disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader className="w-3 h-3 animate-spin" />
              BUILDING CHAIN…
            </>
          ) : (
            <>
              <Ghost className="w-3 h-3" />
              GENERATE GHOST CHAIN
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ── Node Double-Hop Control Panel ─────────────────────────────────────────────

interface NodeSession {
  id: number;
  nodeId: number;
  status: string;
  serverIp: string;
  serverCountry: string;
  serverCountryCode: string;
  exitIp: string | null;
  errorMessage: string | null;
  connectedAt: string | null;
  nodeName: string;
  nodeRegion: string;
  nodeIp: string | null;
}

interface ProxhqNode {
  id: number;
  name: string;
  region: string;
  ipAddress: string;
  status: string;
  lastSeen: string | null;
}

function NodeDoubleHopPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedCountry, setSelectedCountry] = useState("");

  const { data: sessionsData, isFetching: sessionsFetching } = useQuery<{ sessions: NodeSession[] }>({
    queryKey: ["node-vpngate-sessions"],
    queryFn: () => apiFetch("/vpngate/node-sessions"),
    refetchInterval: (query) => {
      const sessions = (query.state.data as { sessions: NodeSession[] } | undefined)?.sessions ?? [];
      const hasPending = sessions.some(
        (s) => s.status === "pending_connect" || s.status === "pending_disconnect",
      );
      return hasPending ? 2000 : 8000;
    },
  });

  const { data: nodesData } = useQuery<{ nodes: ProxhqNode[] }>({
    queryKey: ["proxhq-nodes"],
    queryFn: () => apiFetch("/nodes"),
    refetchInterval: 30000,
  });

  const nodes = nodesData?.nodes ?? [];
  const sessions = sessionsData?.sessions ?? [];
  const sessionByNode = Object.fromEntries(sessions.map((s) => [s.nodeId, s]));

  const enableMutation = useMutation({
    mutationFn: ({ nodeId, country }: { nodeId: number; country?: string }) =>
      apiFetch(`/vpngate/node/${nodeId}/enable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: country || undefined }),
      }),
    onSuccess: (data) => {
      toast({
        title: "Double-Hop Connecting",
        description: `→ ${data.server?.country} (${data.server?.ip}) · will be live in seconds`,
      });
      qc.invalidateQueries({ queryKey: ["node-vpngate-sessions"] });
    },
    onError: (e: any) => {
      let msg = e.message;
      try { const j = JSON.parse(e.message); msg = j.error || msg; } catch {}
      toast({ title: "Failed", description: msg, variant: "destructive" });
    },
  });

  const disableMutation = useMutation({
    mutationFn: (nodeId: number) =>
      apiFetch(`/vpngate/node/${nodeId}/disable`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Disconnected", description: "Double-hop has been disabled for this node" });
      qc.invalidateQueries({ queryKey: ["node-vpngate-sessions"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusColor: Record<string, string> = {
    connected: "text-primary border-primary/40 bg-primary/10",
    pending_connect: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
    pending_disconnect: "text-orange-400 border-orange-400/30 bg-orange-400/5",
    error: "text-red-400 border-red-400/30 bg-red-400/5",
    disconnected: "text-primary/30 border-primary/10",
  };

  return (
    <div className="border border-cyan-400/20 bg-black flex flex-col">
      {/* Fixed header */}
      <div className="p-3 pb-0 space-y-2 shrink-0">
        <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70 flex items-center gap-2">
          <Layers className="w-3 h-3 text-cyan-400" />
          Node Double-Hop
          {sessionsFetching && <Loader className="w-2.5 h-2.5 animate-spin ml-auto text-primary/30" />}
        </div>

        <div className="text-[9px] font-mono text-primary/30 leading-relaxed">
          Route each ProxhqVPN node through a VPN Gate relay for double-encrypted traffic.
        </div>

        <div className="flex items-center gap-1.5 pb-2 border-b border-cyan-400/10">
          <span className="text-[9px] font-mono text-primary/40 shrink-0">EXIT</span>
          <input
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="ANY"
            className="w-14 bg-black border border-primary/20 text-primary font-mono text-[9px] px-2 py-1 uppercase focus:outline-none focus:border-primary/40"
            maxLength={2}
          />
          <span className="text-[8px] font-mono text-primary/20">JP · KR · DE · US…</span>
        </div>
      </div>

      {/* Scrollable node list — shows ~4 nodes then scrolls */}
      {nodes.length === 0 ? (
        <div className="text-[9px] font-mono text-primary/20 text-center py-3 mx-3 my-2 border border-primary/10">
          No nodes online
        </div>
      ) : (
        <div className="overflow-y-auto p-3 pt-2" style={{ maxHeight: "272px" }}>
          <div className="space-y-2">
          {nodes.map((node) => {
            const session = sessionByNode[node.id];
            const st = session?.status ?? "off";
            const isOff = !session;
            const isOn = session?.status === "connected";
            const isPending = st === "pending_connect" || st === "pending_disconnect";
            const isErr = st === "error";
            const isWorking = enableMutation.isPending || disableMutation.isPending;

            return (
              <div key={node.id} className="border border-primary/10 bg-black/30 p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[9px] font-mono text-primary font-bold uppercase">{node.name}</div>
                    <div className="text-[8px] font-mono text-primary/30">{node.region}</div>
                  </div>
                  <div className={`text-[8px] font-mono px-1.5 py-0.5 border uppercase flex items-center gap-1 ${statusColor[st] ?? "text-primary/20 border-primary/10"}`}>
                    {(st === "pending_connect" || st === "pending_disconnect") && (
                      <Loader className="w-2 h-2 animate-spin" />
                    )}
                    {isOff ? "OFF" : st === "pending_connect" ? "CONNECTING" : st === "pending_disconnect" ? "DISCONNECTING" : st.replace(/_/g, " ")}
                  </div>
                </div>

                {session && (
                  <div className="text-[8px] font-mono text-primary/40 space-y-0.5">
                    <div>{countryFlag(session.serverCountryCode)} {session.serverCountry} · {session.serverIp}</div>
                    {session.exitIp && <div className="text-cyan-400/60">EXIT: {session.exitIp}</div>}
                    {session.errorMessage && (
                      <div className="text-red-400/60 text-[7px] leading-relaxed border border-red-400/15 bg-red-400/5 px-1.5 py-1 mt-1">
                        {session.errorMessage}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-1.5">
                  {(isOff || isErr) && (
                    <button
                      onClick={() => enableMutation.mutate({ nodeId: node.id, country: selectedCountry || undefined })}
                      disabled={isWorking}
                      className="flex-1 text-[8px] font-mono py-1 border border-cyan-400/30 text-cyan-400/70 hover:bg-cyan-400/10 uppercase transition-colors disabled:opacity-40 flex items-center justify-center gap-1"
                    >
                      <Play className="w-2 h-2" />
                      ENABLE
                    </button>
                  )}
                  {(isOn || isPending) && (
                    <button
                      onClick={() => disableMutation.mutate(node.id)}
                      disabled={isWorking || st === "pending_disconnect"}
                      className="flex-1 text-[8px] font-mono py-1 border border-red-400/30 text-red-400/70 hover:bg-red-400/10 uppercase transition-colors disabled:opacity-40 flex items-center justify-center gap-1"
                    >
                      <Square className="w-2 h-2" />
                      DISABLE
                    </button>
                  )}
                  {(isOn || isPending) && (
                    <button
                      onClick={() => enableMutation.mutate({ nodeId: node.id, country: selectedCountry || undefined })}
                      disabled={isWorking}
                      className="text-[8px] font-mono px-2 py-1 border border-primary/20 text-primary/40 hover:bg-primary/10 uppercase transition-colors disabled:opacity-40"
                      title="Switch to different exit server"
                    >
                      <RefreshCw className="w-2 h-2" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
