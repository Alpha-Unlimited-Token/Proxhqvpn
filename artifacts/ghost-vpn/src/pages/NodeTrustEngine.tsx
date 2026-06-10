import { useEffect, useState } from "react";
import { Shield, Wifi, AlertTriangle, CheckCircle2, XCircle, Clock, Activity } from "lucide-react";

interface NodeTrust {
  id: number;
  name: string;
  country: string;
  city: string;
  ipAddress: string;
  latencyMs: number;
  uptimePct: number;
  anomalyCount: number;
  patchStatus: string;
  daemonEnrolled: boolean;
  status: string;
  trustScore: number;
}

interface TrustData {
  nodes: NodeTrust[];
  avgTrust: number;
  total: number;
}

function TrustBar({ score }: { score: number }) {
  const color = score >= 90 ? "bg-green-500" : score >= 70 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-mono w-8 text-right ${score >= 90 ? "text-green-400" : score >= 70 ? "text-yellow-400" : "text-red-400"}`}>
        {score}
      </span>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 90
    ? "bg-green-500/20 text-green-300 border-green-500/30"
    : score >= 70
    ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
    : "bg-red-500/20 text-red-300 border-red-500/30";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono font-bold ${cls}`}>
      {score}
    </span>
  );
}

export default function NodeTrustEngine() {
  const [data, setData] = useState<TrustData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sortKey, setSortKey] = useState<keyof NodeTrust>("trustScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  async function load() {
    try {
      setLoading(true);
      const r = await fetch("/api/node-trust");
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, []);

  const sorted = data
    ? [...data.nodes].sort((a, b) => {
        const av = a[sortKey] as any, bv = b[sortKey] as any;
        return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      })
    : [];

  function toggleSort(key: keyof NodeTrust) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const thCls = "text-left py-2 px-3 text-xs font-semibold text-green-400 uppercase tracking-wider cursor-pointer hover:text-green-300 select-none";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-400 flex items-center gap-2">
          <Shield className="w-6 h-6" /> Node Trust Engine
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Real-time trust scoring for every VPN node — routing decisions use trust + latency + health + load.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Average Trust", value: data ? `${data.avgTrust}` : "—", unit: "/ 100", icon: <Shield className="w-5 h-5 text-green-400" />, color: "green" },
          { label: "Total Nodes",   value: data ? String(data.total) : "—",  unit: "nodes",  icon: <Wifi className="w-5 h-5 text-blue-400" />, color: "blue" },
          { label: "High Trust",    value: data ? String(data.nodes.filter(n => n.trustScore >= 90).length) : "—", unit: "≥ 90", icon: <CheckCircle2 className="w-5 h-5 text-green-400" />, color: "green" },
          { label: "Needs Attention", value: data ? String(data.nodes.filter(n => n.trustScore < 70).length) : "—", unit: "< 70", icon: <AlertTriangle className="w-5 h-5 text-yellow-400" />, color: "yellow" },
        ].map(c => (
          <div key={c.label} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">{c.icon}<span className="text-gray-400 text-xs">{c.label}</span></div>
            <div className="text-2xl font-bold text-white font-mono">{c.value} <span className="text-sm text-gray-500">{c.unit}</span></div>
          </div>
        ))}
      </div>

      {/* Nodes table */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
        {loading && !data ? (
          <div className="flex items-center justify-center h-32 text-gray-500">Loading nodes…</div>
        ) : err ? (
          <div className="flex items-center justify-center h-32 text-red-400">{err}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  {([["name", "Node"], ["country", "Country"], ["latencyMs", "Latency"], ["anomalyCount", "Anomalies"], ["daemonEnrolled", "Enrolled"], ["status", "Status"], ["trustScore", "Trust Score"]] as [keyof NodeTrust, string][]).map(([k, lbl]) => (
                    <th key={k} className={thCls} onClick={() => toggleSort(k)}>
                      {lbl}{sortKey === k ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sorted.map(n => (
                  <tr key={n.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-medium text-white">{n.name}</div>
                      <div className="text-gray-500 text-xs font-mono">{n.ipAddress}</div>
                    </td>
                    <td className="py-3 px-3 text-gray-300">{n.city}, {n.country}</td>
                    <td className="py-3 px-3">
                      <span className={`font-mono text-xs ${n.latencyMs > 200 ? "text-red-400" : n.latencyMs > 100 ? "text-yellow-400" : "text-green-400"}`}>
                        {n.latencyMs}ms
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {n.anomalyCount > 0
                        ? <span className="text-yellow-400 font-mono text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{n.anomalyCount}</span>
                        : <span className="text-green-400 text-xs">0</span>
                      }
                    </td>
                    <td className="py-3 px-3">
                      {n.daemonEnrolled
                        ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                        : <XCircle className="w-4 h-4 text-gray-600" />
                      }
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-mono ${n.status === "active" ? "bg-green-500/20 text-green-300" : "bg-gray-700 text-gray-400"}`}>
                        {n.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 w-36">
                      <div className="flex items-center gap-2">
                        <TrustBar score={n.trustScore} />
                        <ScoreBadge score={n.trustScore} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-600 flex items-center gap-1">
        <Clock className="w-3 h-3" /> Auto-refreshes every 15 seconds.
      </p>
    </div>
  );
}
