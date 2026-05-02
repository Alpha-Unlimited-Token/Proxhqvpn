// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useMemo, useState, useRef, useEffect } from "react";
import {
  useGetSilkWeb, useCollapseSilkWeb, useListTrappedAttackers, getGetSilkWebQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Network, Skull, ShieldAlert, Bug, Loader2, XCircle,
  Copy, Search, ChevronDown, Syringe, Globe, TerminalSquare, Download,
} from "lucide-react";
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
          <line key={`${r.id}`}
            x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}
            stroke={ROUTE_COLORS[r.routeType] ?? "#00ff88"}
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
            <circle cx={pos[0]} cy={pos[1]} r={4}
              fill={trapped ? "#ef4444" : "#00ff88"} fillOpacity={trapped ? 1 : 0.7} />
            {trapped && (
              <circle cx={pos[0]} cy={pos[1]} r={7} fill="none"
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

type PanelTab = "portscan" | "sqlmap";

// ── IP address dropdown menu ──────────────────────────────────────────────────
function IpDropdown({
  attacker,
  onOpen,
}: {
  attacker: AttackerRow;
  onOpen: (att: AttackerRow, tab: PanelTab) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const copyIp = () => {
    navigator.clipboard.writeText(attacker.ip);
    toast({ title: "Copied", description: `${attacker.ip} copied to clipboard` });
    setOpen(false);
  };

  const whois = () => {
    window.open(`https://search.arin.net/rdap/?query=${attacker.ip}`, "_blank");
    setOpen(false);
  };

  const actions = [
    {
      icon: <Search className="w-3.5 h-3.5" />,
      label: "Port Scan (nmap)",
      sub: "Discover open ports & services",
      color: "text-primary",
      onClick: () => { onOpen(attacker, "portscan"); setOpen(false); },
    },
    {
      icon: <Syringe className="w-3.5 h-3.5" />,
      label: "SQL Injection (SQLmap)",
      sub: "Test for SQL vulnerabilities & dump data",
      color: "text-red-400",
      onClick: () => { onOpen(attacker, "sqlmap"); setOpen(false); },
    },
    {
      icon: <Globe className="w-3.5 h-3.5" />,
      label: "WHOIS / ARIN Lookup",
      sub: "Identify owner — evidence for law enforcement",
      color: "text-blue-400",
      onClick: whois,
    },
    {
      icon: <Copy className="w-3.5 h-3.5" />,
      label: "Copy IP Address",
      sub: attacker.ip,
      color: "text-primary/60",
      onClick: copyIp,
    },
  ];

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex items-center gap-1 text-red-400 font-bold font-mono hover:text-red-300 transition-colors group"
      >
        <span className="underline underline-offset-2 decoration-red-500/40">{attacker.ip}</span>
        <ChevronDown className={`w-3 h-3 text-red-400/60 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-72 border border-yellow-500/40 bg-[#070c08] shadow-2xl shadow-black/80 rounded overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-yellow-500/20 bg-yellow-500/5">
            <div className="flex items-center gap-2">
              <TerminalSquare className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[10px] font-mono text-yellow-400 uppercase tracking-widest font-bold">
                Attacker Actions — {attacker.ip}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            {actions.map((a, i) => (
              <button
                key={i}
                onClick={a.onClick}
                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left group"
              >
                <span className={`${a.color} mt-0.5 shrink-0`}>{a.icon}</span>
                <div className="min-w-0">
                  <div className={`text-xs font-mono font-semibold ${a.color}`}>{a.label}</div>
                  <div className="text-[10px] text-primary/35 font-mono truncate">{a.sub}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer note */}
          <div className="px-3 py-2 border-t border-yellow-500/10 bg-black/40">
            <div className="text-[9px] font-mono text-primary/25 leading-relaxed">
              Use WHOIS to obtain ISP identity for law enforcement reporting.
              Port scan & SQLmap for authorized security testing only.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SilkWeb() {
  const { data: web }       = useGetSilkWeb({ query: { refetchInterval: 15000 } as any });
  const { data: attackers } = useListTrappedAttackers({ query: { refetchInterval: 8000 } as any });
  const queryClient         = useQueryClient();
  const { toast }           = useToast();
  const collapse            = useCollapseSilkWeb();
  const [selected, setSelected]       = useState<AttackerRow | null>(null);
  const [activeTab, setActiveTab]     = useState<PanelTab>("portscan");

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

  const openPanel = (att: AttackerRow, tab: PanelTab) => {
    setSelected(att);
    setActiveTab(tab);
  };

  const attackerList = (attackers?.attackers ?? []) as AttackerRow[];

  function downloadReport() {
    const rows = [["Time Trapped", "IP", "Fingerprint", "Loop Count", "Honeypot Port", "Probe Type", "SQLmap Status", "Data Collected"]];
    attackerList.forEach(a => rows.push([
      a.trappedAt ? new Date(a.trappedAt).toISOString() : "",
      a.ip ?? "",
      a.fingerprint ?? "",
      String(a.loopCount ?? 0),
      a.honeypotPort ? String(a.honeypotPort) : "",
      a.probeType ?? "",
      a.sqlmapStatus ?? "",
      a.dataCollected ?? "",
    ]));
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `proxhqvpn-silkweb-report-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
          <Network className="w-6 h-6" />
          Silk Web Traps
        </h2>
        <div className="flex items-center gap-2">
          {attackerList.length > 0 && (
            <button
              onClick={downloadReport}
              className="flex items-center gap-2 border border-primary/30 text-primary/70 px-4 py-1.5 text-xs font-mono uppercase hover:bg-primary/10 hover:border-primary transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              DOWNLOAD CSV
            </button>
          )}
          <button
            onClick={handleCollapse}
            disabled={collapse.isPending}
            className="flex items-center gap-2 border border-red-500/40 text-red-400 px-4 py-1.5 text-xs font-mono uppercase hover:bg-red-500/10 hover:border-red-500 transition-colors disabled:opacity-50"
          >
            <Skull className="w-4 h-4" />
            {collapse.isPending ? "COLLAPSING…" : "COLLAPSE WEB"}
          </button>
        </div>
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
              <span className="ml-auto text-primary/30 font-normal normal-case text-[10px]">Click IP for actions</span>
            </div>
            <div className="flex-1 overflow-auto">
              {attackerList.length === 0 && (
                <div className="h-full flex items-center justify-center font-mono text-primary/30 text-xs uppercase tracking-widest">
                  No entities currently trapped
                </div>
              )}
              {attackerList.map((att) => {
                const isActive = selected?.id === att.id;
                const statusColor =
                  att.sqlmapStatus === "complete" ? "text-primary" :
                  att.sqlmapStatus === "running"  ? "text-yellow-400" :
                  att.sqlmapStatus === "error"    ? "text-red-400"    : "text-primary/30";
                return (
                  <div
                    key={att.id}
                    className={`border-b border-primary/10 px-3 py-2.5 text-xs font-mono transition-colors ${isActive ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-primary/5"}`}
                  >
                    <div className="flex items-start gap-2 flex-wrap">
                      {/* Clickable IP with dropdown */}
                      <IpDropdown attacker={att} onOpen={openPanel} />

                      {att.honeypotPort && (
                        <span className="text-yellow-400/70 text-[10px] border border-yellow-500/20 px-1 rounded">
                          honeypot:{att.honeypotPort}
                        </span>
                      )}
                      {att.probeType && (
                        <span className="text-orange-400/60 text-[10px] border border-orange-500/20 px-1 rounded">
                          {att.probeType}
                        </span>
                      )}
                      <span className="text-primary/40">{format(new Date(att.trappedAt), "HH:mm dd/MM")}</span>
                      <span className="text-primary/40">loops:{att.loopCount}</span>
                      <span className={`ml-auto text-[10px] uppercase ${statusColor}`}>{att.sqlmapStatus ?? "idle"}</span>
                    </div>
                    <div className="text-primary/25 text-[10px] truncate mt-0.5">{att.fingerprint}</div>
                  </div>
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
              initialTab={activeTab}
              onTabChange={setActiveTab}
              onClose={() => setSelected(null)}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["listTrappedAttackers"] })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Full attacker command panel ───────────────────────────────────────────────
function AttackerCommandPanel({
  attacker, initialTab, onTabChange, onClose, onRefresh,
}: {
  attacker: AttackerRow;
  initialTab: PanelTab;
  onTabChange: (t: PanelTab) => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<PanelTab>(initialTab);

  useEffect(() => { setTab(initialTab); }, [initialTab]);

  // ── Port scan state ──────────────────────────────────────────────────────────
  const [scanPorts, setScanPorts] = useState("1-10000");
  const [scanFlags, setScanFlags] = useState("-sV -T4");
  const [scanning, setScanning]   = useState(false);
  const [scanOutput, setScanOutput] = useState<string | null>(null);
  const [scanCmd, setScanCmd]     = useState<string | null>(null);

  // ── SQLmap state ─────────────────────────────────────────────────────────────
  const [sqlTarget, setSqlTarget] = useState(`http://${attacker.ip}/`);
  const [sqlFlags, setSqlFlags]   = useState("--dbs --forms");
  const [sqlRunning, setSqlRunning] = useState(false);
  const [sqlOutput, setSqlOutput] = useState<string | null>(attacker.sqlmapResults ?? null);
  const [sqlJobId, setSqlJobId]   = useState<string | null>(attacker.sqlmapJobId ?? null);
  const [sqlStatus, setSqlStatus] = useState(attacker.sqlmapStatus ?? "idle");

  const switchTab = (t: PanelTab) => { setTab(t); onTabChange(t); };

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
      if (!res.ok) {
        toast({ title: "Port Scan Error", description: data.error, variant: "destructive" });
        setScanning(false); return;
      }
      setScanCmd(data.cmd);
      toast({ title: "Port Scan Launched", description: `Job ${data.jobId} — scanning ${attacker.ip}` });
      const poll = setInterval(async () => {
        try {
          const pr = await fetch(`${BASE}/api/silkweb/trapped/${attacker.id}/portscan/${data.jobId}`, { credentials: "include" });
          const pd = await pr.json();
          if (pd.status !== "running") {
            setScanOutput(pd.results ?? "No output");
            setScanning(false); clearInterval(poll);
          }
        } catch { /* ignore */ }
      }, 4000);
    } catch (e: any) {
      setScanOutput("Error: " + e.message);
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
        } catch { /* ignore poll error */ }
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
      <div className="flex items-center gap-3 p-3 border-b border-yellow-500/30 shrink-0 bg-yellow-500/5">
        <Bug className="w-4 h-4 text-yellow-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-yellow-400 font-mono text-sm">{attacker.ip}</div>
          <div className="text-[10px] text-primary/40 font-mono truncate">{attacker.fingerprint}</div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-primary/40 font-mono">
          {attacker.honeypotPort && (
            <span className="border border-yellow-500/30 text-yellow-400/70 px-1 rounded">honeypot:{attacker.honeypotPort}</span>
          )}
          <span>loops:{attacker.loopCount}</span>
          <span>{format(new Date(attacker.trappedAt), "HH:mm dd/MM")}</span>
        </div>
        <button onClick={onClose} className="text-primary/30 hover:text-white transition-colors ml-1 shrink-0">
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-yellow-500/20 shrink-0">
        <button
          onClick={() => switchTab("portscan")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-widest border-b-2 transition-colors ${
            tab === "portscan"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-primary/40 hover:text-primary/70"
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          Port Scan
        </button>
        <button
          onClick={() => switchTab("sqlmap")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-widest border-b-2 transition-colors ${
            tab === "sqlmap"
              ? "border-red-500 text-red-400 bg-red-500/5"
              : "border-transparent text-primary/40 hover:text-red-400/60"
          }`}
        >
          <Syringe className="w-3.5 h-3.5" />
          SQLmap Injection
          {sqlStatus === "running" && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />}
          {sqlStatus === "complete" && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </button>
        <div className="ml-auto flex items-center px-3">
          <a
            href={`https://search.arin.net/rdap/?query=${attacker.ip}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] font-mono text-blue-400/60 hover:text-blue-400 transition-colors border border-blue-500/20 hover:border-blue-500/50 px-2 py-1 rounded"
          >
            <Globe className="w-3 h-3" />
            WHOIS
          </a>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4">

        {/* ── PORT SCAN TAB ── */}
        {tab === "portscan" && (
          <div className="space-y-4">
            <div className="text-[10px] font-mono text-primary/40 border border-primary/10 rounded px-3 py-2 bg-primary/5">
              Runs <span className="text-primary">nmap</span> against <span className="text-primary">{attacker.ip}</span> to discover open ports, services, and software versions. Results can identify what the attacker is running on their machine.
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-primary/50 font-mono uppercase block mb-1">Port Range</label>
                <input
                  value={scanPorts}
                  onChange={(e) => setScanPorts(e.target.value)}
                  className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary/50 rounded"
                  placeholder="1-65535"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-primary/50 font-mono uppercase block mb-1">Nmap Flags</label>
                <input
                  value={scanFlags}
                  onChange={(e) => setScanFlags(e.target.value)}
                  className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary/50 rounded"
                  placeholder="-sV -T4"
                />
              </div>
            </div>

            {/* Quick flag presets */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Fast Top 1000", flags: "-F -T4" },
                { label: "Service Detect", flags: "-sV -T4 -p 1-10000" },
                { label: "OS Detect", flags: "-O -sV -T4" },
                { label: "Full Scan", flags: "-sV -O -T4 -p 1-65535" },
                { label: "UDP Top 100", flags: "-sU --top-ports 100" },
                { label: "Stealth SYN", flags: "-sS -T2 -p 1-10000" },
              ].map(({ label, flags }) => (
                <button
                  key={label}
                  onClick={() => setScanFlags(flags)}
                  className="px-2 py-1 border border-primary/20 text-primary/60 text-[10px] font-mono hover:border-primary/50 hover:text-primary transition-colors rounded"
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={runPortScan}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 border border-primary/40 text-primary text-xs font-mono uppercase hover:bg-primary/10 hover:border-primary transition-colors disabled:opacity-40 rounded"
            >
              {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              {scanning ? `Scanning ${attacker.ip}…` : `Run Port Scan — ${attacker.ip}`}
            </button>

            {scanCmd && (
              <div className="text-[10px] font-mono text-primary/30 bg-black border border-primary/10 px-2 py-1.5 rounded">
                $ {scanCmd}
              </div>
            )}
            {scanOutput && (
              <div className="bg-black border border-primary/15 p-3 text-[11px] font-mono text-primary/75 max-h-96 overflow-auto whitespace-pre-wrap rounded">
                {scanOutput}
              </div>
            )}
          </div>
        )}

        {/* ── SQLMAP TAB ── */}
        {tab === "sqlmap" && (
          <div className="space-y-4">
            <div className="text-[10px] font-mono text-red-400/50 border border-red-500/15 rounded px-3 py-2 bg-red-500/5">
              Runs <span className="text-red-400">SQLmap</span> against a target URL associated with <span className="text-red-400">{attacker.ip}</span>. Use this to test for SQL injection vulnerabilities — results may expose the attacker's database and help identify them for law enforcement.
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-primary/50 font-mono uppercase block mb-1">Target URL</label>
                <input
                  value={sqlTarget}
                  onChange={(e) => setSqlTarget(e.target.value)}
                  className="w-full bg-black border border-red-500/25 text-red-300 text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-red-500/60 rounded"
                  placeholder={`http://${attacker.ip}/`}
                />
              </div>
              <div>
                <label className="text-[10px] text-primary/50 font-mono uppercase block mb-1">SQLmap Flags</label>
                <input
                  value={sqlFlags}
                  onChange={(e) => setSqlFlags(e.target.value)}
                  className="w-full bg-black border border-red-500/25 text-red-300 text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-red-500/60 rounded"
                  placeholder="--dbs --forms --tables -D dbname"
                />
              </div>
            </div>

            {/* Preset quick-launch buttons */}
            <div>
              <div className="text-[10px] text-primary/40 font-mono uppercase mb-2">Quick Presets</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Enumerate DBs",   flags: "--dbs",                                     desc: "List all databases" },
                  { label: "Dump Tables",     flags: "--tables --dbs",                             desc: "List all tables" },
                  { label: "Blind SQLi",      flags: "--technique=B --level=3 --risk=2",           desc: "Boolean-based blind" },
                  { label: "Time-Based",      flags: "--technique=T --level=3",                    desc: "Time-delay blind" },
                  { label: "Error-Based",     flags: "--technique=E --dbs",                        desc: "Error extraction" },
                  { label: "Full Dump",       flags: "--level=5 --risk=3 --dbs --tables --dump-all", desc: "Maximum extraction" },
                  { label: "Get Users",       flags: "--users --passwords",                        desc: "Extract DB credentials" },
                  { label: "OS Shell",        flags: "--os-shell",                                 desc: "Attempt OS command shell" },
                ].map(({ label, flags, desc }) => (
                  <button
                    key={label}
                    onClick={() => setSqlFlags(flags)}
                    className="flex flex-col items-start px-2.5 py-2 border border-red-500/20 text-left hover:border-red-500/50 hover:bg-red-500/5 transition-colors rounded"
                  >
                    <span className="text-red-400/80 text-[10px] font-mono font-semibold">{label}</span>
                    <span className="text-primary/30 text-[9px] font-mono">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={runSqlmap}
                disabled={sqlRunning}
                className="flex items-center gap-2 px-4 py-2 border border-red-500/50 text-red-400 text-xs font-mono uppercase hover:bg-red-500/10 hover:border-red-500 transition-colors disabled:opacity-40 rounded"
              >
                {sqlRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Syringe className="w-3.5 h-3.5" />}
                {sqlRunning ? `SQLmap Running on ${attacker.ip}…` : `Launch SQLmap — ${attacker.ip}`}
              </button>
              <div className="flex items-center gap-2">
                {statusBadge(sqlStatus)}
                {sqlJobId && <span className="text-[10px] text-primary/30 font-mono">JOB:{sqlJobId}</span>}
              </div>
            </div>

            {sqlOutput && (
              <div className="bg-black border border-red-500/15 p-3 text-[11px] font-mono text-red-300/75 max-h-96 overflow-auto whitespace-pre-wrap rounded">
                {sqlOutput}
              </div>
            )}
            {sqlStatus === "running" && !sqlOutput && (
              <div className="flex items-center gap-2 text-yellow-400 text-xs font-mono border border-yellow-500/20 rounded px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                SQLmap scanning {attacker.ip} — polling every 4s for results…
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    idle: "text-primary/40", running: "text-yellow-400 animate-pulse",
    complete: "text-primary", error: "text-red-400",
  };
  return (
    <span className={`text-[10px] font-mono uppercase border px-1.5 py-0.5 rounded border-current ${map[s] ?? "text-primary/40"}`}>
      {s}
    </span>
  );
}
