// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, ShieldOff, Plus, Trash2, RefreshCw, Copy, CheckCheck, Download } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Config {
  id: number; enabled: boolean; blockAds: boolean; blockTrackers: boolean;
  blockMalware: boolean; blockAdult: boolean; dohEnabled: boolean; dohProvider: string;
}
interface Rule { id: number; domain: string; ruleType: "block"|"allow"; category: string; enabled: boolean; hitCount: number }
interface Stats { config: Config; totalRules: number; activeRules: number; totalHits: number; byCategory: Record<string, number>; dohUrl: string }

const CATEGORY_COLORS: Record<string, string> = {
  ads:      "text-orange-400 border-orange-500/40",
  trackers: "text-yellow-400 border-yellow-500/40",
  malware:  "text-red-400 border-red-500/40",
  adult:    "text-purple-400 border-purple-500/40",
  custom:   "text-blue-400 border-blue-500/40",
};

const DOH_PROVIDERS = [
  { id: "cloudflare", name: "Cloudflare (1.1.1.1)" },
  { id: "google",     name: "Google (8.8.8.8)" },
  { id: "quad9",      name: "Quad9 (privacy-focused)" },
  { id: "nextdns",    name: "NextDNS" },
];

export default function DnsShield() {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newRuleType, setNewRuleType] = useState<"block"|"allow">("block");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, rRes] = await Promise.all([
        fetch(`${BASE}/api/dns-shield/stats`),
        fetch(`${BASE}/api/dns-shield/rules`),
      ]);
      setStats(await sRes.json());
      setRules(await rRes.json());
    } catch { toast({ title: "Failed to load DNS Shield data", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const toggleConfig = async (field: keyof Config, value: boolean) => {
    if (!stats) return;
    try {
      const r = await fetch(`${BASE}/api/dns-shield/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const updated = await r.json();
      setStats(prev => prev ? { ...prev, config: updated } : prev);
    } catch { toast({ title: "Update failed", variant: "destructive" }); }
  };

  const addRule = async () => {
    if (!newDomain.trim()) return;
    try {
      const r = await fetch(`${BASE}/api/dns-shield/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain.trim(), ruleType: newRuleType, category: "custom" }),
      });
      const rule = await r.json();
      if (!r.ok) { toast({ title: rule.error || "Failed", variant: "destructive" }); return; }
      setRules(prev => [...prev, rule]);
      setNewDomain("");
      toast({ title: `Rule added: ${newRuleType} ${newDomain}` });
    } catch { toast({ title: "Network error", variant: "destructive" }); }
  };

  const deleteRule = async (id: number, domain: string) => {
    try {
      await fetch(`${BASE}/api/dns-shield/rules/${id}`, { method: "DELETE" });
      setRules(prev => prev.filter(r => r.id !== id));
      toast({ title: `Rule removed: ${domain}` });
    } catch { toast({ title: "Failed to remove rule", variant: "destructive" }); }
  };

  const loadDefaults = async (category: string) => {
    try {
      const r = await fetch(`${BASE}/api/dns-shield/load-defaults/${category}`, { method: "POST" });
      const data = await r.json();
      toast({ title: `Loaded ${data.loaded} ${category} rules` });
      load();
    } catch { toast({ title: "Failed to load defaults", variant: "destructive" }); }
  };

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const cfg = stats?.config;

  const Toggle = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
    <button onClick={onClick}
      className={`flex items-center justify-between w-full border px-3 py-2.5 transition-colors ${on ? "bg-primary/10 border-primary/50 text-primary" : "border-primary/15 text-primary/40 hover:border-primary/30"}`}>
      <span className="text-[10px] font-mono uppercase tracking-wide">{label}</span>
      <span className={`text-[9px] font-mono border px-1.5 py-0.5 ${on ? "border-primary text-primary" : "border-primary/20 text-primary/30"}`}>
        {on ? "ON" : "OFF"}
      </span>
    </button>
  );

  return (
    <div className="space-y-5 font-mono">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-widest uppercase text-primary">DNS Shield</h1>
          <p className="text-xs text-primary/40 mt-0.5">Block ads, trackers and malware at the DNS level</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/40 px-2 py-1.5 transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> REFRESH
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: "TOTAL RULES",   val: stats.totalRules },
            { label: "ACTIVE RULES",  val: stats.activeRules },
            { label: "TOTAL BLOCKED", val: stats.totalHits },
            { label: "CATEGORIES",    val: Object.keys(stats.byCategory).filter(k => (stats.byCategory[k] ?? 0) > 0).length },
          ].map(({ label, val }) => (
            <Card key={label} className="bg-black border-primary/20">
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-primary">{val}</div>
                <div className="text-[9px] text-primary/30 mt-0.5">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-black border-primary/20">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[9px] tracking-widest text-primary/40 uppercase">Blocking Categories</div>
              {cfg && (
                <button onClick={() => toggleConfig("enabled", !cfg.enabled)}
                  className={`flex items-center gap-1.5 text-[9px] uppercase border px-2 py-1 transition-colors ${cfg.enabled ? "border-primary text-primary bg-primary/10" : "border-primary/20 text-primary/40"}`}>
                  {cfg.enabled ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                  {cfg.enabled ? "SHIELD ACTIVE" : "SHIELD OFF"}
                </button>
              )}
            </div>
            {cfg && (
              <div className="space-y-1.5">
                <Toggle on={cfg.blockAds}      onClick={() => toggleConfig("blockAds",      !cfg.blockAds)}      label={`Ads & Advertising  (${stats?.byCategory.ads ?? 0} rules)`} />
                <Toggle on={cfg.blockTrackers} onClick={() => toggleConfig("blockTrackers", !cfg.blockTrackers)} label={`Trackers & Analytics  (${stats?.byCategory.trackers ?? 0} rules)`} />
                <Toggle on={cfg.blockMalware}  onClick={() => toggleConfig("blockMalware",  !cfg.blockMalware)}  label={`Malware & Phishing  (${stats?.byCategory.malware ?? 0} rules)`} />
                <Toggle on={cfg.blockAdult}    onClick={() => toggleConfig("blockAdult",    !cfg.blockAdult)}    label={`Adult Content  (${stats?.byCategory.adult ?? 0} rules)`} />
              </div>
            )}
            <div className="pt-2">
              <div className="text-[9px] text-primary/30 mb-1.5 uppercase tracking-widest">Load Built-in Lists</div>
              <div className="flex flex-wrap gap-1.5">
                {["ads","trackers","malware"].map(cat => (
                  <button key={cat} onClick={() => loadDefaults(cat)}
                    className={`text-[9px] uppercase border px-2 py-1 hover:bg-primary/5 transition-colors ${CATEGORY_COLORS[cat]}`}>
                    <Download className="w-3 h-3 inline mr-1" />LOAD {cat}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="text-[9px] tracking-widest text-primary/40 uppercase mb-2">DNS over HTTPS (DoH)</div>
            {cfg && (
              <div className="space-y-3">
                <Toggle on={cfg.dohEnabled} onClick={() => toggleConfig("dohEnabled", !cfg.dohEnabled)} label="Enable DNS over HTTPS" />
                <div>
                  <label className="text-[9px] text-primary/40 block mb-1">PROVIDER</label>
                  <select
                    value={cfg.dohProvider}
                    onChange={async e => {
                      await fetch(`${BASE}/api/dns-shield/config`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ dohProvider: e.target.value }),
                      });
                      load();
                    }}
                    className="w-full bg-black border border-primary/30 text-primary font-mono text-xs px-2 py-1.5 focus:outline-none focus:border-primary"
                  >
                    {DOH_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {cfg.dohEnabled && stats?.dohUrl && (
                  <div>
                    <div className="text-[9px] text-primary/30 mb-1">DoH Endpoint</div>
                    <div className="flex items-center gap-2">
                      <code className="text-[9px] text-primary/70 bg-primary/5 border border-primary/10 px-2 py-1 flex-1 truncate">{stats.dohUrl}</code>
                      <button onClick={() => copy(stats.dohUrl, "doh")} className="text-primary/40 hover:text-primary">
                        {copied === "doh" ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-black border-primary/20">
        <CardContent className="p-4 space-y-3">
          <div className="text-[9px] tracking-widest text-primary/40 uppercase">Custom Rules</div>
          <div className="flex gap-2">
            <input
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addRule()}
              placeholder="example.com"
              className="flex-1 bg-black border border-primary/30 text-primary font-mono text-xs px-2 py-1.5 focus:outline-none focus:border-primary"
            />
            <select
              value={newRuleType}
              onChange={e => setNewRuleType(e.target.value as "block"|"allow")}
              className="bg-black border border-primary/30 text-primary font-mono text-xs px-2 py-1.5 focus:outline-none focus:border-primary"
            >
              <option value="block">BLOCK</option>
              <option value="allow">ALLOW</option>
            </select>
            <button onClick={addRule}
              className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-black bg-primary hover:bg-primary/80 px-3 transition-colors">
              <Plus className="w-3 h-3" /> ADD
            </button>
          </div>

          {rules.length === 0 ? (
            <p className="text-[9px] text-primary/20 py-2">No custom rules. Add domains above to block or allow them.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {rules.map(rule => (
                <div key={rule.id} className="flex items-center gap-2 py-1 border-b border-primary/5">
                  <span className={`text-[8px] border px-1 shrink-0 ${rule.ruleType === "block" ? "border-red-500/40 text-red-400" : "border-green-500/40 text-green-400"}`}>
                    {rule.ruleType.toUpperCase()}
                  </span>
                  <span className="text-[9px] text-primary/70 flex-1 font-mono truncate">{rule.domain}</span>
                  <span className={`text-[8px] border px-1 shrink-0 ${CATEGORY_COLORS[rule.category] ?? "text-primary/30 border-primary/20"}`}>{rule.category}</span>
                  {rule.hitCount > 0 && <span className="text-[8px] text-primary/30">{rule.hitCount}×</span>}
                  <button onClick={() => deleteRule(rule.id, rule.domain)} className="text-red-400/50 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
