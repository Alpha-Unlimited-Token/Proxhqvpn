// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Wifi, Copy, CheckCheck, RefreshCw, ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface ServerInfo { ip: string; dns1: string; dns2: string; dns3: string }
interface Guide { platform: string; serverIp: string; title: string; steps: string[] }
interface TestResult { serverIp: string; reachable: boolean; testedAt: string }

const PLATFORMS = [
  { id: "samsung-tv",  label: "Samsung Smart TV" },
  { id: "lg-tv",       label: "LG Smart TV" },
  { id: "roku",        label: "Roku" },
  { id: "xbox",        label: "Xbox" },
  { id: "ps5",         label: "PlayStation" },
  { id: "ios",         label: "iPhone / iPad" },
  { id: "android",     label: "Android" },
  { id: "windows",     label: "Windows" },
  { id: "macos",       label: "macOS" },
  { id: "router",      label: "Router (all devices)" },
];

export default function SmartDns() {
  const { toast } = useToast();
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [loadingGuide, setLoadingGuide] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/smart-dns/server-ip`).then(r => r.json()).then(setServer).catch(() => null);
  }, []);

  const loadGuide = async (id: string) => {
    if (selectedPlatform === id) { setSelectedPlatform(null); setGuide(null); return; }
    setSelectedPlatform(id);
    setLoadingGuide(true);
    try {
      const r = await fetch(`${BASE}/api/smart-dns/instructions/${id}`);
      const data = await r.json();
      setGuide(data);
    } catch { toast({ title: "Failed to load guide", variant: "destructive" }); }
    finally { setLoadingGuide(false); }
  };

  const testDns = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch(`${BASE}/api/smart-dns/test`, { method: "POST" });
      const data = await r.json();
      setTestResult(data);
    } catch { toast({ title: "Test failed", variant: "destructive" }); }
    finally { setTesting(false); }
  };

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-5 font-mono">
      <div>
        <h1 className="text-lg font-bold tracking-widest uppercase text-primary">Smart DNS</h1>
        <p className="text-xs text-primary/40 mt-0.5">DNS-based routing for TVs, consoles, and devices that can't run WireGuard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="bg-black border-primary/30 md:col-span-2">
          <CardContent className="p-4 space-y-3">
            <div className="text-[9px] tracking-widest text-primary/40 uppercase">ProxhqVPN DNS Server</div>
            {server ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-primary tracking-widest">{server.dns1}</div>
                    <div className="text-[9px] text-primary/40 mt-0.5">Primary DNS Server</div>
                  </div>
                  <button onClick={() => copy(server.dns1, "dns1")}
                    className="flex items-center gap-1.5 text-[9px] uppercase text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/40 px-2 py-1.5 transition-colors">
                    {copied === "dns1" ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied === "dns1" ? "COPIED" : "COPY"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[9px]">
                  <div className="border border-primary/10 p-2">
                    <div className="text-primary/30 mb-0.5">SECONDARY DNS (FALLBACK)</div>
                    <div className="text-primary flex items-center justify-between">
                      {server.dns2}
                      <button onClick={() => copy(server.dns2, "dns2")} className="text-primary/40 hover:text-primary ml-2">
                        {copied === "dns2" ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="border border-primary/10 p-2">
                    <div className="text-primary/30 mb-0.5">TERTIARY DNS</div>
                    <div className="text-primary flex items-center justify-between">
                      {server.dns3}
                      <button onClick={() => copy(server.dns3, "dns3")} className="text-primary/40 hover:text-primary ml-2">
                        {copied === "dns3" ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-primary/30 text-xs animate-pulse">Loading server IP...</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-black border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="text-[9px] tracking-widest text-primary/40 uppercase">Connection Test</div>
            <p className="text-[9px] text-primary/40">Verify your device can reach the ProxhqVPN DNS server</p>
            <button onClick={testDns} disabled={testing}
              className="w-full flex items-center justify-center gap-2 text-[9px] uppercase tracking-widest text-black bg-primary hover:bg-primary/80 py-2 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3 h-3 ${testing ? "animate-spin" : ""}`} />
              {testing ? "TESTING..." : "RUN TEST"}
            </button>
            {testResult && (
              <div className={`flex items-center gap-2 text-[9px] p-2 border ${testResult.reachable ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"}`}>
                {testResult.reachable
                  ? <CheckCircle className="w-3 h-3" />
                  : <XCircle className="w-3 h-3" />}
                {testResult.reachable ? "DNS SERVER REACHABLE" : "SERVER NOT REACHABLE"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="text-[9px] tracking-[0.25em] text-primary/30 uppercase mb-2">Setup Instructions by Platform</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
          {PLATFORMS.map(p => (
            <button key={p.id} onClick={() => loadGuide(p.id)}
              className={`flex items-center justify-between text-[10px] font-mono uppercase tracking-wide border px-2.5 py-2 transition-colors ${selectedPlatform === p.id ? "bg-primary/10 border-primary text-primary" : "border-primary/20 text-primary/50 hover:border-primary/40 hover:text-primary"}`}>
              {p.label}
              {selectedPlatform === p.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          ))}
        </div>

        {loadingGuide && (
          <div className="mt-3 text-[9px] text-primary/30 animate-pulse">Loading instructions...</div>
        )}

        {guide && !loadingGuide && (
          <Card className="mt-3 bg-black border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wifi className="w-4 h-4 text-primary/50" />
                <span className="text-[11px] font-bold text-primary">{guide.title}</span>
                {server && (
                  <span className="text-[9px] text-primary/30 ml-auto">DNS: {server.dns1}</span>
                )}
              </div>
              <ol className="space-y-2">
                {guide.steps.map((step, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="text-[9px] text-primary/30 shrink-0 pt-0.5 w-4">{i + 1}.</span>
                    <p className="text-[9px] text-primary/70 leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
              {server && (
                <div className="mt-3 pt-3 border-t border-primary/10">
                  <div className="text-[9px] text-primary/30 mb-1">Quick copy for DNS field:</div>
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] text-primary bg-primary/5 border border-primary/10 px-2 py-1">{server.dns1}</code>
                    <button onClick={() => copy(server.dns1, "guide-dns")}
                      className="flex items-center gap-1 text-[9px] text-primary/50 hover:text-primary">
                      {copied === "guide-dns" ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="bg-black border-primary/10">
        <CardContent className="p-4">
          <div className="text-[9px] tracking-widest text-primary/30 uppercase mb-2">How Smart DNS Works</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[9px] text-primary/50">
            <div>
              <div className="text-primary/70 font-bold mb-1">What it does</div>
              DNS-level routing intercepts domain lookups and routes them through ProxhqVPN's resolver, enabling geo-unblocking without a full VPN tunnel.
            </div>
            <div>
              <div className="text-primary/70 font-bold mb-1">What it doesn't do</div>
              Smart DNS does not encrypt your traffic. For full privacy, use the WireGuard app or a router-level VPN which tunnels all traffic.
            </div>
            <div>
              <div className="text-primary/70 font-bold mb-1">Best for</div>
              Smart TVs, game consoles, and streaming devices where installing a VPN app isn't possible. Ideal for accessing geo-restricted streaming content.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
