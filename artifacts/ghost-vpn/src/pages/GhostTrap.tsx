// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useCallback } from "react";
import {
  Shield, Skull, Zap, Ban, RefreshCw, Trash2, Settings,
  Clock, Globe, AlertTriangle, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
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
  probedAt: string;
}

interface Stats {
  total: number;
  uniqueIps: number;
  sqlCount: number;
  xssCount: number;
  cmdCount: number;
  blocked: number;
  silkTrapped: number;
  avgTarpit: number;
}

interface Config {
  id: number;
  enabled: boolean;
  tarpitMinMs: number;
  tarpitMaxMs: number;
  autoBlockAfter: number;
  silkTrapAfter: number;
  fakeSiteName: string;
  fakeDbVersion: string;
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
  sql_injection:  "SQL Injection",
  xss:            "XSS",
  cmd_injection:  "CMD Injection",
  path_traversal: "Path Traversal",
  auth_brute:     "Auth Brute",
  recon:          "Recon",
  other:          "Other",
};

function StatCard({ label, value, sub, color = "text-white" }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-white/50 mt-1">{label}</div>
      {sub && <div className="text-[10px] text-white/30 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function GhostTrap() {
  const [probes, setProbes] = useState<Probe[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    const [probesRes, cfgRes] = await Promise.all([
      fetch(`${BASE}/api/ghost-trap/probes?limit=200`, { credentials: "include" }),
      fetch(`${BASE}/api/ghost-trap/config`,           { credentials: "include" }),
    ]);
    if (probesRes.ok) {
      const d = await probesRes.json();
      setProbes(d.probes ?? []);
      setStats(d.stats ?? null);
    }
    if (cfgRes.ok) setConfig(await cfgRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  const saveConfig = async (patch: Partial<Config>) => {
    const res = await fetch(`${BASE}/api/ghost-trap/config`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) setConfig(await res.json());
  };

  const clearProbes = async () => {
    setClearing(true);
    await fetch(`${BASE}/api/ghost-trap/probes`, { method: "DELETE", credentials: "include" });
    await load();
    setClearing(false);
  };

  const lureBase = `${window.location.origin}${BASE}/api/ghost-trap/lure`;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Skull className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Ghost Trap</h1>
            <p className="text-xs text-white/40">Active honeypot — confuses & tarpits attacker injections</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          These endpoints are publicly reachable with no auth. Any attacker who probes them gets detected, tarpitted, fed fake data, and optionally auto-blocked.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {["/login", "/admin", "/wp-admin", "/api/users", "/api/search", "/.env", "/config.php", "/backup.sql"].map(ep => (
            <div key={ep} className="font-mono text-[10px] bg-black/40 rounded-lg px-3 py-1.5 text-primary/70 truncate">
              {lureBase}{ep}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard label="Total Probes"    value={stats.total}      color="text-white" />
          <StatCard label="Unique IPs"      value={stats.uniqueIps}  color="text-cyan-400" />
          <StatCard label="SQL Injections"  value={stats.sqlCount}   color="text-red-400" />
          <StatCard label="XSS Attempts"    value={stats.xssCount}   color="text-orange-400" />
          <StatCard label="CMD Injections"  value={stats.cmdCount}   color="text-purple-400" />
          <StatCard label="Auto-Blocked"    value={stats.blocked}    color="text-yellow-400" />
          <StatCard label="Silk-Trapped"    value={stats.silkTrapped} color="text-primary" />
          <StatCard label="Avg Tarpit"      value={`${(stats.avgTarpit / 1000).toFixed(1)}s`} color="text-white/70" sub="connection delay" />
        </div>
      )}

      {/* Config panel */}
      {showConfig && config && (
        <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-5 space-y-4">
          <div className="text-sm font-semibold text-white">Trap Configuration</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Tarpit Min (ms)",    field: "tarpitMinMs",    type: "number" },
              { label: "Tarpit Max (ms)",    field: "tarpitMaxMs",    type: "number" },
              { label: "Auto-block after N probes", field: "autoBlockAfter", type: "number" },
              { label: "Silk-trap after N probes",  field: "silkTrapAfter",  type: "number" },
              { label: "Fake Site Name",    field: "fakeSiteName",   type: "text" },
              { label: "Fake DB Version",   field: "fakeDbVersion",  type: "text" },
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

      {/* Probe feed */}
      <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> Live Probe Feed
            <span className="text-xs text-white/30 font-normal ml-1">({probes.length} captured)</span>
          </div>
          <button onClick={clearProbes} disabled={clearing}
            className="flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        </div>

        {loading && <div className="p-8 text-center text-white/30 text-sm">Loading…</div>}
        {!loading && probes.length === 0 && (
          <div className="p-10 text-center">
            <Shield className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <div className="text-sm text-white/30">No probes detected yet.</div>
            <div className="text-xs text-white/20 mt-1">When attackers hit the lure endpoints, they'll appear here.</div>
          </div>
        )}

        <div className="divide-y divide-white/[0.04]">
          {probes.map(p => (
            <div key={p.id}>
              <div
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] cursor-pointer transition-colors"
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
              >
                {/* Attack type badge */}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${TYPE_COLOR[p.probeType]}`}>
                  {TYPE_LABEL[p.probeType]}
                </span>

                {/* IP */}
                <div className="flex items-center gap-1.5 text-sm text-white/80 font-mono shrink-0">
                  <Globe className="w-3.5 h-3.5 text-white/30" />
                  {p.attackerIp}
                </div>

                {/* Endpoint */}
                <div className="text-xs text-white/40 font-mono flex-1 truncate">
                  <span className="text-white/25">{p.method} </span>{p.endpoint}
                </div>

                {/* Vector */}
                {p.attackVector && (
                  <div className="text-[10px] text-orange-400/70 bg-orange-500/10 px-2 py-0.5 rounded shrink-0 truncate max-w-[140px]">
                    {p.attackVector}
                  </div>
                )}

                {/* Tarpit */}
                <div className="flex items-center gap-1 text-xs text-white/30 shrink-0">
                  <Clock className="w-3 h-3" />{(p.tarpitMs / 1000).toFixed(1)}s
                </div>

                {/* Status chips */}
                <div className="flex gap-1 shrink-0">
                  {p.autoBlocked && <Ban className="w-3.5 h-3.5 text-yellow-400" aria-label="Auto-blocked" />}
                  {p.silkTrapped && <AlertTriangle className="w-3.5 h-3.5 text-primary" aria-label="Silk-trapped" />}
                </div>

                {expandedId === p.id ? <ChevronUp className="w-3.5 h-3.5 text-white/20 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-white/20 shrink-0" />}
              </div>

              {/* Expanded detail */}
              {expandedId === p.id && (
                <div className="px-4 pb-4 space-y-3 bg-black/20">
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
                      <div className="text-[10px] text-primary/50 uppercase tracking-widest mb-1">Poisoned Data We Fed Them</div>
                      <pre className="text-[10px] text-primary/70 bg-black/40 rounded-lg p-3 overflow-auto max-h-40 border border-primary/10">
                        {JSON.stringify(JSON.parse(p.fakeResponse.startsWith("{") || p.fakeResponse.startsWith("[") ? p.fakeResponse : `"${p.fakeResponse}"`), null, 2)}
                      </pre>
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap text-[10px]">
                    {p.autoBlocked && <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">✓ IP auto-blocked in firewall</span>}
                    {p.silkTrapped && <span className="bg-primary/10 border border-primary/20 text-primary px-2 py-1 rounded-full">✓ Logged in SilkWeb as trapped attacker</span>}
                    <span className="bg-white/5 border border-white/10 text-white/40 px-2 py-1 rounded-full">⏱ {p.tarpitMs.toLocaleString()}ms connection delay applied</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
