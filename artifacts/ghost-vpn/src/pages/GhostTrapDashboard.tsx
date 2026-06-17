// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Trap — defensive monitoring dashboard. No counter-attack actions.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SecurityOpsShell, SecurityMetricCard } from "@/components/security-ops";
import {
  ShieldCheck, Globe, Clock, Ban, Siren, Download,
  AlertTriangle, Loader2, RefreshCw,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

interface TrapEvent {
  id: number;
  probeId?: string;
  attackerIp: string;
  method?: string;
  endpoint?: string;
  probeType?: string;
  severity?: string;
  autoBlocked?: boolean;
  silkTrapped?: boolean;
  beaconFired?: boolean;
  geoCountry?: string | null;
  geoCity?: string | null;
  geoIsp?: string | null;
  probedAt?: string;
  createdAt?: string;
}

interface TrapSession {
  id: number;
  attackerIp: string;
  sessionStart: string;
  sessionEnd?: string | null;
  eventCount?: number;
  blocked?: boolean;
  status?: string;
}

interface EvidenceItem {
  id: number;
  sessionId?: number;
  attackerIp?: string;
  evidenceType?: string;
  description?: string;
  exportedAt?: string;
  createdAt?: string;
}

interface TrapStats {
  total?: number;
  uniqueIps?: number;
  blocked?: number;
  silkTrapped?: number;
  beaconFires?: number;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-400",
  warn:     "text-yellow-400",
  info:     "text-sky-400",
  success:  "text-primary",
};

export default function GhostTrapDashboard() {
  const [activeTab, setActiveTab] = useState<"events" | "sessions" | "evidence">("events");

  const eventsQ = useQuery<{ probes?: TrapEvent[]; stats?: TrapStats }>({
    queryKey: ["ghost-trap-events"],
    queryFn: () => apiFetch("/api/command-center/ghost-trap/events"),
    refetchInterval: 15_000,
    retry: false,
  });

  const sessionsQ = useQuery<{ sessions?: TrapSession[] }>({
    queryKey: ["ghost-trap-sessions"],
    queryFn: () => apiFetch("/api/command-center/ghost-trap/sessions"),
    refetchInterval: 30_000,
    retry: false,
  });

  const evidenceQ = useQuery<{ evidence?: EvidenceItem[] }>({
    queryKey: ["ghost-trap-evidence"],
    queryFn: () => apiFetch("/api/command-center/ghost-trap/evidence"),
    refetchInterval: 60_000,
    retry: false,
  });

  const portStatsQ = useQuery<{ realPortProbes24h?: number; decoyPortProbes24h?: number }>({
    queryKey: ["ghost-trap-port-stats"],
    queryFn: () => apiFetch("/api/command-center/ghost-trap/port-stats"),
    refetchInterval: 30_000,
    retry: false,
  });

  const stats   = eventsQ.data?.stats ?? {};
  const events  = eventsQ.data?.probes ?? [];
  const sessions = sessionsQ.data?.sessions ?? [];
  const evidence = evidenceQ.data?.evidence ?? [];

  return (
    <SecurityOpsShell
      title="Ghost Trap — Honeypot Intelligence"
      subtitle="Passive deception and attacker capture. Every probe is logged, fingerprinted, and blocked. No retaliation."
      rightRail={
        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary/70">
            Safety Controls
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4 text-sm text-primary/90 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Capture, isolate, log, alert, block — no retaliation.
            </span>
          </div>
          <div className="space-y-2 text-xs text-white/50 leading-relaxed border-t border-white/[0.06] pt-3">
            <div className="font-semibold text-white/60 text-[10px] uppercase tracking-widest mb-2">Active controls</div>
            {[
              "Auto-block after configurable probe threshold",
              "SilkWeb trap ensnares persistent probers",
              "Beacon fires on first contact",
              "Evidence preserved for analysis",
              "Rate limiting enforced per attacker IP",
              "No counter-attack, no public-target scanning",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <ShieldCheck className="w-3 h-3 text-primary/40 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      }
    >
      {/* Passive-only disclosure banner */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 mb-2">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-primary/80 leading-relaxed">
          <strong className="text-primary">Ghost Trap is entirely passive.</strong>{" "}
          All probes are logged, fingerprinted, and blocked — no counter-scanning, no offensive tools,
          no actions taken against external hosts. Data collected from attackers is stored for 90 days
          and disclosed in our{" "}
          <a href="/privacy" className="underline hover:text-primary">Privacy Policy §4</a>.
        </p>
      </div>

      <div className="space-y-6">
        {/* Metric cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SecurityMetricCard
            label="Total probes"
            value={stats.total ?? events.length}
            status="neutral"
          />
          <SecurityMetricCard
            label="Unique attacker IPs"
            value={stats.uniqueIps ?? 0}
            status={(stats.uniqueIps ?? 0) > 0 ? "warning" : "good"}
          />
          <SecurityMetricCard
            label="Auto-blocked"
            value={stats.blocked ?? 0}
            status="neutral"
            detail="Sources blocked after threshold"
          />
          <SecurityMetricCard
            label="Beacons fired"
            value={stats.beaconFires ?? 0}
            status={(stats.beaconFires ?? 0) > 0 ? "warning" : "good"}
            detail="Outbound alert triggers"
          />
        </div>

        {/* Dual-Port Detection row — Ghost WireGuard daemon pipeline */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-red-500/30 bg-red-500/[0.04] p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs font-bold text-red-400">Hidden Port 41194 (Real WG)</span>
            </div>
            <div className="text-2xl font-black text-red-400">
              {portStatsQ.data?.realPortProbes24h ?? 0}
            </div>
            <div className="text-xs text-white/40 mt-1">Probes in last 24 h</div>
            <div className="text-[10px] text-white/30 mt-2 leading-relaxed">
              {(portStatsQ.data?.realPortProbes24h ?? 0) > 0
                ? "⚠️ Someone found the hidden port. Review alerts immediately."
                : "✓ Hidden port undetected by scanners"}
            </div>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-bold text-primary">Decoy Port 51820 (Ghost WG)</span>
            </div>
            <div className="text-2xl font-black text-primary">
              {portStatsQ.data?.decoyPortProbes24h ?? 0}
            </div>
            <div className="text-xs text-white/40 mt-1">Probes in last 24 h</div>
            <div className="text-[10px] text-white/30 mt-2 leading-relaxed">
              Routine internet scanners. Ghost WireGuard responding with fake handshakes.
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/[0.07] pb-0">
          {(["events", "sessions", "evidence"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-widest rounded-t-lg transition-all -mb-px ${
                activeTab === tab
                  ? "border border-b-black border-primary/30 text-primary bg-black/50"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {tab}
              {tab === "events" && events.length > 0 && (
                <span className="ml-1.5 bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded-full">
                  {events.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Events tab */}
        {activeTab === "events" && (
          <div className="rounded-2xl border border-white/[0.07] bg-black/40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Probe log</span>
              <button
                onClick={() => eventsQ.refetch()}
                disabled={eventsQ.isFetching}
                className="text-white/30 hover:text-primary transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${eventsQ.isFetching ? "animate-spin" : ""}`} />
              </button>
            </div>
            {eventsQ.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-white/40 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading probe log...
              </div>
            ) : eventsQ.isError ? (
              <div className="flex items-center gap-2 py-12 px-6 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Unable to load probe events. Check API connectivity.
              </div>
            ) : events.length === 0 ? (
              <div className="py-12 text-center text-white/30 text-sm">No probe events recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/[0.05] text-white/30 text-[10px] uppercase tracking-widest">
                      <th className="px-4 py-2.5 text-left">Time</th>
                      <th className="px-4 py-2.5 text-left">Attacker IP</th>
                      <th className="px-4 py-2.5 text-left">Type</th>
                      <th className="px-4 py-2.5 text-left">Endpoint</th>
                      <th className="px-4 py-2.5 text-left">Geo</th>
                      <th className="px-4 py-2.5 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.slice(0, 100).map((ev) => (
                      <tr key={ev.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2 text-white/40 whitespace-nowrap">
                          {new Date(ev.probedAt ?? ev.createdAt ?? "").toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-2 text-white/80">{ev.attackerIp}</td>
                        <td className={`px-4 py-2 ${SEVERITY_COLOR[ev.severity ?? "info"] ?? "text-sky-400"}`}>
                          {ev.probeType ?? "unknown"}
                        </td>
                        <td className="px-4 py-2 text-white/50 max-w-[200px] truncate">
                          {ev.method && <span className="text-white/30 mr-1">{ev.method}</span>}
                          {ev.endpoint ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-white/40">
                          {[ev.geoCity, ev.geoCountry].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {ev.autoBlocked && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-red-500/15 border border-red-500/30 text-red-300 px-1.5 py-0.5 rounded-full">
                                <Ban className="w-2.5 h-2.5" /> blocked
                              </span>
                            )}
                            {ev.silkTrapped && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-purple-500/15 border border-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded-full">
                                trapped
                              </span>
                            )}
                            {ev.beaconFired && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 px-1.5 py-0.5 rounded-full">
                                <Siren className="w-2.5 h-2.5" /> beacon
                              </span>
                            )}
                            {!ev.autoBlocked && !ev.silkTrapped && !ev.beaconFired && (
                              <span className="text-white/25">logged</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Sessions tab */}
        {activeTab === "sessions" && (
          <div className="rounded-2xl border border-white/[0.07] bg-black/40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Attacker sessions</span>
              <button onClick={() => sessionsQ.refetch()} disabled={sessionsQ.isFetching} className="text-white/30 hover:text-primary transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${sessionsQ.isFetching ? "animate-spin" : ""}`} />
              </button>
            </div>
            {sessionsQ.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-white/40 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading sessions...
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-12 text-center text-white/30 text-sm">No attacker sessions recorded.</div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {sessions.slice(0, 50).map((s) => (
                  <div key={s.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors text-xs">
                    <Globe className="w-3.5 h-3.5 text-white/30 shrink-0" />
                    <span className="font-mono text-white/80 w-36 shrink-0">{s.attackerIp}</span>
                    <span className="text-white/40">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {new Date(s.sessionStart).toLocaleString()}
                    </span>
                    {s.eventCount != null && (
                      <span className="text-white/40">{s.eventCount} events</span>
                    )}
                    {s.blocked && (
                      <span className="inline-flex items-center gap-1 text-[9px] bg-red-500/15 border border-red-500/30 text-red-300 px-1.5 py-0.5 rounded-full ml-auto">
                        <Ban className="w-2.5 h-2.5" /> blocked
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Evidence tab */}
        {activeTab === "evidence" && (
          <div className="rounded-2xl border border-white/[0.07] bg-black/40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Evidence exports</span>
              <button onClick={() => evidenceQ.refetch()} disabled={evidenceQ.isFetching} className="text-white/30 hover:text-primary transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${evidenceQ.isFetching ? "animate-spin" : ""}`} />
              </button>
            </div>
            {evidenceQ.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-white/40 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading evidence...
              </div>
            ) : evidence.length === 0 ? (
              <div className="py-12 text-center text-white/30 text-sm">No evidence packages created yet.</div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {evidence.slice(0, 50).map((e) => (
                  <div key={e.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors text-xs">
                    <Download className="w-3.5 h-3.5 text-white/30 shrink-0" />
                    <span className="font-mono text-white/60 w-32 shrink-0">{e.attackerIp ?? "unknown"}</span>
                    <span className="text-white/50">{e.evidenceType ?? e.description ?? "evidence"}</span>
                    <span className="text-white/30 ml-auto">
                      {new Date(e.exportedAt ?? e.createdAt ?? "").toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </SecurityOpsShell>
  );
}
