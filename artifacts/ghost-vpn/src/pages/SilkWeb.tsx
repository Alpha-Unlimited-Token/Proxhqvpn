import { useMemo, useState } from "react";
import {
  useGetSilkWeb, useCollapseSilkWeb, useListTrappedAttackers, getGetSilkWebQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Network, Skull, ShieldAlert, Bug, ChevronDown, ChevronUp, Loader2, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

type AttackerRow = {
  id: number; ip: string; fingerprint: string; entryNodeId: number;
  loopCount: number; trappedAt: string; dataCollected: string;
  honeypotPort?: number | null; probeType?: string | null;
  sqlmapStatus?: string | null; sqlmapJobId?: string | null;
  sqlmapResults?: string | null; sqlmapStartedAt?: string | null;
  sqlmapFinishedAt?: string | null;
};

export default function SilkWeb() {
  const { data: web }       = useGetSilkWeb({ query: { refetchInterval: 15000 } as any });
  const { data: attackers } = useListTrappedAttackers({ query: { refetchInterval: 8000 } as any });
  const queryClient         = useQueryClient();
  const { toast }           = useToast();
  const collapse            = useCollapseSilkWeb();
  const [selected, setSelected] = useState<AttackerRow | null>(null);

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

  const attackerList = (attackers?.attackers ?? []) as AttackerRow[];

  return (
    <div className="space-y-4 h-full flex flex-col">
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

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        {[
          { label: "Total Routes",  value: web?.totalRoutes ?? 0,     color: "text-primary" },
          { label: "Dead Ends",     value: web?.deadEndRoutes ?? 0,   color: "text-red-400" },
          { label: "Highways",      value: web?.activeHighways ?? 0,  color: "text-primary" },
          { label: "Trapped",       value: attackerList.length,       color: "text-yellow-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="border border-primary/20 bg-black p-3">
            <div className="text-[9px] font-mono text-primary/50 uppercase mb-1">{label}</div>
            <div className={`font-bold font-mono text-2xl ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Main area: topology + list, with command panel slide-over */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-4 min-h-0">

        {/* Left: topology + attacker list */}
        <div className={`flex flex-col gap-4 transition-all duration-300 ${selected ? "lg:w-[40%]" : "w-full"}`}>
          {/* Topology */}
          <div className="border border-primary/20 rounded bg-black flex flex-col min-h-[220px] overflow-hidden" style={{ flex: selected ? "0 0 220px" : "0 0 280px" }}>
            <div className="p-2 border-b border-primary/20 flex items-center justify-between shrink-0">
              <span className="text-xs font-mono text-primary/60 uppercase tracking-widest">Topology Map</span>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                {[["#00ff88","HWY"],["#ef4444","DEAD"],["#eab308","DECOY"],["#f97316","COLLAPSE"]].map(([c,l]) => (
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
                : <div className="h-full flex items-center justify-center font-mono text-primary/30 text-xs uppercase tracking-widest">Awaiting web data…</div>
              }
            </div>
          </div>

          {/* Attacker list */}
          <div className="border border-primary/20 rounded bg-black flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="p-3 border-b border-primary/20 flex items-center gap-2 text-red-400 font-bold text-xs tracking-widest uppercase shrink-0">
              <ShieldAlert className="w-4 h-4" />
              Trapped Entities ({attackerList.length})
              <span className="ml-auto text-primary/30 font-normal normal-case text-[10px]">Click IP to open command panel</span>
            </div>
            <div className="flex-1 overflow-auto">
              {attackerList.length === 0 && (
                <div className="h-full flex items-center justify-center font-mono text-primary/30 text-xs uppercase tracking-widest">
                  No entities currently trapped
                </div>
              )}
              {attackerList.map((att) => {
                const isActive = selected?.id === att.id;
                const statusColor = att.sqlmapStatus === "complete" ? "text-primary" : att.sqlmapStatus === "running" ? "text-yellow-400" : att.sqlmapStatus === "error" ? "text-red-400" : "text-primary/30";
                return (
                  <button
                    key={att.id}
                    onClick={() => setSelected(isActive ? null : att)}
                    className={`w-full text-left border-b border-primary/10 px-3 py-2 text-xs font-mono hover:bg-primary/5 transition-colors flex items-center gap-2 ${isActive ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-red-400 font-bold underline underline-offset-2 cursor-pointer">{att.ip}</span>
                        {att.honeypotPort && (
                          <span className="text-yellow-400/70 text-[10px] border border-yellow-500/20 px-1 rounded">honeypot:{att.honeypotPort}</span>
                        )}
                        <span className="text-primary/40">{format(new Date(att.trappedAt), "HH:mm dd/MM")}</span>
                        <span className="text-primary/40">loops:{att.loopCount}</span>
                      </div>
                      <div className="text-primary/25 text-[10px] truncate">{att.fingerprint}</div>
                    </div>
                    <span className={`text-[10px] uppercase ${statusColor}`}>{att.sqlmapStatus ?? "idle"}</span>
                    <ChevronDown className={`w-3 h-3 text-primary/30 transition-transform ${isActive ? "rotate-180" : ""}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: attacker command panel */}
        {selected && (
          <div className="lg:flex-1 border border-yellow-500/30 rounded bg-black flex flex-col min-h-0 overflow-hidden">
            <AttackerCommandPanel
              attacker={selected}
              onClose={() => setSelected(null)}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["listTrappedAttackers"] })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Full attacker command panel (opens when you click an IP) ──────────────────
function AttackerCommandPanel({
  attacker, onClose, onRefresh,
}: {
  attacker: AttackerRow;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();

  // ── Port scan state ─────────────────────────────────────────────────────────
  const [scanPorts, setScanPorts] = useState("1-10000");
  const [scanFlags, setScanFlags] = useState("-sV -T4");
  const [scanning, setScanning] = useState(false);
  const [scanOutput, setScanOutput] = useState<string | null>(null);
  const [scanCmd, setScanCmd] = useState<string | null>(null);

  // ── SQLmap state ────────────────────────────────────────────────────────────
  const [sqlTarget, setSqlTarget] = useState(`http://${attacker.ip}/`);
  const [sqlFlags, setSqlFlags] = useState("--dbs --forms");
  const [sqlRunning, setSqlRunning] = useState(false);
  const [sqlOutput, setSqlOutput] = useState<string | null>(
    attacker.sqlmapResults ?? null
  );
  const [sqlJobId, setSqlJobId] = useState<string | null>(attacker.sqlmapJobId ?? null);
  const [sqlStatus, setSqlStatus] = useState(attacker.sqlmapStatus ?? "idle");

  const runPortScan = async () => {
    setScanning(true);
    setScanOutput(null);
    setScanCmd(null);
    try {
      const res = await fetch(`${BASE}/api/silkweb/trapped/${attacker.id}/portscan`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ports: scanPorts, flags: scanFlags }),
      });
      const data = await res.json();
      setScanCmd(data.cmd);
      setScanOutput(data.output);
      if (!res.ok) toast({ title: "Port Scan Error", description: data.error, variant: "destructive" });
    } catch (e: any) {
      setScanOutput("Error: " + e.message);
    } finally {
      setScanning(false);
    }
  };

  const runSqlmap = async () => {
    setSqlRunning(true);
    setSqlOutput(null);
    setSqlStatus("running");
    try {
      const res = await fetch(`${BASE}/api/silkweb/trapped/${attacker.id}/sqlmap`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: sqlTarget, extraFlags: sqlFlags }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSqlStatus("error");
        setSqlOutput(data.error ?? "Unknown error");
        toast({ title: "SQLmap Error", description: data.error, variant: "destructive" });
        setSqlRunning(false);
        return;
      }
      setSqlJobId(data.jobId);
      toast({ title: "SQLmap Launched", description: `Job ${data.jobId} — scanning ${attacker.ip}` });

      // Poll for completion
      const poll = setInterval(async () => {
        try {
          const pr = await fetch(`${BASE}/api/silkweb/trapped/${attacker.id}/sqlmap`, { credentials: "include" });
          const pd = await pr.json();
          if (pd.status !== "running") {
            setSqlStatus(pd.status ?? "complete");
            setSqlOutput(pd.results ?? "No output");
            setSqlRunning(false);
            onRefresh();
            clearInterval(poll);
          }
        } catch { /* ignore */ }
      }, 4000);
    } catch (e: any) {
      setSqlStatus("error");
      setSqlOutput("Error: " + e.message);
      setSqlRunning(false);
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      idle: "text-primary/40", running: "text-yellow-400 animate-pulse",
      complete: "text-primary", error: "text-red-400",
    };
    return (
      <span className={`text-[10px] font-mono uppercase border px-1.5 py-0.5 rounded border-current ${map[s] ?? "text-primary/40"}`}>
        {s}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-yellow-500/30 shrink-0">
        <Bug className="w-4 h-4 text-yellow-400" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-yellow-400 font-mono text-sm">{attacker.ip}</div>
          <div className="text-[10px] text-primary/40 font-mono truncate">{attacker.fingerprint}</div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-primary/40 font-mono">
          {attacker.honeypotPort && <span className="border border-yellow-500/30 text-yellow-400/70 px-1 rounded">honeypot:{attacker.honeypotPort}</span>}
          <span>loops:{attacker.loopCount}</span>
          <span>{format(new Date(attacker.trappedAt), "HH:mm dd/MM")}</span>
        </div>
        <button onClick={onClose} className="text-primary/30 hover:text-white transition-colors ml-2">
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">

        {/* ── PORT SCAN ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Network className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono font-bold text-primary uppercase tracking-widest">Port Scan</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <div className="flex-1">
              <label className="text-[10px] text-primary/50 font-mono uppercase block mb-1">Port Range</label>
              <input
                value={scanPorts}
                onChange={(e) => setScanPorts(e.target.value)}
                className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary/50"
                placeholder="1-65535"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-primary/50 font-mono uppercase block mb-1">Nmap Flags</label>
              <input
                value={scanFlags}
                onChange={(e) => setScanFlags(e.target.value)}
                className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary/50"
                placeholder="-sV -T4"
              />
            </div>
          </div>

          <button
            onClick={runPortScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-1.5 border border-primary/40 text-primary text-xs font-mono uppercase hover:bg-primary/10 hover:border-primary transition-colors disabled:opacity-40"
          >
            {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Network className="w-3 h-3" />}
            {scanning ? "Scanning…" : `Run Port Scan — ${attacker.ip}`}
          </button>

          {scanCmd && (
            <div className="mt-2 text-[10px] font-mono text-primary/30 bg-black border border-primary/10 px-2 py-1">
              $ {scanCmd}
            </div>
          )}
          {scanOutput && (
            <div className="mt-2 bg-black border border-primary/10 p-3 text-[11px] font-mono text-primary/70 max-h-64 overflow-auto whitespace-pre-wrap">
              {scanOutput}
            </div>
          )}
        </section>

        {/* ── SQLMAP ── */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <Bug className="w-4 h-4 text-red-400" />
            <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-widest">SQL Injection (SQLmap)</span>
            {statusBadge(sqlStatus)}
            {sqlJobId && <span className="text-[10px] text-primary/30 font-mono">JOB:{sqlJobId}</span>}
          </div>

          <div className="flex flex-col gap-2 mb-2">
            <div>
              <label className="text-[10px] text-primary/50 font-mono uppercase block mb-1">Target URL</label>
              <input
                value={sqlTarget}
                onChange={(e) => setSqlTarget(e.target.value)}
                className="w-full bg-black border border-red-500/20 text-red-300 text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-red-500/50"
                placeholder={`http://${attacker.ip}/`}
              />
            </div>
            <div>
              <label className="text-[10px] text-primary/50 font-mono uppercase block mb-1">Extra SQLmap Flags</label>
              <input
                value={sqlFlags}
                onChange={(e) => setSqlFlags(e.target.value)}
                className="w-full bg-black border border-red-500/20 text-red-300 text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-red-500/50"
                placeholder="--dbs --forms --tables -D dbname"
              />
            </div>
          </div>

          {/* Preset quick-launch buttons */}
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { label: "Enumerate DBs", flags: "--dbs" },
              { label: "Dump Tables", flags: "--tables --dbs" },
              { label: "Blind SQLi", flags: "--technique=B --level=3 --risk=2" },
              { label: "Time-Based", flags: "--technique=T --level=3" },
              { label: "Error-Based", flags: "--technique=E --dbs" },
              { label: "Full Scan", flags: "--level=5 --risk=3 --dbs --tables --dump-all" },
            ].map(({ label, flags }) => (
              <button
                key={label}
                onClick={() => setSqlFlags(flags)}
                className="px-2 py-1 border border-red-500/20 text-red-400/70 text-[10px] font-mono hover:border-red-500/50 hover:text-red-400 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={runSqlmap}
            disabled={sqlRunning}
            className="flex items-center gap-2 px-4 py-1.5 border border-red-500/50 text-red-400 text-xs font-mono uppercase hover:bg-red-500/10 hover:border-red-500 transition-colors disabled:opacity-40"
          >
            {sqlRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bug className="w-3 h-3" />}
            {sqlRunning ? "SQLmap Running…" : `Launch SQLmap — ${attacker.ip}`}
          </button>

          {sqlOutput && (
            <div className="mt-3 bg-black border border-red-500/10 p-3 text-[11px] font-mono text-red-300/70 max-h-80 overflow-auto whitespace-pre-wrap">
              {sqlOutput}
            </div>
          )}
          {sqlStatus === "running" && !sqlOutput && (
            <div className="mt-3 flex items-center gap-2 text-yellow-400 text-xs font-mono">
              <Loader2 className="w-3 h-3 animate-spin" />
              SQLmap scanning {attacker.ip} — results will appear when complete…
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
