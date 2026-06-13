// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Shield, TrendingUp } from "lucide-react";

interface Props {
  score: number;
  maxScore: number;
  status: "trusted" | "monitoring" | "incident" | "initializing";
  lastUpdated: string | null;
}

const STATUS_MAP = {
  trusted:      { label: "Trusted",      color: "text-emerald-400", ring: "border-emerald-500/40", bg: "bg-emerald-900/15" },
  monitoring:   { label: "Monitoring",   color: "text-yellow-400",  ring: "border-yellow-500/40",  bg: "bg-yellow-900/15"  },
  incident:     { label: "Incident",     color: "text-red-400",     ring: "border-red-500/40",     bg: "bg-red-900/15"     },
  initializing: { label: "Initializing", color: "text-gray-400",    ring: "border-gray-500/40",    bg: "bg-gray-900/15"    },
};

export default function TrustScoreCard({ score, maxScore, status, lastUpdated }: Props) {
  const cfg  = STATUS_MAP[status] ?? STATUS_MAP.initializing;
  const pct  = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const bar  = pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className={`rounded-xl border ${cfg.ring} ${cfg.bg} p-6 flex flex-col gap-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Shield className={`w-5 h-5 ${cfg.color}`} />
          <span className="text-sm font-semibold text-white/90">Trust Score</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.ring} ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      <div className="flex items-end gap-3">
        <span className={`text-5xl font-black tracking-tight ${cfg.color}`}>{pct}</span>
        <span className="text-xl text-white/40 mb-1.5">/100</span>
        <TrendingUp className="w-4 h-4 text-emerald-400 mb-2 ml-auto" />
      </div>

      <div>
        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full ${bar} transition-all duration-700`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-white/30">
          <span>0</span>
          <span>{score} / {maxScore} points</span>
          <span>100</span>
        </div>
      </div>

      {lastUpdated && (
        <p className="text-[11px] text-white/30">
          Updated {new Date(lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  );
}
