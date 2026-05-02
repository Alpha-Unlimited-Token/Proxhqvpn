// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useGetSystemStats, useGetNodeStats, useGetBeaconStats, useGetFirewallStatus, useListBeaconAlerts, useListNodes } from "@workspace/api-client-react";
import { Shield, Server, AlertTriangle, CheckCircle, Zap, Wifi, ChevronRight, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { useUser } from "@clerk/react";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high:     "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium:   "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  low:      "text-white/83 bg-white/5 border-white/10",
};

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string | number; sub?: string; icon: any;
  accent?: "green" | "red" | "yellow" | "neutral";
}) {
  const colors = {
    green:   { bg: "bg-primary/10",   border: "border-primary/15",   icon: "text-primary",    value: "text-primary" },
    red:     { bg: "bg-red-500/10",   border: "border-red-500/15",   icon: "text-red-400",    value: "text-red-400" },
    yellow:  { bg: "bg-yellow-500/10",border: "border-yellow-500/15",icon: "text-yellow-400", value: "text-yellow-400" },
    neutral: { bg: "bg-white/[0.04]", border: "border-white/[0.06]", icon: "text-white/78",   value: "text-white/88" },
  };
  const c = colors[accent ?? "neutral"];
  return (
    <div className={`bg-[#0d1610] ${c.border} border rounded-2xl p-5 space-y-4`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/83 font-medium">{label}</span>
        <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-[18px] h-[18px] ${c.icon}`} />
        </div>
      </div>
      <div>
        <div className={`text-3xl font-bold tracking-tight ${c.value}`}>{value}</div>
        {sub && <div className="text-xs text-white/78 mt-1.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useUser();
  const { data: sysStats }     = useGetSystemStats({ query: { refetchInterval: 5000 } as any });
  const { data: nodeStats }    = useGetNodeStats({ query: { refetchInterval: 8000 } as any });
  const { data: beaconStats }  = useGetBeaconStats({ query: { refetchInterval: 6000 } as any });
  const { data: fwStatus }     = useGetFirewallStatus({ query: { refetchInterval: 10000 } as any });
  const { data: recentAlerts } = useListBeaconAlerts({ status: "active" }, { query: { refetchInterval: 5000 } as any });
  const { data: nodesData }    = useListNodes(undefined, { query: { refetchInterval: 10000 } as any });

  const firstName      = user?.firstName ?? user?.username ?? "there";
  const criticalCount  = beaconStats?.criticalAlerts ?? 0;
  const activeAlerts   = beaconStats?.activeAlerts ?? 0;
  const activeNodes    = nodeStats?.activeNodes ?? 0;
  const totalNodes     = nodeStats?.totalNodes ?? 0;
  const fwActive       = fwStatus?.enabled ?? false;
  const allHealthy     = criticalCount === 0 && fwActive && activeNodes > 0;

  function getGreeting() {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }

  return (
    <div className="space-y-7 pb-8 max-w-5xl">

      {/* Welcome + status banner */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-white/78 mt-1 text-sm">
          {totalNodes > 0
            ? `${activeNodes} of ${totalNodes} server${totalNodes !== 1 ? "s" : ""} online`
            : "No servers configured yet"}
          {activeAlerts > 0 ? ` · ${activeAlerts} active alert${activeAlerts !== 1 ? "s" : ""}` : " · No threats detected"}
        </p>
      </div>

      {/* Status pill */}
      {allHealthy && (
        <div className="inline-flex items-center gap-2.5 bg-primary/10 border border-primary/20 rounded-full px-5 py-2.5">
          <CheckCircle className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">All systems secure</span>
          <Link href="/my-vpn" className="text-xs text-primary/60 hover:text-primary underline-offset-2 hover:underline ml-1">
            Get Connected →
          </Link>
        </div>
      )}
      {criticalCount > 0 && (
        <div className="inline-flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-full px-5 py-2.5">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-sm font-medium text-red-400">{criticalCount} critical threat{criticalCount !== 1 ? "s" : ""} detected</span>
          <Link href="/beacons" className="text-xs text-red-400/60 hover:text-red-400 underline-offset-2 hover:underline ml-1">
            View alerts →
          </Link>
        </div>
      )}

      {/* Stat grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Servers Online"
          value={totalNodes > 0 ? `${activeNodes}/${totalNodes}` : "—"}
          sub={activeNodes === totalNodes && totalNodes > 0 ? "All servers healthy" : totalNodes > 0 ? `${totalNodes - activeNodes} offline` : "Add a server to start"}
          icon={Server}
          accent={activeNodes === totalNodes && totalNodes > 0 ? "green" : activeNodes === 0 && totalNodes > 0 ? "red" : "neutral"}
        />
        <StatCard
          label="Firewall"
          value={fwStatus ? (fwActive ? "Active" : "Off") : "—"}
          sub={fwActive ? `${fwStatus?.blockedIps ?? 0} IPs blocked` : "Enable for protection"}
          icon={Shield}
          accent={fwActive ? "green" : fwStatus ? "red" : "neutral"}
        />
        <StatCard
          label="Security Alerts"
          value={beaconStats ? activeAlerts : "—"}
          sub={criticalCount > 0 ? `${criticalCount} critical` : "No critical threats"}
          icon={AlertTriangle}
          accent={criticalCount > 0 ? "red" : activeAlerts > 0 ? "yellow" : "green"}
        />
        <StatCard
          label="CPU Load"
          value={sysStats ? `${sysStats.cpuPercent}%` : "—"}
          sub={sysStats ? `${sysStats.memoryPercent}% RAM used` : "Loading..."}
          icon={Zap}
          accent={sysStats ? (sysStats.cpuPercent > 80 ? "red" : sysStats.cpuPercent > 50 ? "yellow" : "green") : "neutral"}
        />
      </div>

      {/* Two column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Server list */}
        <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <Wifi className="w-4 h-4 text-white/78" />
              <span className="text-sm font-semibold text-white/93">VPN Servers</span>
            </div>
            <Link href="/nodes" className="text-xs text-white/70 hover:text-primary flex items-center gap-1 transition-colors">
              Manage <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {nodesData?.nodes?.slice(0, 6).map((node) => (
              <div key={node.id} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${node.status === "active" ? "bg-primary shadow-[0_0_8px_rgba(0,255,136,0.5)]" : "bg-white/15"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white/93 truncate">{node.name}</div>
                  <div className="text-xs text-white/78">{node.region}</div>
                </div>
                <div className="text-xs text-white/70 font-mono shrink-0">
                  {node.latencyMs != null && node.latencyMs > 0 ? `${node.latencyMs}ms` : "—"}
                </div>
              </div>
            ))}
            {!nodesData?.nodes?.length && (
              <div className="px-5 py-10 text-center">
                <Activity className="w-8 h-8 text-white/70 mx-auto mb-3" />
                <p className="text-sm text-white/70">No servers configured</p>
                <Link href="/nodes" className="text-xs text-primary/60 hover:text-primary mt-1 inline-block">
                  Add your first server →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-white/78" />
              <span className="text-sm font-semibold text-white/93">Recent Threats</span>
            </div>
            <Link href="/beacons" className="text-xs text-white/70 hover:text-primary flex items-center gap-1 transition-colors">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {recentAlerts?.alerts?.slice(0, 6).map((alert) => (
              <div key={alert.id} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg border shrink-0 ${SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.low}`}>
                  {alert.severity.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/88 truncate font-mono text-xs">{alert.attackerIp}</div>
                  <div className="text-xs text-white/78">{alert.nodeName}</div>
                </div>
                <div className="text-xs text-white/70 shrink-0">
                  {formatDistanceToNow(new Date(alert.detectedAt), { addSuffix: true })}
                </div>
              </div>
            ))}
            {!recentAlerts?.alerts?.length && (
              <div className="px-5 py-10 text-center">
                <CheckCircle className="w-8 h-8 text-primary/20 mx-auto mb-3" />
                <p className="text-sm text-white/70">No threats detected</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
