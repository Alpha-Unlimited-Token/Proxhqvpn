// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// ConnectionApprovalPopup — Global overlay that polls /api/firewall/connection-queue
// every 5 seconds and shows a non-intrusive bottom-right panel when unknown/suspicious
// connections are waiting for admin approval.
// Actions: Allow (whitelist) | Block (add to blocked IPs) | Trap (GhostTrap loop)
import React, { useEffect, useState, useCallback } from "react";
import { Shield, ShieldAlert, Ban, Bug, X, ChevronDown, ChevronUp, Globe, Crosshair, Clock } from "lucide-react";
import { toast } from "sonner";

interface QueueEntry {
  id: number;
  ip: string;
  sourcePort: number | null;
  destPort: number | null;
  protocol: string;
  detectedFrom: string;
  attackType: string | null;
  anomalyScore: number;
  payload: string | null;
  userAgent: string | null;
  geoCountry: string | null;
  geoIsp: string | null;
  reason: string | null;
  status: string;
  createdAt: string;
}

const SEVERITY_COLOR = (score: number) => {
  if (score >= 40) return "text-red-400 border-red-500/40";
  if (score >= 25) return "text-orange-400 border-orange-500/40";
  if (score >= 10) return "text-yellow-400 border-yellow-500/40";
  return "text-green-400 border-green-500/40";
};

const SEVERITY_LABEL = (score: number) => {
  if (score >= 40) return "CRITICAL";
  if (score >= 25) return "HIGH";
  if (score >= 10) return "MEDIUM";
  return "LOW";
};

const SOURCE_ICON: Record<string, React.ReactNode> = {
  waf:       <ShieldAlert className="w-3 h-3 text-orange-400" />,
  ghosttrap: <Bug className="w-3 h-3 text-purple-400" />,
  beacon:    <Globe className="w-3 h-3 text-blue-400" />,
  ips:       <Crosshair className="w-3 h-3 text-red-400" />,
  manual:    <Shield className="w-3 h-3 text-green-400" />,
};

async function resolveEntry(id: number, action: "approve" | "deny" | "trap" | "dismiss"): Promise<boolean> {
  try {
    const url = action === "dismiss"
      ? `/api/firewall/connection-queue/${id}`
      : `/api/firewall/connection-queue/${id}/${action}`;
    const method = action === "dismiss" ? "DELETE" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" } });
    return res.ok;
  } catch {
    return false;
  }
}

