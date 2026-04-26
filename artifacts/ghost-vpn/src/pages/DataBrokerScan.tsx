import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldOff, CheckCircle, AlertTriangle, Loader2, ExternalLink, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const SEV_COLOR: Record<string, string> = {
  "People Search":    "bg-red-900/20 border-red-500/20 text-red-400",
  "Background Check": "bg-orange-900/20 border-orange-400/20 text-orange-400",
  "Data Aggregator":  "bg-yellow-900/20 border-yellow-400/20 text-yellow-400",
  "Credit Bureau":    "bg-purple-900/20 border-purple-400/20 text-purple-400",
  "B2B Data":         "bg-blue-900/20 border-blue-400/20 text-blue-400",
  "Public Records":   "bg-pink-900/20 border-pink-400/20 text-pink-400",
  "Identity Data":    "bg-orange-900/20 border-orange-400/20 text-orange-400",
  "Property Data":    "bg-primary/10 border-primary/20 text-primary/60",
};

export default function DataBrokerScan() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [optingOut, setOptingOut] = useState<string | null>(null);

  async function scan() {
    if (!email.trim()) return;
    setLoading(true);
    setSession(null);
    try {
      const r = await fetch(`${BASE}/api/data-broker/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSession(d);
    } catch (e: any) { toast({ title: "Scan failed", description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  async function optOut(broker: string) {
    setOptingOut(broker);
    try {
      const r = await fetch(`${BASE}/api/data-broker/optout/${encodeURIComponent(broker)}`, { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        setSession((prev: any) => ({
          ...prev,
          results: prev.results.map((res: any) => res.broker === broker ? { ...res, optOutStatus: "submitted" } : res),
        }));
        toast({ title: `Opt-out submitted to ${broker}`, description: "Processing takes 7–30 days" });
      }
    } catch { /* ignore */ } finally { setOptingOut(null); }
  }

  const exposed = session?.results?.filter((r: any) => r.found) ?? [];
  const safe    = session?.results?.filter((r: any) => !r.found) ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-mono">
      <div>
        <h1 className="text-xl font-bold text-primary tracking-tight">Data Broker Scanner</h1>
        <p className="text-xs text-white/40 mt-1">Find your personal data on 20+ data brokers and submit opt-out requests — Surfshark Incogni parity</p>
      </div>

      {/* Scan input */}
      <Card className="bg-black/40 border-primary/15">
        <CardContent className="p-4 flex gap-3">
          <Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="your@email.com"
            className="flex-1 bg-black/60 border-primary/20 text-primary text-sm font-mono"
            onKeyDown={e => e.key === "Enter" && scan()} />
          <Button onClick={scan} disabled={loading || !email.trim()} className="bg-primary text-black font-bold hover:bg-primary/85 px-6">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ShieldOff className="w-4 h-4 mr-1" />}
            {loading ? "Scanning 20 brokers…" : "Scan"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {session && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 border border-red-500/20 bg-red-900/10 rounded-xl text-center">
              <div className="text-3xl font-black text-red-400">{session.exposedCount}</div>
              <div className="text-[9px] text-red-400/60 uppercase mt-1">Exposed</div>
            </div>
            <div className="p-4 border border-green-500/20 bg-green-900/10 rounded-xl text-center">
              <div className="text-3xl font-black text-green-400">{safe.length}</div>
              <div className="text-[9px] text-green-400/60 uppercase mt-1">Not Found</div>
            </div>
            <div className="p-4 border border-primary/15 bg-primary/5 rounded-xl text-center">
              <div className="text-3xl font-black text-primary">{session.totalBrokers}</div>
              <div className="text-[9px] text-primary/60 uppercase mt-1">Scanned</div>
            </div>
          </div>

          {/* Exposed brokers */}
          {exposed.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-widest text-red-400/60">Your Data Found On These Brokers</div>
              {exposed.map((r: any) => (
                <Card key={r.broker} className="border-red-500/20 bg-red-900/5">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white">{r.broker}</span>
                            <Badge className={`text-[9px] border ${SEV_COLOR[r.category]}`}>{r.category}</Badge>
                            {r.optOutStatus === "submitted" && <Badge className="text-[9px] border bg-yellow-900/20 border-yellow-400/20 text-yellow-400">OPT-OUT SUBMITTED</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {r.dataTypes.map((dt: string) => (
                              <span key={dt} className="text-[9px] bg-red-900/20 text-red-400/70 border border-red-500/15 px-1.5 py-0.5 rounded">{dt}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <a href={r.optOutUrl} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-[10px] border border-white/15 text-white/40 px-2 py-1 rounded hover:border-white/30 transition-colors">
                          <ExternalLink className="w-3 h-3" /> Opt-Out Page
                        </a>
                        {r.optOutStatus === "not_started" && (
                          <Button size="sm" onClick={() => optOut(r.broker)} disabled={optingOut === r.broker}
                            className="text-xs bg-primary text-black font-bold h-7">
                            {optingOut === r.broker ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                            Request Removal
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Clean brokers */}
          <details>
            <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-white/30 hover:text-white/50 transition-colors list-none flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              {safe.length} brokers — no data found
            </summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {safe.map((r: any) => (
                <span key={r.broker} className="text-[10px] border border-green-500/10 text-green-400/50 bg-green-900/5 px-2 py-0.5 rounded">{r.broker}</span>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
