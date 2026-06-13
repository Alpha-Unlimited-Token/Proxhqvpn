// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { CheckCircle2, XCircle, AlertTriangle, Activity } from "lucide-react";

interface Props {
  checksPerformed: number;
  passed: number;
  failed: number;
  warning: number;
  lastValidationAt: string | null;
  checksTypes: string[];
}

export default function ValidationSummaryCard({
  checksPerformed, passed, failed, warning, lastValidationAt, checksTypes,
}: Props) {
  const items = [
    { label: "Passed",   value: passed,  icon: CheckCircle2,   color: "text-emerald-400" },
    { label: "Warnings", value: warning, icon: AlertTriangle,  color: "text-yellow-400"  },
    { label: "Failed",   value: failed,  icon: XCircle,        color: "text-red-400"     },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <Activity className="w-5 h-5 text-primary" />
        <span className="text-sm font-semibold text-white/90">Validation Checks</span>
        {checksPerformed > 0 && (
          <span className="ml-auto text-xs text-white/40">{checksPerformed} total</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {items.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 rounded-lg bg-white/[0.04] py-3 px-2">
            <Icon className={`w-4 h-4 ${color}`} />
            <span className={`text-2xl font-black ${color}`}>{value}</span>
            <span className="text-[10px] text-white/40 uppercase tracking-wide">{label}</span>
          </div>
        ))}
      </div>

      {checksTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {checksTypes.map(t => (
            <span key={t} className="text-[10px] text-white/50 bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded-full">
              {t}
            </span>
          ))}
        </div>
      )}

      {lastValidationAt ? (
        <p className="text-[11px] text-white/30">
          Last run: {new Date(lastValidationAt).toLocaleString()}
        </p>
      ) : (
        <p className="text-[11px] text-white/30">No validation runs in the past 7 days</p>
      )}
    </div>
  );
}
