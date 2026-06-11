// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { ShieldCheck, Check, X, AlertTriangle, Loader2, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const API = "/api/tool-runner";

interface Approval {
  id: string;
  userId: string;
  toolId: string;
  toolName: string;
  target: string;
  optsJson: Record<string, string> | null;
  riskReason: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending:  "border-yellow-500/40 text-yellow-400 bg-yellow-900/10",
  approved: "border-[#00ff88]/40 text-[#00ff88] bg-[#00ff88]/5",
  rejected: "border-red-500/40 text-red-400 bg-red-900/10",
};

export default function ToolApprovals() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [notes, setNotes]         = useState<Record<string, string>>({});
  const [filter, setFilter]       = useState<"all" | "pending" | "approved" | "rejected">("pending");

  async function loadApprovals() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/approvals`, { credentials: "include" });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Failed to load approvals");
      }
      setApprovals(await r.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadApprovals(); }, []);

  async function action(id: string, action: "approve" | "reject") {
    setProcessing(id);
    try {
      const r = await fetch(`${API}/approvals/${id}/${action}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes[id] }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setApprovals(prev => prev.map(a => a.id === id ? data : a));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessing(null);
    }
  }

  const filtered = filter === "all" ? approvals : approvals.filter(a => a.status === filter);
  const pendingCount = approvals.filter(a => a.status === "pending").length;

  return (
    <div className="p-4 md:p-6 space-y-5 font-mono min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck className="w-5 h-5 text-[#00ff88]" />
            <h1 className="text-lg font-bold text-primary tracking-tight">Tool Approvals</h1>
            {pendingCount > 0 && (
              <Badge className="text-[9px] border-yellow-500/40 bg-yellow-900/10 text-yellow-400 font-mono uppercase tracking-widest px-1.5">
                {pendingCount} pending
              </Badge>
            )}
          </div>
          <p className="text-xs text-primary/40 max-w-xl leading-relaxed">
            Admin review queue for high-risk scan requests. Approve or reject pending tool runs.
          </p>
        </div>
        <button onClick={loadApprovals} className="text-xs border border-primary/20 text-primary/50 hover:text-primary px-3 py-1.5 rounded-sm transition-colors">
          Refresh
        </button>
      </div>

      {error && (
        <div className="border border-red-500/30 bg-red-900/10 text-red-400 text-xs p-3 rounded-sm flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {(["all", "pending", "approved", "rejected"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-[9px] border px-2.5 py-1 rounded-sm font-mono uppercase tracking-wide transition-colors ${
              filter === f ? "border-[#00ff88]/40 text-[#00ff88] bg-[#00ff88]/8" : "border-primary/15 text-primary/30 hover:border-primary/30"
            }`}>
            {f}{f === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-primary/40 text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading approvals...
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-primary/10 rounded-sm p-12 text-center">
          <ShieldCheck className="w-10 h-10 text-primary/10 mx-auto mb-3" />
          <div className="text-sm text-primary/25">No {filter === "all" ? "" : filter} approval requests</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(approval => {
            const isExpanded = expanded === approval.id;
            return (
              <div key={approval.id} className={`border rounded-sm overflow-hidden ${approval.status === "pending" ? "border-yellow-500/20" : "border-primary/10"}`}>
                <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-primary/3 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : approval.id)}>
                  <span className={`text-[9px] border px-1.5 py-px font-mono uppercase shrink-0 ${STATUS_COLORS[approval.status] ?? "border-primary/20 text-primary/40"}`}>
                    {approval.status}
                  </span>
                  <span className="text-xs font-bold text-primary font-mono flex-1">{approval.toolName}</span>
                  <span className="text-[10px] text-primary/40 font-mono truncate max-w-[180px] hidden sm:block">{approval.target}</span>
                  <div className="flex items-center gap-1 text-[10px] text-yellow-400/60 font-mono">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="hidden md:block truncate max-w-[200px]">{approval.riskReason}</span>
                  </div>
                  <span className="text-[10px] text-primary/25 font-mono whitespace-nowrap shrink-0">
                    {new Date(approval.createdAt).toLocaleString()}
                  </span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-primary/40 shrink-0" />
                              : <ChevronDown className="w-3.5 h-3.5 text-primary/40 shrink-0" />}
                </div>

                {isExpanded && (
                  <div className="border-t border-primary/10 p-4 space-y-3 bg-black/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] font-mono">
                      <div><span className="text-primary/30 uppercase">User ID:</span> <span className="text-primary/70">{approval.userId}</span></div>
                      <div><span className="text-primary/30 uppercase">Tool:</span> <span className="text-primary/70">{approval.toolName} ({approval.toolId})</span></div>
                      <div><span className="text-primary/30 uppercase">Target:</span> <span className="text-primary/70">{approval.target}</span></div>
                      <div><span className="text-primary/30 uppercase">Risk Reason:</span> <span className="text-yellow-400/80">{approval.riskReason}</span></div>
                      {approval.reviewedBy && <div><span className="text-primary/30 uppercase">Reviewed By:</span> <span className="text-primary/70">{approval.reviewedBy}</span></div>}
                      {approval.notes && <div className="md:col-span-2"><span className="text-primary/30 uppercase">Notes:</span> <span className="text-primary/70">{approval.notes}</span></div>}
                    </div>

                    {approval.optsJson && (
                      <div>
                        <div className="text-[9px] text-primary/20 uppercase tracking-widest mb-1">Configuration</div>
                        <pre className="text-[10px] text-primary/50 bg-black/40 border border-primary/10 p-2 rounded-sm overflow-x-auto">
                          {JSON.stringify(approval.optsJson, null, 2)}
                        </pre>
                      </div>
                    )}

                    {approval.status === "pending" && (
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] text-primary/40 mb-1 font-mono uppercase">Review Notes (optional)</label>
                          <input value={notes[approval.id] ?? ""}
                            onChange={e => setNotes(prev => ({ ...prev, [approval.id]: e.target.value }))}
                            placeholder="Reason for approval/rejection…"
                            className="w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/15 rounded-sm" />
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => action(approval.id, "approve")} disabled={processing === approval.id}
                            className="flex items-center gap-1.5 bg-[#00ff88] text-black hover:bg-[#00ff88]/80 font-mono text-xs px-4 py-2 font-bold disabled:opacity-40 transition-colors rounded-sm">
                            {processing === approval.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Approve
                          </button>
                          <button onClick={() => action(approval.id, "reject")} disabled={processing === approval.id}
                            className="flex items-center gap-1.5 border border-red-500/40 text-red-400 hover:bg-red-900/20 font-mono text-xs px-4 py-2 disabled:opacity-40 transition-colors rounded-sm">
                            {processing === approval.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
