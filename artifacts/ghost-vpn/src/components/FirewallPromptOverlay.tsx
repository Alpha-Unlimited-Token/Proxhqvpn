// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Firewall Connection Approval Overlay — per-user allow/deny/block with persistent memory
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { Shield, ShieldAlert, ShieldCheck, ShieldX, X, ChevronRight, Lock, Clock, AlertTriangle, Info } from "lucide-react";

type Prompt = {
  id: number;
  sourceIp: string;
  destIp: string | null;
  destPort: string | null;
  protocol: string;
  reason: string;
  threatLevel: string;
  decision: string;
  createdAt: string;
};

const THREAT_COLORS: Record<string, { bar: string; badge: string; icon: string; bg: string; border: string }> = {
  critical: { bar: "bg-red-500", badge: "bg-red-900 text-red-300 border-red-700", icon: "text-red-400", bg: "bg-red-950/30", border: "border-red-800" },
  high:     { bar: "bg-orange-500", badge: "bg-orange-900 text-orange-300 border-orange-700", icon: "text-orange-400", bg: "bg-orange-950/30", border: "border-orange-800" },
  medium:   { bar: "bg-yellow-500", badge: "bg-yellow-900 text-yellow-300 border-yellow-700", icon: "text-yellow-400", bg: "bg-yellow-950/20", border: "border-yellow-800" },
  low:      { bar: "bg-blue-500", badge: "bg-blue-900 text-blue-300 border-blue-700", icon: "text-blue-400", bg: "bg-blue-950/20", border: "border-blue-800" },
};

function ThreatIcon({ level }: { level: string }) {
  const cls = THREAT_COLORS[level]?.icon ?? "text-gray-400";
  if (level === "critical") return <ShieldX className={`h-5 w-5 ${cls}`} />;
  if (level === "high")     return <ShieldAlert className={`h-5 w-5 ${cls}`} />;
  if (level === "medium")   return <Shield className={`h-5 w-5 ${cls}`} />;
  return <Info className={`h-5 w-5 ${cls}`} />;
}

