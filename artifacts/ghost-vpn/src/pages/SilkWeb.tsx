import { useGetSilkWeb, useCollapseSilkWeb, useListTrappedAttackers, getGetSilkWebQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Network, Skull, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useMemo } from "react";

const ROUTE_COLORS: Record<string, string> = {
  highway: "#00ff88",
  dead_end: "#ef4444",
  decoy: "#eab308",
  collapse_zone: "#f97316",
};

const ROUTE_OPACITY: Record<string, number> = {
  highway: 0.7,
  dead_end: 0.35,
  decoy: 0.5,
  collapse_zone: 0.55,
};

interface Route {
  id: number;
  fromNodeId: number;
  toNodeId: number;
  routeType: string;
}

function SilkWebTopology({ routes, trappedIds }: { routes: Route[]; trappedIds: Set<number> }) {
  const cx = 200;
  const cy = 200;

  const { nodePositions, outerR, innerR, outerIds, innerIds } = useMemo(() => {
    const allIds = Array.from(new Set(routes.flatMap((r) => [r.fromNodeId, r.toNodeId]))).sort((a, b) => a - b);
    const outerIds = allIds.slice(0, 50);
    const innerIds = allIds.slice(50);
    const outerR = 168;
    const innerR = 72;
    const pos: Record<number, [number, number]> = {};
    outerIds.forEach((id, i) => {
      const angle = (i / outerIds.length) * 2 * Math.PI - Math.PI / 2;
      pos[id] = [cx + outerR * Math.cos(angle), cy + outerR * Math.sin(angle)];
    });
    innerIds.forEach((id, i) => {
      const angle = (i / Math.max(innerIds.length, 1)) * 2 * Math.PI - Math.PI / 2;
      pos[id] = [cx + innerR * Math.cos(angle), cy + innerR * Math.sin(angle)];
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
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx={cx} cy={cy} r={outerR + 10} fill="url(#webGlow)" />

      {webRings.map((r, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke="#00ff88" strokeOpacity={0.08} strokeWidth={0.5} />
      ))}

      {outerIds.map((id, i) => {
        const angle = (i / outerIds.length) * 2 * Math.PI - Math.PI / 2;
        const x = cx + outerR * Math.cos(angle);
        const y = cy + outerR * Math.sin(angle);
        return (
          <line key={`spoke-${id}`} x1={cx} y1={cy} x2={x} y2={y} stroke="#00ff88" strokeOpacity={0.06} strokeWidth={0.5} />
        );
      })}

      {routes.map((r) => {
        const from = nodePositions[r.fromNodeId];
        const to = nodePositions[r.toNodeId];
        if (!from || !to) return null;
        const color = ROUTE_COLORS[r.routeType] ?? "#ffffff";
        const opacity = ROUTE_OPACITY[r.routeType] ?? 0.3;
        return (
          <line
            key={r.id}
            x1={from[0]} y1={from[1]}
            x2={to[0]} y2={to[1]}
            stroke={color}
            strokeOpacity={opacity}
            strokeWidth={r.routeType === "highway" ? 1.2 : 0.6}
          />
        );
      })}

      {innerIds.map((id) => {
        const pos = nodePositions[id];
        if (!pos) return null;
        const isTrapped = trappedIds.has(id);
        return (
          <g key={`inner-${id}`}>
            <circle cx={pos[0]} cy={pos[1]} r={5} fill="#00ff88" fillOpacity={0.9} filter="url(#glow)" />
            {isTrapped && (
              <circle cx={pos[0]} cy={pos[1]} r={8} fill="none" stroke="#ef4444" strokeWidth={1.5} strokeOpacity={0.9}>
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
        const isTrapped = trappedIds.has(id);
        return (
          <g key={`outer-${id}`}>
            <circle cx={pos[0]} cy={pos[1]} r={2.5} fill="#00ff88" fillOpacity={0.6} />
            {isTrapped && (
              <circle cx={pos[0]} cy={pos[1]} r={5} fill="none" stroke="#ef4444" strokeWidth={1} strokeOpacity={0.85}>
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
  const { data: web } = useGetSilkWeb({ query: { refetchInterval: 15000 } });
  const { data: attackers } = useListTrappedAttackers({ query: { refetchInterval: 8000 } });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const collapse = useCollapseSilkWeb();

  const handleCollapse = () => {
    collapse.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Silk Web Collapsed", description: "Web geometry has been regenerated." });
        queryClient.invalidateQueries({ queryKey: getGetSilkWebQueryKey() });
      }
    });
  };

  const routes: Route[] = (web?.routes ?? []) as Route[];
  const trappedIds = useMemo(() => {
    const ids = new Set<number>();
    (attackers?.attackers ?? []).forEach((a) => {
      if (typeof a.entryNodeId === "number") ids.add(a.entryNodeId);
    });
    return ids;
  }, [attackers]);

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
          <Network className="w-6 h-6" />
          Silk Web Traps
        </h2>
        <Button
          variant="outline"
          className="border-destructive text-destructive hover:bg-destructive hover:text-black"
          onClick={handleCollapse}
          disabled={collapse.isPending}
        >
          <Skull className="w-4 h-4 mr-2" />
          COLLAPSE WEB
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <Card className="bg-black border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary/70">Total Routes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary font-mono">{web?.totalRoutes ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-black border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary/70">Dead Ends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive font-mono">{web?.deadEndRoutes ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-black border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary/70">Highways</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary font-mono">{web?.activeHighways ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-black border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary/70">Generation ID</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-primary font-mono truncate">{web?.generationId ?? "N/A"}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
        <div className="border border-primary/20 rounded bg-black flex flex-col h-full min-h-[300px] overflow-hidden">
          <div className="p-2 border-b border-primary/20 flex items-center justify-between">
            <span className="text-xs font-mono text-primary/60 uppercase tracking-widest">Topology Map</span>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-[#00ff88]" />HIGHWAY</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-red-500" />DEAD_END</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-yellow-500" />DECOY</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-orange-500" />COLLAPSE</span>
            </div>
          </div>
          <div className="flex-1 p-2">
            {routes.length > 0 ? (
              <SilkWebTopology routes={routes} trappedIds={trappedIds} />
            ) : (
              <div className="h-full flex items-center justify-center font-mono text-primary/30 text-xs uppercase">
                [awaiting web data...]
              </div>
            )}
          </div>
        </div>

        <div className="border border-primary/20 rounded bg-black flex flex-col h-full min-h-[300px]">
          <div className="p-3 border-b border-primary/20 flex items-center gap-2 text-destructive font-bold text-sm tracking-widest uppercase">
            <ShieldAlert className="w-4 h-4" />
            Trapped Entities ({attackers?.attackers?.length ?? 0})
          </div>
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-primary/20 hover:bg-transparent">
                  <TableHead className="text-primary/70 text-xs">TIME</TableHead>
                  <TableHead className="text-primary/70 text-xs">IP</TableHead>
                  <TableHead className="text-primary/70 text-xs">LOOPS</TableHead>
                  <TableHead className="text-primary/70 text-xs">FINGERPRINT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attackers?.attackers?.map((att) => (
                  <TableRow key={att.id} className="border-primary/20 hover:bg-primary/5">
                    <TableCell className="font-mono text-xs">{format(new Date(att.trappedAt), 'HH:mm:ss')}</TableCell>
                    <TableCell className="font-mono text-xs text-destructive">{att.ip}</TableCell>
                    <TableCell className="font-mono text-xs">{att.loopCount}</TableCell>
                    <TableCell className="font-mono text-[10px] truncate max-w-[120px]">{att.fingerprint}</TableCell>
                  </TableRow>
                ))}
                {!attackers?.attackers?.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-primary/50 py-8 font-mono text-xs">
                      NO ENTITIES CURRENTLY TRAPPED
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
