// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Nodes — decoy node monitoring. Admin/security-only. Not shown to consumers.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SecurityOpsShell, SecurityMetricCard } from "@/components/security-ops";
import {
  Server, Shield, AlertTriangle, Loader2, RefreshCw,
  Globe, Activity, Clock, ChevronDown, ChevronRight,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

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

const STATUS_LABEL: Record<string, string> = {
  active:      "Decoy online",
  quarantined: "Quarantined",
  disabled:    "Isolated",
};

const STATUS_COLOR: Record<string, string> = {
  active:      "text-primary border-primary/30 bg-primary/10",
  quarantined: "text-yellow-300 border-yellow-300/30 bg-yellow-500/10",
  disabled:    "text-gray-400 border-gray-500/30 bg-gray-500/10",
};

const SEVERITY_COLOR: Record<string, string> = {
  info:     "text-sky-400",
  warn:     "text-yellow-400",
  critical: "text-red-400",
  success:  "text-primary",
};

function NodeRow({ node }: { node: GhostNode }) {
  const [expanded, setExpanded] = useState(false);

  const eventsQ = useQuery<{ events?: GhostNodeEvent[] }>({
    queryKey: ["ghost-node-events", node.id],
    queryFn: () => apiFetch(`/api/command-center/ghost-nodes/${node.id}/events`),
    enabled: expanded,
    refetchInterval: expanded ? 15_000 : false,
    retry: false,
  });

  return (
    <div className="border border-white/[0.07] rounded-2xl overflow-hidden bg-black/30">
      <div className="flex items-center gap-3 px-5 py-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-white/30 hover:text-white/60 transition-colors shrink-0"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <Server className="w-4 h-4 text-white/40 shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono text-white/90 font-semibold">{node.name}</span>
            <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-widest border px-2 py-0.5 rounded-full ${STATUS_COLOR[node.status] ?? "text-white/50 border-white/20"}`}>
              {STATUS_LABEL[node.status] ?? node.status}
            </span>
            {node.isolationLevel && node.isolationLevel !== "none" && (
              <span className="text-[9px] text-white/30 font-mono">isolation: {node.isolationLevel}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-white/40 flex-wrap">
            <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {node.region}</span>
            <span className="font-mono">{node.publicIp}:{node.listenPort}</span>
            {node.decoyIp && <span className="text-white/30">decoy: {node.decoyIp}</span>}
          </div>
        </div>

        <div className="text-[10px] text-white/30 font-mono text-right shrink-0">
          <div>{node.enabledAt ? `online ${new Date(node.enabledAt).toLocaleDateString()}` : "not enabled"}</div>
          {node.quarantinedAt && (
            <div className="text-yellow-400/60">quarantined {new Date(node.quarantinedAt).toLocaleDateString()}</div>
          )}
        </div>
      </div>

      {node.status === "active" && (
        <div className="px-5 pb-3">
          <div className="flex items-center gap-1.5 text-[10px] text-yellow-400/70 bg-yellow-500/5 border border-yellow-500/15 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Verify this decoy node is NOT connected to production VPN traffic. Decoy nodes must remain isolated.
          </div>
        </div>
      )}

      {expanded && (
        <div className="border-t border-white/[0.06] px-5 py-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">
            Recent events on this node
          </div>
          {eventsQ.isLoading ? (
            <div className="flex items-center gap-2 text-white/40 text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Loading...</div>
          ) : (eventsQ.data?.events ?? []).length === 0 ? (
            <div className="text-white/25 text-xs">No events recorded for this node.</div>
          ) : (
            <div className="space-y-1.5">
              {(eventsQ.data?.events ?? []).slice(0, 20).map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-white/25 w-20 shrink-0">
                    {new Date(ev.createdAt).toLocaleTimeString()}
                  </span>
                  <span className={SEVERITY_COLOR[ev.severity] ?? "text-sky-400"}>
                    {ev.eventType}
                  </span>
                  <span className="text-white/50">{ev.sourceIp}</span>
                  {ev.geoCity && (
                    <span className="text-white/30">{ev.geoCity}, {ev.geoCountry}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {node.notes && (
        <div className="px-5 pb-4">
          <div className="text-[10px] text-white/25 font-mono italic">{node.notes}</div>
        </div>
      )}
    </div>
  );
}

export default function GhostNodesDashboard() {
  const nodesQ = useQuery<{ nodes?: GhostNode[] }>({
    queryKey: ["ghost-nodes-list"],
    queryFn: () => apiFetch("/api/command-center/ghost-nodes"),
    refetchInterval: 30_000,
    retry: false,
  });

  const nodes = nodesQ.data?.nodes ?? (Array.isArray(nodesQ.data) ? nodesQ.data as unknown as GhostNode[] : []);
  const active      = nodes.filter(n => n.status === "active").length;
  const quarantined = nodes.filter(n => n.status === "quarantined").length;
  const disabled    = nodes.filter(n => n.status === "disabled").length;

  return (
    <SecurityOpsShell
      title="Ghost Node Fleet"
      subtitle="Deception asset monitoring. All nodes are isolated decoys — separate from production VPN infrastructure."
      rightRail={
        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary/70">
            Architecture
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4 text-sm text-primary/90 flex items-start gap-2.5">
            <Shield className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Decoy nodes run deception services only. No real customer VPN traffic should ever route through a ghost node.
            </span>
          </div>
          <div className="space-y-2 text-xs text-white/50 leading-relaxed border-t border-white/[0.06] pt-3">
            <div className="font-semibold text-white/60 text-[10px] uppercase tracking-widest mb-2">Status labels</div>
            {[
              { label: "Decoy online", desc: "Active and receiving probe traffic" },
              { label: "Decoy degraded", desc: "Active but reporting health issues" },
              { label: "Isolated", desc: "Disabled — no traffic accepted" },
              { label: "Quarantined", desc: "Flagged for review — traffic frozen" },
              { label: "Policy pending", desc: "Awaiting policy push from command center" },
            ].map(({ label, desc }) => (
              <div key={label}>
                <span className="text-white/70 font-medium">{label}</span>
                <span className="text-white/30"> — {desc}</span>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Fleet metrics */}
        <div className="grid gap-4 sm:grid-cols-3">
          <SecurityMetricCard
            label="Active decoy nodes"
            value={active}
            status={active > 0 ? "good" : "neutral"}
            detail="Running deception services"
          />
          <SecurityMetricCard
            label="Quarantined"
            value={quarantined}
            status={quarantined > 0 ? "warning" : "good"}
            detail="Flagged for review"
          />
          <SecurityMetricCard
            label="Isolated / disabled"
            value={disabled}
            status="neutral"
            detail="Traffic frozen"
          />
        </div>

        {/* Production traffic warning */}
        {active > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 px-5 py-4">
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-300/80 leading-relaxed">
              <strong className="text-yellow-300">Production traffic isolation required.</strong> If any ghost node shows live customer VPN connections,
              immediately quarantine it via the Ghost Nodes control panel and notify the security team.
              Ghost nodes must never carry real VPN traffic.
            </div>
          </div>
        )}

        {/* Node list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">
              Decoy node fleet — {nodes.length} node{nodes.length !== 1 ? "s" : ""}
            </div>
            <button
              onClick={() => nodesQ.refetch()}
              disabled={nodesQ.isFetching}
              className="text-white/30 hover:text-primary transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${nodesQ.isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>

          {nodesQ.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-white/40 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading ghost node fleet...
            </div>
          ) : nodesQ.isError ? (
            <div className="flex items-center gap-2 py-12 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Unable to load ghost nodes. Check API connectivity.
            </div>
          ) : nodes.length === 0 ? (
            <div className="py-16 text-center text-white/25 text-sm">
              No ghost nodes provisioned yet. Use the Ghost Nodes control panel to add decoy nodes.
            </div>
          ) : (
            nodes.map((node) => <NodeRow key={node.id} node={node} />)
          )}
        </div>
      </div>
    </SecurityOpsShell>
  );
}
