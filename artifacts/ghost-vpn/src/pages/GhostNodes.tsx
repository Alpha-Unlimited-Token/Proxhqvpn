// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Node Manager — decoy VPN node infrastructure control panel.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Network, Plus, Trash2, Shield, ShieldOff, RefreshCw, AlertTriangle, Server, Globe, Activity, ChevronDown, ChevronRight, Eye } from "lucide-react";

interface GhostNode {
  id: number;
  name: string;
  region: string;
  publicIp: string;
  decoyIp: string | null;
  listenPort: number;
  status: "active" | "quarantined" | "disabled";
  isolationLevel: string;
  notes: string | null;
  createdAt: string;
  enabledAt: string | null;
  quarantinedAt: string | null;
}

interface GhostNodeEvent {
  id: number;
  eventType: string;
  sourceIp: string;
  sourcePort: number | null;
  geoCountry: string | null;
  geoCity: string | null;
  severity: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  active:      "text-green-400 bg-green-500/10 border-green-500/30",
  quarantined: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  disabled:    "text-gray-400 bg-gray-500/10 border-gray-500/30",
};

const SEVERITY_COLORS: Record<string, string> = {
  info:     "text-blue-400",
  warn:     "text-yellow-400",
  critical: "text-red-400",
};

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: Record<string, unknown>) => void }) {
  const [form, setForm] = useState({ name: "", region: "", publicIp: "", decoyIp: "", listenPort: "51820", notes: "" });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#0a0f0a] border border-green-900/50 rounded-xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-green-300 font-mono font-bold text-lg">+ New Ghost Node</h3>
        {[
          { label: "Name", key: "name", placeholder: "ghost-node-us-east-1" },
          { label: "Region Code", key: "region", placeholder: "ewr" },
          { label: "Public IP", key: "publicIp", placeholder: "1.2.3.4" },
          { label: "Decoy IP (shown to scanners)", key: "decoyIp", placeholder: "10.99.99.1 (optional)" },
          { label: "Listen Port", key: "listenPort", placeholder: "51820" },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="block text-xs text-green-600 font-mono mb-1">{label}</label>
            <input
              value={form[key as keyof typeof form]}
              onChange={set(key)}
              placeholder={placeholder}
              className="w-full bg-black/60 border border-green-900/40 rounded px-3 py-2 text-green-200 font-mono text-sm focus:outline-none focus:border-green-500/60"
            />
          </div>
        ))}
        <div>
          <label className="block text-xs text-green-600 font-mono mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={set("notes")}
            rows={2}
            className="w-full bg-black/60 border border-green-900/40 rounded px-3 py-2 text-green-200 font-mono text-sm focus:outline-none focus:border-green-500/60 resize-none"
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-mono text-gray-400 border border-gray-700 rounded hover:border-gray-500 transition-colors">Cancel</button>
          <button
            onClick={() => {
              if (!form.name || !form.region || !form.publicIp) return;
              onCreate({
                name: form.name, region: form.region, publicIp: form.publicIp,
                decoyIp: form.decoyIp || undefined,
                listenPort: parseInt(form.listenPort) || 51820,
                notes: form.notes || undefined,
              });
            }}
            className="px-4 py-2 text-sm font-mono bg-green-700 hover:bg-green-600 text-white rounded transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function NodeCard({ node, onQuarantine, onDelete, onRefresh }: {
  node: GhostNode;
  onQuarantine: (id: number) => void;
  onDelete: (id: number) => void;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const eventsQ = useQuery<{ events: GhostNodeEvent[] }>({
    queryKey: ["ghost-node-events", node.id],
    queryFn: () => fetch(`/api/ghost-nodes/${node.id}/events?limit=20`).then(r => r.json()),
    enabled: expanded,
  });

  return (
    <div className="bg-black/40 border border-green-900/30 rounded-xl overflow-hidden">
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Server className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-green-200 font-mono font-semibold text-sm">{node.name}</span>
              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${STATUS_COLORS[node.status] ?? "text-gray-400"}`}>
                {node.status}
              </span>
              <span className="text-xs text-gray-500 font-mono">{node.isolationLevel} isolation</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
              <span className="text-xs text-gray-400 font-mono flex items-center gap-1">
                <Globe className="w-3 h-3" /> {node.region} — {node.publicIp}:{node.listenPort}
              </span>
              {node.decoyIp && (
                <span className="text-xs text-yellow-400/80 font-mono flex items-center gap-1">
                  <Eye className="w-3 h-3" /> decoy: {node.decoyIp}
                </span>
              )}
            </div>
            {node.notes && <p className="text-xs text-gray-500 mt-1 truncate">{node.notes}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {node.status === "active" && (
            <button
              onClick={() => onQuarantine(node.id)}
              title="Quarantine"
              className="p-1.5 rounded text-yellow-500 hover:bg-yellow-500/10 transition-colors"
            >
              <ShieldOff className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(node.id)}
            title="Delete"
            className="p-1.5 rounded text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded text-green-500 hover:bg-green-500/10 transition-colors"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-green-900/20 p-4 bg-black/20">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-green-600" />
            <span className="text-xs font-mono text-green-500 font-semibold uppercase tracking-wider">Recent Events</span>
          </div>
          {eventsQ.isLoading && <p className="text-xs text-gray-500 font-mono">Loading events…</p>}
          {eventsQ.data?.events.length === 0 && <p className="text-xs text-gray-500 font-mono">No events recorded yet.</p>}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {eventsQ.data?.events.map(ev => (
              <div key={ev.id} className="flex items-center gap-3 text-xs font-mono">
                <span className={`w-2 h-2 rounded-full shrink-0 ${ev.severity === "critical" ? "bg-red-500" : ev.severity === "warn" ? "bg-yellow-500" : "bg-blue-500"}`} />
                <span className="text-gray-400 shrink-0">{new Date(ev.createdAt).toLocaleTimeString()}</span>
                <span className={`shrink-0 ${SEVERITY_COLORS[ev.severity] ?? "text-gray-300"}`}>{ev.eventType}</span>
                <span className="text-green-300">{ev.sourceIp}{ev.sourcePort ? `:${ev.sourcePort}` : ""}</span>
                {ev.geoCity && <span className="text-gray-500">{ev.geoCity}, {ev.geoCountry}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GhostNodes() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [vultrOpen, setVultrOpen] = useState(false);

  const nodesQ = useQuery<{ nodes: GhostNode[] }>({
    queryKey: ["ghost-nodes"],
    queryFn: () => fetch("/api/ghost-nodes").then(r => r.json()),
    refetchInterval: 30_000,
  });

  const vultrQ = useQuery<{ instances: unknown[] }>({
    queryKey: ["vultr-instances"],
    queryFn: () => fetch("/api/ghost-nodes/vultr/instances").then(r => r.json()),
    enabled: vultrOpen,
  });

  const createM = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch("/api/ghost-nodes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ghost-nodes"] }); setShowCreate(false); },
  });

  const quarantineM = useMutation({
    mutationFn: (id: number) => fetch(`/api/ghost-nodes/${id}/quarantine`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ghost-nodes"] }),
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => fetch(`/api/ghost-nodes/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ghost-nodes"] }),
  });

  const nodes = nodesQ.data?.nodes ?? [];
  const active      = nodes.filter(n => n.status === "active").length;
  const quarantined = nodes.filter(n => n.status === "quarantined").length;

  return (
    <div className="min-h-screen bg-[#060b06] text-green-200 p-6 space-y-6">
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreate={data => createM.mutate(data)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Network className="w-7 h-7 text-green-400" />
          <div>
            <h1 className="text-2xl font-mono font-bold text-green-300">Ghost Node Manager</h1>
            <p className="text-xs text-gray-500 font-mono mt-0.5">Decoy VPN infrastructure — isolated from real customer tunnels</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setVultrOpen(v => !v); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-mono border border-blue-700/40 text-blue-400 rounded-lg hover:bg-blue-900/20 transition-colors"
          >
            <Server className="w-4 h-4" /> Vultr Sync
          </button>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["ghost-nodes"] })}
            className="p-2 rounded-lg border border-green-900/30 text-green-500 hover:bg-green-900/20 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-mono bg-green-700 hover:bg-green-600 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> New Node
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: nodes.length, color: "text-green-300" },
          { label: "Active", value: active, color: "text-green-400" },
          { label: "Quarantined", value: quarantined, color: "text-yellow-400" },
          { label: "Disabled", value: nodes.length - active - quarantined, color: "text-gray-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-black/40 border border-green-900/20 rounded-xl p-4 text-center">
            <div className={`text-3xl font-mono font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 font-mono mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Vultr panel */}
      {vultrOpen && (
        <div className="bg-black/40 border border-blue-900/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-mono text-blue-300 font-semibold">Vultr Instances</span>
            {vultrQ.isLoading && <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />}
          </div>
          {vultrQ.error && <p className="text-xs text-red-400 font-mono">VULTR_API_KEY not configured or API error.</p>}
          {vultrQ.data?.instances && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left py-1 pr-4">Label</th>
                    <th className="text-left py-1 pr-4">Region</th>
                    <th className="text-left py-1 pr-4">IP</th>
                    <th className="text-left py-1 pr-4">Status</th>
                    <th className="text-left py-1">Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {(vultrQ.data.instances as Record<string, unknown>[]).map((i) => (
                    <tr key={String(i.id)} className="border-b border-gray-900 hover:bg-white/5">
                      <td className="py-1 pr-4 text-blue-200">{String(i.label ?? i.id)}</td>
                      <td className="py-1 pr-4 text-gray-400">{String(i.regionLabel ?? i.region)}</td>
                      <td className="py-1 pr-4 text-green-300">{String(i.ip)}</td>
                      <td className="py-1 pr-4">
                        <span className={String(i.powerStatus) === "running" ? "text-green-400" : "text-red-400"}>
                          {String(i.powerStatus)}
                        </span>
                      </td>
                      <td className="py-1 text-gray-500">{String(i.plan)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {vultrQ.data && !vultrQ.data.instances?.length && (
            <p className="text-xs text-gray-500 font-mono">No Vultr instances found on this account.</p>
          )}
        </div>
      )}

      {/* Warning banner */}
      <div className="flex items-start gap-3 bg-yellow-900/10 border border-yellow-700/20 rounded-xl p-4">
        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <div className="text-xs font-mono text-yellow-300/80 space-y-1">
          <p className="font-semibold">Ghost Nodes are fully isolated decoy endpoints.</p>
          <p className="text-yellow-400/60">They are NOT connected to any real customer VPN tunnel. Traffic to ghost nodes is never forwarded to customer devices. All interactions are logged as threat intelligence only.</p>
        </div>
      </div>

      {/* Node list */}
      {nodesQ.isLoading && (
        <div className="text-center py-12 text-gray-500 font-mono">Loading ghost nodes…</div>
      )}
      {!nodesQ.isLoading && nodes.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <Network className="w-12 h-12 text-green-900 mx-auto" />
          <p className="text-gray-500 font-mono">No ghost nodes yet. Create one to start deploying decoy VPN infrastructure.</p>
          <button onClick={() => setShowCreate(true)} className="mt-2 px-5 py-2 text-sm font-mono bg-green-800 hover:bg-green-700 text-white rounded-lg transition-colors">
            + Add First Ghost Node
          </button>
        </div>
      )}
      <div className="space-y-3">
        {nodes.map(node => (
          <NodeCard
            key={node.id}
            node={node}
            onQuarantine={id => quarantineM.mutate(id)}
            onDelete={id => { if (confirm(`Delete ghost node "${node.name}"?`)) deleteM.mutate(id); }}
            onRefresh={() => qc.invalidateQueries({ queryKey: ["ghost-nodes"] })}
          />
        ))}
      </div>
    </div>
  );
}
