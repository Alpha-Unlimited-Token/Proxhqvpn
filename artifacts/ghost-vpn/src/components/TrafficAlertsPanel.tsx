// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// TrafficAlertsPanel — full traffic alert management: pending alerts, saved rules, blocked IPs
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/react";
import {
  ShieldAlert, ShieldCheck, ShieldX, Shield, X, Trash2,
  Unlock, Lock, ChevronRight, RefreshCw, AlertTriangle,
  CheckCircle2, Ban, Clock, Info, Zap,
} from "lucide-react";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

async function api(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${BASE()}${path}`, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

type Prompt = {
  id: number;
  sourceIp: string;
  destPort: string | null;
  protocol: string;
  reason: string;
  threatLevel: string;
  decision: string;
  createdAt: string;
};

type UserDecision = {
  id: number;
  sourceIp: string | null;
  destPort: string | null;
  protocol: string | null;
  decision: string;
  label: string | null;
  notes: string | null;
  hitCount: number;
  createdAt: string;
};

type BlockedIp = {
  id: number;
  ip: string;
  reason: string;
  autoBlocked: boolean;
  hitCount: number;
  blockedAt: string;
  expiresAt: string | null;
};

const THREAT_COLORS: Record<string, { bar: string; badge: string; icon: string; bg: string; border: string }> = {
  critical: { bar: "bg-red-500",    badge: "bg-red-900/60 text-red-300 border-red-700",    icon: "text-red-400",    bg: "bg-red-950/20",    border: "border-red-800/60" },
  high:     { bar: "bg-orange-500", badge: "bg-orange-900/60 text-orange-300 border-orange-700", icon: "text-orange-400", bg: "bg-orange-950/20", border: "border-orange-800/60" },
  medium:   { bar: "bg-yellow-500", badge: "bg-yellow-900/60 text-yellow-300 border-yellow-700", icon: "text-yellow-400", bg: "bg-yellow-950/10", border: "border-yellow-800/40" },
  low:      { bar: "bg-blue-500",   badge: "bg-blue-900/60 text-blue-300 border-blue-700",   icon: "text-blue-400",   bg: "bg-blue-950/10",   border: "border-blue-800/40" },
};

function ThreatBadge({ level }: { level: string }) {
  const t = THREAT_COLORS[level] ?? THREAT_COLORS.medium;
  return (
    <span className={`text-[9px] font-bold font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border ${t.badge}`}>
      {level}
    </span>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCountChange?: (n: number) => void;
}

export default function TrafficAlertsPanel({ open, onClose, onCountChange }: Props) {
  const { isSignedIn } = useAuth();
  const [tab, setTab] = useState<"alerts" | "rules" | "blocked">("alerts");

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [decisions, setDecisions] = useState<UserDecision[]>([]);
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  };

  const fetchAll = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const [pd, dd, bd] = await Promise.all([
        api("/api/firewall/prompts"),
        api("/api/firewall/user-decisions"),
        api("/api/firewall/blocked-ips"),
      ]);
      const all: Prompt[] = pd.prompts ?? [];
      setPrompts(all);
      setDecisions(dd.decisions ?? []);
      setBlockedIps(bd.blockedIps ?? []);
      const pending = all.filter((p: Prompt) => p.decision === "pending").length;
      onCountChange?.(pending);
    } catch { /* silent */ }
  }, [isSignedIn, onCountChange]);

  useEffect(() => {
    if (!open || !isSignedIn) return;
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
    timerRef.current = setInterval(fetchAll, 8000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [open, isSignedIn, fetchAll]);

  const decidePrompt = async (id: number, decision: "allow_once" | "allow_always" | "block_always" | "dismissed") => {
    setActing(id);
    try {
      await api(`/api/firewall/prompts/${id}/decide`, { method: "POST", body: JSON.stringify({ decision }) });
      const labels: Record<string, string> = {
        allow_once:   "Allowed once",
        allow_always: "Always allowed — rule saved",
        block_always: "Blocked — rule saved",
        dismissed:    "Dismissed",
      };
      showFlash(labels[decision] ?? "Done");
      await fetchAll();
    } catch { showFlash("Error — try again"); } finally { setActing(null); }
  };

  const deleteDecision = async (id: number) => {
    setActing(id);
    try {
      await api(`/api/firewall/user-decisions/${id}`, { method: "DELETE" });
      showFlash("Rule removed");
      await fetchAll();
    } catch { showFlash("Error removing rule"); } finally { setActing(null); }
  };

  const unblockIp = async (id: number, ip: string) => {
    setActing(id);
    try {
      await api(`/api/firewall/blocked-ips/${id}/unblock`, { method: "POST" });
      showFlash(`${ip} unblocked`);
      await fetchAll();
    } catch { showFlash("Error unblocking"); } finally { setActing(null); }
  };

  const pendingPrompts = prompts.filter(p => p.decision === "pending");
  const resolvedPrompts = prompts.filter(p => p.decision !== "pending");

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[9990] bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[400px] max-w-full z-[9991] flex flex-col bg-[#070c09] border-l border-white/[0.07] shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07] shrink-0">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-4 w-4 text-orange-400" />
            <div>
              <div className="text-[13px] font-bold text-white font-mono tracking-tight">Traffic Firewall</div>
              <div className="text-[10px] text-white/40 font-mono">Allow · Block · Manage rules</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setLoading(true); fetchAll().finally(() => setLoading(false)); }}
              className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Flash message */}
        {flash && (
          <div className="mx-4 mt-3 flex items-center gap-2 bg-[#0f1a0f] border border-green-800/60 rounded-lg px-3 py-2 shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
            <span className="text-[11px] font-mono text-green-300">{flash}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-white/[0.07] shrink-0 px-4 pt-2 gap-1">
          {(["alerts", "rules", "blocked"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-[11px] font-mono font-bold rounded-t-md transition-all capitalize relative ${
                tab === t
                  ? "text-white bg-white/[0.06] border-b-2 border-[#00ff88]"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {t === "alerts" ? (
                <>
                  Alerts
                  {pendingPrompts.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 text-[8px] font-bold text-black">
                      {pendingPrompts.length > 9 ? "9+" : pendingPrompts.length}
                    </span>
                  )}
                </>
              ) : t === "rules" ? (
                <>Rules {decisions.length > 0 && <span className="ml-1 text-white/30">({decisions.length})</span>}</>
              ) : (
                <>Blocked {blockedIps.length > 0 && <span className="ml-1 text-white/30">({blockedIps.length})</span>}</>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── ALERTS TAB ── */}
          {tab === "alerts" && (
            <div className="p-4 space-y-3">
              {pendingPrompts.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <ShieldCheck className="h-10 w-10 text-[#00ff88]/30" />
                  <div className="text-[12px] font-mono text-white/30 text-center">No pending alerts<br />You&apos;re protected</div>
                </div>
              )}

              {pendingPrompts.map(p => {
                const t = THREAT_COLORS[p.threatLevel] ?? THREAT_COLORS.medium;
                const busy = acting === p.id;
                return (
                  <div key={p.id} className={`rounded-xl border overflow-hidden ${t.border} ${t.bg}`}>
                    <div className={`h-0.5 w-full ${t.bar}`} />
                    <div className="p-3.5">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-[12px] font-bold text-white font-mono">{p.sourceIp}</div>
                          {p.destPort && (
                            <div className="text-[10px] text-white/50 font-mono">
                              port {p.destPort} · {p.protocol?.toUpperCase()}
                            </div>
                          )}
                        </div>
                        <ThreatBadge level={p.threatLevel} />
                      </div>
                      <div className="text-[10px] text-white/60 mb-3 leading-relaxed">{p.reason}</div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                        <button
                          onClick={() => decidePrompt(p.id, "allow_once")}
                          disabled={busy}
                          className="flex items-center justify-center gap-1.5 bg-green-950/60 hover:bg-green-900/60 border border-green-800/60 text-green-300 text-[10px] font-bold font-mono py-2 rounded-lg transition-all disabled:opacity-40"
                        >
                          <ShieldCheck className="h-3 w-3" /> Allow Once
                        </button>
                        <button
                          onClick={() => decidePrompt(p.id, "block_always")}
                          disabled={busy}
                          className="flex items-center justify-center gap-1.5 bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-[10px] font-bold font-mono py-2 rounded-lg transition-all disabled:opacity-40"
                        >
                          <ShieldX className="h-3 w-3" /> Block
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => decidePrompt(p.id, "allow_always")}
                          disabled={busy}
                          className="flex items-center justify-center gap-1.5 bg-[#0a1a0f]/60 hover:bg-[#0f2015]/60 border border-[#1a3020]/60 text-[#00ff88]/70 text-[10px] font-bold font-mono py-2 rounded-lg transition-all disabled:opacity-40"
                        >
                          <Lock className="h-3 w-3" /> Always Allow
                        </button>
                        <button
                          onClick={() => decidePrompt(p.id, "dismissed")}
                          disabled={busy}
                          className="flex items-center justify-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-white/40 text-[10px] font-bold font-mono py-2 rounded-lg transition-all disabled:opacity-40"
                        >
                          <X className="h-3 w-3" /> Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Recent resolved alerts */}
              {resolvedPrompts.length > 0 && (
                <div className="mt-4">
                  <div className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-2 px-1">Recent History</div>
                  {resolvedPrompts.slice(0, 8).map(p => (
                    <div key={p.id} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                      {p.decision === "blocked" || p.decision === "block_always"
                        ? <ShieldX className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        : p.decision === "dismissed"
                        ? <X className="h-3.5 w-3.5 text-white/30 shrink-0" />
                        : <ShieldCheck className="h-3.5 w-3.5 text-green-400 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-mono text-white/70 truncate">{p.sourceIp}</div>
                        <div className="text-[9px] text-white/30 font-mono capitalize">{p.decision.replace(/_/g, " ")}</div>
                      </div>
                      <div className="text-[9px] text-white/25 font-mono shrink-0">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── RULES TAB ── */}
          {tab === "rules" && (
            <div className="p-4 space-y-2">
              {decisions.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Shield className="h-10 w-10 text-white/10" />
                  <div className="text-[12px] font-mono text-white/30 text-center">No saved rules yet<br />Decisions you make become rules here</div>
                </div>
              )}
              {decisions.map(d => {
                const isAllow = d.decision === "allow";
                return (
                  <div
                    key={d.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                      isAllow
                        ? "bg-green-950/10 border-green-800/30"
                        : "bg-red-950/10 border-red-800/30"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isAllow
                        ? <ShieldCheck className="h-4 w-4 text-green-400" />
                        : <ShieldX className="h-4 w-4 text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[12px] font-mono font-bold text-white/90 truncate">
                          {d.sourceIp ?? "Any IP"}
                        </span>
                        <span className={`text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded ${
                          isAllow ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"
                        }`}>
                          {isAllow ? "ALLOW" : "BLOCK"}
                        </span>
                      </div>
                      {d.destPort && (
                        <div className="text-[10px] text-white/40 font-mono">
                          port {d.destPort} · {d.protocol?.toUpperCase()}
                        </div>
                      )}
                      {d.notes && <div className="text-[10px] text-white/40 mt-0.5 italic">{d.notes}</div>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-white/25 font-mono">
                          {d.hitCount} hits · {new Date(d.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteDecision(d.id)}
                      disabled={acting === d.id}
                      title="Remove this rule"
                      className="shrink-0 p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-950/30 transition-all disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
              {decisions.length > 0 && (
                <div className="pt-1 text-[10px] text-white/25 font-mono text-center">
                  Tap the trash icon to remove a rule and restore default behavior
                </div>
              )}
            </div>
          )}

          {/* ── BLOCKED IPs TAB ── */}
          {tab === "blocked" && (
            <div className="p-4 space-y-2">
              {blockedIps.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Ban className="h-10 w-10 text-white/10" />
                  <div className="text-[12px] font-mono text-white/30 text-center">No blocked IPs<br />Blocked addresses appear here</div>
                </div>
              )}
              {blockedIps.map(b => (
                <div key={b.id} className="flex items-start gap-3 p-3 rounded-xl border border-red-800/25 bg-red-950/10">
                  <Ban className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[12px] font-mono font-bold text-white/90">{b.ip}</span>
                      {b.autoBlocked && (
                        <span className="text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded bg-orange-900/40 text-orange-400">
                          AUTO
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-white/50 leading-snug">{b.reason}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-white/25 font-mono">
                        {b.hitCount} hit{b.hitCount !== 1 ? "s" : ""} · {new Date(b.blockedAt).toLocaleDateString()}
                      </span>
                      {b.expiresAt && (
                        <span className="text-[9px] text-yellow-500/60 font-mono">
                          expires {new Date(b.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => unblockIp(b.id, b.ip)}
                    disabled={acting === b.id}
                    title="Unblock this IP"
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-green-950/40 border border-white/[0.08] hover:border-green-800/60 text-white/40 hover:text-green-300 text-[10px] font-mono font-bold transition-all disabled:opacity-30"
                  >
                    <Unlock className="h-3 w-3" />
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 border-t border-white/[0.05]">
          <div className="text-[9px] text-white/20 font-mono text-center">
            Polling every 8s · Decisions persist across sessions · © 2026 Alpha Unlimited Technologies LLC
          </div>
        </div>
      </div>
    </>
  );
}
