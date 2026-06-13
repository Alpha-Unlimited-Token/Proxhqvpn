// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Gauge } from "lucide-react";

interface Props {
  uptime30d: number;
  uptime90d: number;
  uptime365d: number;
}

function UptimeBar({ label, value }: { label: string; value: number }) {
  const color = value >= 99.9 ? "bg-emerald-500" : value >= 99 ? "bg-yellow-500" : "bg-red-500";
  const text  = value >= 99.9 ? "text-emerald-400" : value >= 99 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-white/60">{label}</span>
        <span className={`font-bold tabular-nums ${text}`}>{value.toFixed(2)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function UptimeMetricsCard({ uptime30d, uptime90d, uptime365d }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <Gauge className="w-5 h-5 text-primary" />
        <span className="text-sm font-semibold text-white/90">Uptime</span>
      </div>
      <div className="space-y-4">
        <UptimeBar label="Last 30 days"  value={uptime30d}  />
        <UptimeBar label="Last 90 days"  value={uptime90d}  />
        <UptimeBar label="Last 365 days" value={uptime365d} />
      </div>
      <p className="text-[11px] text-white/30">
        Includes API, VPN nodes, and authentication services
      </p>
    </div>
  );
}
