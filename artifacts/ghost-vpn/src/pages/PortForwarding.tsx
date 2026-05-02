// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Power, RefreshCcw, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const PROTOCOLS = ["TCP", "UDP", "TCP+UDP"] as const;

export default function PortForwarding() {
  const { toast } = useToast();
  const [rules, setRules] = useState<any[]>([]);
  const [extPort, setExtPort] = useState("");
  const [intPort, setIntPort] = useState("");
  const [proto, setProto] = useState<"TCP"|"UDP"|"TCP+UDP">("TCP");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);

  async function load() {
    const r = await fetch(`${BASE}/api/port-forward/rules`);
    const d = await r.json();
    setRules(d.rules ?? []);
  }

  useEffect(() => { load(); }, []);

  async function addRule() {
    if (!extPort || !intPort) return;
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/port-forward/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocol: proto, externalPort: parseInt(extPort), internalPort: parseInt(intPort), description: desc }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRules(prev => [...prev, d.rule]);
      setExtPort(""); setIntPort(""); setDesc("");
      toast({ title: `Port ${extPort} forwarded` });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  async function deleteRule(id: string) {
    await fetch(`${BASE}/api/port-forward/rules/${id}`, { method: "DELETE" });
    setRules(prev => prev.filter(r => r.id !== id));
    toast({ title: "Rule removed" });
  }

  async function toggle(id: string) {
    const r = await fetch(`${BASE}/api/port-forward/rules/${id}/toggle`, { method: "PUT" });
    const d = await r.json();
    setRules(prev => prev.map(rule => rule.id === id ? d.rule : rule));
  }

  async function check(id: string) {
    setChecking(id);
    try {
      const r = await fetch(`${BASE}/api/port-forward/check/${id}`, { method: "POST" });
      const d = await r.json();
      setRules(prev => prev.map(rule => rule.id === id ? d.rule : rule));
    } catch { /* ignore */ } finally { setChecking(null); }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-mono">
      <div>
        <h1 className="text-xl font-bold text-primary tracking-tight">Port Forwarding</h1>
        <p className="text-xs text-white/40 mt-1">Manage inbound port forwarding rules — Mullvad & ProtonVPN parity</p>
      </div>

      {/* Add rule form */}
      <Card className="bg-black/40 border-primary/15">
        <CardContent className="p-4 space-y-3">
          <div className="text-[10px] uppercase tracking-widest text-white/40">Add Rule</div>
          <div className="flex gap-2 flex-wrap">
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Protocol</label>
              <select value={proto} onChange={e => setProto(e.target.value as any)}
                className="bg-black/60 border border-primary/20 text-primary text-sm font-mono rounded-lg px-2 py-2 focus:outline-none w-28">
                {PROTOCOLS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">External Port</label>
              <Input value={extPort} onChange={e => setExtPort(e.target.value)} type="number" min="1" max="65535"
                placeholder="51820" className="bg-black/60 border-primary/20 text-primary text-sm font-mono w-28" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Internal Port</label>
              <Input value={intPort} onChange={e => setIntPort(e.target.value)} type="number" min="1" max="65535"
                placeholder="8080" className="bg-black/60 border-primary/20 text-primary text-sm font-mono w-28" />
            </div>
            <div className="flex-1 min-w-40">
              <label className="text-[10px] text-white/30 mb-1 block">Description</label>
              <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. BitTorrent"
                className="bg-black/60 border-primary/20 text-primary text-sm font-mono" />
            </div>
            <div className="flex items-end">
              <Button onClick={addRule} disabled={loading || !extPort || !intPort}
                className="bg-primary text-black font-bold hover:bg-primary/85">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="text-center text-white/30 text-sm py-12">No rules yet. Add one above.</div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[80px_100px_100px_1fr_120px_80px] gap-3 px-3 py-1 text-[9px] uppercase tracking-widest text-white/25">
            <span>Protocol</span><span>Ext Port</span><span>Int Port</span><span>Description</span><span>Status</span><span>Actions</span>
          </div>
          {rules.map(rule => (
            <Card key={rule.id} className="bg-black/30 border-primary/10">
              <CardContent className="p-3">
                <div className="grid grid-cols-[80px_100px_100px_1fr_120px_80px] gap-3 items-center">
                  <Badge className={`text-[9px] w-fit border ${rule.protocol === "TCP" ? "bg-blue-900/20 border-blue-400/30 text-blue-400" : rule.protocol === "UDP" ? "bg-yellow-900/20 border-yellow-400/30 text-yellow-400" : "bg-purple-900/20 border-purple-400/30 text-purple-400"}`}>
                    {rule.protocol}
                  </Badge>
                  <span className="text-primary font-mono text-sm">{rule.externalPort}</span>
                  <span className="text-white/60 font-mono text-sm">→ {rule.internalPort}</span>
                  <span className="text-white/50 text-xs truncate">{rule.description || "—"}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge className={`text-[9px] border ${rule.status === "active" ? "bg-green-900/20 border-green-500/20 text-green-400" : "bg-white/5 border-white/10 text-white/30"}`}>
                      {rule.status}
                    </Badge>
                    {rule.reachable !== null && (
                      rule.reachable
                        ? <CheckCircle className="w-3 h-3 text-green-400" />
                        : <XCircle className="w-3 h-3 text-red-400" />
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => toggle(rule.id)}
                      className={`p-1.5 rounded hover:bg-primary/10 transition-colors ${rule.status === "active" ? "text-primary/70" : "text-white/20"}`}>
                      <Power className="w-3 h-3" />
                    </button>
                    <button onClick={() => check(rule.id)} disabled={checking === rule.id}
                      className="p-1.5 rounded hover:bg-primary/10 transition-colors text-white/40">
                      {checking === rule.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                    </button>
                    <button onClick={() => deleteRule(rule.id)} className="p-1.5 rounded hover:bg-red-900/20 transition-colors text-red-400/50 hover:text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
