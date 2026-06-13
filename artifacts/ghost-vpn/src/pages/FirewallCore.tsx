// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import {
  Shield, RefreshCw, AlertTriangle, CheckCircle2, Zap, Ban,
  Filter, Activity, Server, Clock, ArrowRight, ShieldAlert, Database,
} from "lucide-react";

interface Overview {
  rules:      { total: number; active: number };
  blockedIps: { total: number; permanent: number; expired: number };
  events24h:  { total: number; high: number; last1h: number };
  traffic1h:  { total: number; blocked: number; allowed: number; blockRatePct: number };
  timestamp:  string;
}

interface BlockedIp {
  ip: string; reason: string | null; created_at: string;
  expires_at: string | null; permanent: boolean;
}

interface FwEvent {
  event_type: string; severity: string; source_ip: string | null;
  description: string | null; created_at: string;
}

interface Subsystem {
  name: string; status: string; count: number | null; path: string;
}

const SEV_COLOR: Record<string, string> = {
  critical: "text-red-300 bg-red-500/10 border-red-500/30",
  high:     "text-red-400 bg-red-500/5 border-red-500/20",
  medium:   "text-orange-400 bg-orange-500/5 border-orange-500/20",
  low:      "text-yellow-400 bg-yellow-500/5 border-yellow-500/20",
  info:     "text-blue-400 bg-blue-500/5 border-blue-500/20",
};

const SUBSYSTEM_ICONS: Record<string, React.ReactNode> = {
  "Rule Engine":         <Filter className="w-4 h-4 text-blue-400" />,
  "IP Blacklist":        <Ban className="w-4 h-4 text-red-400" />,
  "Policy Compiler":     <Shield className="w-4 h-4 text-purple-400" />,
  "Drift Monitor":       <Activity className="w-4 h-4 text-yellow-400" />,
  "Event Correlator":    <Zap className="w-4 h-4 text-green-400" />,
  "DNS Sinkhole":        <Database className="w-4 h-4 text-cyan-400" />,
  "Threat Intelligence": <ShieldAlert className="w-4 h-4 text-orange-400" />,
  "ZTNA Posture":        <Server className="w-4 h-4 text-green-300" />,
};

