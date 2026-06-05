// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useCallback } from "react";
import {
  Skull, Zap, Ban, RefreshCw, Trash2, Settings, Clock, Globe,
  AlertTriangle, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Download, Radio, MapPin, Building2, Wifi, Shield, FileText,
  Network, ArrowRight, Server, Home, Layers, Search,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ProbeType = "sql_injection" | "xss" | "cmd_injection" | "path_traversal" | "auth_brute" | "recon" | "other";
type NodeType  = "vpn_exit" | "datacenter" | "residential" | "corporate" | "private_network" | "tor_exit" | "unknown";

interface Probe {
  id: number;
  probeId: string;
  attackerIp: string;
  attackerPort: number | null;
  attackerUa: string | null;
  method: string;
  endpoint: string;
  probeType: ProbeType;
  attackVector: string | null;
  fakeResponse: string | null;
  tarpitMs: number;
  autoBlocked: boolean;
  silkTrapped: boolean;
  beaconFired: boolean;
  beaconFiredAt: string | null;
  hopChain: string | null;
  vpnDetected: boolean;
  torDetected: boolean;
  geoCountry: string | null;
  geoCity: string | null;
  geoIsp: string | null;
  geoOrg: string | null;
  geoAsn: string | null;
  geoTimezone: string | null;
  probedAt: string;
}

interface Stats {
  total: number; uniqueIps: number; sqlCount: number; xssCount: number;
  cmdCount: number; blocked: number; silkTrapped: number; beaconFires: number;
  avgTarpit: number; vpnCount: number;
}

interface Config {
  id: number; enabled: boolean; tarpitMinMs: number; tarpitMaxMs: number;
  autoBlockAfter: number; silkTrapAfter: number; fakeSiteName: string; fakeDbVersion: string;
}

interface HopNode {
  ip: string;
  port: number | null;
  rdns: string | null;
  isp: string | null;
  org: string | null;
  country: string | null;
  city: string | null;
  asn: string | null;
  nodeType: NodeType;
  vpnProvider: string | null;
  confidence: number;
  isPrivate: boolean;
}

interface BacktraceResult {
  targetIp: string;
  sourcePort: number | null;
  hopChain: HopNode[];
  vpnDetected: boolean;
  vpnNodes: HopNode[];
  likelyRealOrigin: HopNode | null;
  portHints: { port: number; service: string; likely: boolean }[];
  summary: string;
  analysedAt: string;
}

const TYPE_COLOR: Record<ProbeType, string> = {
  sql_injection:  "bg-red-500/15 text-red-400 border-red-500/30",
  xss:            "bg-orange-500/15 text-orange-400 border-orange-500/30",
  cmd_injection:  "bg-purple-500/15 text-purple-400 border-purple-500/30",
  path_traversal: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  auth_brute:     "bg-blue-500/15 text-blue-400 border-blue-500/30",
  recon:          "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  other:          "bg-white/10 text-white/50 border-white/20",
};
const TYPE_LABEL: Record<ProbeType, string> = {
  sql_injection: "SQL Inject", xss: "XSS", cmd_injection: "CMD Inject",
  path_traversal: "Path Traversal", auth_brute: "Auth Brute", recon: "Recon", other: "Other",
};

const NODE_TYPE_CONFIG: Record<NodeType, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  vpn_exit:       { color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",    icon: <Layers className="w-3.5 h-3.5" />,  label: "VPN Exit Node" },
  datacenter:     { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", icon: <Server className="w-3.5 h-3.5" />,  label: "Datacenter / VPS" },
  residential:    { color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30",  icon: <Home className="w-3.5 h-3.5" />,    label: "Residential ISP" },
  corporate:      { color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/30",   icon: <Building2 className="w-3.5 h-3.5" />, label: "Corporate / Edu" },
  private_network:{ color: "text-white/40",   bg: "bg-white/5",       border: "border-white/10",      icon: <Wifi className="w-3.5 h-3.5" />,    label: "Private Network" },
  tor_exit:       { color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", icon: <Globe className="w-3.5 h-3.5" />,   label: "Tor Exit Node" },
  unknown:        { color: "text-white/40",   bg: "bg-white/5",       border: "border-white/10",      icon: <Globe className="w-3.5 h-3.5" />,   label: "Unknown" },
};

function StatCard({ label, value, color = "text-white", sub }: { label: string; value: number | string; color?: string; sub?: string }) {
  return (
    <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-white/50 mt-1">{label}</div>
      {sub && <div className="text-[10px] text-white/30 mt-0.5">{sub}</div>}
    </div>
  );
}

function HopChainViz({ chain, targetIp }: { chain: HopNode[]; targetIp: string }) {
  const allNodes = [...chain, { ip: "YOUR SERVER", nodeType: "residential" as NodeType, isPrivate: true, port: 443, rdns: null, isp: "ProxhqVPN", org: null, country: null, city: null, asn: null, vpnProvider: null, confidence: 100 }];
  return (
    <div className="space-y-2">
      <div className="text-[10px] text-white/30 uppercase tracking-widest">Connection Hop Chain (left = probable origin)</div>
      <div className="flex items-center gap-1 overflow-x-auto pb-2 flex-wrap">
        {allNodes.map((node, i) => {
          const cfg = NODE_TYPE_CONFIG[node.nodeType as NodeType] ?? NODE_TYPE_CONFIG.unknown;
          const isTarget = node.ip === targetIp;
          const isServer = node.ip === "YOUR SERVER";
          return (
            <div key={i} className="flex items-center gap-1 shrink-0">
              <div className={`rounded-xl border px-3 py-2 text-xs ${cfg.bg} ${cfg.border} ${isTarget ? "ring-1 ring-red-400/50" : ""}`}>
                <div className={`flex items-center gap-1.5 font-semibold ${cfg.color}`}>
                  {cfg.icon}
                  <span className="font-mono">{isServer ? "Your Server" : node.ip}</span>
                  {node.port && <span className="text-[9px] text-white/30 font-normal">:{node.port}</span>}
                </div>
                <div className={`text-[9px] mt-0.5 ${cfg.color} opacity-70`}>{cfg.label}</div>
                {node.vpnProvider && <div className="text-[9px] font-bold mt-0.5" style={{ color: "inherit" }}>{node.vpnProvider}</div>}
                {node.country && <div className="text-[9px] text-white/40">{node.city ?? node.country}</div>}
                {node.rdns && <div className="text-[9px] text-white/30 font-mono truncate max-w-[140px]">{node.rdns}</div>}
                {!isServer && <div className={`text-[9px] mt-0.5 ${cfg.color} opacity-50`}>{node.confidence}% confidence</div>}
              </div>
              {i < allNodes.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 text-white/20 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface WhoisData { ip?: string; isp?: string; org?: string; country?: string; city?: string; timezone?: string; asn?: string; error?: string; }

export default function GhostTrap() {
  const [probes, setProbes]   = useState<Probe[]>([]);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [config, setConfig]   = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [clearing, setClearing]     = useState(false);
  const [whoisCache, setWhoisCache] = useState<Record<string, WhoisData>>({});
  const [whoisLoading, setWhoisLoading] = useState<Record<string, boolean>>({});
  const [reportLoading, setReportLoading] = useState<Record<string, boolean>>({});
  const [backtraceCache, setBacktraceCache] = useState<Record<string, BacktraceResult>>({});
  const [backtraceLoading, setBacktraceLoading] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"probes" | "info">("probes");

  const load = useCallback(async () => {
    const [pr, cr] = await Promise.all([
      fetch(`${BASE}/api/ghost-trap/probes?limit=200`, { credentials: "include" }),
      fetch(`${BASE}/api/ghost-trap/config`,           { credentials: "include" }),
    ]);
    if (pr.ok) { const d = await pr.json(); setProbes(d.probes ?? []); setStats(d.stats ?? null); }
    if (cr.ok) setConfig(await cr.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  const saveConfig = async (patch: Partial<Config>) => {
    const r = await fetch(`${BASE}/api/ghost-trap/config`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (r.ok) setConfig(await r.json());
  };

  const lookupWhois = async (ip: string) => {
    if (whoisCache[ip] || whoisLoading[ip]) return;
    setWhoisLoading(w => ({ ...w, [ip]: true }));
    try {
      const r = await fetch(`${BASE}/api/ghost-trap/whois/${encodeURIComponent(ip)}`, { credentials: "include" });
      setWhoisCache(c => ({ ...c, [ip]: r.ok ? {} : { error: "Lookup failed" } }));
      if (r.ok) setWhoisCache(c => ({ ...c, [ip]: {} }));
      const d = await r.json();
      setWhoisCache(c => ({ ...c, [ip]: d }));
    } catch { setWhoisCache(c => ({ ...c, [ip]: { error: "Lookup failed" } })); }
    setWhoisLoading(w => ({ ...w, [ip]: false }));
  };

  const runBacktrace = async (ip: string) => {
    if (backtraceCache[ip] || backtraceLoading[ip]) return;
    setBacktraceLoading(b => ({ ...b, [ip]: true }));
    try {
      const r = await fetch(`${BASE}/api/ghost-trap/backtrace/${encodeURIComponent(ip)}`, { credentials: "include" });
      if (r.ok) { const d = await r.json(); setBacktraceCache(c => ({ ...c, [ip]: d })); }
    } catch { /* ignore */ }
    setBacktraceLoading(b => ({ ...b, [ip]: false }));
  };

  const downloadReport = async (ip: string) => {
    setReportLoading(r => ({ ...r, [ip]: true }));
    const r = await fetch(`${BASE}/api/ghost-trap/report/${encodeURIComponent(ip)}?download=1`, { credentials: "include" });
    if (r.ok) {
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `proxhqvpn-incident-${ip.replace(/[.:]/g, "_")}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
    setReportLoading(r => ({ ...r, [ip]: false }));
  };

  const clearProbes = async () => {
    setClearing(true);
    await fetch(`${BASE}/api/ghost-trap/probes`, { method: "DELETE", credentials: "include" });
    setWhoisCache({}); setBacktraceCache({}); await load(); setClearing(false);
  };

  const lureBase = `${window.location.origin}${BASE}/api/ghost-trap/lure`;
  const uniqueIps = [...new Set(probes.map(p => p.attackerIp))];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Skull className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Ghost Trap — Counter Intel</h1>
            <p className="text-xs text-white/40">Honeypot · port tracking · VPN hop backtrace · authority reports</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowConfig(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-white/60 hover:text-white border border-white/10 rounded-xl hover:bg-white/5 transition-all">
            <Settings className="w-4 h-4" /> Config
          </button>
          <button onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-white/60 hover:text-white border border-white/10 rounded-xl hover:bg-white/5 transition-all">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          {config && (
            <button onClick={() => saveConfig({ enabled: !config.enabled })}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border transition-all ${
                config.enabled
                  ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15"
                  : "bg-white/5 border-white/15 text-white/50 hover:bg-white/8"
              }`}>
              {config.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              {config.enabled ? "Trap Active" : "Trap Off"}
            </button>
          )}
        </div>
      </div>

      {/* Lure endpoints */}
      <div className="bg-[#0d1610] border border-primary/10 rounded-xl p-4">
        <div className="text-xs font-semibold text-primary/60 uppercase tracking-widest mb-2">Active Honeypot Endpoints</div>
        <div className="text-xs text-white/40 mb-3">
          Publicly reachable. Attackers hitting these are tarpitted ({config?.tarpitMinMs ?? 1500}–{config?.tarpitMaxMs ?? 8000}ms delay), fed poisoned data with embedded beacons, port-logged, and auto-blocked after {config?.autoBlockAfter ?? 5} hits.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {["/login", "/admin", "/wp-admin", "/api/users", "/api/search", "/.env", "/config.php", "/backup.sql"].map(ep => (
            <div key={ep} className="font-mono text-[10px] bg-black/40 rounded-lg px-3 py-1.5 text-primary/70 truncate">
              {lureBase}{ep}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3">
          <StatCard label="Total Probes"   value={stats.total}       color="text-white" />
          <StatCard label="Unique IPs"     value={stats.uniqueIps}   color="text-cyan-400" />
          <StatCard label="SQL Inject"     value={stats.sqlCount}    color="text-red-400" />
          <StatCard label="XSS"            value={stats.xssCount}    color="text-orange-400" />
          <StatCard label="CMD Inject"     value={stats.cmdCount}    color="text-purple-400" />
          <StatCard label="Auto-Blocked"   value={stats.blocked}     color="text-yellow-400" />
          <StatCard label="Silk-Trapped"   value={stats.silkTrapped} color="text-primary" />
          <StatCard label="Beacon Fires"   value={stats.beaconFires} color="text-red-300" sub="live confirmed" />
          <StatCard label="VPN Detected"   value={stats.vpnCount}    color="text-orange-300" sub="surface IP" />
          <StatCard label="Avg Tarpit"     value={`${((stats.avgTarpit ?? 0) / 1000).toFixed(1)}s`} color="text-white/70" />
        </div>
      )}

      {/* Config panel */}
      {showConfig && config && (
        <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-5 space-y-4">
          <div className="text-sm font-semibold text-white">Trap Configuration</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Tarpit Min (ms)",           field: "tarpitMinMs",    type: "number" },
              { label: "Tarpit Max (ms)",           field: "tarpitMaxMs",    type: "number" },
              { label: "Auto-block after N probes", field: "autoBlockAfter", type: "number" },
              { label: "Silk-trap after N probes",  field: "silkTrapAfter",  type: "number" },
              { label: "Fake Site Name",            field: "fakeSiteName",   type: "text" },
              { label: "Fake DB Version",           field: "fakeDbVersion",  type: "text" },
            ].map(({ label, field, type }) => (
              <div key={field}>
                <label className="text-xs text-white/50 mb-1 block">{label}</label>
                <input
                  type={type}
                  value={(config as any)[field]}
                  onChange={e => setConfig(c => c ? { ...c, [field]: type === "number" ? Number(e.target.value) : e.target.value } : c)}
                  onBlur={e => saveConfig({ [field]: type === "number" ? Number(e.target.value) : e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/40"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.06]">
        {([["probes", "Probe Feed"], ["info", "Attacker Intel"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-all ${
              activeTab === key ? "text-white bg-[#0d1610] border border-b-0 border-white/[0.07]" : "text-white/40 hover:text-white/60"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── PROBE FEED ─────────────────────────────────────────────────────────── */}
      {activeTab === "probes" && (
        <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Live Probe Feed
              <span className="text-xs text-white/30 font-normal ml-1">({probes.length})</span>
            </div>
            <button onClick={clearProbes} disabled={clearing}
              className="flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Clear All
            </button>
          </div>

          {loading && <div className="p-8 text-center text-white/30 text-sm">Loading…</div>}
          {!loading && probes.length === 0 && (
            <div className="p-10 text-center">
              <Shield className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <div className="text-sm text-white/30">No probes yet.</div>
              <div className="text-xs text-white/20 mt-1">When attackers hit the lure URLs, they'll appear here instantly.</div>
            </div>
          )}

          <div className="divide-y divide-white/[0.04]">
            {probes.map(p => (
              <div key={p.id}>
                <div
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                >
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${TYPE_COLOR[p.probeType]}`}>
                    {TYPE_LABEL[p.probeType]}
                  </span>
                  {/* IP + Port */}
                  <div className="flex items-center gap-1 text-sm text-white/80 font-mono shrink-0">
                    <Globe className="w-3.5 h-3.5 text-white/30" />
                    {p.attackerIp}
                    {p.attackerPort && (
                      <span className="text-[10px] text-yellow-400/70 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded font-mono">
                        :{p.attackerPort}
                      </span>
                    )}
                    {p.geoCountry && <span className="text-white/30 text-xs">({p.geoCity ?? p.geoCountry})</span>}
                  </div>
                  <div className="text-xs text-white/40 font-mono flex-1 truncate">
                    <span className="text-white/25">{p.method} </span>{p.endpoint}
                  </div>
                  {p.attackVector && (
                    <div className="text-[10px] text-orange-400/70 bg-orange-500/10 px-2 py-0.5 rounded shrink-0 truncate max-w-[120px]">
                      {p.attackVector}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-white/30 shrink-0">
                    <Clock className="w-3 h-3" />{(p.tarpitMs / 1000).toFixed(1)}s
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {p.vpnDetected && <Layers className="w-3.5 h-3.5 text-red-300" aria-label="VPN detected" />}
                    {p.beaconFired && <Radio className="w-3.5 h-3.5 text-red-400" aria-label="Beacon fired" />}
                    {p.autoBlocked && <Ban className="w-3.5 h-3.5 text-yellow-400" aria-label="Auto-blocked" />}
                    {p.silkTrapped && <AlertTriangle className="w-3.5 h-3.5 text-primary" aria-label="Silk-trapped" />}
                  </div>
                  {expandedId === p.id ? <ChevronUp className="w-3.5 h-3.5 text-white/20 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-white/20 shrink-0" />}
                </div>

                {expandedId === p.id && (
                  <div className="px-4 pb-4 space-y-3 bg-black/20">
                    {/* Port + Geo */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-black/30 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-1 text-white/30 mb-1"><Network className="w-3 h-3" /><span className="uppercase tracking-widest text-[9px]">Source Port</span></div>
                        <div className={`font-mono font-bold ${p.attackerPort ? "text-yellow-400" : "text-white/30"}`}>{p.attackerPort ? `:${p.attackerPort}` : "Not captured"}</div>
                      </div>
                      {p.geoCountry && <>
                        <div className="bg-black/30 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-1 text-white/30 mb-1"><MapPin className="w-3 h-3" /><span className="uppercase tracking-widest text-[9px]">Location</span></div>
                          <div className="text-white/70">{p.geoCity ?? "—"}, {p.geoCountry}</div>
                        </div>
                        <div className="bg-black/30 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-1 text-white/30 mb-1"><Building2 className="w-3 h-3" /><span className="uppercase tracking-widest text-[9px]">ISP</span></div>
                          <div className="text-white/70 truncate">{p.geoIsp ?? "—"}</div>
                        </div>
                        <div className="bg-black/30 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-1 text-white/30 mb-1"><Wifi className="w-3 h-3" /><span className="uppercase tracking-widest text-[9px]">ASN</span></div>
                          <div className="text-white/70">{p.geoAsn ?? "—"}</div>
                        </div>
                      </>}
                    </div>

                    {/* Hop chain (if multi-hop) */}
                    {p.hopChain && (() => {
                      try {
                        const chain: string[] = JSON.parse(p.hopChain);
                        if (chain.length > 1) return (
                          <div>
                            <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Detected Hop Chain (raw XFF headers)</div>
                            <div className="flex items-center gap-1 flex-wrap">
                              {chain.map((hop, i) => (
                                <div key={i} className="flex items-center gap-1">
                                  <span className="font-mono text-xs text-cyan-400/70 bg-cyan-500/10 border border-cyan-500/20 rounded px-2 py-0.5">{hop}</span>
                                  {i < chain.length - 1 && <ArrowRight className="w-3 h-3 text-white/20" />}
                                </div>
                              ))}
                              <ArrowRight className="w-3 h-3 text-white/20" />
                              <span className="font-mono text-xs text-primary/70 bg-primary/10 border border-primary/20 rounded px-2 py-0.5">Your Server</span>
                            </div>
                          </div>
                        );
                      } catch { return null; }
                      return null;
                    })()}

                    {/* UA */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">User Agent</div>
                        <div className="text-xs text-white/60 font-mono break-all">{p.attackerUa || "—"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Timestamp</div>
                        <div className="text-xs text-white/60">{new Date(p.probedAt).toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Fake data fed */}
                    {p.fakeResponse && (
                      <div>
                        <div className="text-[10px] text-primary/50 uppercase tracking-widest mb-1">Poisoned Data Fed (includes tracking beacon)</div>
                        <pre className="text-[10px] text-primary/70 bg-black/40 rounded-lg p-3 overflow-auto max-h-36 border border-primary/10 whitespace-pre-wrap break-all">
                          {(() => { try { return JSON.stringify(JSON.parse(p.fakeResponse), null, 2); } catch { return p.fakeResponse; } })()}
                        </pre>
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap items-center">
                      {p.vpnDetected && <span className="bg-red-300/10 border border-red-300/20 text-red-300 text-[10px] px-2 py-1 rounded-full">🛡 VPN exit node detected at surface IP</span>}
                      {p.beaconFired && <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] px-2 py-1 rounded-full">🔥 Beacon fired {p.beaconFiredAt ? `at ${new Date(p.beaconFiredAt).toLocaleTimeString()}` : ""} — attacker confirmed live</span>}
                      {p.autoBlocked && <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] px-2 py-1 rounded-full">✓ IP auto-blocked</span>}
                      {p.silkTrapped && <span className="bg-primary/10 border border-primary/20 text-primary text-[10px] px-2 py-1 rounded-full">✓ Silk-trapped</span>}
                      <span className="bg-white/5 border border-white/10 text-white/40 text-[10px] px-2 py-1 rounded-full">⏱ {p.tarpitMs.toLocaleString()}ms delay</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ATTACKER INTEL ─────────────────────────────────────────────────────── */}
      {activeTab === "info" && (
        <div className="space-y-4">
          {uniqueIps.length === 0 && (
            <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-10 text-center">
              <Shield className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <div className="text-sm text-white/30">No attackers captured yet.</div>
            </div>
          )}
          {uniqueIps.map(ip => {
            const ipProbes   = probes.filter(p => p.attackerIp === ip);
            const first      = ipProbes[ipProbes.length - 1]!;
            const beaconFired = ipProbes.some(p => p.beaconFired);
            const vpnDetected = ipProbes.some(p => p.vpnDetected);
            const whois      = whoisCache[ip];
            const backtrace  = backtraceCache[ip];
            const sourcePort = ipProbes.find(p => p.attackerPort)?.attackerPort;

            return (
              <div key={ip} className="bg-[#0d1610] border border-white/[0.07] rounded-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/[0.06] flex-wrap">
                  <div className="flex items-center gap-3">
                    <Skull className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="font-mono text-base font-bold text-white">{ip}</span>
                    {sourcePort && (
                      <span className="font-mono text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded">:{sourcePort}</span>
                    )}
                    {first.geoCountry && <span className="text-xs text-white/40">{first.geoCity}, {first.geoCountry}</span>}
                    {vpnDetected && <span className="text-[10px] bg-red-300/10 border border-red-300/20 text-red-300 px-2 py-0.5 rounded-full">🛡 VPN exit</span>}
                    {beaconFired && <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full">🔥 Beacon confirmed</span>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => lookupWhois(ip)} disabled={!!whoisCache[ip] || whoisLoading[ip]}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cyan-400 border border-cyan-500/20 bg-cyan-500/5 rounded-lg hover:bg-cyan-500/10 transition-all disabled:opacity-50">
                      <Globe className="w-3.5 h-3.5" />
                      {whoisLoading[ip] ? "Looking up…" : whoisCache[ip] ? "WHOIS ✓" : "WHOIS Lookup"}
                    </button>
                    <button onClick={() => runBacktrace(ip)} disabled={!!backtraceCache[ip] || backtraceLoading[ip]}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-orange-400 border border-orange-500/20 bg-orange-500/5 rounded-lg hover:bg-orange-500/10 transition-all disabled:opacity-50">
                      <Network className="w-3.5 h-3.5" />
                      {backtraceLoading[ip] ? "Tracing…" : backtraceCache[ip] ? "Traced ✓" : "VPN Backtrace"}
                    </button>
                    <button onClick={() => downloadReport(ip)} disabled={reportLoading[ip]}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary border border-primary/20 bg-primary/5 rounded-lg hover:bg-primary/10 transition-all disabled:opacity-50">
                      <Download className="w-3.5 h-3.5" />
                      {reportLoading[ip] ? "Generating…" : "Authority Report"}
                    </button>
                  </div>
                </div>

                {/* Summary row */}
                <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-white/[0.04]">
                  <div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest">Total Probes</div>
                    <div className="text-lg font-bold text-white">{ipProbes.length}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest">Source Port</div>
                    <div className={`font-mono text-lg font-bold mt-0.5 ${sourcePort ? "text-yellow-400" : "text-white/20"}`}>
                      {sourcePort ? `:${sourcePort}` : "—"}
                    </div>
                    <div className="text-[9px] text-white/20">TCP source port</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest">Attack Types</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {[...new Set(ipProbes.map(p => p.probeType))].map(t => (
                        <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded border ${TYPE_COLOR[t as ProbeType]}`}>{TYPE_LABEL[t as ProbeType]}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest">Status</div>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {ipProbes.some(p => p.autoBlocked) && <span className="text-[9px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded">BLOCKED</span>}
                      {ipProbes.some(p => p.silkTrapped) && <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded">SILK-TRAPPED</span>}
                      {beaconFired && <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">BEACON ✓</span>}
                      {vpnDetected && <span className="text-[9px] bg-red-300/10 text-red-300 border border-red-300/20 px-1.5 py-0.5 rounded">VPN</span>}
                    </div>
                  </div>
                </div>

                {/* WHOIS panel */}
                {whois && !whois.error && (
                  <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-cyan-500/[0.03] border-b border-cyan-500/10">
                    {[
                      { icon: <Building2 className="w-3 h-3" />, label: "ISP",      val: whois.isp },
                      { icon: <MapPin className="w-3 h-3" />,    label: "Location", val: `${whois.city ?? "—"}, ${whois.country ?? "—"}` },
                      { icon: <Wifi className="w-3 h-3" />,      label: "ASN",      val: whois.asn },
                      { icon: <Clock className="w-3 h-3" />,     label: "Timezone", val: whois.timezone },
                    ].map(({ icon, label, val }) => (
                      <div key={label}>
                        <div className="flex items-center gap-1 text-cyan-400/50 text-[9px] uppercase tracking-widest mb-1">{icon}{label}</div>
                        <div className="text-xs text-white/70 truncate">{val ?? "—"}</div>
                      </div>
                    ))}
                  </div>
                )}
                {whois?.error && (
                  <div className="px-4 py-2 text-xs text-red-400/60 border-b border-white/[0.04]">WHOIS error: {whois.error}</div>
                )}

                {/* ── VPN BACKTRACE PANEL ─────────────────────────────────────── */}
                {backtrace && (
                  <div className="px-4 py-4 space-y-4 bg-orange-500/[0.03] border-b border-orange-500/10">
                    {/* Summary sentence */}
                    <div className="flex items-start gap-2">
                      <Network className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                      <div className="text-xs text-white/70 leading-relaxed">{backtrace.summary}</div>
                    </div>

                    {/* Hop chain visualization */}
                    <HopChainViz chain={backtrace.hopChain} targetIp={ip} />

                    {/* VPN nodes highlight */}
                    {backtrace.vpnNodes.length > 0 && (
                      <div>
                        <div className="text-[10px] text-orange-400/60 uppercase tracking-widest mb-2">Identified VPN / Proxy Nodes</div>
                        <div className="space-y-2">
                          {backtrace.vpnNodes.map((n, i) => (
                            <div key={i} className="bg-red-500/5 border border-red-500/15 rounded-xl px-4 py-3">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <Layers className="w-3.5 h-3.5 text-red-400" />
                                  <span className="font-mono text-sm text-white/80">{n.ip}</span>
                                  {n.vpnProvider && <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded">{n.vpnProvider}</span>}
                                </div>
                                <div className="text-[10px] text-red-400/60">{n.confidence}% confidence</div>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs text-white/50">
                                {n.country  && <span>📍 {n.city ?? n.country}</span>}
                                {n.isp      && <span>🏢 {n.isp}</span>}
                                {n.asn      && <span>📡 {n.asn}</span>}
                                {n.rdns     && <span className="font-mono truncate">🔤 {n.rdns}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Likely real origin */}
                    {backtrace.likelyRealOrigin && backtrace.likelyRealOrigin.nodeType !== "vpn_exit" && backtrace.likelyRealOrigin.nodeType !== "datacenter" && (
                      <div className="bg-green-500/5 border border-green-500/15 rounded-xl px-4 py-3">
                        <div className="text-[10px] text-green-400/60 uppercase tracking-widest mb-2">Probable Real-World Origin</div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <Home className="w-4 h-4 text-green-400 shrink-0" />
                          <span className="font-mono text-sm text-white/80">{backtrace.likelyRealOrigin.ip}</span>
                          {backtrace.likelyRealOrigin.city && <span className="text-xs text-white/50">📍 {backtrace.likelyRealOrigin.city}, {backtrace.likelyRealOrigin.country}</span>}
                          {backtrace.likelyRealOrigin.isp  && <span className="text-xs text-white/50">🏢 {backtrace.likelyRealOrigin.isp}</span>}
                          <span className="text-[10px] text-green-400/60">{backtrace.likelyRealOrigin.confidence}% confidence</span>
                        </div>
                      </div>
                    )}

                    {/* Port hints */}
                    <div>
                      <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Common VPN/Proxy Ports Associated With This Attack Profile</div>
                      <div className="flex flex-wrap gap-1.5">
                        {backtrace.portHints.map(ph => (
                          <div key={ph.port} className={`text-[10px] px-2.5 py-1 rounded-lg border font-mono ${
                            ph.likely
                              ? "bg-orange-500/10 border-orange-500/25 text-orange-300"
                              : "bg-white/[0.03] border-white/10 text-white/30"
                          }`}>
                            :{ph.port} <span className="font-sans">{ph.service}</span>
                            {ph.likely && <span className="ml-1 text-orange-400">← likely</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Law enforcement note */}
                    {backtrace.vpnNodes.length > 0 && (
                      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-xs text-white/40 leading-relaxed">
                        <span className="text-white/60 font-semibold">Law Enforcement Note: </span>
                        The attacker's real identity is behind {backtrace.vpnNodes.map(n => n.vpnProvider ?? "unknown VPN").join(", ")}.
                        {" "}A subpoena or court order to {backtrace.vpnNodes.map(n => n.vpnProvider ?? "the VPN provider").join(", ")} for
                        subscriber records matching these timestamps would be required to identify the true subscriber.
                        Download the Authority Report below — it includes all timestamps formatted for this purpose.
                      </div>
                    )}
                  </div>
                )}

                {/* Report CTA */}
                <div className="px-4 py-3 flex items-center gap-3">
                  <FileText className="w-4 h-4 text-white/20 shrink-0" />
                  <div className="text-xs text-white/40 flex-1">
                    Authority Report: full probe timeline, all attack vectors, port info, hop chain, beacon confirmation, geo/WHOIS — formatted for law enforcement handover.
                  </div>
                  <button onClick={() => downloadReport(ip)} disabled={reportLoading[ip]}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-primary bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/15 transition-all shrink-0 disabled:opacity-50">
                    <Download className="w-4 h-4" />
                    {reportLoading[ip] ? "Generating…" : "Download Report"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