export function ConnectionApprovalPopup() {
  const [entries, setEntries]       = useState<QueueEntry[]>([]);
  const [expanded, setExpanded]     = useState(true);
  const [resolving, setResolving]   = useState<Set<number>>(new Set());
  const [dismissed, setDismissed]   = useState(false);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/firewall/connection-queue?status=pending&limit=5");
      if (!res.ok) return;
      const data = await res.json() as { entries: QueueEntry[] };
      const newEntries = data.entries ?? [];

      // Notify if new entries arrived
      setEntries(prev => {
        const prevIds = new Set(prev.map(e => e.id));
        const truly_new = newEntries.filter(e => !prevIds.has(e.id));
        if (truly_new.length > 0) {
          setDismissed(false); // re-open if new items come in
          setExpanded(true);
          if (truly_new.length === 1) {
            toast.warning(`⚠ Connection approval needed: ${truly_new[0]!.ip}`, {
              description: truly_new[0]!.reason ?? truly_new[0]!.attackType ?? "Suspicious connection",
              duration: 8000,
            });
          } else {
            toast.warning(`⚠ ${truly_new.length} connections awaiting approval`, { duration: 6000 });
          }
        }
        return newEntries;
      });
    } catch { /* network error, skip */ }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const handleAction = useCallback(async (id: number, action: "approve" | "deny" | "trap" | "dismiss") => {
    setResolving(prev => new Set(prev).add(id));
    const ok = await resolveEntry(id, action);
    if (ok) {
      setEntries(prev => prev.filter(e => e.id !== id));
      const labels = { approve: "Allowed", deny: "Blocked", trap: "Trapped in GhostTrap™", dismiss: "Dismissed" };
      const colors = { approve: "success", deny: "error", trap: "warning", dismiss: "info" } as const;
      const entry = entries.find(e => e.id === id);
      if (entry) {
        if (action === "approve") toast.success(`✓ ${labels[action]}: ${entry.ip}`);
        else if (action === "deny")    toast.error(`🚫 ${labels[action]}: ${entry.ip}`);
        else if (action === "trap")    toast.warning(`🕷 ${labels[action]}: ${entry.ip}`);
        else                           toast.info(`${labels[action]}: ${entry.ip}`);
      }
    } else {
      toast.error("Action failed — please try again");
    }
    setResolving(prev => { const s = new Set(prev); s.delete(id); return s; });
  }, [entries]);

  // Nothing pending → invisible
  if (entries.length === 0 || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[340px] shadow-2xl rounded-xl overflow-hidden border border-white/10 bg-gray-950/95 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-orange-950/60 border-b border-orange-500/30">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-orange-400 animate-pulse" />
          <span className="text-[11px] font-semibold text-orange-300 tracking-wide uppercase">
            Connection Approval
          </span>
          <span className="text-[10px] bg-orange-500/30 text-orange-300 px-1.5 py-0.5 rounded-full font-bold">
            {entries.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1 text-white/40 hover:text-white/70 transition-colors rounded"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-white/40 hover:text-white/70 transition-colors rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="max-h-[420px] overflow-y-auto">
          {entries.map((entry, i) => {
            const isResolving = resolving.has(entry.id);
            const sevColor = SEVERITY_COLOR(entry.anomalyScore);
            return (
              <div key={entry.id} className={`px-3 py-2.5 ${i < entries.length - 1 ? "border-b border-white/5" : ""}`}>
                {/* IP + severity */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {SOURCE_ICON[entry.detectedFrom] ?? <Shield className="w-3 h-3 text-white/40" />}
                    <span className="text-[12px] font-mono font-semibold text-white">{entry.ip}</span>
                    {entry.sourcePort && (
                      <span className="text-[10px] text-white/40">:{entry.sourcePort}</span>
                    )}
                  </div>
                  <span className={`text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded border ${sevColor} bg-black/20`}>
                    {SEVERITY_LABEL(entry.anomalyScore)} · {entry.anomalyScore}
                  </span>
                </div>

                {/* Details row */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {entry.attackType && (
                    <span className="text-[9px] bg-red-900/40 text-red-300 px-1.5 py-0.5 rounded">
                      {entry.attackType.replace(/_/g, " ")}
                    </span>
                  )}
                  {entry.detectedFrom && (
                    <span className="text-[9px] bg-white/5 text-white/50 px-1.5 py-0.5 rounded">
                      via {entry.detectedFrom}
                    </span>
                  )}
                  {entry.geoCountry && (
                    <span className="text-[9px] bg-white/5 text-white/50 px-1.5 py-0.5 rounded">
                      🌍 {entry.geoCountry}
                    </span>
                  )}
                  <span className="text-[9px] bg-white/5 text-white/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(entry.createdAt).toLocaleTimeString()}
                  </span>
                </div>

                {/* Reason/payload */}
                {(entry.reason || entry.payload) && (
                  <p className="text-[9px] text-white/30 font-mono bg-black/30 px-1.5 py-1 rounded mb-2 leading-tight line-clamp-2">
                    {entry.reason ?? entry.payload}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex gap-1.5">
                  <button
                    disabled={isResolving}
                    onClick={() => handleAction(entry.id, "approve")}
                    className="flex-1 text-[10px] font-semibold py-1 px-2 rounded bg-green-900/40 text-green-300 border border-green-500/30 hover:bg-green-800/50 transition-colors disabled:opacity-40"
                  >
                    ✓ Allow
                  </button>
                  <button
                    disabled={isResolving}
                    onClick={() => handleAction(entry.id, "deny")}
                    className="flex-1 text-[10px] font-semibold py-1 px-2 rounded bg-red-900/40 text-red-300 border border-red-500/30 hover:bg-red-800/50 transition-colors disabled:opacity-40"
                  >
                    🚫 Block
                  </button>
                  <button
                    disabled={isResolving}
                    onClick={() => handleAction(entry.id, "trap")}
                    className="flex-1 text-[10px] font-semibold py-1 px-2 rounded bg-purple-900/40 text-purple-300 border border-purple-500/30 hover:bg-purple-800/50 transition-colors disabled:opacity-40"
                    title="Route into GhostTrap™ infinite honeypot loop"
                  >
                    🕷 Trap
                  </button>
                  <button
                    disabled={isResolving}
                    onClick={() => handleAction(entry.id, "dismiss")}
                    className="text-[10px] py-1 px-1.5 rounded text-white/30 hover:text-white/60 transition-colors disabled:opacity-40"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer hint */}
      {expanded && entries.length > 0 && (
        <div className="px-3 py-1.5 border-t border-white/5 bg-black/30">
          <p className="text-[9px] text-white/25">
            🕷 Trap routes attacker into GhostTrap™ infinite honeypot loop · Auto-dismissed in 2 min
          </p>
        </div>
      )}
    </div>
  );
}
