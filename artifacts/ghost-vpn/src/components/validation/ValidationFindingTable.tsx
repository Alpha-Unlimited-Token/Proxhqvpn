// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, ShieldAlert } from "lucide-react";

interface Finding {
  id: string; title: string; severity: string; category: string | null;
  description: string | null; status: string; created_at: string; run_id: string | null;
}

const SEV_CONFIG: Record<string, { color: string; icon: React.ReactElement }> = {
  critical: { color: "text-red-400 bg-red-900/20 border-red-700/40",    icon: <XCircle className="w-3.5 h-3.5 text-red-400" /> },
  high:     { color: "text-orange-400 bg-orange-900/20 border-orange-700/40", icon: <ShieldAlert className="w-3.5 h-3.5 text-orange-400" /> },
  medium:   { color: "text-yellow-400 bg-yellow-900/20 border-yellow-700/40", icon: <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" /> },
  low:      { color: "text-blue-400 bg-blue-900/20 border-blue-700/40",  icon: <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> },
  info:     { color: "text-gray-400 bg-gray-900/20 border-gray-700/40",  icon: <CheckCircle2 className="w-3.5 h-3.5 text-gray-400" /> },
};

export default function ValidationFindingTable() {
  const [findings, setFindings]   = useState<Finding[]>([]);
  const [loading, setLoading]     = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [severity, setSeverity]   = useState("");

  const load = () => {
    setLoading(true);
    const qs = severity ? `?severity=${severity}` : "";
    fetch(`/api/validation/findings${qs}`)
      .then(r => r.json())
      .then(d => setFindings(d.findings ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [severity]);

  const resolve = async (id: string) => {
    setResolving(id);
    await fetch(`/api/validation/findings/${id}/resolve`, { method: "POST" }).catch(() => {});
    setResolving(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={severity} onChange={e => setSeverity(e.target.value)}
          className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none">
          <option value="">All severities</option>
          {["critical","high","medium","low","info"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-400">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
        <span className="text-xs text-gray-500">{findings.length} open finding{findings.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading…</div>
        ) : findings.length === 0 ? (
          <div className="text-center py-12 text-gray-500 flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
            No open findings
          </div>
        ) : findings.map(f => {
          const cfg = SEV_CONFIG[f.severity] ?? SEV_CONFIG.info;
          return (
            <div key={f.id} className={`border ${cfg.color} rounded-lg p-4 flex items-start justify-between gap-4`}>
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {cfg.icon}
                <div className="min-w-0">
                  <div className="font-medium text-sm text-white truncate">{f.title}</div>
                  {f.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{f.description}</p>}
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                    <span className="uppercase font-mono">{f.severity}</span>
                    {f.category && <><span>·</span><span>{f.category}</span></>}
                    <span>·</span>
                    <span>{new Date(f.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => resolve(f.id)}
                disabled={resolving === f.id}
                className="shrink-0 px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-xs text-gray-300 rounded transition-colors"
              >
                {resolving === f.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Resolve"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
