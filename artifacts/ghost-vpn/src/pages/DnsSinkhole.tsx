import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, ShieldOff, Ban, CheckCircle, Plus, Trash2,
  Search, BarChart2, Globe, Zap, AlertTriangle,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}/api${path}`, {
    credentials: "include", ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const CATEGORIES = [
  { key: "blockAds", label: "Advertising", desc: "Google Ads, DoubleClick, AdSense, ad networks", icon: "📢", color: "text-yellow-400" },
  { key: "blockTrackers", label: "Trackers", desc: "Facebook Pixel, Google Analytics, Hotjar, Mixpanel", icon: "👁", color: "text-orange-400" },
  { key: "blockMalware", label: "Malware", desc: "Known malware domains, C2 servers, exploit kits", icon: "🦠", color: "text-red-400" },
  { key: "blockPhishing", label: "Phishing", desc: "Credential harvesting and impersonation sites", icon: "🎣", color: "text-red-300" },
  { key: "blockCryptomining", label: "Cryptomining", desc: "Browser-based mining scripts (Coinhive etc.)", icon: "⛏", color: "text-purple-400" },
  { key: "blockBotnet", label: "Botnet C2", desc: "Botnet command and control infrastructure", icon: "🤖", color: "text-red-500" },
  { key: "blockAdult", label: "Adult Content", desc: "Adult and explicit content domains", icon: "🔞", color: "text-pink-400" },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
        checked ? "bg-[#00ff88]" : "bg-primary/20"
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-black transition-transform ${
        checked ? "translate-x-4.5" : "translate-x-0.5"
      }`} />
    </button>
  );
}

