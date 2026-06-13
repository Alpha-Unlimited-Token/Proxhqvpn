import { Panel, StatusBadge } from "@/components/system";

export function NodeHealthCard({ node }: { node: any }) {
  const status = node.health?.state ?? node.status ?? "inactive";

  return (
    <Panel className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">
            {node.label ?? node.name ?? node.nodeId ?? node.id}
          </div>
          <div className="mt-1 text-xs text-white/45">
            {node.region ?? "Unknown region"}
          </div>
        </div>
        <StatusBadge status={status === "healthy" ? "healthy" : "degraded"} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-white/35">Health</div>
          <div className="mt-1 text-primary">{node.health?.score ?? "—"}</div>
        </div>
        <div>
          <div className="text-white/35">Peers</div>
          <div className="mt-1 text-white">{node.activePeers ?? "—"}</div>
        </div>
        <div>
          <div className="text-white/35">Latency</div>
          <div className="mt-1 text-white">{node.latencyMs ?? "—"} ms</div>
        </div>
      </div>
    </Panel>
  );
}
