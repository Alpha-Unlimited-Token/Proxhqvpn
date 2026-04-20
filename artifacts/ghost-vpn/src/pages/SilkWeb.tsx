import { useMemo } from "react";
import {
  useGetSilkWeb, useCollapseSilkWeb, useListTrappedAttackers, getGetSilkWebQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Network, Skull, ShieldAlert } from "lucide-react";
import { format } from "date-fns";

interface Route {
  id: number;
  fromNodeId: number;
  toNodeId: number;
  routeType: string;
}

const ROUTE_COLORS: Record<string, string> = {
  highway:      "#00ff88",
  dead_end:     "#ef4444",
  decoy:        "#eab308",
  collapse_zone:"#f97316",
};
const ROUTE_OPACITY: Record<string, number> = {
  highway: 0.7, dead_end: 0.35, decoy: 0.5, collapse_zone: 0.55,
};

function SilkWebTopology({ routes, trappedIds }: { routes: Route[]; trappedIds: Set<number> }) {
  const cx = 200, cy = 200;

  const { nodePositions, outerR, innerR, outerIds, innerIds } = useMemo(() => {
    const allIds = Array.from(new Set(routes.flatMap((r) => [r.fromNodeId, r.toNodeId]))).sort((a, b) => a - b);
    const outerIds = allIds.slice(0, 50);
    const innerIds = allIds.slice(50);
    const outerR = 168, innerR = 72;
    const pos: Record<number, [number, number]> = {};
    outerIds.forEach((id, i) => {
      const a = (i / outerIds.length) * 2 * Math.PI - Math.PI / 2;
      pos[id] = [cx + outerR * Math.cos(a), cy + outerR * Math.sin(a)];
    });
    innerIds.forEach((id, i) => {
      const a = (i / Math.max(innerIds.length, 1)) * 2 * Math.PI - Math.PI / 2;
      pos[id] = [cx + innerR * Math.cos(a), cy + innerR * Math.sin(a)];
    });
    return { nodePositions: pos, outerR, innerR, outerIds, innerIds };
  }, [routes]);

  const webRings = [innerR * 0.35, innerR * 0.65, innerR, (outerR + innerR) / 2, outerR];

  return (
    <svg viewBox="0 0 400 400" className="w-full h-full" style={{ background: "transparent" }}>
      <defs>
        <radialGradient id="webGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00ff88" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <circle cx={cx} cy={cy} r={outerR + 10} fill="url(#webGlow)" />
      {webRings.map((r, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke="#00ff88" strokeOpacity={0.08} strokeWidth={0.5} />
      ))}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * 2 * Math.PI;
        return <line key={i} x1={cx} y1={cy}
          x2={cx + outerR * Math.cos(a)} y2={cy + outerR * Math.sin(a)}
          stroke="#00ff88" strokeOpacity={0.04} strokeWidth={0.4} />;
      })}

      {routes.map((r) => {
        const from = nodePositions[r.fromNodeId];
        const to = nodePositions[r.toNodeId];
        if (!from || !to) return null;
        return (
          <line key={r.id}
            x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}
            stroke={ROUTE_COLORS[r.routeType] ?? "#ffffff"}
            strokeOpacity={ROUTE_OPACITY[r.routeType] ?? 0.3}
            strokeWidth={r.routeType === "highway" ? 1.2 : 0.6}
          />
        );
      })}

      {innerIds.map((id) => {
        const pos = nodePositions[id];
        if (!pos) return null;
        const trapped = trappedIds.has(id);
        return (
          <g key={`inner-${id}`}>
            <circle cx={pos[0]} cy={pos[1]} r={5}
              fill={trapped ? "#ef4444" : "#00ff88"} fillOpacity={0.9} filter="url(#glow)" />
            {trapped && (
              <circle cx={pos[0]} cy={pos[1]} r={8} fill="none"
                stroke="#ef4444" strokeWidth={1.5} strokeOpacity={0.9}>
                <animate attributeName="r" values="7;11;7" dur="1.2s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.9;0.3;0.9" dur="1.2s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        );
      })}
      {outerIds.map((id) => {
        const pos = nodePositions[id];
        if (!pos) return null;
        const trapped = trappedIds.has(id);
        return (
          <g key={`outer-${id}`}>
            <circle cx={pos[0]} cy={pos[1]} r={2.5}
              fill={trapped ? "#ef4444" : "#00ff88"} fillOpacity={trapped ? 1 : 0.6} />
            {trapped && (
              <circle cx={pos[0]} cy={pos[1]} r={5} fill="none"
                stroke="#ef4444" strokeWidth={1} strokeOpacity={0.85}>
                <animate attributeName="r" values="4;7;4" dur="1s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.85;0.2;0.85" dur="1s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        );
      })}

      <circle cx={cx} cy={cy} r={6} fill="#00ff88" fillOpacity={0.9} filter="url(#glow)" />
      <circle cx={cx} cy={cy} r={3} fill="#ffffff" fillOpacity={0.95} />
    </svg>
  );
}

export default function SilkWeb() {
  const { data: web }      = useGetSilkWeb({ query: { refetchInterval: 15000 } as any });
  const { data: attackers } = useListTrappedAttackers({ query: { refetchInterval: 8000 } as any });
  const queryClient        = useQueryClient();
  const { toast }          = useToast();
  const collapse           = useCollapseSilkWeb();

  const routes: Route[] = (web?.routes ?? []) as Route[];
  const trappedIds = useMemo(() => {
    const ids = new Set<number>();
    (attackers?.attackers ?? []).forEach((a) => {
      if (typeof a.entryNodeId === "number") ids.add(a.entryNodeId);
    });
    return ids;
  }, [attackers]);

  const handleCollapse = () => {
    collapse.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Silk Web Collapsed", description: "Web geometry has been regenerated." });
        queryClient.invalidateQueries({ queryKey: getGetSilkWebQueryKey() });
      },
    });
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
          <Network className="w-6 h-6" />
          Silk Web Traps
        </h2>
        <button
          onClick={handleCollapse}
          disabled={collapse.isPending}
          className="flex items-center gap-2 border border-red-500/40 text-red-400 px-4 py-1.5 text-xs font-mono uppercase hover:bg-red-500/10 hover:border-red-500 transition-colors disabled:opacity-50"
        >
          <Skull className="w-4 h-4" />
          {collapse.isPending ? "COLLAPSING…" : "COLLAPSE WEB"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
        {[
          { label: "Total Routes",   value: web?.totalRoutes ?? 0,    color: "text-primary" },
          { label: "Dead Ends",      value: web?.deadEndRoutes ?? 0,  color: "text-red-400" },
          { label: "Highways",       value: web?.activeHighways ?? 0, color: "text-primary" },
          { label: "Generation ID",  value: web?.generationId ?? "N/A", color: "text-primary", small: true },
        ].map(({ label, value, color, small }) => (
          <div key={label} className="border border-primary/20 bg-black p-3">
            <div className="text-[9px] font-mono text-primary/50 uppercase mb-1">{label}</div>
            <div className={`font-bold font-mono ${small ? "text-sm truncate" : "text-2xl"} ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
        {/* Topology */}
        <div className="border border-primary/20 rounded bg-black flex flex-col h-full min-h-[300px] overflow-hidden">
          <div className="p-2 border-b border-primary/20 flex items-center justify-between shrink-0">
            <span className="text-xs font-mono text-primary/60 uppercase tracking-widest">Topology Map</span>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              {[["#00ff88","HIGHWAY"],["#ef4444","DEAD END"],["#eab308","DECOY"],["#f97316","COLLAPSE"]].map(([c,l]) => (
                <span key={l} className="flex items-center gap-1">
                  <span className="inline-block w-3 h-0.5" style={{ background: c }} />
                  {l}
                </span>
              ))}
            </div>
          </div>
          <div className="flex-1 p-2">
            {routes.length > 0
              ? <SilkWebTopology routes={routes} trappedIds={trappedIds} />
              : <div className="h-full flex items-center justify-center font-mono text-primary/30 text-xs uppercase tracking-widest">
                  Awaiting web data…
                </div>
            }
          </div>
        </div>

        {/* Trapped entities — real DB records only */}
        <div className="border border-primary/20 rounded bg-black flex flex-col h-full min-h-[300px]">
          <div className="p-3 border-b border-primary/20 flex items-center gap-2 text-red-400 font-bold text-sm tracking-widest uppercase shrink-0">
            <ShieldAlert className="w-4 h-4" />
            Trapped Entities ({attackers?.attackers?.length ?? 0})
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-primary/20">
                  <th className="text-left px-3 py-2 text-primary/50 font-normal uppercase text-[10px]">TIME</th>
                  <th className="text-left px-3 py-2 text-primary/50 font-normal uppercase text-[10px]">IP</th>
                  <th className="text-left px-3 py-2 text-primary/50 font-normal uppercase text-[10px]">LOOPS</th>
                  <th className="text-left px-3 py-2 text-primary/50 font-normal uppercase text-[10px]">FINGERPRINT</th>
                </tr>
              </thead>
              <tbody>
                {attackers?.attackers?.map((att) => (
                  <tr key={att.id} className="border-b border-primary/10 hover:bg-primary/5">
                    <td className="px-3 py-2">{format(new Date(att.trappedAt), "HH:mm:ss")}</td>
                    <td className="px-3 py-2 text-red-400">{att.ip}</td>
                    <td className="px-3 py-2">{att.loopCount}</td>
                    <td className="px-3 py-2 truncate max-w-[120px] text-primary/40">{att.fingerprint}</td>
                  </tr>
                ))}
                {!attackers?.attackers?.length && (
                  <tr>
                    <td colSpan={4} className="text-center text-primary/30 py-12 uppercase tracking-widest">
                      No entities currently trapped
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
