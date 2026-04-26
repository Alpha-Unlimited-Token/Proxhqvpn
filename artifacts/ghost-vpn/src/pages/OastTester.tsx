import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crosshair, RefreshCcw, Trash2, Loader2, Copy, Radio } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "text-red-500 bg-red-900/20 border-red-500/30",
  HIGH:     "text-orange-400 bg-orange-900/20 border-orange-400/30",
  MEDIUM:   "text-yellow-400 bg-yellow-900/20 border-yellow-400/30",
  LOW:      "text-blue-400 bg-blue-900/20 border-blue-400/30",
};

export default function OastTester() {
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [target, setTarget] = useState("https://example.com/search?q=");
  const [vector, setVector] = useState("ssrf");

  async function createSession() {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/oast-tester/session`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSession(d);
      setInteractions([]);
      toast({ title: "OAST session created", description: d.payload });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function injectPayload() {
    if (!session) return;
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/oast-tester/inject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId, target, vector }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: "Payload injected", description: `${d.requestsSent} requests sent` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function poll() {
    if (!session) return;
    setPolling(true);
    try {
      const r = await fetch(`${BASE}/api/oast-tester/poll/${session.sessionId}`);
      const d = await r.json();
      if (r.ok) setInteractions(d.interactions ?? []);
    } catch { /* ignore */ } finally {
      setPolling(false);
    }
  }

  async function clearSession() {
    if (!session) return;
    await fetch(`${BASE}/api/oast-tester/session/${session.sessionId}`, { method: "DELETE" });
    setSession(null);
    setInteractions([]);
    toast({ title: "Session cleared" });
  }

  useEffect(() => {
    if (!session) return;
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [session]);

  function copyPayload() {
    if (!session) return;
    navigator.clipboard.writeText(session.payload);
    toast({ title: "Payload copied" });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-mono">
      <div>
        <h1 className="text-xl font-bold text-primary tracking-tight">OAST Blind Tester</h1>
        <p className="text-xs text-white/40 mt-1">Out-of-band application security testing — detect blind SSRF, XXE, blind XSS &amp; DNS injection</p>
      </div>

      {/* Session status */}
      <Card className={`border ${session ? "border-primary/30 bg-primary/5" : "border-white/10 bg-black/30"}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio className={`w-4 h-4 ${session ? "text-primary animate-pulse" : "text-white/30"}`} />
              <span className="text-xs text-white/60 uppercase tracking-widest">Session Status</span>
            </div>
            {session && (
              <Badge className="bg-primary/20 text-primary border-primary/30 border text-[10px]">LIVE</Badge>
            )}
          </div>
          {session ? (
            <div className="space-y-2">
              <div className="text-[11px] text-white/40">Session ID</div>
              <div className="text-xs text-white/80 font-mono bg-black/40 px-3 py-2 rounded-lg border border-white/10">{session.sessionId}</div>
              <div className="text-[11px] text-white/40 mt-2">OAST Payload (embed in target)</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 text-xs text-primary font-mono bg-black/40 px-3 py-2 rounded-lg border border-primary/20 truncate">{session.payload}</div>
                <Button variant="outline" size="sm" onClick={copyPayload} className="border-primary/30 text-primary hover:bg-primary/10 shrink-0">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="text-[11px] text-white/30 mt-1">Listening on: <span className="text-white/50">{session.listenDomain}</span></div>
            </div>
          ) : (
            <div className="text-sm text-white/30">No active session — create one to get an OAST payload</div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-black/40 border-primary/15">
          <CardContent className="p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Session</div>
            <div className="flex gap-2">
              <Button onClick={createSession} disabled={loading} className="flex-1 bg-primary text-black font-bold hover:bg-primary/85">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Crosshair className="w-4 h-4 mr-1" />}
                New Session
              </Button>
              {session && (
                <Button variant="outline" onClick={clearSession}
                  className="border-red-500/30 text-red-400 hover:bg-red-900/20">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Button variant="outline" onClick={poll} disabled={!session || polling}
              className="w-full border-primary/20 text-primary/70 hover:bg-primary/10">
              <RefreshCcw className={`w-4 h-4 mr-1 ${polling ? "animate-spin" : ""}`} />
              Poll Now
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-primary/15">
          <CardContent className="p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Auto-Inject</div>
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Target URL</label>
              <Input value={target} onChange={e => setTarget(e.target.value)}
                className="bg-black/60 border-primary/20 text-primary text-xs font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Vector</label>
              <select value={vector} onChange={e => setVector(e.target.value)}
                className="w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono px-3 py-2 rounded-lg">
                <option value="ssrf">SSRF</option>
                <option value="xxe">XXE</option>
                <option value="blind_xss">Blind XSS</option>
                <option value="dns">DNS Injection</option>
              </select>
            </div>
            <Button onClick={injectPayload} disabled={!session || loading}
              className="w-full bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 font-semibold">
              Inject Payload
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Interactions log */}
      <Card className="bg-black/40 border-primary/15">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Interaction Log</div>
            <Badge className="bg-black/60 text-white/40 border-white/10 border text-[10px]">{interactions.length} hit{interactions.length !== 1 ? "s" : ""}</Badge>
          </div>
          {interactions.length === 0 ? (
            <div className="text-xs text-white/20 text-center py-6">No interactions yet — inject a payload and wait for callbacks</div>
          ) : (
            <div className="space-y-2">
              {interactions.map((i: any, idx: number) => (
                <div key={idx} className={`p-3 rounded-lg border text-xs ${SEV_COLOR[i.severity] ?? "border-white/10 bg-black/30 text-white/60"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold uppercase text-[10px]">{i.type}</span>
                    <span className="text-[10px] opacity-60">{new Date(i.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="font-mono text-[11px] opacity-80">{i.sourceIp} → {i.protocol}</div>
                  {i.payload && <div className="mt-1 opacity-60 truncate">{i.payload}</div>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
