import { useState, useMemo } from "react";
import { useGetSilkWeb, useCollapseSilkWeb, useListTrappedAttackers, getGetSilkWebQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSilkWebEngine } from "@/hooks/useSilkWebEngine";
import {
  Network, Skull, ShieldAlert, Activity, Zap, RotateCcw,
  AlertTriangle, ArrowRightLeft, Bug, Radio, Eye, Layers
} from "lucide-react";
import { format } from "date-fns";

interface Route {
  id: number;
  fromNodeId: number;
  toNodeId: number;
  routeType: string;
}

const ROUTE_COLORS: Record<string, string> = {
  highway: "#00ff88",
  dead_end: "#ef4444",
  decoy: "#eab308",
  collapse_zone: "#f97316",
};

function SilkWebTopology({
  routes,
  trappedIds,
  collapseActive,
  webGeneration,
}: {
  routes: Route[];
  trappedIds: Set<number>;
  collapseActive: boolean;
  webGeneration: number;
}) {
  const cx = 200, cy = 200;

  const { nodePositions, outerIds, innerIds } = useMemo(() => {
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
    return { nodePositions: pos, outerIds, innerIds };
  }, [routes]);

  const webRings = [72 * 0.35, 72 * 0.65, 72, (168 + 72) / 2, 168];

  return (
    <svg viewBox="0 0 400 400" className="w-full h-full">
      <defs>
        <radialGradient id="webGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00ff88" stopOpacity={collapseActive ? "0.12" : "0.05"} />
          <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="strongGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <circle cx={cx} cy={cy} r={178} fill="url(#webGlow)" />

      {webRings.map((r, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={collapseActive ? "#f97316" : "#00ff88"}
          strokeOpacity={collapseActive ? 0.18 : 0.07}
          strokeWidth={0.5}
          strokeDasharray={collapseActive ? "3,4" : undefined}
        />
      ))}

      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * 2 * Math.PI;
        return (
          <line key={`spoke-${i}`} x1={cx} y1={cy}
            x2={cx + 168 * Math.cos(a)} y2={cy + 168 * Math.sin(a)}
            stroke="#00ff88" strokeOpacity={0.04} strokeWidth={0.4} />
        );
      })}

      {routes.map((r) => {
        const from = nodePositions[r.fromNodeId];
        const to = nodePositions[r.toNodeId];
        if (!from || !to) return null;
        const color = collapseActive ? "#f97316" : (ROUTE_COLORS[r.routeType] ?? "#ffffff");
        return (
          <line key={r.id}
            x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}
            stroke={color}
            strokeOpacity={collapseActive ? 0.3 : (r.routeType === "highway" ? 0.7 : 0.35)}
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
            <circle cx={pos[0]} cy={pos[1]} r={5}
              fill={isTrapped ? "#ef4444" : "#00ff88"} fillOpacity={0.9} filter="url(#glow)" />
            {isTrapped && (
              <circle cx={pos[0]} cy={pos[1]} r={8} fill="none" stroke="#ef4444" strokeWidth={1.5} strokeOpacity={0.9}>
                <animate attributeName="r" values="7;12;7" dur="1.2s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.9;0.2;0.9" dur="1.2s" repeatCount="indefinite" />
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
            <circle cx={pos[0]} cy={pos[1]} r={2.5}
              fill={isTrapped ? "#ef4444" : (collapseActive ? "#f97316" : "#00ff88")}
              fillOpacity={isTrapped ? 1 : 0.6}
            />
            {isTrapped && (
              <circle cx={pos[0]} cy={pos[1]} r={5} fill="none" stroke="#ef4444" strokeWidth={1} strokeOpacity={0.85}>
                <animate attributeName="r" values="4;8;4" dur="1s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.85;0.2;0.85" dur="1s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        );
      })}

      <circle cx={cx} cy={cy} r={8} fill="#00ff88" fillOpacity={0.15} />
      <circle cx={cx} cy={cy} r={5} fill="#00ff88" fillOpacity={0.9} filter="url(#strongGlow)" />
      <circle cx={cx} cy={cy} r={2.5} fill="#ffffff" fillOpacity={0.95} />
      <text x={cx} y={cy + 22} textAnchor="middle" fill="#00ff88" fillOpacity={0.35}
        fontFamily="monospace" fontSize={7}>GEN.{webGeneration}</text>
      {collapseActive && (
        <text x={cx} y={cy - 16} textAnchor="middle" fill="#f97316" fillOpacity={0.85}
          fontFamily="monospace" fontSize={8}>◉ COLLAPSING</text>
      )}
    </svg>
  );
}

const EVENT_ICON: Record<string, React.ReactNode> = {
  DECAY:            <RotateCcw className="w-3 h-3 text-yellow-400" />,
  HONEYPOT_SPAWN:   <Bug className="w-3 h-3 text-primary" />,
  PROBE_DETECTED:   <Eye className="w-3 h-3 text-orange-400" />,
  INNER_REDIRECT:   <ArrowRightLeft className="w-3 h-3 text-red-400" />,
  OUTER_TRAP:       <Skull className="w-3 h-3 text-red-500" />,
  REGROWTH:         <Zap className="w-3 h-3 text-primary" />,
  COLLAPSE_START:   <AlertTriangle className="w-3 h-3 text-orange-500" />,
  COLLAPSE_WAVE:    <Activity className="w-3 h-3 text-orange-400" />,
  COLLAPSE_COMPLETE:<Network className="w-3 h-3 text-primary" />,
  SPIDER_CRAWL:     <Bug className="w-3 h-3 text-primary/40" />,
  BEACON_PULSE:     <Radio className="w-3 h-3 text-cyan-400/70" />,
  WORM_SUPPRESS:    <Layers className="w-3 h-3 text-yellow-400/70" />,
};

const EVENT_COLOR: Record<string, string> = {
  DECAY:            "text-yellow-400/80",
  HONEYPOT_SPAWN:   "text-primary",
  PROBE_DETECTED:   "text-orange-400",
  INNER_REDIRECT:   "text-red-400",
  OUTER_TRAP:       "text-red-500",
  REGROWTH:         "text-primary",
  COLLAPSE_START:   "text-orange-500",
  COLLAPSE_WAVE:    "text-orange-400",
  COLLAPSE_COMPLETE:"text-primary",
  SPIDER_CRAWL:     "text-primary/35",
  BEACON_PULSE:     "text-cyan-400/55",
  WORM_SUPPRESS:    "text-yellow-400/55",
};

const EVENT_FILTERS = [
  { value: "all",            label: "ALL"       },
  { value: "INNER_REDIRECT", label: "REDIRECTS" },
  { value: "OUTER_TRAP",     label: "TRAPS"     },
  { value: "PROBE_DETECTED", label: "PROBES"    },
  { value: "DECAY",          label: "DECAYS"    },
  { value: "BEACON_PULSE",   label: "BEACONS"   },
  { value: "SPIDER_CRAWL",   label: "SPIDER"    },
  { value: "WORM_SUPPRESS",  label: "WORM"      },
  { value: "critical",       label: "CRITICAL"  },
];

export default function SilkWeb() {
  const { data: web }      = useGetSilkWeb({ query: { refetchInterval: 15000 } as any });
  const { data: attackers } = useListTrappedAttackers({ query: { refetchInterval: 8000 } as any });
  const queryClient        = useQueryClient();
  const { toast }          = useToast();
  const collapseApi        = useCollapseSilkWeb();
  const engine             = useSilkWebEngine();
  const [eventFilter, setEventFilter] = useState("all");

  const routes: Route[] = (web?.routes ?? []) as Route[];
  const trappedIds = useMemo(() => {
    const ids = new Set<number>();
    (attackers?.attackers ?? []).forEach((a) => {
      if (typeof a.entryNodeId === "number") ids.add(a.entryNodeId);
    });
    return ids;
  }, [attackers]);

  const handleCollapse = () => {
    engine.triggerCollapse();
    collapseApi.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "SilkWeb Collapsed", description: "Mesh reforming — all paths regenerated, honeypot flood planted." });
        queryClient.invalidateQueries({ queryKey: getGetSilkWebQueryKey() });
      },
    });
  };

  const filteredEvents = eventFilter === "all"
    ? engine.events
    : engine.events.filter((e) => e.kind === eventFilter || e.severity === eventFilter);

  const activeHoneypots  = engine.honeypots.filter((h) => !h.trapped && Date.now() < h.expiresAt);
  const trappedHoneypots = engine.honeypots.filter((h) => h.trapped);
  const trapEvents       = engine.events.filter((e) => e.kind === "OUTER_TRAP" || e.kind === "INNER_REDIRECT");

  return (
    <div className="flex flex-col gap-3 h-full pb-8">

      {/* Header */}
      <div className="border border-primary/10 bg-black/20 px-3 py-2.5 shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
              <Network className="w-5 h-5" />
              Silk Web
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] font-mono flex-wrap">
              {[
                ["GEN",       String(engine.webGeneration),  "text-primary"],
                ["HONEYPOTS", String(activeHoneypots.length),"text-primary"],
                ["TRAPPED",   String(engine.totalTrapped),   "text-red-400"],
                ["REDIRECTS", String(engine.totalRedirects), "text-orange-400"],
                ["DECAYS",    String(engine.totalDecays),    "text-yellow-400/80"],
              ].map(([label, val, cls], i, arr) => (
                <span key={label} className="flex items-center gap-1">
                  <span className="text-primary/50">{label}:</span>
                  <span className={cls}>{val}</span>
                  {i < arr.length - 1 && <span className="text-primary/20 mx-1">|</span>}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={handleCollapse}
            disabled={engine.collapseActive}
            className={`flex items-center gap-2 border px-3 py-1.5 text-xs font-mono uppercase transition-all
              ${engine.collapseActive
                ? "border-orange-500/60 text-orange-400 animate-pulse cursor-not-allowed"
                : "border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500"}`}
          >
            <Skull className="w-3.5 h-3.5" />
            {engine.collapseActive ? `COLLAPSING… ${engine.collapseProgress}%` : "COLLAPSE WEB"}
          </button>
        </div>

        {engine.collapseActive && (
          <div className="mt-2 h-1 bg-orange-500/20 overflow-hidden">
            <div className="h-full bg-orange-500 transition-all duration-300"
              style={{ width: `${engine.collapseProgress}%` }} />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 shrink-0">
        {[
          { label: "ROUTES",     value: web?.totalRoutes ?? 0,      color: "text-primary"    },
          { label: "HIGHWAYS",   value: web?.activeHighways ?? 0,   color: "text-primary"    },
          { label: "DEAD ENDS",  value: web?.deadEndRoutes ?? 0,    color: "text-red-400"    },
          { label: "LIVE HPT",   value: activeHoneypots.length,     color: "text-primary"    },
          { label: "TRAPPED",    value: engine.totalTrapped,         color: "text-red-400"    },
          { label: "REDIRECTED", value: engine.totalRedirects,       color: "text-orange-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="border border-primary/10 bg-black/20 p-2.5">
            <div className="text-[9px] font-mono text-primary/40 uppercase mb-1">{label}</div>
            <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0">

        {/* Topology */}
        <div className="border border-primary/10 bg-black flex flex-col min-h-[300px]">
          <div className="px-3 py-2 border-b border-primary/10 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-mono text-primary/60 uppercase tracking-widest">Mesh Topology</span>
            <div className="flex gap-3 text-[8px] font-mono">
              {[["#00ff88","HIGHWAY"],["#ef4444","DEAD END"],["#eab308","DECOY"],["#f97316","COLLAPSE"]].map(([c,l]) => (
                <span key={l} className="flex items-center gap-0.5">
                  <span className="inline-block w-3 h-0.5" style={{ background: c }} />
                  <span className="text-primary/30">{l}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="flex-1 p-2">
            {routes.length > 0
              ? <SilkWebTopology routes={routes} trappedIds={trappedIds}
                  collapseActive={engine.collapseActive} webGeneration={engine.webGeneration} />
              : <div className="h-full flex items-center justify-center font-mono text-primary/20 text-xs uppercase tracking-widest">
                  Awaiting mesh data…
                </div>
            }
          </div>

          {/* Architecture key */}
          <div className="border-t border-primary/10 px-3 py-2 text-[8px] font-mono text-primary/30 space-y-1 shrink-0">
            <div className="flex justify-between">
              <span>Decay → Honeypot → Probe detected</span>
            </div>
            <div className="flex justify-between">
              <span>Inner hit → Redirect → Outer trap</span>
            </div>
            <div className="flex justify-between">
              <span>Collapse → Mass rotation → New geometry</span>
            </div>
          </div>
        </div>

        {/* Live event feed */}
        <div className="border border-primary/10 bg-black flex flex-col min-h-[300px]">
          <div className="px-3 py-2 border-b border-primary/10 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-mono text-primary/60 uppercase tracking-widest">Live Event Stream</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {EVENT_FILTERS.map(({ value, label }) => (
                <button key={value} onClick={() => setEventFilter(value)}
                  className={`text-[8px] font-mono uppercase px-1.5 py-0.5 border transition-colors
                    ${eventFilter === value
                      ? "bg-primary/20 border-primary/50 text-primary"
                      : "border-primary/15 text-primary/40 hover:text-primary hover:border-primary/30"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredEvents.map((ev) => (
              <div key={ev.id}
                className={`px-3 py-1.5 border-b border-primary/5 flex items-start gap-2
                  ${ev.severity === "critical" ? "bg-red-500/5" : ev.severity === "warn" ? "bg-yellow-400/3" : ""}`}>
                <div className="shrink-0 mt-0.5">{EVENT_ICON[ev.kind] ?? <Activity className="w-3 h-3" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[9px] font-mono uppercase tracking-wider ${EVENT_COLOR[ev.kind] ?? "text-primary/50"}`}>
                      {ev.kind.replace(/_/g, " ")}
                    </span>
                    <span className="text-[8px] font-mono text-primary/20 shrink-0">{format(ev.ts, "HH:mm:ss")}</span>
                  </div>
                  <div className="text-[9px] font-mono text-primary/40 mt-0.5 leading-tight">{ev.detail}</div>
                </div>
              </div>
            ))}
            {filteredEvents.length === 0 && (
              <div className="flex items-center justify-center h-32 text-[10px] font-mono text-primary/20 uppercase">
                No events matching filter
              </div>
            )}
          </div>
        </div>

        {/* Honeypots + traps */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="border border-primary/10 bg-black flex flex-col flex-1 min-h-[180px]">
            <div className="px-3 py-2 border-b border-primary/10 flex items-center gap-2 shrink-0">
              <Bug className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-mono text-primary/60 uppercase tracking-widest">
                Active Honeypots ({activeHoneypots.length})
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <div className="grid grid-cols-2 gap-1">
                {activeHoneypots.slice(0, 40).map((hp) => (
                  <div key={hp.id}
                    className={`border px-2 py-1 text-[9px] font-mono flex items-center justify-between
                      ${hp.layer === "inner" ? "border-cyan-400/20 bg-cyan-400/5" : "border-primary/15"}`}>
                    <div className="min-w-0">
                      <div className="text-primary truncate">{hp.ip}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[8px] ${hp.layer === "inner" ? "text-cyan-400/60" : "text-primary/40"}`}>
                          {hp.layer.toUpperCase()}
                        </span>
                        {hp.probeCount > 0 && (
                          <span className="text-orange-400/70 text-[8px]">×{hp.probeCount}</span>
                        )}
                      </div>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0 ml-1" />
                  </div>
                ))}
                {activeHoneypots.length === 0 && (
                  <div className="col-span-2 text-center text-[10px] font-mono text-primary/20 py-4 uppercase">
                    No active honeypots
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border border-red-500/20 bg-black flex flex-col" style={{ maxHeight: 260 }}>
            <div className="px-3 py-2 border-b border-red-500/20 flex items-center gap-2 shrink-0">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[10px] font-mono text-red-400/70 uppercase tracking-widest">
                Traps & Redirects ({trapEvents.length})
              </span>
            </div>
            <div className="overflow-y-auto flex-1">
              {trapEvents.slice(0, 20).map((e) => (
                <div key={e.id} className="px-3 py-1.5 border-b border-red-500/10 text-[9px] font-mono">
                  <div className="flex items-center gap-1.5">
                    {e.kind === "INNER_REDIRECT"
                      ? <ArrowRightLeft className="w-2.5 h-2.5 text-red-400 shrink-0" />
                      : <Skull className="w-2.5 h-2.5 text-red-500 shrink-0" />}
                    <span className={e.kind === "INNER_REDIRECT" ? "text-red-400" : "text-red-500"}>
                      {e.kind === "INNER_REDIRECT" ? "REDIRECTED" : "TRAPPED"}
                    </span>
                    <span className="text-primary/30 ml-auto">{format(e.ts, "HH:mm:ss")}</span>
                  </div>
                  <div className="text-primary/40 mt-0.5 leading-tight">{e.detail}</div>
                </div>
              ))}
              {trapEvents.length === 0 && (
                <div className="text-center text-[10px] font-mono text-primary/20 py-6 uppercase">
                  No trapped entities yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
