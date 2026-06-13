// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { Shield, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Play, Clock, Hash } from "lucide-react";
import ValidationScorecard from "@/components/validation/ValidationScorecard";
import ValidationRunTable from "@/components/validation/ValidationRunTable";
import ValidationFindingTable from "@/components/validation/ValidationFindingTable";
import ValidationTargetForm from "@/components/validation/ValidationTargetForm";
import ValidationScheduleForm from "@/components/validation/ValidationScheduleForm";

type Tab = "scorecard" | "runs" | "findings" | "targets" | "schedules";

export default function ValidationDashboard() {
  const [tab, setTab] = useState<Tab>("scorecard");

  const tabs: { id: Tab; label: string; icon: React.ReactElement }[] = [
    { id: "scorecard",  label: "Scorecard",  icon: <Shield className="w-4 h-4" /> },
    { id: "runs",       label: "Runs",        icon: <Play className="w-4 h-4" /> },
    { id: "findings",   label: "Findings",    icon: <AlertTriangle className="w-4 h-4" /> },
    { id: "targets",    label: "Targets",     icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: "schedules",  label: "Schedules",   icon: <Clock className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Hash className="w-6 h-6 text-green-400" />
            Continuous Validation Framework
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Live security, infrastructure &amp; VPN validation — ProxhqVPN systems only.
            Hash-chained immutable results.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-700/60 pb-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t transition-colors
              ${tab === t.id
                ? "bg-gray-800 text-green-400 border-b-2 border-green-400"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"}`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {tab === "scorecard"  && <ValidationScorecard />}
        {tab === "runs"       && <ValidationRunTable />}
        {tab === "findings"   && <ValidationFindingTable />}
        {tab === "targets"    && <ValidationTargetForm />}
        {tab === "schedules"  && <ValidationScheduleForm />}
      </div>
    </div>
  );
}
