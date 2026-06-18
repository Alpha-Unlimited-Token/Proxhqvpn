// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Threat Bus Dashboard — real-time triple-layer security escalation monitor.
import { useEffect, useRef, useState, useCallback } from "react";
import { Shield, Skull, Network, Zap, AlertTriangle, CheckCircle, ChevronRight, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ThreatEvent {
  id: number;
  eventType: string;
  sourceLayer: string;
  targetLayer: string | null;
  attackerIp: string;
  threatScore: number | null;
  reason: string | null;
  escalatedAt: string;
}

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  SUSPECT_IP_DETECTED:       { label: "Suspect Detected",       color: "text-yellow-400" },
  LURE_TRIGGERED:            { label: "Lure Triggered",         color: "text-orange-400" },
  ENTITY_TRAPPED:            { label: "Entity Trapped",         color: "text-red-400" },
  DECEPTION_ROUTE_ACTIVATED: { label: "Deception Route Active", color: "text-purple-400" },
  HARD_BLOCK_ENFORCED:       { label: "Hard Block Enforced",    color: "text-red-600" },
  MANUAL_ESCALATION:         { label: "Manual Escalation",      color: "text-primary" },
};

const LAYER_META = {
  firewall:   { label: "Firewall",   icon: Shield,  color: "border-blue-500/40 bg-blue-500/5",   badge: "bg-blue-500/20 text-blue-300",   dot: "bg-blue-400"    },
  ghost_trap: { label: "Ghost Trap", icon: Skull,   color: "border-orange-500/40 bg-orange-500/5", badge: "bg-orange-500/20 text-orange-300", dot: "bg-orange-400" },
  ghost_nodes:{ label: "Ghost Nodes",icon: Network, color: "border-purple-500/40 bg-purple-500/5", badge: "bg-purple-500/20 text-purple-300", dot: "bg-purple-400" },
};

function LayerCard({ layer, events, className }: { layer: keyof typeof LAYER_META; events: ThreatEvent[]; className?: string }) {
  const meta   = LAYER_META[layer];
  const Icon   = meta.icon;
  const count  = events.filter(e => e.sourceLayer === layer || e.targetLayer === layer).length;
  const active = events.filter(e => (e.sourceLayer === layer || e.targetLayer === layer) &&
    Date.now() - new Date(e.escalatedAt).getTime() < 60_000).length;

  return (
    <div className={cn("rounded-2xl border p-5 flex flex-col gap-3 transition-all duration-500", meta.color, className)}>
      <div className="flex items-center gap-3">
        <div className={cn("rounded-xl p-2.5", meta.badge)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-bold text-white">{meta.label}</div>
          <div className="text-[11px] text-white/40">Layer {layer === "firewall" ? "1" : layer === "ghost_trap" ? "2" : "3"}</div>
        </div>
        {active > 0 && (
          <span className={cn("ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", meta.badge)}>
            <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", meta.dot)} />
            {active} active
          </span>
        )}
      </div>
      <div className="text-2xl font-black text-white tabular-nums">{count}</div>
      <div className="text-[11px] text-white/40">events in session</div>
    </div>
  );
}

function EventRow({ ev }: { ev: ThreatEvent }) {
  const meta   = EVENT_TYPE_LABELS[ev.eventType] ?? { label: ev.eventType, color: "text-white/60" };
  const age    = Math.round((Date.now() - new Date(ev.escalatedAt).getTime()) / 1000);
  const ageStr = age < 60 ? `${age}s ago` : age < 3600 ? `${Math.floor(age/60)}m ago` : `${Math.floor(age/3600)}h ago`;
  const srcMeta = LAYER_META[ev.sourceLayer as keyof typeof LAYER_META];
  const dstMeta = ev.targetLayer ? LAYER_META[ev.targetLayer as keyof typeof LAYER_META] : null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs animate-in fade-in slide-in-from-bottom-1">
      <div className="w-28 font-mono text-white/50 shrink-0">{ev.attackerIp}</div>
      <span className={cn("font-semibold shrink-0", meta.color)}>{meta.label}</span>
      <div className="flex items-center gap-1 text-white/30 shrink-0">
        {srcMeta && <span className={cn("rounded px-1.5 py-0.5 font-medium text-[10px]", srcMeta.badge)}>{srcMeta.label}</span>}
        {dstMeta && <><ChevronRight className="h-3 w-3" /><span className={cn("rounded px-1.5 py-0.5 font-medium text-[10px]", dstMeta.badge)}>{dstMeta.label}</span></>}
      </div>
      {ev.threatScore !== null && (
        <span className={cn("ml-auto shrink-0 font-bold tabular-nums", ev.threatScore >= 80 ? "text-red-400" : ev.threatScore >= 50 ? "text-orange-400" : "text-yellow-400")}>
          {ev.threatScore}
        </span>
      )}
      <span className="text-white/30 shrink-0 w-14 text-right">{ageStr}</span>
    </div>
  );
}

