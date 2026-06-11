// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { Target, Plus, Trash2, AlertTriangle, CheckCircle2, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const API = "/api/tool-runner";

interface Scope {
  id: number;
  userId: string;
  scopeType: string;
  scopeValue: string;
  notes: string | null;
  approvedBy: string | null;
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  ip:     "text-blue-400   border-blue-500/30   bg-blue-900/10",
  cidr:   "text-purple-400 border-purple-500/30 bg-purple-900/10",
  domain: "text-cyan-400   border-cyan-500/30   bg-cyan-900/10",
  url:    "text-green-400  border-green-500/30  bg-green-900/10",
};

export default function ToolScope() {
  const [scopes, setScopes]       = useState<Scope[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [adding, setAdding]       = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({ scopeType: "domain", scopeValue: "", notes: "" });

  async function loadScopes() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/scopes`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      setScopes(await r.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadScopes(); }, []);

  async function addScope() {
    if (!form.scopeValue.trim()) return;
    setSaving(true); setError(null);
    try {
      const r = await fetch(`${API}/scopes`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopeType: form.scopeType, scopeValue: form.scopeValue.trim(), notes: form.notes || undefined }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setScopes(prev => [data, ...prev]);
      setForm({ scopeType: "domain", scopeValue: "", notes: "" });
      setAdding(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeScope(id: number) {
    try {
      await fetch(`${API}/scopes/${id}`, { method: "DELETE", credentials: "include" });
      setScopes(prev => prev.filter(s => s.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 font-mono min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Target className="w-5 h-5 text-[#00ff88]" />
            <h1 className="text-lg font-bold text-primary tracking-tight">Scan Target Scope</h1>
            <Badge className="text-[9px] border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88] font-mono uppercase tracking-widest px-1.5">
              {scopes.length} targets
            </Badge>
          </div>
          <p className="text-xs text-primary/40 max-w-xl leading-relaxed">
            Declare authorized scan targets. All tool runs are validated against this scope for SSRF and abuse prevention.
          </p>
        </div>
        <Button onClick={() => setAdding(v => !v)}
          className="bg-[#00ff88] text-black hover:bg-[#00ff88]/80 font-mono text-xs px-4 py-2 h-auto font-bold flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Target
        </Button>
      </div>

      <div className="border border-orange-500/20 bg-orange-900/10 rounded-sm p-3 flex items-start gap-2 text-[10px] text-orange-400">
        <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>RFC1918 / loopback / link-local / cloud-metadata ranges are always blocked regardless of scope entries. Only register external targets you own or have written permission to test.</span>
      </div>

      {error && (
        <div className="border border-red-500/30 bg-red-900/10 text-red-400 text-xs p-3 rounded-sm flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}

      {adding && (
        <div className="border border-[#00ff88]/20 bg-[#00ff88]/3 rounded-sm p-4 space-y-3">
          <div className="text-[10px] text-[#00ff88]/60 uppercase tracking-widest font-mono">New Target Scope</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-primary/50 mb-1 font-mono uppercase tracking-wide">Type</label>
              <select value={form.scopeType} onChange={e => setForm(f => ({ ...f, scopeType: e.target.value }))}
                className="w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-[#00ff88]/40 rounded-sm">
                <option value="ip">IP Address</option>
                <option value="cidr">CIDR Range</option>
                <option value="domain">Domain</option>
                <option value="url">URL</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-primary/50 mb-1 font-mono uppercase tracking-wide">Value *</label>
              <input value={form.scopeValue} onChange={e => setForm(f => ({ ...f, scopeValue: e.target.value }))}
                placeholder={form.scopeType === "ip" ? "203.0.113.1" : form.scopeType === "cidr" ? "203.0.113.0/24" : form.scopeType === "domain" ? "example.com" : "https://example.com/app"}
                className="w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm"
                onKeyDown={e => e.key === "Enter" && addScope()} />
            </div>
            <div>
              <label className="block text-[10px] text-primary/50 mb-1 font-mono uppercase tracking-wide">Notes (optional)</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Bug bounty scope, test server, etc."
                className="w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={addScope} disabled={saving || !form.scopeValue.trim()}
              className="bg-[#00ff88] text-black hover:bg-[#00ff88]/80 font-mono text-xs px-4 py-2 h-auto font-bold flex items-center gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {saving ? "Saving..." : "Add Scope"}
            </Button>
            <Button onClick={() => setAdding(false)} variant="outline"
              className="border-primary/20 text-primary/50 font-mono text-xs h-8 px-3">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-primary/40 text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading scopes...
        </div>
      ) : scopes.length === 0 ? (
        <div className="border border-primary/10 rounded-sm p-12 text-center">
          <Target className="w-10 h-10 text-primary/10 mx-auto mb-3" />
          <div className="text-sm text-primary/25">No target scopes defined</div>
          <div className="text-xs text-primary/15 mt-1">Add domains, IPs, or CIDR ranges you have permission to scan</div>
        </div>
      ) : (
        <div className="space-y-2">
          {scopes.map(scope => (
            <div key={scope.id} className="border border-primary/10 rounded-sm p-3 flex items-center gap-3 hover:border-primary/20 transition-colors">
              <span className={`text-[9px] border px-1.5 py-px font-mono uppercase shrink-0 ${TYPE_COLORS[scope.scopeType] ?? "border-primary/20 text-primary/40"}`}>
                {scope.scopeType}
              </span>
              <span className="text-xs font-bold text-primary font-mono flex-1 min-w-0 truncate">{scope.scopeValue}</span>
              {scope.notes && <span className="text-[10px] text-primary/30 font-mono hidden sm:block truncate max-w-[200px]">{scope.notes}</span>}
              {scope.approvedBy && (
                <span className="flex items-center gap-1 text-[9px] text-[#00ff88] border border-[#00ff88]/20 px-1.5 py-px shrink-0">
                  <CheckCircle2 className="w-2.5 h-2.5" />Admin approved
                </span>
              )}
              <span className="text-[10px] text-primary/25 font-mono whitespace-nowrap shrink-0">
                {new Date(scope.createdAt).toLocaleDateString()}
              </span>
              <button onClick={() => removeScope(scope.id)}
                className="p-1.5 border border-red-500/20 text-red-400/50 hover:text-red-400 hover:border-red-500/40 rounded-sm transition-colors shrink-0">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
