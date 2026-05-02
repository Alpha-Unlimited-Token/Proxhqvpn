// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GitBranch, Trash2, Plus, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type TunnelMode = "vpn" | "direct" | "block";
type RuleType = "ip" | "cidr" | "app" | "domain" | "port";

interface SplitRule {
  id: string; name: string; type: RuleType; value: string;
  mode: TunnelMode; enabled: boolean; priority: number; notes: string;
  createdAt: string; hitCount: number;
}

const MODE_COLORS: Record<TunnelMode, string> = {
  vpn:    "text-primary border-primary/50",
  direct: "text-yellow-400 border-yellow-400/50",
  block:  "text-red-400 border-red-400/50",
};

const MODE_BG: Record<TunnelMode, string> = {
  vpn:    "bg-primary/5",
  direct: "bg-yellow-900/10",
  block:  "bg-red-900/10",
};

export default function SplitTunnel() {
  const { toast } = useToast();
  const [rules, setRules]   = useState<SplitRule[]>([]);
  const [form, setForm]     = useState<Partial<SplitRule>>({ type: "cidr", mode: "vpn", priority: 100, name: "", value: "" });
  const [totals, setTotals] = useState({ total: 0, vpnCount: 0, directCount: 0, blockCount: 0, enabled: 0 });

  const load = useCallback(async () => {
    const r = await fetch(`${BASE}/api/split-tunnel/rules`);
    const d = await r.json();
    setRules(d.rules ?? []);
    setTotals({ total: d.total, vpnCount: d.vpnCount, directCount: d.directCount, blockCount: d.blockCount, enabled: d.enabled });
  }, []);

  useEffect(() => { load(); }, [load]);

  const addRule = async () => {
    if (!form.name || !form.value || !form.type || !form.mode) return;
    const r = await fetch(`${BASE}/api/split-tunnel/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.ok) { load(); setForm({ type: "cidr", mode: "vpn", priority: 100, name: "", value: "" }); toast({ title: "Rule added" }); }
  };

  const toggleRule = async (rule: SplitRule) => {
    const r = await fetch(`${BASE}/api/split-tunnel/rules/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    if (!r.ok) { toast({ title: "Failed to toggle rule", variant: "destructive" }); return; }
    load();
  };

  const deleteRule = async (id: string) => {
    const r = await fetch(`${BASE}/api/split-tunnel/rules/${id}`, { method: "DELETE" });
    if (!r.ok) { toast({ title: "Failed to remove rule", variant: "destructive" }); return; }
    load();
    toast({ title: "Rule removed" });
  };

  const resetRules = async () => {
    const r = await fetch(`${BASE}/api/split-tunnel/rules/reset`, { method: "POST" });
    if (!r.ok) { toast({ title: "Failed to reset rules", variant: "destructive" }); return; }
    load();
    toast({ title: "Rules reset to defaults" });
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="border border-primary/10 bg-black/20 rounded-sm px-3 py-2.5 flex items-center justify-between flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <GitBranch className="w-5 h-5" /> Split Tunneling
          </h2>
          <Badge variant="outline" className="text-primary/50 border-primary/20 font-mono text-xs">{totals.total} RULES</Badge>
          <Badge variant="outline" className="text-primary border-primary/50 font-mono text-xs">{totals.vpnCount} VPN</Badge>
          <Badge variant="outline" className="text-yellow-400 border-yellow-400/50 font-mono text-xs">{totals.directCount} DIRECT</Badge>
          <Badge variant="outline" className="text-red-400 border-red-400/50 font-mono text-xs">{totals.blockCount} BLOCK</Badge>
        </div>
        <Button onClick={resetRules} variant="outline" className="border-primary/30 text-primary/60 hover:text-primary font-mono text-xs h-8">
          <RotateCcw className="w-3 h-3 mr-1.5" /> RESET DEFAULTS
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card className="bg-black border-primary/20">
            <CardContent className="p-4 space-y-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 pb-2 border-b border-primary/10">
                Add Rule
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Rule name" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8" />
                <Input value={form.value ?? ""} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                  placeholder="Value (IP/CIDR/port/app)" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8" />
                <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as RuleType }))}>
                  <SelectTrigger className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-black border-primary/30 font-mono text-xs">
                    <SelectItem value="cidr">CIDR Range</SelectItem>
                    <SelectItem value="ip">Single IP</SelectItem>
                    <SelectItem value="port">Port / Range</SelectItem>
                    <SelectItem value="domain">Domain</SelectItem>
                    <SelectItem value="app">Application</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={form.mode} onValueChange={(v) => setForm(f => ({ ...f, mode: v as TunnelMode }))}>
                  <SelectTrigger className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-black border-primary/30 font-mono text-xs">
                    <SelectItem value="vpn" className="text-primary">VPN — route through tunnel</SelectItem>
                    <SelectItem value="direct" className="text-yellow-400">DIRECT — bypass VPN</SelectItem>
                    <SelectItem value="block" className="text-red-400">BLOCK — drop all packets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Input value={String(form.priority ?? 100)} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value)||100 }))}
                  type="number" placeholder="Priority" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8 w-24" />
                <Input value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes (optional)" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8 flex-1" />
                <Button onClick={addRule} variant="outline"
                  className="h-8 font-mono text-xs bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                  disabled={!form.name || !form.value}>
                  <Plus className="w-3 h-3 mr-1" /> ADD
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black border-primary/20">
            <CardContent className="p-4 space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 pb-2 border-b border-primary/10">
                Rules (sorted by priority)
              </div>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {rules.map((rule) => (
                  <div key={rule.id}
                    className={`flex items-center gap-2 px-2 py-1.5 border rounded-sm ${rule.enabled ? `border-${rule.mode === "vpn" ? "primary" : rule.mode === "direct" ? "yellow-500" : "red-500"}/20 ${MODE_BG[rule.mode]}` : "border-primary/10 opacity-50"}`}
                    style={{ borderColor: rule.enabled ? (rule.mode === "vpn" ? "rgba(0,255,65,0.15)" : rule.mode === "direct" ? "rgba(234,179,8,0.2)" : "rgba(239,68,68,0.2)") : undefined }}>
                    <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule)} className="scale-75" />
                    <Badge variant="outline" className={`text-[9px] font-mono flex-shrink-0 ${MODE_COLORS[rule.mode]}`}>{rule.mode.toUpperCase()}</Badge>
                    <span className="text-[10px] font-mono text-primary flex-shrink-0">{rule.priority}</span>
                    <span className="text-xs font-mono text-primary flex-1 truncate">{rule.name}</span>
                    <code className="text-[9px] font-mono text-primary/60 bg-black/60 px-1 rounded flex-shrink-0">{rule.type}:{rule.value}</code>
                    {rule.notes && <span className="text-[9px] font-mono text-primary/40 truncate max-w-[80px]">{rule.notes}</span>}
                    <button onClick={() => deleteRule(rule.id)} className="text-primary/30 hover:text-red-400 flex-shrink-0 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-black border-primary/20 h-fit">
          <CardContent className="p-4 space-y-3">
            <div className="pb-2 border-b border-primary/10">
              <span className="text-[10px] font-mono uppercase tracking-widest text-primary/50">How Rules Are Applied</span>
            </div>
            <div className="space-y-2 text-[10px] font-mono text-primary/50 leading-relaxed">
              <p>Rules are applied automatically on the server the moment you add or remove them. No scripts, no manual steps.</p>
              <div className="space-y-1.5 pt-1">
                {[
                  ["VPN", "Traffic forced through VPN tunnel", "text-primary"],
                  ["DIRECT", "Traffic bypasses VPN — goes direct to internet", "text-yellow-400/70"],
                  ["BLOCK", "Traffic completely dropped — never reaches internet", "text-red-400/70"],
                ].map(([mode, desc, color]) => (
                  <div key={mode} className="flex gap-2 items-start">
                    <span className={`${color} w-12 shrink-0 font-bold`}>{mode}</span>
                    <span className="text-primary/30">{desc}</span>
                  </div>
                ))}
              </div>
              <p className="text-primary/30 pt-1">Rules with higher priority numbers run first. Drag to reorder, or set priority manually.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