export default function DnsSinkhole() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [lookupDomain, setLookupDomain] = useState("");
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newAction, setNewAction] = useState("block");

  const { data: config } = useQuery({ queryKey: ["sinkhole-config"], queryFn: () => apiFetch("/dns-sinkhole/config"), refetchInterval: 30000 });
  const { data: stats } = useQuery({ queryKey: ["sinkhole-stats"], queryFn: () => apiFetch("/dns-sinkhole/stats"), refetchInterval: 10000 });
  const { data: rules = [] } = useQuery<any[]>({ queryKey: ["sinkhole-rules"], queryFn: () => apiFetch("/dns-sinkhole/rules") });

  const updateConfig = useMutation({
    mutationFn: (patch: Record<string, boolean>) => apiFetch("/dns-sinkhole/config", { method: "PUT", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sinkhole-config"] }),
  });

  const addRule = useMutation({
    mutationFn: (d: { domain: string; action: string }) => apiFetch("/dns-sinkhole/rules", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sinkhole-rules"] }); setNewDomain(""); toast({ title: "Rule added" }); },
    onError: () => toast({ title: "Failed to add rule", variant: "destructive" }),
  });

  const deleteRule = useMutation({
    mutationFn: (id: number) => apiFetch(`/dns-sinkhole/rules/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sinkhole-rules"] }),
  });

  const handleLookup = async () => {
    if (!lookupDomain.trim()) return;
    setLookingUp(true);
    try {
      const r = await apiFetch("/dns-sinkhole/lookup", { method: "POST", body: JSON.stringify({ domain: lookupDomain.trim() }) });
      setLookupResult(r);
    } catch {
      toast({ title: "Lookup failed", variant: "destructive" });
    } finally {
      setLookingUp(false);
    }
  };

  const totalBlocked = stats?.totalBlocked || 0;
  const totalAllowed = stats?.totalAllowed || 0;
  const blockRate = totalBlocked + totalAllowed > 0
    ? ((totalBlocked / (totalBlocked + totalAllowed)) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="p-4 md:p-6 space-y-6 font-mono min-h-screen">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Ban className="w-5 h-5 text-[#00ff88]" />
          <h1 className="text-lg font-bold text-primary tracking-tight">DNS Sinkhole</h1>
          <Badge className={`text-[9px] font-mono uppercase tracking-widest px-1.5 ${config?.enabled ? "border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88]" : "border-red-400/30 bg-red-400/10 text-red-400"}`}>
            {config?.enabled ? "Active" : "Disabled"}
          </Badge>
        </div>
        <p className="text-xs text-primary/40 max-w-xl leading-relaxed">
          DNS-level blocking of ads, trackers, malware, and phishing domains — for every device connected to your VPN. No install required on client devices.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Blocked Today", value: totalBlocked.toLocaleString(), icon: Ban, color: "text-red-400" },
          { label: "Allowed Today", value: totalAllowed.toLocaleString(), icon: CheckCircle, color: "text-[#00ff88]" },
          { label: "Block Rate", value: `${blockRate}%`, icon: Shield, color: "text-yellow-400" },
          { label: "Custom Rules", value: rules.length, icon: Zap, color: "text-[#00ff88]" },
        ].map(s => (
          <div key={s.label} className="border border-primary/10 bg-primary/2 p-3 rounded-sm">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              <span className="text-[10px] text-primary/40 uppercase tracking-wider">{s.label}</span>
            </div>
            <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Category toggles */}
        <div className="border border-primary/10 p-4 rounded-sm space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] text-primary/40 uppercase tracking-widest">Block Categories</div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-primary/40">Master switch</span>
              <Toggle
                checked={config?.enabled ?? true}
                onChange={v => updateConfig.mutate({ enabled: v })}
              />
            </div>
          </div>

          {CATEGORIES.map(cat => (
            <div key={cat.key} className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="text-base leading-none mt-0.5 shrink-0">{cat.icon}</span>
                <div className="min-w-0">
                  <div className={`text-xs font-bold ${cat.color}`}>{cat.label}</div>
                  <div className="text-[10px] text-primary/30 truncate">{cat.desc}</div>
                  {stats?.categoryCounts && (
                    <div className="text-[10px] text-primary/25">{(stats.categoryCounts as Record<string, number>)[cat.key.replace("block", "").toLowerCase()] || 0} blocked today</div>
                  )}
                </div>
              </div>
              <Toggle
                checked={config?.[cat.key] ?? true}
                onChange={v => updateConfig.mutate({ [cat.key]: v })}
              />
            </div>
          ))}
        </div>

        {/* Right panel — top blocked + domain lookup */}
        <div className="space-y-4">
          {/* Top blocked domains */}
          {stats?.topBlockedDomains && (
            <div className="border border-primary/10 p-4 rounded-sm">
              <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-3">Top Blocked Today</div>
              <div className="space-y-2">
                {stats.topBlockedDomains.map((d: any, i: number) => (
                  <div key={d.domain} className="flex items-center gap-2">
                    <span className="text-[10px] text-primary/25 w-4 font-bold">{i + 1}</span>
                    <div className="flex-1 h-4 bg-primary/5 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-red-400/40"
                        style={{ width: `${(d.count / stats.topBlockedDomains[0].count) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-primary/60 w-28 truncate font-mono">{d.domain}</span>
                    <span className="text-[10px] text-red-400/80 w-12 text-right font-mono">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Domain lookup */}
          <div className="border border-primary/10 p-4 rounded-sm">
            <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-3">Domain Lookup</div>
            <div className="flex gap-2 mb-3">
              <input
                value={lookupDomain}
                onChange={e => setLookupDomain(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLookup()}
                placeholder="example.com"
                className="flex-1 bg-black/40 border border-primary/20 text-primary text-xs font-mono px-3 py-2 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm"
              />
              <Button
                size="sm"
                onClick={handleLookup}
                disabled={lookingUp}
                className="bg-[#00ff88] hover:bg-[#00ff88]/80 text-black font-bold font-mono text-xs rounded-sm"
              >
                <Search className="w-3.5 h-3.5" />
              </Button>
            </div>
            {lookupResult && (
              <div className={`p-3 rounded-sm border text-xs font-mono space-y-1.5 ${
                lookupResult.verdict === "BLOCKED" ? "border-red-400/30 bg-red-400/5" : "border-[#00ff88]/20 bg-[#00ff88]/5"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary">{lookupResult.domain}</span>
                  <span className={`font-bold text-sm ${lookupResult.verdict === "BLOCKED" ? "text-red-400" : "text-[#00ff88]"}`}>
                    {lookupResult.verdict}
                  </span>
                </div>
                {lookupResult.resolved?.length > 0 && (
                  <div className="text-primary/50">Resolves to: {lookupResult.resolved.join(", ")}</div>
                )}
                {lookupResult.categories?.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {lookupResult.categories.map((c: string) => (
                      <span key={c} className="text-[9px] border border-red-400/30 text-red-400 px-1 py-0.5 rounded">{c}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom rules */}
      <div className="border border-primary/10 p-4 rounded-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-primary/40 uppercase tracking-widest">Custom Rules</div>
          <div className="flex gap-2">
            <input
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              onKeyDown={e => e.key === "Enter" && newDomain.trim() && addRule.mutate({ domain: newDomain, action: newAction })}
              placeholder="domain.com"
              className="bg-black/40 border border-primary/20 text-primary text-xs font-mono px-3 py-1.5 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm w-44"
            />
            <select
              value={newAction}
              onChange={e => setNewAction(e.target.value)}
              className="bg-black border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 rounded-sm focus:outline-none"
            >
              <option value="block">Block</option>
              <option value="allow">Allow</option>
            </select>
            <Button
              size="sm"
              onClick={() => newDomain.trim() && addRule.mutate({ domain: newDomain, action: newAction })}
              disabled={!newDomain.trim()}
              className="bg-[#00ff88] hover:bg-[#00ff88]/80 text-black font-bold font-mono text-xs rounded-sm"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        {rules.length === 0 ? (
          <div className="text-center py-4 text-primary/20 text-xs">No custom rules yet</div>
        ) : (
          <div className="space-y-1">
            {rules.map((rule: any) => (
              <div key={rule.id} className="flex items-center gap-3 text-xs font-mono py-1.5 border-b border-primary/5">
                <Globe className="w-3.5 h-3.5 text-primary/30 shrink-0" />
                <span className="flex-1 text-primary/70">{rule.domain}</span>
                <span className={`text-[10px] font-bold ${rule.action === "block" ? "text-red-400" : "text-[#00ff88]"}`}>
                  {rule.action.toUpperCase()}
                </span>
                {rule.reason && <span className="text-primary/30 text-[10px] truncate max-w-32">{rule.reason}</span>}
                <span className="text-primary/25 text-[10px]">{rule.hitCount} hits</span>
                <button onClick={() => deleteRule.mutate(rule.id)} className="text-primary/20 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
