// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { Shield, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Hash, Activity } from "lucide-react";

interface Metric { label: string; score: number; maxScore: number; status: "ok" | "warn" | "fail"; detail: string }
interface Scorecard {
  score: number; maxScore: number; status: "trusted" | "warning" | "failed";
  grade: string; metrics: Metric[]; hashChainValid: boolean; computedAt: string;
  openFindings: { critical: number; high: number; medium: number; low: number; total: number };
  latestRuns: Array<{ run_type: string; status: string; score: number; started_at: string }>;
}

function GradeCircle({ score, max, grade }: { score: number; max: number; grade: string }) {
  const pct   = max > 0 ? score / max : 0;
  const r     = 60;
  const circ  = 2 * Math.PI * r;
  const dash  = circ * pct;
  const color = pct >= 0.9 ? "#22c55e" : pct >= 0.7 ? "#eab308" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="absolute -rotate-90" width="144" height="144" viewBox="0 0 144 144">
        <circle cx="72" cy="72" r={r} fill="none" stroke="#1f2937" strokeWidth="10" />
        <circle cx="72" cy="72" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease" }} />
      </svg>
      <div className="text-center z-10">
        <div className="text-3xl font-bold text-white font-mono">{score}</div>
        <div className="text-gray-400 text-xs">/ {max}</div>
        <div className={`text-xl font-bold ${pct >= 0.9 ? "text-green-400" : pct >= 0.7 ? "text-yellow-400" : "text-red-400"}`}>{grade}</div>
      </div>
    </div>
  );
}

function MetricBar({ m }: { m: Metric }) {
  const pct   = m.maxScore > 0 ? m.score / m.maxScore : 0;
  const color = m.status === "ok" ? "bg-green-500" : m.status === "warn" ? "bg-yellow-500" : "bg-red-500";
  const Icon  = m.status === "ok" ? CheckCircle2 : m.status === "warn" ? AlertTriangle : XCircle;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-sm">
        <span className="flex items-center gap-1.5 text-gray-300">
          <Icon className={`w-3.5 h-3.5 ${m.status === "ok" ? "text-green-400" : m.status === "warn" ? "text-yellow-400" : "text-red-400"}`} />
          {m.label}
        </span>
        <span className="text-gray-400 text-xs">{m.score}/{m.maxScore}</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct * 100}%` }} />
      </div>
      <p className="text-xs text-gray-500">{m.detail}</p>
    </div>
  );
}

export default function ValidationScorecard() {
  const [data, setData]       = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/validation/scorecard")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(`Failed to load scorecard (${e})`))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400"><RefreshCw className="animate-spin mr-2" />Loading scorecard…</div>;
  if (error)   return <div className="p-4 bg-red-900/20 border border-red-700/40 rounded text-red-400 text-sm">{error}</div>;
  if (!data)   return null;

  const statusColor = data.status === "trusted" ? "text-green-400" : data.status === "warning" ? "text-yellow-400" : "text-red-400";
  const statusBg    = data.status === "trusted" ? "border-green-700/40 bg-green-900/10" : data.status === "warning" ? "border-yellow-700/40 bg-yellow-900/10" : "border-red-700/40 bg-red-900/10";

  return (
    <div className="space-y-6">
      {/* Main score card */}
      <div className={`border ${statusBg} rounded-xl p-6 flex flex-col sm:flex-row gap-8 items-center sm:items-start`}>
        <GradeCircle score={data.score} max={data.maxScore} grade={data.grade} />
        <div className="flex-1 space-y-4">
          <div>
            <div className={`text-xl font-bold ${statusColor} capitalize`}>{data.status}</div>
            <div className="text-gray-400 text-sm">Computed {new Date(data.computedAt).toLocaleString()}</div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            {[
              { label: "Critical", val: data.openFindings.critical, c: data.openFindings.critical > 0 ? "text-red-400" : "text-gray-400" },
              { label: "High",     val: data.openFindings.high,     c: data.openFindings.high     > 0 ? "text-orange-400" : "text-gray-400" },
              { label: "Medium",   val: data.openFindings.medium,   c: data.openFindings.medium   > 0 ? "text-yellow-400" : "text-gray-400" },
              { label: "Low",      val: data.openFindings.low,      c: "text-gray-400" },
            ].map(({ label, val, c }) => (
              <div key={label} className="text-center">
                <div className={`text-2xl font-bold font-mono ${c}`}>{val}</div>
                <div className="text-gray-500 text-xs">{label}</div>
              </div>
            ))}
            <div className="text-center">
              <div className={`text-2xl font-bold font-mono ${data.hashChainValid ? "text-green-400" : "text-red-400"}`}>
                {data.hashChainValid ? "✓" : "✗"}
              </div>
              <div className="flex items-center gap-1 text-gray-500 text-xs"><Hash className="w-3 h-3" />Chain</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {data.metrics.map(m => <MetricBar key={m.label} m={m} />)}
          </div>
        </div>
      </div>

      {/* Latest runs */}
      {data.latestRuns.length > 0 && (
        <div className="bg-gray-900/40 border border-gray-700/40 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-green-400" />Latest Runs</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {data.latestRuns.map(r => (
              <div key={r.run_type} className="bg-gray-800/60 rounded-lg p-2.5 text-xs">
                <div className="font-mono text-gray-300 uppercase tracking-wide">{r.run_type}</div>
                <div className={`font-bold mt-0.5 ${r.status === "passed" ? "text-green-400" : r.status === "failed" ? "text-red-400" : r.status === "warning" ? "text-yellow-400" : "text-gray-400"}`}>{r.status}</div>
                <div className="text-gray-500 mt-0.5">{r.score}% · {new Date(r.started_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </button>
      </div>
    </div>
  );
}
