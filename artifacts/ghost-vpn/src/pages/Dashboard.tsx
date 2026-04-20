import { useGetSystemStats, useGetNodeStats, useGetBeaconStats, useGetFirewallStatus, useListBeaconAlerts, useListNodes } from "@workspace/api-client-react";
import { Shield, Server, AlertTriangle, CheckCircle, Clock, Zap, Wifi, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { useUser } from "@clerk/react";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "text-red-400 bg-red-900/15 border-red-500/30",
  high:     "text-orange-400 bg-orange-900/15 border-orange-500/30",
  medium:   "text-yellow-400 bg-yellow-900/15 border-yellow-500/30",
  low:      "text-primary/60 bg-primary/5 border-primary/20",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high:     "High",
  medium:   "Medium",
  low:      "Low",
};

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: any;
  accent?: "green" | "red" | "yellow";
}) {
  const iconColor = accent === "green" ? "text-green-400" : accent === "red" ? "text-red-400" : accent === "yellow" ? "text-yellow-400" : "text-primary";
  return (
    <div className="border border-primary/15 bg-primary/[0.02] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-primary/50 font-medium">{label}</span>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className={`text-2xl font-bold font-mono ${iconColor}`}>{value}</div>
      {sub && <div className="text-xs text-primary/40">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useUser();
  const { data: sysStats }    = useGetSystemStats({ query: { refetchInterval: 5000 } as any });
  const { data: nodeStats }   = useGetNodeStats({ query: { refetchInterval: 8000 } as any });
  const { data: beaconStats } = useGetBeaconStats({ query: { refetchInterval: 6000 } as any });
  const { data: fwStatus }    = useGetFirewallStatus({ query: { refetchInterval: 10000 } as any });
  const { data: recentAlerts } = useListBeaconAlerts({ status: "active" }, { query: { refetchInterval: 5000 } as any });
  const { data: nodesData }   = useListNodes(undefined, { query: { refetchInterval: 10000 } as any });

  const firstName = user?.firstName ?? user?.username ?? "there";
  const criticalCount = beaconStats?.criticalAlerts ?? 0;
  const activeAlerts  = beaconStats?.activeAlerts ?? 0;
  const activeNodes   = nodeStats?.activeNodes ?? 0;
  const totalNodes    = nodeStats?.totalNodes ?? 0;
  const fwActive      = fwStatus?.enabled ?? false;

  return (
    <div className="space-y-8 pb-8 max-w-5xl">

      {/* Welcome */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-primary">Good {getGreeting()}, {firstName}</h1>
        <p className="text-sm text-primary/50">
          {activeNodes > 0
            ? `${activeNodes} of ${totalNodes} VPN server${totalNodes !== 1 ? "s" : ""} online · ${activeAlerts === 0 ? "No threats detected" : `${activeAlerts} active alert${activeAlerts !== 1 ? "s" : ""}`}`
            : "No VPN servers online. Head to VPN Servers to add one."
          }
        </p>
      </div>

      {/* Quick action if no alerts and firewall active */}
      {criticalCount === 0 && fwActive && (
        <div className="flex items-start gap-3 border border-green-500/20 bg-green-900/5 p-4">
          <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-green-400">All systems secure</div>
            <div className="text-xs text-green-400/60 mt-0.5">Firewall active, no critical threats detected right now.</div>
          </div>
          <Link href="/my-vpn" className="ml-auto shrink-0 flex items-center gap-1 text-xs text-primary/50 hover:text-primary border border-primary/15 hover:border-primary/40 px-3 py-1.5 transition-colors">
            Get Connected <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {criticalCount > 0 && (
        <div className="flex items-start gap-3 border border-red-500/30 bg-red-900/5 p-4">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-red-400">{criticalCount} Critical Threat{criticalCount !== 1 ? "s" : ""} Detected</div>
            <div className="text-xs text-red-400/60 mt-0.5">Review the alerts below and take action.</div>
          </div>
          <Link href="/beacons" className="ml-auto shrink-0 flex items-center gap-1 text-xs text-red-400/70 hover:text-red-400 border border-red-500/20 hover:border-red-500/50 px-3 py-1.5 transition-colors">
            View All <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Servers Online"
          value={totalNodes > 0 ? `${activeNodes}/${totalNodes}` : "--"}
          sub={activeNodes === totalNodes && totalNodes > 0 ? "All servers healthy" : totalNodes > 0 ? `${totalNodes - activeNodes} offline` : "No servers added"}
          icon={Server}
          accent={activeNodes === totalNodes && totalNodes > 0 ? "green" : activeNodes === 0 ? "red" : "yellow"}
        />
        <StatCard
          label="Firewall"
          value={fwStatus ? (fwActive ? "Active" : "Off") : "--"}
          sub={fwActive ? `${fwStatus?.blockedIps ?? 0} IPs blocked` : "Enable for protection"}
          icon={Shield}
          accent={fwActive ? "green" : "red"}
        />
        <StatCard
          label="Security Alerts"
          value={beaconStats ? activeAlerts : "--"}
          sub={criticalCount > 0 ? `${criticalCount} critical` : "No critical threats"}
          icon={AlertTriangle}
          accent={criticalCount > 0 ? "red" : activeAlerts > 0 ? "yellow" : "green"}
        />
        <StatCard
          label="System Load"
          value={sysStats ? `${sysStats.cpuPercent}%` : "--"}
          sub={sysStats ? `${sysStats.memoryPercent}% memory used` : "Loading..."}
          icon={Zap}
          accent={sysStats && sysStats.cpuPercent > 80 ? "red" : sysStats && sysStats.cpuPercent > 50 ? "yellow" : "green"}
        />
      </div>

      {/* Two-column lower section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Servers table */}
        <div className="border border-primary/15">
          <div className="flex items-center justify-between px-4 py-3 border-b border-primary/15">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Wifi className="w-4 h-4" />
              VPN Servers
            </div>
            <Link href="/nodes" className="text-[10px] text-primary/40 hover:text-primary uppercase tracking-widest transition-colors flex items-center gap-1">
              Manage <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-primary/10">
            {nodesData?.nodes?.slice(0, 6).map((node) => (
              <div key={node.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${node.status === "active" ? "bg-green-400" : "bg-primary/20"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-primary truncate">{node.name}</div>
                  <div className="text-xs text-primary/40">{node.region}</div>
                </div>
                <div className="text-xs text-primary/50 font-mono shrink-0">
                  {node.latencyMs != null && node.latencyMs > 0 ? `${node.latencyMs}ms` : "—"}
                </div>
              </div>
            ))}
            {!nodesData?.nodes?.length && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-primary/30">No servers added yet.</p>
                <Link href="/nodes" className="text-xs text-primary/50 hover:text-primary mt-1 inline-block underline">Add your first server</Link>
              </div>
            )}
          </div>
        </div>

        {/* Alerts table */}
        <div className="border border-primary/15">
          <div className="flex items-center justify-between px-4 py-3 border-b border-primary/15">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <AlertTriangle className="w-4 h-4" />
              Recent Threats
            </div>
            <Link href="/beacons" className="text-[10px] text-primary/40 hover:text-primary uppercase tracking-widest transition-colors flex items-center gap-1">
              View All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-primary/10">
            {recentAlerts?.alerts?.slice(0, 6).map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 px-4 py-3">
                <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 border shrink-0 mt-0.5 ${SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.low}`}>
                  {SEVERITY_LABEL[alert.severity] ?? alert.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-primary/70 truncate">From {alert.attackerIp}</div>
                  <div className="text-[10px] text-primary/40">on {alert.nodeName}</div>
                </div>
                <div className="text-[10px] text-primary/30 shrink-0 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {formatDistanceToNow(new Date(alert.detectedAt), { addSuffix: true })}
                </div>
              </div>
            ))}
            {!recentAlerts?.alerts?.length && (
              <div className="px-4 py-8 text-center">
                <CheckCircle className="w-6 h-6 text-green-400/50 mx-auto mb-2" />
                <p className="text-sm text-primary/30">No threats detected.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
