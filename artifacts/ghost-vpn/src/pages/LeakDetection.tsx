import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, Globe, Wifi, Search, Copy, CheckCheck, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface LeakResult {
  runAt: string;
  durationMs: number;
  overallStatus: "secure" | "warning" | "leaked";
  publicIp: { ip: string; country: string; isp: string };
  dns: { leakDetected: boolean; servers: { ip: string; provider: string; isVpnDns: boolean; isPrivate: boolean }[] };
  ipv6: { leakDetected: boolean; address: string | null; recommendation: string };
  webrtc: { leakDetected: boolean; note: string; browserTestUrl: string };
  fingerprint: { dnssec: boolean; doh: boolean; dot: boolean; recommendation: string };
  fixes: Record<string, string>;
}

interface WebRtcScript { script: string; description: string }

const STATUS_COLORS = {
  secure:  "text-green-400 border-green-400/50",
  warning: "text-yellow-400 border-yellow-400/50",
  leaked:  "text-red-400 border-red-400/50",
};

const STATUS_BG = {
  secure:  "bg-green-900/10 border-green-500/30",
  warning: "bg-yellow-900/10 border-yellow-500/30",
  leaked:  "bg-red-900/10 border-red-500/30",
};

export default function LeakDetection() {
  const { toast } = useToast();
  const [result, setResult] = useState<LeakResult | null>(null);
  const [webrtcScript, setWebrtcScript] = useState<WebRtcScript | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const runTest = useCallback(async () => {
    setRunning(true);
    try {
      const [leakR, wrtcR] = await Promise.all([
        fetch(`${BASE}/api/leaks/check`).then(r => r.json()),
        fetch(`${BASE}/api/leaks/webrtc-script`).then(r => r.json()),
      ]);
      setResult(leakR);
      setWebrtcScript(wrtcR);
      toast({
        title: leakR.overallStatus === "secure" ? "No leaks detected" : "Leak detected!",
        description: leakR.overallStatus === "secure" ? "All tests passed." : "Check results for details.",
        variant: leakR.overallStatus === "leaked" ? "destructive" : "default",
      });
    } catch (e: any) {
      toast({ title: "Test failed", description: e.message, variant: "destructive" });
    } finally { setRunning(false); }
  }, [toast]);

  const copyScript = async () => {
    if (!webrtcScript?.script) return;
    await navigator.clipboard.writeText(webrtcScript.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="border border-primary/10 bg-black/20 rounded-sm px-3 py-2.5 flex items-center justify-between flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <Search className="w-5 h-5" /> Leak Detection Suite
          </h2>
          {result && (
            <Badge variant="outline" className={`font-mono text-xs ${STATUS_COLORS[result.overallStatus]}`}>
              {result.overallStatus.toUpperCase()}
            </Badge>
          )}
        </div>
        <Button
          onClick={runTest}
          disabled={running}
          className="bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 font-mono text-xs"
          variant="outline"
        >
          <RefreshCw className={`w-3 h-3 mr-1.5 ${running ? "animate-spin" : ""}`} />
          {running ? "SCANNING..." : "RUN LEAK TEST"}
        </Button>
      </div>

      {!result && !running && (
        <div className="flex flex-col items-center justify-center h-56 text-primary/30 font-mono text-xs gap-4 border border-primary/10 bg-black/20 rounded-sm">
          <ShieldAlert className="w-10 h-10 opacity-30" />
          <span>Click RUN LEAK TEST to check for DNS, IPv6, and WebRTC leaks</span>
        </div>
      )}

      {running && (
        <div className="flex flex-col items-center justify-center h-56 text-primary/50 font-mono text-xs gap-4 border border-primary/10 bg-black/20 rounded-sm">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <span>Running leak detection tests...</span>
        </div>
      )}

      {result && (
        <>
          <div className={`border rounded-sm px-4 py-3 flex items-center gap-3 text-sm font-mono ${STATUS_BG[result.overallStatus]}`}>
            <Shield className={`w-5 h-5 flex-shrink-0 ${STATUS_COLORS[result.overallStatus].split(" ")[0]}`} />
            <div>
              <span className={`font-bold ${STATUS_COLORS[result.overallStatus].split(" ")[0]}`}>
                {result.overallStatus === "secure" ? "SECURE — No leaks detected" :
                 result.overallStatus === "warning" ? "WARNING — Potential DNS exposure" :
                 "LEAKED — Your real identity may be exposed"}
              </span>
              <span className="text-primary/40 text-xs ml-3">({result.durationMs}ms)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="bg-black border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-primary/10">
                  <Globe className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-primary/50">Public IP</span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-primary/50">IP ADDRESS</span>
                    <span className="text-primary font-bold">{result.publicIp.ip}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-primary/50">COUNTRY</span>
                    <span className="text-primary">{result.publicIp.country}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-primary/50">ISP / ORG</span>
                    <span className="text-primary truncate max-w-[140px]" title={result.publicIp.isp}>{result.publicIp.isp}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`bg-black border ${result.dns.leakDetected ? "border-yellow-500/40" : "border-primary/20"}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-primary/10">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-primary/50">DNS Leak Test</span>
                  </div>
                  <Badge variant="outline" className={`text-[9px] font-mono ${result.dns.leakDetected ? "text-yellow-400 border-yellow-400/50" : "text-green-400 border-green-400/50"}`}>
                    {result.dns.leakDetected ? "POTENTIAL LEAK" : "CLEAN"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {result.dns.servers.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-primary/70">{s.ip}</span>
                      <span className={s.isVpnDns ? "text-green-400" : s.isPrivate ? "text-primary/50" : "text-yellow-400"}>{s.provider}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] font-mono text-primary/40 border-t border-primary/10 pt-2">{result.dns.recommendation}</p>
              </CardContent>
            </Card>

            <Card className={`bg-black border ${result.ipv6.leakDetected ? "border-red-500/40" : "border-primary/20"}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-primary/10">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-primary/50">IPv6 Leak</span>
                  </div>
                  <Badge variant="outline" className={`text-[9px] font-mono ${result.ipv6.leakDetected ? "text-red-400 border-red-400/50" : "text-green-400 border-green-400/50"}`}>
                    {result.ipv6.leakDetected ? "EXPOSED" : "SECURE"}
                  </Badge>
                </div>
                {result.ipv6.leakDetected && (
                  <p className="text-xs font-mono text-red-400">{result.ipv6.address}</p>
                )}
                {!result.ipv6.leakDetected && (
                  <p className="text-xs font-mono text-green-400">No IPv6 address detected externally.</p>
                )}
                <p className="text-[9px] font-mono text-primary/40 border-t border-primary/10 pt-2">{result.ipv6.recommendation}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-black border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-primary/10">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-primary/50">WebRTC Leak Test</span>
                  <Badge variant="outline" className="text-[9px] font-mono text-primary/50 border-primary/30">BROWSER-SIDE</Badge>
                </div>
                <p className="text-xs font-mono text-primary/70">{result.webrtc.note}</p>
                {webrtcScript && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-primary/40">Paste in browser console:</span>
                      <button onClick={copyScript} className="text-[10px] font-mono text-primary/50 hover:text-primary flex items-center gap-1">
                        {copied ? <><CheckCheck className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                      </button>
                    </div>
                    <pre className="text-[9px] font-mono text-primary/60 bg-black/60 border border-primary/10 rounded p-2 overflow-x-auto max-h-32 whitespace-pre-wrap">
                      {webrtcScript.script}
                    </pre>
                  </div>
                )}
                <a href={result.webrtc.browserTestUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] font-mono text-primary/60 hover:text-primary underline">
                  {result.webrtc.browserTestUrl}
                </a>
              </CardContent>
            </Card>

            <Card className="bg-black border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="pb-2 border-b border-primary/10">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-primary/50">Recommended Fixes</span>
                </div>
                <div className="space-y-3">
                  {Object.entries(result.fixes).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-[9px] font-mono text-primary/40 uppercase mb-0.5">{key.replace(/([A-Z])/g, " $1").toUpperCase()}</p>
                      <p className="text-[10px] font-mono text-primary/70">{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
