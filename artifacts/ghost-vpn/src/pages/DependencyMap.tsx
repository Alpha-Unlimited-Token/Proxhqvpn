import { useEffect, useState } from "react";
import {
  Server, Database, Wifi, Shield, CreditCard, Lock,
  RefreshCw, CheckCircle2, AlertCircle, HelpCircle,
  Activity, Eye, Zap, Globe, FlaskConical, Cpu,
  AlertTriangle, GitBranch,
} from "lucide-react";

type ServiceStatus = "ok" | "error" | "unknown" | "unconfigured" | "degraded";

type ServiceNode = {
  id:         string;
  label:      string;
  category:   "core" | "enterprise" | "labs" | "infra" | "external";
  status:     ServiceStatus;
  latencyMs?: number;
  detail?:    string;
};

type Graph = {
  nodes:         ServiceNode[];
  edges:         [string, string][];
  healthSummary: { total: number; ok: number; degraded: number; error: number; unknown: number };
  checkedAt?:    string;
};

const STATUS_ICON: Record<ServiceStatus, React.ReactNode> = {
  ok:           <CheckCircle2 className="w-4 h-4 text-green-400" />,
  error:        <AlertCircle className="w-4 h-4 text-red-400" />,
  degraded:     <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  unknown:      <HelpCircle className="w-4 h-4 text-gray-500" />,
  unconfigured: <HelpCircle className="w-4 h-4 text-yellow-500" />,
};

const STATUS_BADGE: Record<ServiceStatus, string> = {
  ok:           "border-green-500/30 bg-green-500/5 text-green-300",
  error:        "border-red-500/30 bg-red-500/5 text-red-300",
  degraded:     "border-yellow-500/30 bg-yellow-500/5 text-yellow-300",
  unknown:      "border-gray-700 bg-black/30 text-gray-400",
  unconfigured: "border-yellow-500/30 bg-yellow-500/5 text-yellow-300",
};

const CATEGORY_LABEL: Record<string, string> = {
  core:       "Core",
  enterprise: "Enterprise",
  labs:       "Labs",
  infra:      "Infrastructure",
  external:   "External",
};

const CATEGORY_COLOR: Record<string, string> = {
  core:       "text-green-400 border-green-500/20",
  enterprise: "text-blue-400 border-blue-500/20",
  labs:       "text-purple-400 border-purple-500/20",
  infra:      "text-gray-400 border-gray-600/40",
  external:   "text-yellow-400 border-yellow-500/20",
};

const NODE_ICON: Record<string, React.ReactNode> = {
  api:          <Server className="w-5 h-5" />,
  db:           <Database className="w-5 h-5" />,
  wireguard:    <Wifi className="w-5 h-5" />,
  daemon:       <Cpu className="w-5 h-5" />,
  firewall:     <Shield className="w-5 h-5" />,
  ztna:         <Lock className="w-5 h-5" />,
  beacons:      <Eye className="w-5 h-5" />,
  canary:       <Zap className="w-5 h-5" />,
  siem:         <Activity className="w-5 h-5" />,
  audit_chain:  <GitBranch className="w-5 h-5" />,
  event_graph:  <Activity className="w-5 h-5" />,
  drift:        <GitBranch className="w-5 h-5" />,
  stripe:       <CreditCard className="w-5 h-5" />,
  clerk:        <Lock className="w-5 h-5" />,
  splunk:       <Activity className="w-5 h-5" />,
  quantum_audit:<FlaskConical className="w-5 h-5" />,
  sig_engine:   <Cpu className="w-5 h-5" />,
};

