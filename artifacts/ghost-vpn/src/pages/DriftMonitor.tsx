import { useEffect, useState } from "react";
import { GitCompare, CheckCircle2, AlertTriangle, RefreshCw, Clock } from "lucide-react";

interface DriftResult {
  drifted: boolean;
  component: string;
  expectedHash: string;
  actualHash: string;
  detectedAt: string;
}

interface DriftSummary {
  total: number;
  drifted: number;
  results: DriftResult[];
}

const COMPONENT_LABELS: Record<string, string> = {
  firewall_policy:     "Firewall Policy",
  node_credentials:    "Node Daemon Credentials",
  device_config_parity: "Device ↔ Config Parity",
};

function HashChip({ hash }: { hash: string }) {
  if (hash === "-") return <span className="text-gray-600 font-mono text-xs">n/a</span>;
  return (
    <span className="font-mono text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
      {hash.substring(0, 16)}…
    </span>
  );
}

function DriftRow({ r }: { r: DriftResult }) {
  return (
    <div className={`border rounded-lg p-4 ${r.drifted ? "bg-yellow-900/10 border-yellow-700/40" : "bg-gray-900 border-gray-700"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {r.drifted
            ? <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            : <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
          }
          <div>
            <div className="font-semibold text-sm text-white">
              {COMPONENT_LABELS[r.component] ?? r.component}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {new Date(r.detectedAt).toLocaleString()}
            </div>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded font-mono ${r.drifted ? "bg-yellow-500/20 text-yellow-300" : "bg-green-500/20 text-green-300"}`}>
          {r.drifted ? "DRIFTED" : "IN SYNC"}
        </span>
      </div>
      {r.drifted && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-gray-500 mb-1">Expected</div>
            <HashChip hash={r.expectedHash} />
          </div>
          <div>
            <div className="text-gray-500 mb-1">Actual</div>
            <HashChip hash={r.actualHash} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function DriftMonitor() {
  const [data, setData]       = useState<DriftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  async function load() {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/drift-monitor/check");
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
      setLastChecked(new Date());
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-green-400 flex items-center gap-2">
            <GitCompare className="w-6 h-6" /> Infrastructure Drift Monitor
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Continuously compares expected state vs actual state across firewall, nodes, and device configs.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 text-sm text-gray-400 hover:text-green-400 transition-colors border border-gray-700 rounded-lg px-3 py-2 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Check Now
        </button>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-white font-mono">{data.total}</div>
            <div className="text-gray-400 text-xs mt-1">Components Checked</div>
          </div>
          <div className={`border rounded-lg p-4 text-center ${data.drifted > 0 ? "bg-yellow-900/10 border-yellow-700/40" : "bg-green-900/10 border-green-700/40"}`}>
            <div className={`text-3xl font-bold font-mono ${data.drifted > 0 ? "text-yellow-400" : "text-green-400"}`}>{data.drifted}</div>
            <div className="text-gray-400 text-xs mt-1">Drift Detected</div>
          </div>
          <div className="bg-green-900/10 border border-green-700/40 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-400 font-mono">{data.total - data.drifted}</div>
            <div className="text-gray-400 text-xs mt-1">In Sync</div>
          </div>
        </div>
      )}

      {err && <div className="bg-red-900/20 border border-red-700/40 text-red-300 rounded-lg px-4 py-3 text-sm">{err}</div>}

      {/* Results */}
      <div className="space-y-3">
        {data?.results.map(r => <DriftRow key={r.component} r={r} />) ?? (
          loading ? <div className="text-center text-gray-500 py-8">Running drift check…</div> : null
        )}
      </div>

      {lastChecked && (
        <p className="text-xs text-gray-600 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Last checked: {lastChecked.toLocaleString()} — auto-checks every 60 seconds.
        </p>
      )}
    </div>
  );
}
