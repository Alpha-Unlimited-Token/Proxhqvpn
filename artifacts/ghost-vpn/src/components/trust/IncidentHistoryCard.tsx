// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Bell, CheckCircle2 } from "lucide-react";

interface Incident {
  title: string;
  severity: string;
  startedAt: string;
}

interface Props {
  openCount: number;
  resolvedCount: number;
  activeIncidents: Incident[];
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-400 bg-red-900/20 border-red-700/40",
  high:     "text-orange-400 bg-orange-900/20 border-orange-700/40",
  medium:   "text-yellow-400 bg-yellow-900/20 border-yellow-700/40",
  low:      "text-blue-400 bg-blue-900/20 border-blue-700/40",
};

export default function IncidentHistoryCard({ openCount, resolvedCount, activeIncidents }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <Bell className="w-5 h-5 text-primary" />
        <span className="text-sm font-semibold text-white/90">Incident History</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 text-center">
          <div className={`text-3xl font-black ${openCount > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {openCount}
          </div>
          <div className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">Open</div>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 text-center">
          <div className="text-3xl font-black text-white/60">{resolvedCount}</div>
          <div className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">Resolved</div>
        </div>
      </div>

      {activeIncidents.length > 0 ? (
        <div className="space-y-2">
          {activeIncidents.map((inc, i) => (
            <div key={i} className={`rounded-lg border px-3 py-2.5 ${SEVERITY_COLOR[inc.severity] ?? SEVERITY_COLOR.low}`}>
              <div className="text-xs font-medium">{inc.title}</div>
              <div className="text-[10px] opacity-60 mt-0.5">
                Since {new Date(inc.startedAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-lg bg-emerald-900/10 border border-emerald-700/25 px-3.5 py-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs text-emerald-300/80">No active incidents. All systems nominal.</span>
        </div>
      )}
    </div>
  );
}
