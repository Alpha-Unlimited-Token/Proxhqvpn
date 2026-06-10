import { useEffect, useState } from "react";
import { Server, Database, Wifi, Shield, CreditCard, Lock, RefreshCw, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";

type NodeStatus = "ok" | "error" | "unknown" | "unconfigured";

type GraphNode = {
  id: string;
  label: string;
  status: NodeStatus;
};

type Graph = {
  nodes: GraphNode[];
  edges: [string, string][];
};

const STATUS_ICON: Record<NodeStatus, React.ReactNode> = {
  ok:           <CheckCircle2 className="w-4 h-4 text-green-400" />,
  error:        <AlertCircle className="w-4 h-4 text-red-400" />,
  unknown:      <HelpCircle className="w-4 h-4 text-gray-500" />,
  unconfigured: <HelpCircle className="w-4 h-4 text-yellow-500" />,
};

const STATUS_BADGE: Record<NodeStatus, string> = {
  ok:           "text-green-400 border-green-500/30 bg-green-500/5",
  error:        "text-red-400 border-red-500/30 bg-red-500/5",
  unknown:      "text-gray-400 border-gray-700 bg-black/30",
  unconfigured: "text-yellow-400 border-yellow-500/30 bg-yellow-500/5",
};

const NODE_ICON: Record<string, React.ReactNode> = {
  api:      <Server className="w-5 h-5" />,
  db:       <Database className="w-5 h-5" />,
  wireguard:<Wifi className="w-5 h-5" />,
  daemon:   <Server className="w-5 h-5" />,
  firewall: <Shield className="w-5 h-5" />,
  stripe:   <CreditCard className="w-5 h-5" />,
  clerk:    <Lock className="w-5 h-5" />,
};

export default function DependencyMap() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/dependency-map/graph", { credentials: "include" });
    const d = await r.json();
    setGraph(d);
    setLastChecked(new Date());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const nodeMap = Object.fromEntries((graph?.nodes ?? []).map((n) => [n.id, n]));

  return (
    <div className="p-6 space-y-6 font-mono">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server className="w-6 h-6 text-green-400" />
          <h1 className="text-xl font-bold text-green-300">Dependency Health Graph</h1>
        </div>
        <div className="flex items-center gap-3">
          {lastChecked && <span className="text-xs text-gray-500">Checked {lastChecked.toLocaleTimeString()}</span>}
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs border border-green-500/30 rounded px-3 py-1 text-green-400 hover:bg-green-500/10 disabled:opacity-50">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Node grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {(graph?.nodes ?? []).map((node) => (
          <div key={node.id} className={`rounded border p-4 flex items-center gap-3 ${STATUS_BADGE[node.status]}`}>
            <div className="opacity-60">{NODE_ICON[node.id] ?? <Server className="w-5 h-5" />}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{node.label}</div>
              <div className="text-xs opacity-70">{node.status}</div>
            </div>
            {STATUS_ICON[node.status]}
          </div>
        ))}
      </div>

      {/* Edge list */}
      {graph && (
        <div className="rounded border border-green-500/20 bg-black/40">
          <h2 className="px-4 py-3 text-green-300 font-semibold border-b border-green-500/20 text-sm">Service Dependencies</h2>
          <div className="p-4 space-y-2">
            {graph.edges.map(([from, to], i) => {
              const fromNode = nodeMap[from];
              const toNode   = nodeMap[to];
              const healthy  = fromNode?.status === "ok" && (toNode?.status === "ok" || toNode?.status === "unknown");
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className={fromNode?.status === "ok" ? "text-green-400" : "text-red-400"}>{fromNode?.label ?? from}</span>
                  <span className={`text-lg ${healthy ? "text-green-600" : "text-red-600"}`}>→</span>
                  <span className={toNode?.status === "ok" ? "text-green-400" : toNode?.status === "unknown" ? "text-gray-400" : "text-red-400"}>{toNode?.label ?? to}</span>
                  {toNode?.status === "error" && <span className="text-xs text-red-400 border border-red-500/30 rounded px-1">DEGRADED</span>}
                  {toNode?.status === "unconfigured" && <span className="text-xs text-yellow-400 border border-yellow-500/30 rounded px-1">NOT CONFIGURED</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