function StatusPill({ status }: { status: ServiceStatus }) {
  const styles: Record<ServiceStatus, string> = {
    ok:           "bg-green-500/20 text-green-300",
    error:        "bg-red-500/20 text-red-300",
    degraded:     "bg-yellow-500/20 text-yellow-300",
    unknown:      "bg-gray-700 text-gray-400",
    unconfigured: "bg-yellow-500/10 text-yellow-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-mono uppercase ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function DependencyMap() {
  const [graph, setGraph]     = useState<Graph | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/dependency-map/graph", { credentials: "include" });
      const d = await r.json();
      setGraph(d);
      setLastChecked(new Date());
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const allCategories = ["all", ...Array.from(new Set((graph?.nodes ?? []).map(n => n.category)))];
  const filteredNodes = activeCategory === "all"
    ? (graph?.nodes ?? [])
    : (graph?.nodes ?? []).filter(n => n.category === activeCategory);

  const nodeMap = Object.fromEntries((graph?.nodes ?? []).map(n => [n.id, n]));
  const hs = graph?.healthSummary;

  return (
    <div className="p-6 space-y-6 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-green-400" />
          <div>
            <h1 className="text-xl font-bold text-green-300">Service Dependency Graph</h1>
            <p className="text-xs text-gray-500 mt-0.5">Live health checks across all platform services</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastChecked && <span className="text-xs text-gray-500">Checked {lastChecked.toLocaleTimeString()}</span>}
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs border border-green-500/30 rounded px-3 py-1 text-green-400 hover:bg-green-500/10 disabled:opacity-50">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Health summary */}
      {hs && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">{hs.total}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total</div>
          </div>
          <div className="bg-green-900/10 border border-green-700/40 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-400">{hs.ok}</div>
            <div className="text-xs text-gray-500 mt-0.5">Healthy</div>
          </div>
          <div className="bg-yellow-900/10 border border-yellow-700/40 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">{hs.degraded}</div>
            <div className="text-xs text-gray-500 mt-0.5">Degraded</div>
          </div>
          <div className="bg-red-900/10 border border-red-700/40 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-400">{hs.error}</div>
            <div className="text-xs text-gray-500 mt-0.5">Error</div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-400">{hs.unknown}</div>
            <div className="text-xs text-gray-500 mt-0.5">Unknown</div>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {allCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`text-xs px-3 py-1 rounded border transition-colors capitalize ${
              activeCategory === cat
                ? "bg-green-500/20 border-green-500/40 text-green-300"
                : "border-gray-700 text-gray-400 hover:border-gray-600"
            }`}
          >
            {cat === "all" ? "All Services" : CATEGORY_LABEL[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Service nodes grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredNodes.map((node) => (
          <div key={node.id} className={`rounded-lg border p-4 flex items-start gap-3 ${STATUS_BADGE[node.status]}`}>
            <div className="opacity-60 mt-0.5 flex-shrink-0">
              {NODE_ICON[node.id] ?? <Server className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <div className="text-sm font-medium truncate">{node.label}</div>
                {STATUS_ICON[node.status]}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <StatusPill status={node.status} />
                <span className={`text-xs capitalize ${CATEGORY_COLOR[node.category] ?? "text-gray-500"}`}>
                  {CATEGORY_LABEL[node.category] ?? node.category}
                </span>
              </div>
              {node.detail && (
                <p className="text-xs text-gray-500 mt-1 truncate">{node.detail}</p>
              )}
              {node.latencyMs != null && node.latencyMs > 0 && (
                <p className="text-xs text-gray-600 mt-0.5">{node.latencyMs}ms</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Dependency edges */}
      {graph && (
        <div className="rounded-lg border border-green-500/20 bg-black/40">
          <h2 className="px-4 py-3 text-green-300 font-semibold border-b border-green-500/20 text-sm">
            Service Dependencies ({graph.edges.length} connections)
          </h2>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {graph.edges.map(([from, to], i) => {
              const fromNode = nodeMap[from];
              const toNode   = nodeMap[to];
              const healthy  = fromNode?.status === "ok" && (toNode?.status === "ok" || toNode?.status === "unknown");
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={fromNode?.status === "ok" ? "text-green-400" : "text-yellow-400"}>
                    {fromNode?.label ?? from}
                  </span>
                  <span className={`${healthy ? "text-green-600" : "text-red-600"}`}>→</span>
                  <span className={
                    toNode?.status === "ok" ? "text-green-400" :
                    toNode?.status === "error" ? "text-red-400" :
                    toNode?.status === "degraded" ? "text-yellow-400" :
                    "text-gray-400"
                  }>
                    {toNode?.label ?? to}
                  </span>
                  {toNode?.status === "error" && <span className="text-red-400 border border-red-500/30 rounded px-1">ERR</span>}
                  {toNode?.status === "unconfigured" && <span className="text-yellow-400 border border-yellow-500/30 rounded px-1">CFG</span>}
                  {toNode?.status === "degraded" && <span className="text-yellow-400 border border-yellow-500/30 rounded px-1">DEG</span>}
                </div>
              );
            })}
          </div>
          {graph.checkedAt && (
            <p className="px-4 pb-3 text-xs text-gray-600">Checked at {new Date(graph.checkedAt).toLocaleString()}</p>
          )}
        </div>
      )}
    </div>
  );
}