export default function FirewallPromptOverlay() {
  const { isSignedIn } = useAuth();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [current, setCurrent] = useState<Prompt | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [deciding, setDeciding] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [lastDecision, setLastDecision] = useState<{ label: string; color: string } | null>(null);

  const fetchPrompts = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const res = await fetch("/api/firewall/prompts");
      if (!res.ok) return;
      const data = await res.json();
      const pending: Prompt[] = (data.prompts ?? []).filter((p: Prompt) => p.decision === "pending");
      setPrompts(pending);
      setPendingCount(data.pendingCount ?? 0);
      if (!current && pending.length > 0) setCurrent(pending[0]);
    } catch { /* network error — silent */ }
  }, [isSignedIn, current]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetchPrompts();
    const timer = setInterval(fetchPrompts, 20000);
    return () => clearInterval(timer);
  }, [isSignedIn, fetchPrompts]);

  // When prompts refresh, ensure a current item is set
  useEffect(() => {
    setCurrent(prev => {
      if (prev) return prev;
      return prompts[0] ?? null;
    });
  }, [prompts]);

  const decide = async (decision: "allow_once" | "allow_always" | "block_always" | "dismissed") => {
    if (!current || deciding) return;
    setDeciding(true);
    try {
      await fetch(`/api/firewall/prompts/${current.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });

      const labels: Record<string, { label: string; color: string }> = {
        allow_once:    { label: "Allowed (this time)", color: "text-green-400" },
        allow_always:  { label: "Always Allowed — saved", color: "text-green-400" },
        block_always:  { label: "Blocked & remembered", color: "text-red-400" },
        dismissed:     { label: "Dismissed", color: "text-gray-400" },
      };
      setLastDecision(labels[decision] ?? null);
      setTimeout(() => setLastDecision(null), 2500);

      // Remove decided prompt and advance
      const remaining = prompts.filter(p => p.id !== current.id);
      setPrompts(remaining);
      setCurrent(remaining[0] ?? null);
      setPendingCount(remaining.length);
    } catch { /* silent */ } finally {
      setDeciding(false);
    }
  };

  if (!isSignedIn || (prompts.length === 0 && !lastDecision)) return null;

  const t = THREAT_COLORS[current?.threatLevel ?? "medium"] ?? THREAT_COLORS.medium;

  // Minimized pill
  if (minimized) {
    return (
      <div
        className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 bg-[#0f0f13] border border-[#2a2a2a] rounded-full px-4 py-2 cursor-pointer shadow-2xl hover:border-[#3a3a3a] transition-all"
        onClick={() => setMinimized(false)}
      >
        <ShieldAlert className="h-4 w-4 text-orange-400" />
        <span className="text-xs font-bold text-white font-mono">{pendingCount} firewall alert{pendingCount !== 1 ? "s" : ""}</span>
        <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-[340px] pointer-events-none">
      {/* Decision flash */}
      {lastDecision && (
        <div className="pointer-events-auto mb-2 flex items-center gap-2 bg-[#0f0f13] border border-[#2a2a2a] rounded-lg px-4 py-2 shadow-xl animate-in fade-in slide-in-from-bottom-2">
          <ShieldCheck className="h-4 w-4 text-green-400 shrink-0" />
          <span className={`text-xs font-mono font-bold ${lastDecision.color}`}>{lastDecision.label}</span>
        </div>
      )}

      {/* Main prompt card */}
      {current && (
        <div className={`pointer-events-auto rounded-xl border shadow-2xl overflow-hidden ${t.border} ${t.bg}`}
          style={{ backdropFilter: "blur(12px)" }}>
          {/* Threat level bar */}
          <div className={`h-0.5 w-full ${t.bar}`} />

          {/* Header */}
          <div className="flex items-start justify-between px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <ThreatIcon level={current.threatLevel} />
              <div>
                <div className="text-xs font-black text-white font-mono uppercase tracking-wider">
                  Firewall Alert
                </div>
                <div className={`text-[9px] font-bold uppercase tracking-widest ${t.icon}`}>
                  {current.threatLevel} threat
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {pendingCount > 1 && (
                <span className="text-[9px] text-gray-500 font-mono mr-1">{pendingCount} pending</span>
              )}
              <button onClick={() => setMinimized(true)}
                className="text-gray-600 hover:text-gray-400 transition-colors p-0.5 rounded">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => decide("dismissed")}
                className="text-gray-600 hover:text-gray-400 transition-colors p-0.5 rounded">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Connection details */}
          <div className="px-4 pb-3">
            <div className="bg-black/40 rounded-lg p-3 mb-3 font-mono text-[11px] space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-16 shrink-0">Source IP</span>
                <span className="text-white font-bold">{current.sourceIp}</span>
              </div>
              {current.destPort && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-16 shrink-0">Port</span>
                  <span className="text-gray-300">{current.destPort} / {current.protocol?.toUpperCase()}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-16 shrink-0">Reason</span>
                <span className="text-gray-300 leading-tight">{current.reason}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-1.5 mb-2">
              <button onClick={() => decide("allow_once")} disabled={deciding}
                className="flex-1 flex items-center justify-center gap-1 bg-green-950 hover:bg-green-900 border border-green-800 text-green-300 text-[10px] font-bold font-mono py-1.5 px-2 rounded-lg transition-colors disabled:opacity-50">
                <ShieldCheck className="h-3 w-3" />
                Allow Once
              </button>
              <button onClick={() => decide("block_always")} disabled={deciding}
                className="flex-1 flex items-center justify-center gap-1 bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 text-[10px] font-bold font-mono py-1.5 px-2 rounded-lg transition-colors disabled:opacity-50">
                <ShieldX className="h-3 w-3" />
                Block
              </button>
            </div>
            <button onClick={() => decide("allow_always")} disabled={deciding}
              className="w-full flex items-center justify-center gap-1.5 bg-[#111] hover:bg-[#181818] border border-[#2a2a2a] text-gray-400 hover:text-white text-[10px] font-mono font-bold py-1.5 rounded-lg transition-colors disabled:opacity-50">
              <Lock className="h-3 w-3" />
              Always Allow — Remember This Decision
            </button>

            {/* Queue indicator */}
            {pendingCount > 1 && (
              <div className="mt-2 flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-gray-600" />
                <span className="text-[9px] text-gray-600 font-mono">{pendingCount - 1} more alert{pendingCount - 1 !== 1 ? "s" : ""} waiting</span>
                <div className="flex gap-0.5 ml-1">
                  {Array.from({ length: Math.min(pendingCount - 1, 5) }).map((_, i) => (
                    <div key={i} className="h-1 w-1 rounded-full bg-gray-700" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