export default function FirewallCore() {
  const [overview,    setOverview]    = useState<Overview | null>(null);
  const [topBlocked,  setTopBlocked]  = useState<BlockedIp[]>([]);
  const [recentEvents, setRecentEvents] = useState<FwEvent[]>([]);
  const [subsystems,  setSubsystems]  = useState<Subsystem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [tab, setTab] = useState<"overview" | "blocked" | "events">("overview");

  const load = useCallback(async () => {
    setLoading(true);
    const [oRes, bRes, eRes, sRes] = await Promise.all([
      fetch("/api/firewall-core/overview",      { credentials: "include" }),
      fetch("/api/firewall-core/top-blocked",   { credentials: "include" }),
      fetch("/api/firewall-core/recent-events", { credentials: "include" }),
      fetch("/api/firewall-core/subsystems",    { credentials: "include" }),
    ]);
    if (oRes.ok) setOverview(await oRes.json());
    if (bRes.ok) { const d = await bRes.json(); setTopBlocked(d.items ?? []); }
    if (eRes.ok) { const d = await eRes.json(); setRecentEvents(d.events ?? []); }
    if (sRes.ok) { const d = await sRes.json(); setSubsystems(d.subsystems ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 20_000); return () => clearInterval(t); }, [load]);

  const ov = overview;
  const blockRateColor = ov && ov.traffic1h.blockRatePct > 50 ? "text-red-400" : ov && ov.traffic1h.blockRatePct > 20 ? "text-yellow-400" : "text-green-400";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-green-400 flex items-center gap-2">
            <Shield className="w-6 h-6" /> Firewall Core
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Unified view across all firewall subsystems — rules, blocks, events, and traffic decisions.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 text-sm text-gray-400 hover:text-green-400 border border-gray-700 rounded-lg px-3 py-2 disabled:opacity-50 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      {ov && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-400">Firewall Rules</span>
            </div>
            <div className="text-3xl font-bold text-white font-mono">{ov.rules.active}</div>
            <div className="text-xs text-gray-500 mt-0.5">{ov.rules.total} total</div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Ban className="w-4 h-4 text-red-400" />
              <span className="text-xs text-gray-400">Blocked IPs</span>
            </div>
            <div className="text-3xl font-bold text-red-400 font-mono">{ov.blockedIps.total}</div>
            <div className="text-xs text-gray-500 mt-0.5">{ov.blockedIps.permanent} permanent</div>
          </div>
          <div className={`rounded-xl p-4 ${ov.events24h.high > 0 ? "bg-red-900/10 border border-red-700/40" : "bg-gray-900 border border-gray-700"}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`w-4 h-4 ${ov.events24h.high > 0 ? "text-red-400" : "text-gray-500"}`} />
              <span className="text-xs text-gray-400">Security Events (24h)</span>
            </div>
            <div className={`text-3xl font-bold font-mono ${ov.events24h.high > 0 ? "text-red-400" : "text-white"}`}>{ov.events24h.total}</div>
            <div className="text-xs text-gray-500 mt-0.5">{ov.events24h.high} high/critical</div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-400">Traffic (1h)</span>
            </div>
            <div className={`text-3xl font-bold font-mono ${blockRateColor}`}>{ov.traffic1h.blockRatePct}%</div>
            <div className="text-xs text-gray-500 mt-0.5">block rate · {ov.traffic1h.total} total</div>
          </div>
        </div>
      )}

      {/* Subsystem grid */}
      {subsystems.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Subsystems</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {subsystems.map(s => (
              <Link key={s.name} href={s.path}
                className="bg-gray-900 border border-gray-700 rounded-xl p-3 flex items-center gap-3 hover:border-green-500/30 hover:bg-green-500/5 transition-all group">
                <div>{SUBSYSTEM_ICONS[s.name] ?? <Shield className="w-4 h-4 text-gray-500" />}</div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-200 group-hover:text-white transition-colors truncate">{s.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${s.status === "active" ? "bg-green-400" : "bg-gray-600"}`} />
                    <span className="text-[10px] text-gray-500">{s.status}{s.count != null ? ` · ${s.count}` : ""}</span>
                  </div>
                </div>
                <ArrowRight className="w-3 h-3 text-gray-600 group-hover:text-green-400 ml-auto transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {(["overview", "blocked", "events"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? "border-green-500 text-green-400" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}>
            {t === "overview" ? "Quick Links" : t === "blocked" ? `Top Blocked (${topBlocked.length})` : `Recent Events (${recentEvents.length})`}
          </button>
        ))}
      </div>

      {/* Tab: Overview / Quick links */}
      {tab === "overview" && (
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { title: "Full Firewall Console",  desc: "Rules, blocked IPs, iptables export, NodeSync hardening", href: "/firewall",          icon: <Shield className="w-5 h-5 text-blue-400" /> },
            { title: "Firewall Policy Compiler",desc: "Build, simulate, and deploy nftables/iptables policies",  href: "/firewall-compiler", icon: <Filter className="w-5 h-5 text-purple-400" /> },
            { title: "Drift Monitor",          desc: "Infrastructure drift detection with auto-remediation",     href: "/drift-monitor",     icon: <Activity className="w-5 h-5 text-yellow-400" /> },
            { title: "Global Event Graph",     desc: "Cross-system event correlation and kill-chain detection",  href: "/event-graph",       icon: <Zap className="w-5 h-5 text-green-400" /> },
            { title: "DNS Sinkhole",           desc: "Pi-hole style DNS blocking for ads, malware, phishing",   href: "/dns-sinkhole",      icon: <Database className="w-5 h-5 text-cyan-400" /> },
            { title: "Threat Intelligence",    desc: "IP reputation, Tor exits, threat feeds, blocklist",       href: "/threat-intel",      icon: <ShieldAlert className="w-5 h-5 text-orange-400" /> },
            { title: "Device Trust Engine",    desc: "ZTNA posture scoring — manage and evaluate devices",      href: "/device-trust",      icon: <Server className="w-5 h-5 text-green-300" /> },
            { title: "Node Trust Engine",      desc: "Per-node trust scores, routing pool enforcement",         href: "/node-trust",        icon: <CheckCircle2 className="w-5 h-5 text-green-400" /> },
          ].map(l => (
            <Link key={l.title} href={l.href}
              className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex items-start gap-3 hover:border-green-500/30 hover:bg-green-500/5 transition-all group">
              <div className="flex-shrink-0 mt-0.5">{l.icon}</div>
              <div>
                <div className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">{l.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{l.desc}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-green-400 ml-auto flex-shrink-0 mt-0.5 transition-colors" />
            </Link>
          ))}
        </div>
      )}

      {/* Tab: Top Blocked IPs */}
      {tab === "blocked" && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          {topBlocked.length === 0 ? (
            <div className="py-10 text-center text-gray-600">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No blocked IPs recorded yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2.5">IP Address</th>
                  <th className="text-left px-4 py-2.5">Reason</th>
                  <th className="text-left px-4 py-2.5">Type</th>
                  <th className="text-left px-4 py-2.5">Blocked At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {topBlocked.map((b, i) => (
                  <tr key={i} className="hover:bg-gray-800/40">
                    <td className="px-4 py-2.5 font-mono text-red-300 text-xs">{b.ip}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs truncate max-w-[200px]">{b.reason ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${b.permanent ? "bg-red-500/20 text-red-300" : "bg-yellow-500/20 text-yellow-300"}`}>
                        {b.permanent ? "permanent" : "temporary"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(b.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Recent Events */}
      {tab === "events" && (
        <div className="space-y-2">
          {recentEvents.length === 0 ? (
            <div className="py-10 text-center text-gray-600 bg-gray-900 border border-gray-700 rounded-xl">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No security events recorded in the last 24h.</p>
            </div>
          ) : (
            recentEvents.map((e, i) => {
              const sc = SEV_COLOR[e.severity] ?? SEV_COLOR.info;
              return (
                <div key={i} className={`border rounded-lg px-4 py-3 flex items-center gap-4 text-sm ${sc}`}>
                  <span className={`text-xs px-1.5 py-0.5 rounded border font-mono uppercase flex-shrink-0 ${sc}`}>{e.severity}</span>
                  <span className="font-medium text-gray-200 flex-1 truncate">{e.event_type?.replace(/_/g, " ") ?? "—"}</span>
                  {e.source_ip && <span className="font-mono text-xs text-gray-500 flex-shrink-0">{e.source_ip}</span>}
                  <span className="text-xs text-gray-600 flex-shrink-0">{new Date(e.created_at).toLocaleString()}</span>
                </div>
              );
            })
          )}
        </div>
      )}

      {ov && (
        <p className="text-xs text-gray-600 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Updated {new Date(ov.timestamp).toLocaleTimeString()} — auto-refreshes every 20 seconds.
        </p>
      )}
    </div>
  );
}
