import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, Server, Users, Globe, Wifi, WifiOff, RefreshCw,
  Shield, ShieldCheck, ShieldOff, Clock, MapPin, Cpu,
  CheckCircle, XCircle, AlertCircle, Circle, ArrowUpDown,
  Network, Layers, Key, TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string) {
  const r = await fetch(`${BASE}/api${path}`, { credentials: "include" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function timeAgo(ts: string | null | undefined) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function NodeStatusDot({ status }: { status: string }) {
  if (status === "active")
    return <span className="inline-block w-2 h-2 rounded-full bg-[#00ff88] shadow-[0_0_6px_#00ff88]" />;
  if (status === "rotating")
    return <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_6px_#facc15]" />;
  if (status === "trapped")
    return <span className="inline-block w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />;
  return <span className="inline-block w-2 h-2 rounded-full bg-zinc-600" />;
}

function PeerStatusIcon({ revoked }: { revoked: boolean }) {
  if (revoked) return <WifiOff className="w-3.5 h-3.5 text-zinc-500" />;
  return <Wifi className="w-3.5 h-3.5 text-[#00ff88]" />;
}

function CmdStatusBadge({ status }: { status: string }) {
  if (status === "applied")
    return (
      <span className="flex items-center gap-1 text-[10px] text-[#00ff88]">
        <CheckCircle className="w-3 h-3" /> Applied
      </span>
    );
  if (status === "failed")
    return (
      <span className="flex items-center gap-1 text-[10px] text-red-400">
        <XCircle className="w-3 h-3" /> Failed
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[10px] text-yellow-400">
      <Circle className="w-3 h-3" /> Pending
    </span>
  );
}

function SessionStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    connected: "text-[#00ff88]",
    pending_connect: "text-yellow-400",
    error: "text-red-400",
    disconnected: "text-zinc-500",
  };
  return (
    <span className={`text-[10px] uppercase tracking-widest font-mono ${map[status] ?? "text-zinc-400"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

type Tab = "nodes" | "peers" | "vpngate" | "activity";

export default function VpnTracker() {
  const [tab, setTab] = useState<Tab>("nodes");
  const [showRevoked, setShowRevoked] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["vpn-tracker"],
    queryFn: () => apiFetch("/vpn-tracker/overview"),
    refetchInterval: 30_000,
  });

  const summary = data?.summary ?? {};
  const nodeHealth: any[] = data?.nodeHealth ?? [];
  const peers: any[] = data?.peers ?? [];
  const vpngateSessions: any[] = data?.vpngateSessions ?? [];
  const recentCmds: any[] = data?.recentCommands ?? [];
  const topCountries: any[] = data?.topGateCountries ?? [];

  const visiblePeers = showRevoked ? peers : peers.filter((p: any) => !p.revokedAt);

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "nodes",    label: "Node Health",      icon: Server },
    { id: "peers",    label: "WG Peers",         icon: Users },
    { id: "vpngate",  label: "VPNGate Sessions", icon: Globe },
    { id: "activity", label: "Activity Log",     icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-mono p-4 md:p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-widest uppercase text-[#00ff88]">
            VPN Tracker
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">
            Peer roster · node health · session history · provisioning
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 border border-zinc-800 text-zinc-400 text-[10px] uppercase tracking-widest px-3 py-1.5 hover:border-[#00ff88]/40 hover:text-[#00ff88] transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            icon: Users,
            label: "Active Peers",
            value: isLoading ? "—" : summary.activePeers ?? 0,
            sub: `${summary.revokedPeers ?? 0} revoked`,
            color: "text-[#00ff88]",
          },
          {
            icon: Server,
            label: "Active Nodes",
            value: isLoading ? "—" : summary.activeNodes ?? 0,
            sub: `${summary.inactiveNodes ?? 0} inactive`,
            color: "text-blue-400",
          },
          {
            icon: Globe,
            label: "VPNGate Sessions",
            value: isLoading ? "—" : summary.totalVpngateSessions ?? 0,
            sub: `${summary.activeVpngateSessions ?? 0} connected`,
            color: "text-purple-400",
          },
          {
            icon: Activity,
            label: "Peer Commands",
            value: isLoading ? "—" : (summary.cmdStats?.applied ?? 0),
            sub: `${summary.cmdStats?.pending ?? 0} pending · ${summary.cmdStats?.failed ?? 0} failed`,
            color: "text-yellow-400",
          },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-zinc-600 mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Top VPNGate Countries ── */}
      {topCountries.length > 0 && (
        <div className="border border-zinc-800 bg-zinc-900/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">Top VPNGate Exit Countries</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {topCountries.map((c: any) => (
              <div key={c.country} className="flex items-center gap-2">
                <span className="text-xs text-zinc-300">{c.country}</span>
                <span className="text-[10px] text-zinc-600">×{c.count}</span>
                <div
                  className="h-1.5 bg-[#00ff88]/40 rounded-full"
                  style={{ width: `${Math.max(20, c.count * 12)}px` }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="border-b border-zinc-800 flex gap-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-[11px] uppercase tracking-widest border-b-2 transition-colors ${
              tab === id
                ? "border-[#00ff88] text-[#00ff88]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Node Health ── */}
      {tab === "nodes" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border border-zinc-800 bg-zinc-900/30 p-4 animate-pulse h-28" />
              ))
            : nodeHealth.length === 0
            ? (
              <div className="col-span-3 border border-zinc-800 p-8 text-center text-zinc-600 text-xs uppercase tracking-widest">
                No nodes found
              </div>
            )
            : nodeHealth.map((n: any) => (
              <div key={n.id} className="border border-zinc-800 bg-zinc-900/20 p-4 hover:border-zinc-700 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <NodeStatusDot status={n.status} />
                    <span className="text-sm font-bold text-zinc-200">{n.name}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-zinc-600 border border-zinc-800 px-1.5 py-0.5">
                    {n.layer ?? "—"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
                  <div className="text-zinc-600 uppercase tracking-widest">Region</div>
                  <div className="text-zinc-300">{n.region ?? "—"}</div>

                  <div className="text-zinc-600 uppercase tracking-widest">Public IP</div>
                  <div className="text-zinc-300 font-mono">{n.publicIp ?? n.ipAddress ?? "—"}</div>

                  <div className="text-zinc-600 uppercase tracking-widest">Active Peers</div>
                  <div className="text-[#00ff88] font-bold">{n.activePeerCount}</div>

                  <div className="text-zinc-600 uppercase tracking-widest">Latency</div>
                  <div className="text-zinc-300">{n.latencyMs != null ? `${n.latencyMs} ms` : "—"}</div>

                  <div className="text-zinc-600 uppercase tracking-widest">Last Seen</div>
                  <div className="text-zinc-400">{timeAgo(n.lastSeen)}</div>

                  <div className="text-zinc-600 uppercase tracking-widest">Status</div>
                  <div className={`uppercase tracking-widest font-bold ${
                    n.status === "active" ? "text-[#00ff88]"
                    : n.status === "rotating" ? "text-yellow-400"
                    : n.status === "trapped" ? "text-red-400"
                    : "text-zinc-500"
                  }`}>{n.status}</div>
                </div>

                <div className="mt-3 flex gap-1.5">
                  {n.hasBeacon && (
                    <span className="text-[9px] uppercase tracking-widest border border-purple-500/30 text-purple-400 px-1.5 py-0.5">BEACON</span>
                  )}
                  {n.hasSpider && (
                    <span className="text-[9px] uppercase tracking-widest border border-blue-500/30 text-blue-400 px-1.5 py-0.5">SPIDER</span>
                  )}
                  {n.hasWorm && (
                    <span className="text-[9px] uppercase tracking-widest border border-orange-500/30 text-orange-400 px-1.5 py-0.5">WORM</span>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ── WireGuard Peers ── */}
      {tab === "peers" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
              {visiblePeers.length} peer{visiblePeers.length !== 1 ? "s" : ""}
              {!showRevoked && summary.revokedPeers > 0 && ` (${summary.revokedPeers} revoked hidden)`}
            </span>
            <button
              onClick={() => setShowRevoked((v) => !v)}
              className="text-[10px] uppercase tracking-widest text-zinc-500 border border-zinc-800 px-2 py-1 hover:text-zinc-300 transition-colors"
            >
              {showRevoked ? "Hide Revoked" : "Show Revoked"}
            </button>
          </div>

          <div className="border border-zinc-800 overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  {["Status", "Assigned IP", "Node", "Region", "Public Key (short)", "PSK", "Created", "Revoked"].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-zinc-600 uppercase tracking-widest font-normal whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-zinc-900 animate-pulse">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-3 py-2.5">
                            <div className="h-3 bg-zinc-800 rounded w-16" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : visiblePeers.length === 0
                  ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-zinc-600 uppercase tracking-widest">
                        No peers
                      </td>
                    </tr>
                  )
                  : visiblePeers.map((p: any) => (
                    <tr
                      key={p.id}
                      className={`border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors ${p.revokedAt ? "opacity-50" : ""}`}
                    >
                      <td className="px-3 py-2.5">
                        <PeerStatusIcon revoked={!!p.revokedAt} />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[#00ff88]">{p.assignedIp}</td>
                      <td className="px-3 py-2.5 text-zinc-300">{p.node?.name ?? `Node ${p.nodeId}`}</td>
                      <td className="px-3 py-2.5 text-zinc-500">{p.node?.region ?? "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-500">
                        {p.clientPublicKey ? p.clientPublicKey.slice(0, 12) + "…" : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        {p.pskKey ? (
                          <span className="flex items-center gap-1 text-[10px] text-blue-400">
                            <Key className="w-3 h-3" /> PSK
                          </span>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-500">{timeAgo(p.createdAt)}</td>
                      <td className="px-3 py-2.5 text-zinc-600">
                        {p.revokedAt ? <span className="text-red-400/70">{timeAgo(p.revokedAt)}</span> : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VPNGate Sessions ── */}
      {tab === "vpngate" && (
        <div className="border border-zinc-800 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                {["Status", "Server IP", "Country", "Node", "Exit IP", "Error", "Assigned", "Connected"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-zinc-600 uppercase tracking-widest font-normal whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-zinc-900 animate-pulse">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-3 py-2.5">
                          <div className="h-3 bg-zinc-800 rounded w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                : vpngateSessions.length === 0
                ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-zinc-600 uppercase tracking-widest">
                      No VPNGate sessions recorded
                    </td>
                  </tr>
                )
                : vpngateSessions.map((s: any) => (
                  <tr key={s.id} className="border-b border-zinc-900 hover:bg-zinc-900/30 transition-colors">
                    <td className="px-3 py-2.5">
                      <SessionStatusBadge status={s.status} />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-zinc-300">{s.serverIp ?? "—"}</td>
                    <td className="px-3 py-2.5 text-zinc-300">
                      {s.serverCountryCode && (
                        <span className="uppercase tracking-widest">
                          {s.serverCountryCode} — {s.serverCountry}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-500">{s.node?.name ?? `Node ${s.nodeId}`}</td>
                    <td className="px-3 py-2.5 font-mono text-zinc-500">{s.exitIp ?? "—"}</td>
                    <td className="px-3 py-2.5 text-red-400/70 max-w-[140px] truncate">{s.errorMessage ?? "—"}</td>
                    <td className="px-3 py-2.5 text-zinc-500">{timeAgo(s.assignedAt)}</td>
                    <td className="px-3 py-2.5 text-zinc-500">{s.connectedAt ? timeAgo(s.connectedAt) : "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Activity Log (Peer Commands) ── */}
      {tab === "activity" && (
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">
            Latest {recentCmds.length} peer provisioning command{recentCmds.length !== 1 ? "s" : ""}
          </p>
          <div className="border border-zinc-800 overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  {["Result", "Node", "Assigned IP", "Public Key (short)", "Submitted", "Applied", "Error"].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-zinc-600 uppercase tracking-widest font-normal whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-zinc-900 animate-pulse">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-3 py-2.5">
                            <div className="h-3 bg-zinc-800 rounded w-16" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : recentCmds.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-zinc-600 uppercase tracking-widest">
                        No peer commands recorded
                      </td>
                    </tr>
                  )
                  : recentCmds.map((c: any) => (
                    <tr key={c.id} className="border-b border-zinc-900 hover:bg-zinc-900/30 transition-colors">
                      <td className="px-3 py-2.5">
                        <CmdStatusBadge status={c.status} />
                      </td>
                      <td className="px-3 py-2.5 text-zinc-300">{c.node?.name ?? `Node ${c.nodeId}`}</td>
                      <td className="px-3 py-2.5 font-mono text-[#00ff88]">{c.assignedIp}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-500">
                        {c.clientPublicKey ? c.clientPublicKey.slice(0, 12) + "…" : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-500">{timeAgo(c.createdAt)}</td>
                      <td className="px-3 py-2.5 text-zinc-500">{c.appliedAt ? timeAgo(c.appliedAt) : "—"}</td>
                      <td className="px-3 py-2.5 text-red-400/70 max-w-[180px] truncate">{c.errorMessage ?? "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
