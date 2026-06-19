// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/apiClient";
import {
  Shield,
  ShieldAlert,
  Activity,
  ChevronDown,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Eye,
  Zap,
  Network,
  Radio,
  Database,
} from "lucide-react";

interface KillChainStage {
  id: string;
  name: string;
  description: string;
  ourControls: string[];
  detectionSources: string[];
  activeDetections: number;
  status: "defended";
}

interface KillChainDefenseData {
  stages: KillChainStage[];
  totalActiveDetections: number;
  coveredStages: number;
  totalStages: number;
  coveragePercent: number;
  framework: string;
  detectionSummary: Record<string, number>;
  generatedAt: string;
}

const STAGE_ICONS: Record<string, React.ElementType> = {
  TA0043: Eye,
  TA0001: Lock,
  TA0002: Zap,
  TA0003: Database,
  TA0004: ShieldAlert,
  TA0008: Network,
  TA0011: Radio,
  TA0010: Activity,
};

const STAGE_COLORS: Record<string, string> = {
  TA0043: "border-blue-500/40 bg-blue-500/5",
  TA0001: "border-yellow-500/40 bg-yellow-500/5",
  TA0002: "border-orange-500/40 bg-orange-500/5",
  TA0003: "border-red-500/40 bg-red-500/5",
  TA0004: "border-red-600/40 bg-red-600/5",
  TA0008: "border-purple-500/40 bg-purple-500/5",
  TA0011: "border-pink-500/40 bg-pink-500/5",
  TA0010: "border-rose-500/40 bg-rose-500/5",
};

const ICON_COLORS: Record<string, string> = {
  TA0043: "text-blue-400",
  TA0001: "text-yellow-400",
  TA0002: "text-orange-400",
  TA0003: "text-red-400",
  TA0004: "text-red-500",
  TA0008: "text-purple-400",
  TA0011: "text-pink-400",
  TA0010: "text-rose-400",
};

function StageCard({ stage, index }: { stage: KillChainStage; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = STAGE_ICONS[stage.id] ?? Shield;
  const borderClass = STAGE_COLORS[stage.id] ?? "border-green-500/20 bg-green-500/5";
  const iconClass = ICON_COLORS[stage.id] ?? "text-green-400";

  return (
    <div className="relative">
      {index > 0 && (
        <div className="absolute -top-3 left-8 w-px h-3 bg-green-500/30" />
      )}
      <div
        className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:border-opacity-70 ${borderClass}`}
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex-shrink-0 ${iconClass}`}>
            <Icon size={18} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono text-gray-500 bg-gray-800/60 px-1.5 py-0.5 rounded">
                  {stage.id}
                </span>
                <span className="text-sm font-semibold text-white">{stage.name}</span>
                {stage.activeDetections > 0 && (
                  <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-mono">
                    {stage.activeDetections} active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1 text-green-400">
                  <CheckCircle2 size={13} />
                  <span className="text-[10px] font-mono">defended</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">{stage.description}</p>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pl-7 space-y-3">
            <div>
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2">
                Our Defensive Controls
              </p>
              <div className="flex flex-wrap gap-1.5">
                {stage.ourControls.map(ctrl => (
                  <span
                    key={ctrl}
                    className="text-[11px] bg-green-500/10 text-green-300 border border-green-500/20 px-2 py-0.5 rounded font-mono"
                  >
                    {ctrl}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">
                Detection Sources
              </p>
              <div className="flex gap-1.5">
                {stage.detectionSources.map(src => (
                  <span
                    key={src}
                    className="text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded font-mono"
                  >
                    {src}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function KillChainDefender() {
  const [data, setData] = useState<KillChainDefenseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const d = await apiFetch<KillChainDefenseData>("/api/siem/kill-chain-defense");
      setData(d);
    } catch (e: any) {
      setError(e.message ?? "Failed to load kill chain defense data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const detectionEntries = data
    ? Object.entries(data.detectionSummary).filter(([, v]) => v > 0)
    : [];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Shield className="text-green-400" size={22} />
            <h1 className="text-xl font-bold text-white">Kill Chain Defender</h1>
          </div>
          <p className="text-sm text-gray-400">
            MITRE ATT&amp;CK kill chain coverage — each stage mapped to ProxhqVPN defensive controls
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-sm text-gray-300 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Coverage summary */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Coverage</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{data.coveragePercent}%</p>
            <p className="text-[11px] text-gray-500">{data.framework}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Stages Defended</p>
            <p className="text-2xl font-bold text-white mt-1">
              {data.coveredStages}<span className="text-gray-600 text-base">/{data.totalStages}</span>
            </p>
            <p className="text-[11px] text-gray-500">All ATT&amp;CK stages</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Active Detections</p>
            <p className={`text-2xl font-bold mt-1 ${data.totalActiveDetections > 0 ? "text-red-400" : "text-green-400"}`}>
              {data.totalActiveDetections}
            </p>
            <p className="text-[11px] text-gray-500">Last 7 days</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Detection Sources</p>
            <p className="text-2xl font-bold text-white mt-1">{Object.keys(data.detectionSummary).length}</p>
            <p className="text-[11px] text-gray-500">Integrated sources</p>
          </div>
        </div>
      )}

      {/* Active detections breakdown */}
      {detectionEntries.length > 0 && (
        <div className="bg-gray-900 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-red-400" />
            <p className="text-sm font-semibold text-red-400">Active Detections by Source</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {detectionEntries.map(([src, count]) => (
              <div key={src} className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded px-3 py-1.5">
                <span className="text-[11px] font-mono text-gray-400">{src}</span>
                <span className="text-sm font-bold text-red-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading / Error states */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-gray-400">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-sm">Loading kill chain defense map...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Kill chain stages */}
      {data && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <p className="text-[11px] font-mono text-gray-500 uppercase tracking-wider">
              Attack Kill Chain — {data.stages.length} stages
            </p>
            <div className="flex-1 h-px bg-gray-800" />
            <p className="text-[10px] text-gray-600">Click any stage to expand controls</p>
          </div>
          <div className="space-y-3">
            {data.stages.map((stage, i) => (
              <StageCard key={stage.id} stage={stage} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ChatGPT reference note */}
      {data && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mt-2">
          <p className="text-[11px] font-mono text-gray-600">
            Defensive controls derived from security analysis of the ProxhqVPN architecture threat model.
            Framework: MITRE ATT&amp;CK Enterprise. Updated: {data ? new Date(data.generatedAt).toLocaleString() : "—"}
          </p>
        </div>
      )}
    </div>
  );
}