export default function ThreatBusDashboard() {
  const { toast } = useToast();
  const [events, setEvents] = useState<ThreatEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [manualIp, setManualIp] = useState("");
  const [manualScore, setManualScore] = useState(90);
  const [escalating, setEscalating] = useState(false);
  const [stats, setStats] = useState<{ total: number; byType: Record<string, number>; byLayer: Record<string, number>; clients: number } | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // ── SSE connection ─────────────────────────────────────────────────────────
  useEffect(() => {
    const connect = () => {
      const es = new EventSource("/api/threat-bus/stream");
      esRef.current = es;

      es.onopen = () => setConnected(true);

      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "snapshot") {
            setEvents(msg.events ?? []);
          } else if (msg.type === "event" && msg.event) {
            setEvents(prev => [msg.event, ...prev].slice(0, 200));
          } else if (msg.channel && msg.payload) {
            // Service-bus event forwarded via SSE
            const synthetic: ThreatEvent = {
              id: Date.now(),
              eventType: msg.channel === "firewall.escalate_ghost_trap" ? "LURE_TRIGGERED"
                : msg.channel === "ghost_trap.escalate_ghost_node" ? "DECEPTION_ROUTE_ACTIVATED"
                : msg.channel === "ghost_node.escalate_firewall" ? "HARD_BLOCK_ENFORCED"
                : "SUSPECT_IP_DETECTED",
              sourceLayer: msg.source ?? "unknown",
              targetLayer: null,
              attackerIp: msg.payload?.ip ?? "unknown",
              threatScore: msg.payload?.threatScore ?? null,
              reason: msg.payload?.reason ?? null,
              escalatedAt: msg.timestamp ?? new Date().toISOString(),
            };
            setEvents(prev => [synthetic, ...prev].slice(0, 200));
          }
        } catch {}
      };

      es.onerror = () => { setConnected(false); es.close(); setTimeout(connect, 3000); };
    };

    connect();
    return () => { esRef.current?.close(); };
  }, []);

  // ── Stats polling ──────────────────────────────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch("/api/threat-bus/stats");
        if (r.ok) setStats(await r.json());
      } catch {}
    };
    poll();
    const t = setInterval(poll, 10_000);
    return () => clearInterval(t);
  }, []);

  // ── Manual one-click escalation ────────────────────────────────────────────
  const handleEscalate = useCallback(async () => {
    if (!manualIp) return;
    setEscalating(true);
    try {
      const r = await fetch("/api/threat-bus/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: manualIp, threatScore: manualScore, reason: "Manual one-click escalation via Threat Bus Dashboard" }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "Escalated through all three layers", description: `${manualIp} → Firewall + Ghost Trap + Ghost Nodes` });
      setManualIp("");
    } catch (err: any) {
      toast({ title: "Escalation failed", description: err.message, variant: "destructive" });
    } finally {
      setEscalating(false);
    }
  }, [manualIp, manualScore, toast]);

  const firewallEvents   = events.filter(e => e.sourceLayer === "firewall"    || e.targetLayer === "firewall");
  const ghostTrapEvents  = events.filter(e => e.sourceLayer === "ghost_trap"  || e.targetLayer === "ghost_trap");
  const ghostNodesEvents = events.filter(e => e.sourceLayer === "ghost_nodes" || e.targetLayer === "ghost_nodes");

  return (
    <div className="min-h-screen bg-[#0a0f14] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Threat Bus</h1>
          <p className="text-sm text-white/40 mt-0.5">Triple-layer security escalation — Firewall → Ghost Trap → Ghost Nodes</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
            connected ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400")}>
            <Activity className="h-3 w-3" />
            {connected ? `SSE Live${stats ? ` · ${stats.clients} client${stats.clients !== 1 ? "s" : ""}` : ""}` : "Reconnecting…"}
          </span>
        </div>
      </div>

      {/* Layer status cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <LayerCard layer="firewall"    events={events} />
        <LayerCard layer="ghost_trap"  events={events} />
        <LayerCard layer="ghost_nodes" events={events} />
      </div>

      {/* Flow diagram */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <div className="text-xs font-bold uppercase tracking-widest text-white/30 mb-4">Escalation Pipeline</div>
        <div className="flex items-center gap-2 flex-wrap">
          {(["firewall", "ghost_trap", "ghost_nodes"] as const).map((layer, i) => {
            const meta  = LAYER_META[layer];
            const Icon  = meta.icon;
            const count = events.filter(e => e.sourceLayer === layer).length;
            return (
              <div key={layer} className="flex items-center gap-2">
                <div className={cn("flex items-center gap-2 rounded-xl border px-4 py-2.5", meta.color)}>
                  <Icon className="h-4 w-4 text-white/70" />
                  <span className="text-sm font-semibold text-white">{meta.label}</span>
                  {count > 0 && <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", meta.badge)}>{count}</span>}
                </div>
                {i < 2 && (
                  <div className="flex flex-col items-center gap-0.5">
                    <Zap className="h-4 w-4 text-primary/60 animate-pulse" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Event type breakdown */}
        {stats && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(stats.byType).map(([type, count]) => {
              const meta = EVENT_TYPE_LABELS[type] ?? { label: type, color: "text-white/50" };
              return (
                <div key={type} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <span className={cn("text-xs font-medium", meta.color)}>{meta.label}</span>
                  <span className="text-xs font-bold text-white tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* One-click escalation */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">One-Click: Escalate IP Through All Three Layers</div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-white/40">Attacker IP</label>
            <input
              type="text"
              placeholder="e.g. 192.168.1.100"
              value={manualIp}
              onChange={e => setManualIp(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleEscalate(); }}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/40 w-48"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-white/40">Threat Score (0–100)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={manualScore}
              onChange={e => setManualScore(parseInt(e.target.value, 10))}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary/40 w-24"
            />
          </div>
          <button
            onClick={handleEscalate}
            disabled={escalating || !manualIp}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-black transition-all hover:bg-primary/80 disabled:opacity-40"
          >
            <AlertTriangle className="h-4 w-4" />
            {escalating ? "Escalating…" : "Escalate All Layers"}
          </button>
        </div>
      </div>

      {/* Live event feed */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-bold uppercase tracking-widest text-white/30">Live Escalation Feed</div>
          <span className="text-[11px] text-white/30">{events.length} events</span>
        </div>
        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-white/20">
            <CheckCircle className="h-8 w-8" />
            <span className="text-sm">No escalation events yet — system is quiet</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-[480px] overflow-y-auto">
            {events.map(ev => <EventRow key={ev.id} ev={ev} />)}
          </div>
        )}
      </div>
    </div>
  );
}
