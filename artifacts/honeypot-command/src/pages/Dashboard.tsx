// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useGetHoneypotStats } from "@/hooks/useApi";
import { useQueryClient } from "@tanstack/react-query";
import { getGetHoneypotStatsQueryKey } from "@workspace/api-client-react";
import { useEffect } from "react";
import {
  Server, Users, Terminal, FileCode2, Bell, Database,
  Activity, Globe, RefreshCw, AlertTriangle, TrendingUp,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";

function StatCard({
  label, value, icon: Icon, color = "primary", sub,
}: {
  label: string; value: number | string; icon: React.FC<any>; color?: string; sub?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "text-primary border-primary/20 bg-primary/5",
    destructive: "text-destructive border-destructive/20 bg-destructive/5",
    accent: "text-accent border-accent/20 bg-accent/5",
    yellow: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
  };
  return (
    <div className={cn("border rounded-lg p-4 flex items-start gap-3", colorMap[color])}>
      <div className={cn("p-2 rounded", colorMap[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-mono">{label}</p>
        <p className="text-2xl font-bold font-mono">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-primary font-mono">
      <span className="w-2 h-2 rounded-full bg-primary pulse-dot" />
      LIVE
    </span>
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

export default function Dashboard() {
  const qc = useQueryClient();
  const { data: stats, isLoading, error } = useGetHoneypotStats();

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => {
      qc.invalidateQueries({ queryKey: getGetHoneypotStatsQueryKey() });
    }, 30_000);
    return () => clearInterval(id);
  }, [qc]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-primary font-mono text-sm animate-pulse">Loading honeypot data...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <p className="font-mono text-sm">Failed to load stats</p>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: getGetHoneypotStatsQueryKey() })}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline font-mono"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  const chartData = stats.sessionsByDay.map((d) => ({
    date: d.date.slice(5), // MM-DD
    sessions: d.count,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono text-foreground tracking-wider">HONEYPOT COMMAND CENTER</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Multi-node deception infrastructure — Alpha Unlimited Technologies LLC</p>
        </div>
        <LiveDot />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="ACTIVE NODES" value={stats.activeNodes} icon={Server} color="primary" sub={`${stats.totalNodes} total`} />
        <StatCard label="UNIQUE ATTACKERS" value={stats.totalAttackers} icon={Users} color="destructive" />
        <StatCard label="TOTAL SESSIONS" value={stats.totalSessions} icon={Terminal} color="accent" />
        <StatCard label="UNACK ALERTS" value={stats.unacknowledgedAlerts} icon={Bell} color="yellow" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="COMMANDS CAPTURED" value={stats.totalCommands} icon={FileCode2} color="primary" />
        <StatCard label="PAYLOADS CAPTURED" value={stats.totalFiles} icon={Database} color="destructive" />
        <StatCard label="TOTAL IOCs" value={stats.totalAttackers} icon={Globe} color="accent" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Session timeline */}
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-mono font-medium">Sessions — Last 14 Days</h2>
          </div>
          {chartData.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-muted-foreground text-xs font-mono">
              No sessions yet. Deploy a honeypot node to start capturing data.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0f1219", border: "1px solid #1a2a1a", borderRadius: 4, fontSize: 11 }}
                  cursor={{ fill: "rgba(34,197,94,0.06)" }}
                />
                <Bar dataKey="sessions" radius={[2, 2, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill="hsl(140 70% 45%)" fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top countries */}
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-mono font-medium">Top Attack Origins</h2>
          </div>
          {stats.topCountries.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-muted-foreground text-xs font-mono">
              No attacker geo-data yet.
            </div>
          ) : (
            <div className="space-y-2">
              {stats.topCountries.slice(0, 7).map((c, i) => {
                const max = stats.topCountries[0]?.count ?? 1;
                const pct = Math.round((c.count / max) * 100);
                return (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono">
                    <span className="w-24 truncate text-muted-foreground">{c.country}</span>
                    <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-foreground">{c.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent sessions */}
      <div className="border border-border rounded-lg bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Activity className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-mono font-medium">Recent Sessions</h2>
        </div>
        {stats.recentSessions.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-xs font-mono">
            No sessions captured yet. Configure a honeypot node to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 text-left font-normal">IP</th>
                  <th className="px-4 py-2 text-left font-normal">Protocol</th>
                  <th className="px-4 py-2 text-left font-normal">Username</th>
                  <th className="px-4 py-2 text-left font-normal">Outcome</th>
                  <th className="px-4 py-2 text-left font-normal">Started</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSessions.map((s: any) => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2 text-primary">{s.attacker?.ipAddress ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.protocol?.toUpperCase()}</td>
                    <td className="px-4 py-2 text-foreground">{s.username ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px]",
                        s.outcome === "captured" ? "bg-primary/10 text-primary" :
                        s.outcome === "login_failed" ? "bg-destructive/10 text-destructive" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {s.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(s.startedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
