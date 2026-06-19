// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Play, ChevronDown, ChevronRight } from "lucide-react";

interface Run {
  id: string; run_type: string; status: string; tool_name: string; tool_version: string | null;
  score: number; max_score: number; summary: string | null; started_at: string; completed_at: string | null;
  finding_count: number; critical_count: number; high_count: number; result_hash: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  passed:  "text-green-400 bg-green-900/20 border-green-700/40",
  failed:  "text-red-400 bg-red-900/20 border-red-700/40",
  warning: "text-yellow-400 bg-yellow-900/20 border-yellow-700/40",
  error:   "text-orange-400 bg-orange-900/20 border-orange-700/40",
  queued:  "text-blue-400 bg-blue-900/20 border-blue-700/40",
  running: "text-cyan-400 bg-cyan-900/20 border-cyan-700/40",
};

const RUN_TYPES = ["uptime","tls","headers","wireguard","synthetic","zap","trivy","semgrep","k6","dependency"];

export default function ValidationRunTable() {
  const [runs, setRuns]           = useState<Run[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [runType, setRunType]     = useState("");
  const [triggering, setTriggering] = useState(false);
  const [targetId, setTargetId]   = useState("");
  const [triggerType, setTriggerType] = useState("uptime");
  const [msg, setMsg]             = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const qs = runType ? `?run_type=${runType}` : "";
    fetch(`/api/validation/runs${qs}`)
      .then(r => r.json())
      .then(d => setRuns(d.runs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [runType]);

  useEffect(() => { load(); }, [load]);

  const triggerRun = async () => {
    if (!targetId.trim()) { setMsg("Enter a target ID first"); return; }
    setTriggering(true); setMsg("");
    const r = await fetch("/api/validation/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: targetId.trim(), runType: triggerType }),
    });
    const d = await r.json();
    setMsg(r.ok ? `Queued: ${d.runId}` : d.error ?? "Error");
    setTriggering(false);
    setTimeout(load, 2000);
  };

  return (
    <div className="space-y-4">
      {/* Manual trigger */}
      <div className="bg-gray-900/40 border border-gray-700/40 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2"><Play className="w-4 h-4 text-green-400" />Manual Run</h3>
        <div className="flex flex-wrap gap-2">
          <input
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            placeholder="Target UUID"
            className="flex-1 min-w-48 bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          />
          <select value={triggerType} onChange={e => setTriggerType(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-green-500">
            {RUN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={triggerRun} disabled={triggering}
            className="px-4 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm rounded flex items-center gap-1.5 transition-colors">
            {triggering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Trigger
          </button>
        </div>
        {msg && <p className="text-xs text-gray-400 font-mono">{msg}</p>}
      </div>

      {/* Filter + refresh */}
      <div className="flex items-center gap-3">
        <select value={runType} onChange={e => setRunType(e.target.value)}
          className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none">
          <option value="">All types</option>
          {RUN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={load} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-400">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
        <span className="text-xs text-gray-500">{runs.length} run{runs.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="bg-gray-900/40 border border-gray-700/40 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-700/60">
            <tr className="text-xs text-gray-400 uppercase tracking-wide">
              <th className="px-4 py-3 text-left w-6"></th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Score</th>
              <th className="px-4 py-3 text-left">Findings</th>
              <th className="px-4 py-3 text-left">Started</th>
              <th className="px-4 py-3 text-left">Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : runs.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No runs yet</td></tr>
            ) : runs.map(r => (
              <>
                <tr key={r.id} className="hover:bg-gray-800/40 cursor-pointer" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <td className="px-4 py-3 text-gray-500">
                    {expanded === r.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-300 uppercase text-xs">{r.run_type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[r.status] ?? "text-gray-400"}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-300">{r.score}/{r.max_score}</td>
                  <td className="px-4 py-3">
                    <span className={r.critical_count > 0 ? "text-red-400" : r.high_count > 0 ? "text-orange-400" : "text-gray-400"}>
                      {r.finding_count} {r.critical_count > 0 && <span className="text-xs">(crit:{r.critical_count})</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(r.started_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.result_hash?.slice(0, 12)}…</td>
                </tr>
                {expanded === r.id && (
                  <tr key={`${r.id}-exp`} className="bg-gray-800/20">
                    <td colSpan={7} className="px-6 py-3 text-xs text-gray-400 space-y-1">
                      <div><span className="text-gray-500">Tool:</span> {r.tool_name} {r.tool_version ?? ""}</div>
                      {r.summary && <div><span className="text-gray-500">Summary:</span> {r.summary}</div>}
                      {r.result_hash && <div className="font-mono text-gray-600"><span className="text-gray-500">Hash:</span> {r.result_hash}</div>}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
