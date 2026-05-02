// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, Shield, Loader2, Trash2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const REGION_COLOR: Record<string, string> = {
  "Americas": "text-blue-400", "Europe": "text-green-400", "Asia-Pacific": "text-yellow-400",
};

export default function DedicatedIp() {
  const { toast } = useToast();
  const [current, setCurrent] = useState<any>(null);
  const [pool, setPool] = useState<any[]>([]);
  const [plan, setPlan] = useState<"monthly"|"annual">("monthly");
  const [loading, setLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  async function load() {
    const [c, p] = await Promise.all([
      fetch(`${BASE}/api/dedicated-ip/current`).then(r => r.json()),
      fetch(`${BASE}/api/dedicated-ip/pool`).then(r => r.json()),
    ]);
    setCurrent(c.assignment);
    setPool(p.pool ?? []);
  }

  useEffect(() => { load(); }, []);

  async function assign() {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/dedicated-ip/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: selectedCity, plan }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setCurrent(d.assignment);
      setPool(prev => prev.filter(p => p.ip !== d.assignment.ip));
      toast({ title: `Dedicated IP ${d.assignment.ip} assigned` });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  async function release() {
    setLoading(true);
    try {
      await fetch(`${BASE}/api/dedicated-ip/release`, { method: "DELETE" });
      setCurrent(null);
      await load();
      toast({ title: "Dedicated IP released" });
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  const grouped = pool.reduce((acc: Record<string, any[]>, p: any) => {
    if (!acc[p.region]) acc[p.region] = [];
    acc[p.region].push(p);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-mono">
      <div>
        <h1 className="text-xl font-bold text-primary tracking-tight">Dedicated IP</h1>
        <p className="text-xs text-white/40 mt-1">Your own static VPN IP address — no shared-IP blacklisting, whitelisting-friendly</p>
      </div>

      {/* Current assignment */}
      {current ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5 flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-primary font-mono">{current.ip}</span>
                <Badge className="bg-green-900/30 border-green-500/30 text-green-400 text-[9px] border">DEDICATED</Badge>
              </div>
              <div className="text-xs text-white/50 mt-0.5">{current.city}, {current.country} · {current.plan} plan · Expires {new Date(current.expiresAt).toLocaleDateString()}</div>
            </div>
            <Button variant="outline" size="sm" onClick={release} disabled={loading}
              className="border-red-500/30 text-red-400 hover:bg-red-900/20 shrink-0">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
              Release
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-black/30 border-white/10">
          <CardContent className="p-4">
            <div className="text-sm text-white/40 text-center py-2">No dedicated IP assigned — select a location below</div>
          </CardContent>
        </Card>
      )}

      {/* Plan picker */}
      {!current && (
        <>
          <div className="flex gap-3 items-center">
            <span className="text-[10px] uppercase tracking-widest text-white/40">Plan:</span>
            {(["monthly", "annual"] as const).map(p => (
              <button key={p} onClick={() => setPlan(p)}
                className={`px-3 py-1 text-xs rounded-lg border font-semibold transition-colors ${plan === p ? "bg-primary text-black border-primary" : "border-primary/20 text-primary/60 hover:bg-primary/10"}`}>
                {p === "annual" ? "Annual (save 40%)" : "Monthly"}
              </button>
            ))}
          </div>

          {/* IP pool */}
          {Object.entries(grouped).map(([region, cities]) => (
            <Card key={region} className="bg-black/40 border-primary/15">
              <CardContent className="p-4">
                <div className={`text-[10px] uppercase tracking-widest mb-3 ${REGION_COLOR[region] ?? "text-white/40"}`}>{region}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {(cities as any[]).map((c: any) => (
                    <button key={c.ip} onClick={() => setSelectedCity(selectedCity === c.city ? null : c.city)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all ${selectedCity === c.city ? "border-primary/50 bg-primary/10" : "border-white/10 bg-black/30 hover:border-primary/30"}`}>
                      <Globe className={`w-3.5 h-3.5 shrink-0 ${selectedCity === c.city ? "text-primary" : "text-white/30"}`} />
                      <div>
                        <div className="text-[11px] font-semibold text-white/80">{c.city}</div>
                        <div className="text-[9px] text-white/30 font-mono">{c.ip}</div>
                      </div>
                      {selectedCity === c.city && <CheckCircle className="w-3 h-3 text-primary ml-auto" />}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Button onClick={assign} disabled={loading} className="bg-primary text-black font-bold hover:bg-primary/85">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
            {selectedCity ? `Assign Dedicated IP in ${selectedCity}` : "Assign Any Available IP"}
          </Button>
        </>
      )}
    </div>
  );
}
