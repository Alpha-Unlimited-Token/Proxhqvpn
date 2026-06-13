// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { ClipboardCheck, Circle, CheckCircle2, Clock } from "lucide-react";

interface ComplianceItem {
  name: string;
  status: "active" | "in_progress" | "planned";
}

interface Props {
  items: ComplianceItem[];
}

const STATUS_CONFIG = {
  active:      { label: "Active",      icon: CheckCircle2, color: "text-emerald-400" },
  in_progress: { label: "In Progress", icon: Clock,        color: "text-yellow-400"  },
  planned:     { label: "Planned",     icon: Circle,       color: "text-white/30"    },
};

export default function ComplianceRoadmapCard({ items }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <ClipboardCheck className="w-5 h-5 text-primary" />
        <span className="text-sm font-semibold text-white/90">Compliance Roadmap</span>
      </div>

      <div className="space-y-2.5">
        {items.map(item => {
          const cfg  = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.planned;
          const Icon = cfg.icon;
          return (
            <div key={item.name} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3.5 py-2.5 border border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${cfg.color} shrink-0`} />
                <span className="text-sm text-white/80">{item.name}</span>
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-white/30">
        Compliance program under ongoing development
      </p>
    </div>
  );
}
