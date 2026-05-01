import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useMutation } from "@tanstack/react-query";
import { Network, Wifi, WifiOff, Search, RefreshCw } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type PingResult = { ip: string; reachable: boolean; latencyMs: number | null; ttl: number | null };
type ResolveResult = { input: string; resolved: string; type: string };

async function doPing(ip: string): Promise<PingResult> {
  const r = await fetch(`${BASE}/api/tools/ping`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ip }),
  });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function doResolve(host: string): Promise<ResolveResult> {
  const r = await fetch(`${BASE}/api/tools/resolve`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host }),
  });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

const PING_COUNT = 4;

export default function IpTool() {
  const [pingTarget, setPingTarget] = useState("192.168.1.101");
  const [resolveTarget, setResolveTarget] = useState("alpha-workstation.local");
  const [pingLog, setPingLog] = useState<Array<PingResult & { seq: number }>>([]);
  const [pingRunning, setPingRunning] = useState(false);

  const resolveMut = useMutation({ mutationFn: () => doResolve(resolveTarget) });

  const runPing = async () => {
    setPingRunning(true);
    setPingLog([]);
    for (let i = 1; i <= PING_COUNT; i++) {
      try {
        const result = await doPing(pingTarget);
        setPingLog(prev => [...prev, { ...result, seq: i }]);
      } catch {
        setPingLog(prev => [...prev, { ip: pingTarget, reachable: false, latencyMs: null, ttl: null, seq: i }]);
      }
      if (i < PING_COUNT) await new Promise(r => setTimeout(r, 400));
    }
    setPingRunning(false);
  };

  const pingStats = pingLog.length > 0 ? {
    sent: pingLog.length,
    recv: pingLog.filter(p => p.reachable).length,
    avgMs: Math.round(pingLog.filter(p => p.latencyMs).reduce((s, p) => s + (p.latencyMs ?? 0), 0) / (pingLog.filter(p => p.latencyMs).length || 1)),
    minMs: Math.min(...pingLog.filter(p => p.latencyMs).map(p => p.latencyMs ?? 9999)),
    maxMs: Math.max(...pingLog.filter(p => p.latencyMs).map(p => p.latencyMs ?? 0)),
  } : null;

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Network className="h-7 w-7 text-primary" /> IP Tool
          </h1>
          <p className="text-muted-foreground mt-1">Ping hosts and resolve IP addresses / hostnames.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ping */}
          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wifi className="h-4 w-4 text-primary" /> Ping
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input value={pingTarget} onChange={e => setPingTarget(e.target.value)}
                  className="font-mono bg-black/20 border-border/50 flex-1" placeholder="IP or hostname"
                  onKeyDown={e => e.key === "Enter" && !pingRunning && runPing()} />
                <Button onClick={runPing} disabled={pingRunning} className="gap-2">
                  {pingRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                  Ping
                </Button>
              </div>

              <div className="bg-black/40 rounded-md p-3 min-h-[180px] font-mono text-xs space-y-1 border border-border/30">
                {pingLog.length === 0 && !pingRunning && (
                  <span className="text-muted-foreground">Ready. Enter an IP and click Ping.</span>
                )}
                {pingRunning && pingLog.length === 0 && (
                  <span className="text-primary animate-pulse">Pinging {pingTarget}...</span>
                )}
                {pingLog.map((p) => (
                  <div key={p.seq} className={p.reachable ? "text-green-400" : "text-red-400"}>
                    {p.reachable
                      ? `Reply from ${p.ip}: bytes=32 time=${p.latencyMs}ms TTL=${p.ttl}`
                      : `Request timeout for icmp_seq ${p.seq}`}
                  </div>
                ))}
                {pingRunning && pingLog.length > 0 && pingLog.length < PING_COUNT && (
                  <span className="text-primary animate-pulse">...</span>
                )}
              </div>

              {pingStats && !pingRunning && (
                <div className="bg-muted/20 rounded p-3 font-mono text-xs space-y-1 border border-border/30">
                  <p className="text-muted-foreground">--- {pingTarget} ping statistics ---</p>
                  <p>
                    <span className="text-foreground">{pingStats.sent}</span> packets transmitted, {" "}
                    <span className="text-green-400">{pingStats.recv}</span> received, {" "}
                    <span className={pingStats.sent - pingStats.recv > 0 ? "text-red-400" : "text-green-400"}>
                      {Math.round(((pingStats.sent - pingStats.recv) / pingStats.sent) * 100)}% packet loss
                    </span>
                  </p>
                  {pingStats.recv > 0 && (
                    <p className="text-muted-foreground">
                      rtt min/avg/max = <span className="text-foreground">{pingStats.minMs}/{pingStats.avgMs}/{pingStats.maxMs} ms</span>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resolve */}
          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" /> DNS Resolve
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input value={resolveTarget} onChange={e => setResolveTarget(e.target.value)}
                  className="font-mono bg-black/20 border-border/50 flex-1" placeholder="Hostname or IP"
                  onKeyDown={e => e.key === "Enter" && resolveMut.mutate()} />
                <Button onClick={() => resolveMut.mutate()} disabled={resolveMut.isPending} className="gap-2">
                  {resolveMut.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Resolve
                </Button>
              </div>

              <div className="bg-black/40 rounded-md p-4 min-h-[180px] font-mono text-xs border border-border/30">
                {!resolveMut.data && !resolveMut.isPending && (
                  <span className="text-muted-foreground">Enter a hostname to resolve to IP, or an IP to reverse-lookup.</span>
                )}
                {resolveMut.isPending && (
                  <span className="text-primary animate-pulse">Resolving {resolveTarget}...</span>
                )}
                {resolveMut.data && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                        {resolveMut.data.type === "reverse" ? "PTR" : "A"}
                      </Badge>
                      <span className="text-muted-foreground">lookup</span>
                    </div>
                    <Separator className="border-border/30" />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-muted-foreground text-[10px] mb-1">INPUT</p>
                        <p className="text-yellow-400">{resolveMut.data.input}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[10px] mb-1">RESOLVED</p>
                        <p className="text-green-400">{resolveMut.data.resolved}</p>
                      </div>
                    </div>
                    <Separator className="border-border/30" />
                    <p className="text-muted-foreground">
                      {resolveMut.data.type === "reverse"
                        ? `Reverse lookup: ${resolveMut.data.input} → ${resolveMut.data.resolved}`
                        : `Forward lookup: ${resolveMut.data.input} → ${resolveMut.data.resolved}`}
                    </p>
                  </div>
                )}
                {resolveMut.isError && (
                  <span className="text-red-400">Resolution failed: unable to reach DNS</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    
  );
}
