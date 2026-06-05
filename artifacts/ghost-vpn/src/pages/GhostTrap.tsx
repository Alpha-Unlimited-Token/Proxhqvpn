// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useCallback } from "react";
import {
  Skull, Zap, Ban, RefreshCw, Trash2, Settings, Clock, Globe,
  AlertTriangle, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Download, Radio, MapPin, Building2, Wifi, Shield, FileText,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ProbeType = "sql_injection" | "xss" | "cmd_injection" | "path_traversal" | "auth_brute" | "recon" | "other";

interface Probe {
  id: number;
  probeId: string;
  attackerIp: string;
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
  cmdCount: number; blocked: number; silkTrapped: number; beaconFires: number; avgTarpit: number;
}

interface Config {
  id: number; enabled: boolean; tarpitMinMs: number; tarpitMaxMs: number;
  autoBlockAfter: number; silkTrapAfter: number; fakeSiteName: string; fakeDbVersion: string;
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

function StatCard({ label, value, color = "text-white", sub }: { label: string; value: number | string; color?: string; sub?: string }) {
  return (
    <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-white/50 mt-1">{label}</div>
      {sub && <div className="text-[10px] text-white/30 mt-0.5">{sub}</div>}
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
      const d = await r.json();
      setWhoisCache(c => ({ ...c, [ip]: d }));
    } catch { setWhoisCache(c => ({ ...c, [ip]: { error: "Lookup failed" } })); }
    setWhoisLoading(w => ({ ...w, [ip]: false }));
  };

  const downloadReport = async (ip: string) => {
    setReportLoading(r => ({ ...r, [ip]: true }));
    const url = `${BASE}/api/ghost-trap/report/${encodeURIComponent(ip)}?download=1`;
    const r = await fetch(url, { credentials: "include" });
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
    setWhoisCache({}); await load(); setClearing(false);
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
            <p className="text-xs text-white/40">Honeypot · injection confusion · beacon tracking · authority reports</p>
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

      {/* How it works — lure URLs */}
      <div className="bg-[#0d1610] border border-primary/10 rounded-xl p-4">
        <div className="text-xs font-semibold text-primary/60 uppercase tracking-widest mb-2">Active Honeypot Endpoints</div>
        <div className="text-xs text-white/40 mb-3">
          Publicly reachable. Attackers who probe them are detected, tarpitted (1.5–8s delay), fed poisoned data with embedded tracking beacons, and auto-blocked after {config?.autoBlockAfter ?? 5} hits.
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
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-3">
          <StatCard label="Total Probes"   value={stats.total}       color="text-white" />
          <StatCard label="Unique IPs"     value={stats.uniqueIps}   color="text-cyan-400" />
          <StatCard label="SQL Inject"     value={stats.sqlCount}    color="text-red-400" />
          <StatCard label="XSS Attempts"   value={stats.xssCount}    color="text-orange-400" />
          <StatCard label="CMD Inject"     value={stats.cmdCount}    color="text-purple-400" />
          <StatCard label="Auto-Blocked"   value={stats.blocked}     color="text-yellow-400" />
          <StatCard label="Silk-Trapped"   value={stats.silkTrapped} color="text-primary" />
          <StatCard label="Beacon Fires"   value={stats.beaconFires} color="text-red-300" sub="attacker confirmed live" />
          <StatCard label="Avg Tarpit"     value={`${((stats.avgTarpit ?? 0) / 1000).toFixed(1)}s`} color="text-white/70" sub="connection delay" />
        </div>
      )}

      {/* Config panel */}
      {showConfig && config && (
        <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-5 space-y-4">
          <div className="text-sm font-semibold text-white">Trap Configuration</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Tarpit Min (ms)",          field: "tarpitMinMs",    type: "number" },
              { label: "Tarpit Max (ms)",          field: "tarpitMaxMs",    type: "number" },
              { label: "Auto-block after N probes", field: "autoBlockAfter", type: "number" },
              { label: "Silk-trap after N probes",  field: "silkTrapAfter",  type: "number" },
              { label: "Fake Site Name",           field: "fakeSiteName",   type: "text" },
              { label: "Fake DB Version",          field: "fakeDbVersion",  type: "text" },
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
      <div className="flex gap-1 border-b border-white/[0.06] pb-0">
        {([["probes", "Probe Feed"], ["info", "Attacker Intel"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-all ${
              activeTab === key ? "text-white bg-[#0d1610] border border-b-0 border-white/[0.07]" : "text-white/40 hover:text-white/60"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: PROBE FEED ─────────────────────────────────────────────────── */}
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
                  <div className="flex items-center gap-1.5 text-sm text-white/80 font-mono shrink-0">
                    <Globe className="w-3.5 h-3.5 text-white/30" />
                    {p.attackerIp}
                    {p.geoCountry && <span className="text-white/30 text-xs">({p.geoCity ?? p.geoCountry})</span>}
                  </div>
                  <div className="text-xs text-white/40 font-mono flex-1 truncate">
                    <span className="text-white/25">{p.method} </span>{p.endpoint}
                  </div>
                  {p.attackVector && (
                    <div className="text-[10px] text-orange-400/70 bg-orange-500/10 px-2 py-0.5 rounded shrink-0 truncate max-w-[130px]">
                      {p.attackVector}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-white/30 shrink-0">
                    <Clock className="w-3 h-3" />{(p.tarpitMs / 1000).toFixed(1)}s
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {p.beaconFired && <Radio className="w-3.5 h-3.5 text-red-400" aria-label="Beacon fired" />}
                    {p.autoBlocked && <Ban className="w-3.5 h-3.5 text-yellow-400" aria-label="Auto-blocked" />}
                    {p.silkTrapped && <AlertTriangle className="w-3.5 h-3.5 text-primary" aria-label="Silk-trapped" />}
                  </div>
                  {expandedId === p.id ? <ChevronUp className="w-3.5 h-3.5 text-white/20 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-white/20 shrink-0" />}
                </div>

                {expandedId === p.id && (
                  <div className="px-4 pb-4 space-y-3 bg-black/20">
                    {/* Geo info */}
                    {p.geoCountry && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        {[
                          { icon: <MapPin className="w-3 h-3" />,      label: "Location", val: `${p.geoCity ?? "—"}, ${p.geoCountry}` },
                          { icon: <Building2 className="w-3 h-3" />,   label: "ISP",      val: p.geoIsp ?? "—" },
                          { icon: <Wifi className="w-3 h-3" />,        label: "ASN",      val: p.geoAsn ?? "—" },
                          { icon: <Clock className="w-3 h-3" />,       label: "Timezone", val: p.geoTimezone ?? "—" },
                        ].map(({ icon, label, val }) => (
                          <div key={label} className="bg-black/30 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-1 text-white/30 mb-1">{icon}<span className="uppercase tracking-widest text-[9px]">{label}</span></div>
                            <div className="text-white/70 truncate">{val}</div>
                          </div>
                        ))}
                      </div>
                    )}

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

                    {p.fakeResponse && (
                      <div>
                        <div className="text-[10px] text-primary/50 uppercase tracking-widest mb-1">Poisoned Data Fed to Attacker (includes tracking beacon)</div>
                        <pre className="text-[10px] text-primary/70 bg-black/40 rounded-lg p-3 overflow-auto max-h-40 border border-primary/10 whitespace-pre-wrap break-all">
                          {(() => { try { return JSON.stringify(JSON.parse(p.fakeResponse), null, 2); } catch { return p.fakeResponse; } })()}
                        </pre>
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap items-center">
                      {p.beaconFired && <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] px-2 py-1 rounded-full">🔥 Beacon fired at {p.beaconFiredAt ? new Date(p.beaconFiredAt).toLocaleTimeString() : "—"} — attacker confirmed live</span>}
                      {p.autoBlocked && <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] px-2 py-1 rounded-full">✓ IP auto-blocked in firewall</span>}
                      {p.silkTrapped && <span className="bg-primary/10 border border-primary/20 text-primary text-[10px] px-2 py-1 rounded-full">✓ Logged in SilkWeb trap</span>}
                      <span className="bg-white/5 border border-white/10 text-white/40 text-[10px] px-2 py-1 rounded-full">⏱ {p.tarpitMs.toLocaleString()}ms delay applied</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: ATTACKER INTEL ─────────────────────────────────────────────── */}
      {activeTab === "info" && (
        <div className="space-y-4">
          {uniqueIps.length === 0 && (
            <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-10 text-center">
              <Shield className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <div className="text-sm text-white/30">No attackers captured yet.</div>
            </div>
          )}
          {uniqueIps.map(ip => {
            const ipProbes = probes.filter(p => p.attackerIp === ip);
            const first    = ipProbes[ipProbes.length - 1];
            const beaconFired = ipProbes.some(p => p.beaconFired);
            const geo      = first?.geoCountry ? first : null;
            const whois    = whoisCache[ip];

            return (
              <div key={ip} className="bg-[#0d1610] border border-white/[0.07] rounded-xl overflow-hidden">
                {/* IP header row */}
                <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/[0.06] flex-wrap">
                  <div className="flex items-center gap-3">
                    <Skull className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="font-mono text-base font-bold text-white">{ip}</span>
                    {geo && <span className="text-xs text-white/40">{geo.geoCity}, {geo.geoCountry}</span>}
                    {beaconFired && <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full">🔥 Beacon confirmed</span>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { lookupWhois(ip); }}
                      disabled={whoisLoading[ip]}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cyan-400 border border-cyan-500/20 bg-cyan-500/5 rounded-lg hover:bg-cyan-500/10 transition-all disabled:opacity-50"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {whoisLoading[ip] ? "Looking up…" : "WHOIS Lookup"}
                    </button>
                    <button
                      onClick={() => downloadReport(ip)}
                      disabled={reportLoading[ip]}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary border border-primary/20 bg-primary/5 rounded-lg hover:bg-primary/10 transition-all disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {reportLoading[ip] ? "Generating…" : "Authority Report"}
                    </button>
                  </div>
                </div>

                {/* Probe summary */}
                <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-white/[0.04]">
                  <div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest">Total Probes</div>
                    <div className="text-lg font-bold text-white">{ipProbes.length}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest">Attack Types</div>
                    <div className="text-xs text-white/70 mt-1 flex flex-wrap gap-1">
                      {[...new Set(ipProbes.map(p => p.probeType))].map(t => (
                        <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded border ${TYPE_COLOR[t as ProbeType]}`}>{TYPE_LABEL[t as ProbeType]}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest">First Seen</div>
                    <div className="text-xs text-white/70 mt-1">{new Date(ipProbes[ipProbes.length - 1]?.probedAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest">Status</div>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {ipProbes.some(p => p.autoBlocked) && <span className="text-[9px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded">BLOCKED</span>}
                      {ipProbes.some(p => p.silkTrapped) && <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded">SILK-TRAPPED</span>}
                      {beaconFired && <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">BEACON ✓</span>}
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

                {/* Authority report CTA */}
                <div className="px-4 py-3 flex items-center gap-3">
                  <FileText className="w-4 h-4 text-white/20 shrink-0" />
                  <div className="text-xs text-white/40 flex-1">
                    Authority Report includes: full probe timeline, all attack vectors, beacon confirmation, geo/WHOIS data, and a legal declaration — formatted for law enforcement handover.
                  </div>
                  <button
                    onClick={() => downloadReport(ip)}
                    disabled={reportLoading[ip]}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-primary bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/15 transition-all shrink-0 disabled:opacity-50"
                  >
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
