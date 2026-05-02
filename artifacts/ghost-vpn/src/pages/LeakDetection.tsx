// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield, ShieldAlert, ShieldCheck, Globe, Wifi,
  Search, RefreshCw, AlertTriangle, CheckCircle2,
  XCircle, Eye, EyeOff, Radio, Fingerprint, Network,
  Lock, Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface WebRtcIp { ip: string; type: "private" | "vpn-public" | "leak"; label: string; isLeak: boolean }
interface DnsServer { ip: string; provider: string; isVpnDns: boolean; isPrivate: boolean; isLeak: boolean }
interface BrowserFingerprint {
  userAgent: string; language: string; languages: string[]; timezone: string;
  screen: string; colorDepth: number; platform: string; hardwareConcurrency: number;
  doNotTrack: string; cookiesEnabled: boolean; javaEnabled: boolean;
  webglRenderer: string; webglVendor: string; plugins: number;
  touchPoints: number; deviceMemory: string; connectionType: string;
}

interface TestState {
  status: "idle" | "running" | "done" | "error";
  result?: any;
}

const STUN_SERVERS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:stun.cloudflare.com:3478",
  "stun:stun.ekiga.net",
];

interface IceCandidate {
  ip: string;
  candidateType: "host" | "srflx" | "relay" | "prflx" | "unknown";
  protocol: string;
  port: number;
  isMdns: boolean;
  raw: string;
}

function parseIceCandidate(candidateLine: string): IceCandidate | null {
  const ipRegex = /([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-f0-9:]{3,}:[a-f0-9:]+)/i;
  const typeMatch = candidateLine.match(/\btyp\s+(\w+)/i);
  const protoMatch = candidateLine.match(/\b(udp|tcp)\b/i);
  const portMatch = candidateLine.match(/(\d{1,5})\s+typ/i);

  const ipMatch = candidateLine.match(ipRegex);
  const ip = ipMatch?.[1] ?? "";

  const isMdns = ip.endsWith(".local");
  if (!ip && !isMdns) return null;

  const candidateType = (typeMatch?.[1]?.toLowerCase() ?? "unknown") as IceCandidate["candidateType"];

  return {
    ip,
    candidateType,
    protocol: protoMatch?.[1]?.toLowerCase() ?? "unknown",
    port: parseInt(portMatch?.[1] ?? "0", 10),
    isMdns,
    raw: candidateLine,
  };
}

function gatherWebRtcCandidates(): Promise<IceCandidate[]> {
  return new Promise((resolve) => {
    const candidates: IceCandidate[] = [];
    const seen = new Set<string>();

    let pc: RTCPeerConnection | null = null;
    const done = () => { try { pc?.close(); } catch {} resolve(candidates); };
    const timer = setTimeout(done, 5000);

    try {
      pc = new RTCPeerConnection({ iceServers: STUN_SERVERS.map(u => ({ urls: u })) });
      pc.createDataChannel("");
      pc.onicecandidate = (e) => {
        if (!e.candidate) { clearTimeout(timer); done(); return; }
        const parsed = parseIceCandidate(e.candidate.candidate);
        if (parsed) {
          const key = `${parsed.ip}:${parsed.candidateType}`;
          if (!seen.has(key)) { seen.add(key); candidates.push(parsed); }
        }
      };
      pc.createOffer().then(o => pc!.setLocalDescription(o)).catch(() => { clearTimeout(timer); done(); });
    } catch { clearTimeout(timer); done(); }
  });
}

function classifyCandidate(c: IceCandidate, vpnPublicIp: string) {
  if (c.isMdns) return { isLeak: false, severity: "info" as const, label: "mDNS (browser privacy mode)" };
  if (c.candidateType === "relay") return { isLeak: false, severity: "safe" as const, label: "TURN relay (safe)" };

  const isPrivate = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|fc|fd)/.test(c.ip);
  const isVpnIp = vpnPublicIp && c.ip === vpnPublicIp;

  if (c.candidateType === "srflx") {
    if (isVpnIp) return { isLeak: false, severity: "safe" as const, label: "VPN public IP (correct)" };
    return { isLeak: true, severity: "critical" as const, label: "REAL IP LEAKED via srflx" };
  }

  if (c.candidateType === "host") {
    if (isPrivate) return { isLeak: false, severity: "info" as const, label: "local/private IP" };
    return { isLeak: true, severity: "high" as const, label: "public IP leaked via host candidate" };
  }

  return { isLeak: false, severity: "info" as const, label: c.candidateType };
}

function getBrowserFingerprint(): BrowserFingerprint {
  let webglRenderer = "unavailable";
  let webglVendor = "unavailable";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl") as WebGLRenderingContext | null;
    if (gl) {
      const dbgInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbgInfo) {
        webglRenderer = gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) ?? "unknown";
        webglVendor = gl.getParameter(dbgInfo.UNMASKED_VENDOR_WEBGL) ?? "unknown";
      }
    }
  } catch {}

  const nav = navigator as any;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: [...(navigator.languages ?? [])],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${screen.width}×${screen.height}`,
    colorDepth: screen.colorDepth,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 0,
    doNotTrack: navigator.doNotTrack ?? "not set",
    cookiesEnabled: navigator.cookieEnabled,
    javaEnabled: false,
    webglRenderer,
    webglVendor,
    plugins: navigator.plugins?.length ?? 0,
    touchPoints: navigator.maxTouchPoints ?? 0,
    deviceMemory: nav.deviceMemory ? `${nav.deviceMemory} GB` : "unknown",
    connectionType: conn?.effectiveType ?? "unknown",
  };
}

function statusColor(s: "idle" | "running" | "done" | "error" | "secure" | "warning" | "leaked") {
  if (s === "secure" || s === "done") return "text-green-400";
  if (s === "warning") return "text-yellow-400";
  if (s === "leaked" || s === "error") return "text-red-400";
  return "text-primary/40";
}

function StatusIcon({ status, leaked }: { status: TestState["status"]; leaked?: boolean }) {
  if (status === "running") return <RefreshCw className="w-4 h-4 animate-spin text-primary/50" />;
  if (status === "error") return <XCircle className="w-4 h-4 text-red-500" />;
  if (status === "done") {
    return leaked
      ? <XCircle className="w-4 h-4 text-red-400" />
      : <CheckCircle2 className="w-4 h-4 text-green-400" />;
  }
  return <div className="w-4 h-4 rounded-full border border-primary/20" />;
}

function LeakBadge({ leaked, label }: { leaked?: boolean; label?: string }) {
  if (leaked === undefined) return null;
  return (
    <Badge variant="outline" className={`text-[9px] font-mono ${leaked ? "text-red-400 border-red-400/50" : "text-green-400 border-green-400/50"}`}>
      {label ?? (leaked ? "LEAKED" : "SECURE")}
    </Badge>
  );
}

export default function LeakDetection() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const [ipTest,          setIpTest]          = useState<TestState>({ status: "idle" });
  const [webrtcTest,      setWebrtcTest]      = useState<TestState>({ status: "idle" });
  const [dnsTest,         setDnsTest]         = useState<TestState>({ status: "idle" });
  const [ipv6Test,        setIpv6Test]        = useState<TestState>({ status: "idle" });
  const [torTest,         setTorTest]         = useState<TestState>({ status: "idle" });
  const [fingerTest,      setFingerTest]      = useState<TestState>({ status: "idle" });
  const [dnsRebindTest,   setDnsRebindTest]   = useState<TestState>({ status: "idle" });

  const abortRef = useRef<AbortController | null>(null);

  const runAll = useCallback(async () => {
    setRunning(true);
    setCompleted(false);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    const reset = (fn: (s: TestState) => void) => fn({ status: "running" });
    [setIpTest, setWebrtcTest, setDnsTest, setIpv6Test, setTorTest, setFingerTest, setDnsRebindTest].forEach(reset);

    // 1 — Browser fingerprint (instant, local)
    try {
      const fp = getBrowserFingerprint();
      setFingerTest({ status: "done", result: fp });
    } catch (e: any) {
      setFingerTest({ status: "error", result: { error: e.message } });
    }

    // 2 — WebRTC — full ICE candidate collection with type classification
    let iceCandidates: IceCandidate[] = [];
    try {
      iceCandidates = await gatherWebRtcCandidates();
      const wrtcRes = await fetch(`${BASE}/api/leaks/webrtc-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          iceIps: iceCandidates.map(c => c.ip).filter(ip => !ip.endsWith(".local")),
          candidates: iceCandidates,
        }),
        signal,
      }).then(r => r.json());
      setWebrtcTest({ status: "done", result: { ...wrtcRes, rawCandidates: iceCandidates } });
    } catch (e: any) {
      if (e.name !== "AbortError") setWebrtcTest({ status: "error", result: { error: e.message } });
    }

    // 3 — Server-side check (IP + DNS + IPv6 + Tor in parallel from server)
    try {
      const serverResult = await fetch(`${BASE}/api/leaks/check`, { signal }).then(r => r.json());
      setIpTest({ status: "done", result: serverResult.publicIp });
      setDnsTest({ status: "done", result: serverResult.dns });
      setIpv6Test({ status: "done", result: serverResult.ipv6 });
      setTorTest({ status: "done", result: serverResult.tor });
    } catch (e: any) {
      if (e.name !== "AbortError") {
        [setIpTest, setDnsTest, setIpv6Test, setTorTest].forEach(fn =>
          fn({ status: "error", result: { error: (e as any).message } })
        );
      }
    }

    // 4 — DNS rebinding protection test (server-side, checks if internal metadata is reachable)
    try {
      const rebindRes = await fetch(`${BASE}/api/leaks/dns-rebind`, { signal }).then(r => r.json());
      setDnsRebindTest({ status: "done", result: rebindRes });
    } catch (e: any) {
      if (e.name !== "AbortError") setDnsRebindTest({ status: "error", result: { error: (e as any).message } });
    }

    setRunning(false);
    setCompleted(true);

    const wrtcLeaked = iceCandidates.some(c => {
      const cls = classifyCandidate(c, "");
      return cls.isLeak;
    });
    toast({
      title: wrtcLeaked ? "WebRTC Leak Detected!" : "Leak scan complete",
      description: wrtcLeaked ? "Your real IP is exposed via srflx WebRTC candidate." : "Review results below.",
      variant: wrtcLeaked ? "destructive" : "default",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const overallLeaked =
    webrtcTest.result?.status === "leaked" ||
    ipv6Test.result?.leakDetected ||
    dnsRebindTest.result?.verdict === "CRITICAL";
  const overallWarning =
    dnsTest.result?.leakDetected ||
    dnsRebindTest.result?.verdict === "WARNING";

  const overallVerdict = completed
    ? overallLeaked ? "leaked"
    : overallWarning ? "warning"
    : "secure"
    : null;

  function downloadReport() {
    const now = new Date().toISOString();
    const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const verdict = overallLeaked ? "LEAKED" : overallWarning ? "WARNING" : "SECURE";
    const verdictColor = overallLeaked ? "#ff4141" : overallWarning ? "#ffd93d" : "#00ff88";
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ProxhqVPN Privacy Leak Report — ${now}</title>
  <style>
    body { background:#0a0f0c; color:#e0e0e0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:40px; max-width:800px; margin:0 auto; }
    h1 { font-size:22px; color:#00ff88; margin-bottom:4px; }
    .subtitle { color:#555; font-size:12px; margin-bottom:28px; }
    .verdict { display:inline-block; font-size:16px; font-weight:700; padding:8px 20px; border-radius:8px; border:1px solid ${verdictColor}40; color:${verdictColor}; background:${verdictColor}10; margin-bottom:28px; }
    .card { background:#0d1a11; border:1px solid #1a2e20; border-radius:12px; padding:20px; margin-bottom:20px; }
    .card h2 { font-size:12px; color:#00ff8880; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:12px; }
    .row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #1a2e20; font-size:13px; }
    .row:last-child { border-bottom:none; }
    .label { color:#6b7280; } .value { color:#e0e0e0; font-family:monospace; text-align:right; max-width:65%; word-break:break-all; }
    .ok { color:#00ff88; } .warn { color:#ffd93d; } .bad { color:#ff4141; }
    footer { margin-top:40px; text-align:center; font-size:11px; color:#333; }
  </style>
</head>
<body>
  <h1>ProxhqVPN Privacy Leak Report</h1>
  <div class="subtitle">ALPHA UNLIMITED TECHNOLOGIES LLC · ${now}</div>
  <div class="verdict">OVERALL VERDICT: ${verdict}</div>

  <div class="card">
    <h2>Public IP &amp; Tor Status</h2>
    ${[
      ["Public IP", ipTest.result?.ip ?? "—", false],
      ["ISP", ipTest.result?.isp ?? "—", false],
      ["Country", ipTest.result?.country ?? "—", false],
      ["Using Tor", torTest.result?.isTor ? "YES" : (torTest.status === "done" ? "NO" : "—"), torTest.result?.isTor],
    ].map(([l, v, ok]) => `<div class="row"><span class="label">${l}</span><span class="value ${ok === true ? "ok" : ok === false ? "" : ""}">${esc(String(v))}</span></div>`).join("")}
  </div>

  <div class="card">
    <h2>WebRTC Leak Test</h2>
    ${webrtcTest.status === "done" ? [
      ["Status", webrtcTest.result?.status ?? "—", webrtcTest.result?.status !== "leaked"],
      ["Real IP exposed", webrtcTest.result?.realIp ?? "—", false],
      ["Gathered IPs", (webrtcTest.result?.gathered ?? []).join(", ") || "none", false],
    ].map(([l, v, ok]) => `<div class="row"><span class="label">${l}</span><span class="value ${ok === false && webrtcTest.result?.status === "leaked" ? "bad" : "ok"}">${esc(String(v))}</span></div>`).join("") : "<div style='color:#555;font-size:12px;'>Not completed</div>"}
  </div>

  <div class="card">
    <h2>DNS Resolver Analysis</h2>
    ${dnsTest.status === "done" ? [
      ["Leak Detected", dnsTest.result?.leakDetected ? "YES" : "NO", !dnsTest.result?.leakDetected],
      ["Resolvers", (dnsTest.result?.resolvers ?? []).join(", ") || "—", false],
    ].map(([l, v, ok]) => `<div class="row"><span class="label">${l}</span><span class="value ${ok === false && dnsTest.result?.leakDetected ? "warn" : "ok"}">${esc(String(v))}</span></div>`).join("") : "<div style='color:#555;font-size:12px;'>Not completed</div>"}
  </div>

  <div class="card">
    <h2>IPv6 Exposure</h2>
    ${ipv6Test.status === "done" ? [
      ["Leak Detected", ipv6Test.result?.leakDetected ? "YES" : "NO", !ipv6Test.result?.leakDetected],
      ["IPv6 Address", ipv6Test.result?.address ?? "None", false],
    ].map(([l, v, ok]) => `<div class="row"><span class="label">${l}</span><span class="value ${ok === false && ipv6Test.result?.leakDetected ? "bad" : "ok"}">${esc(String(v))}</span></div>`).join("") : "<div style='color:#555;font-size:12px;'>Not completed</div>"}
  </div>

  <div class="card">
    <h2>Browser Fingerprint</h2>
    ${fingerTest.status === "done" && fingerTest.result ? Object.entries(fingerTest.result as Record<string, unknown>).slice(0, 15).map(([k, v]) =>
      `<div class="row"><span class="label">${esc(k)}</span><span class="value">${esc(String(v))}</span></div>`
    ).join("") : "<div style='color:#555;font-size:12px;'>Not completed</div>"}
  </div>

  <footer>ProxhqVPN · ALPHA UNLIMITED TECHNOLOGIES LLC · Report generated ${now}</footer>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `proxhqvpn-privacy-leak-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Header */}
      <div className="border border-primary/10 bg-black/20 rounded-sm px-3 py-2.5 flex items-center justify-between flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <Search className="w-5 h-5" /> Privacy Leak Suite
          </h2>
          {overallVerdict && (
            <Badge variant="outline" className={`font-mono text-xs ${
              overallVerdict === "secure" ? "text-green-400 border-green-400/50" :
              overallVerdict === "warning" ? "text-yellow-400 border-yellow-400/50" :
              "text-red-400 border-red-400/50"
            }`}>
              {overallVerdict.toUpperCase()}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {completed && (
            <Button
              onClick={downloadReport}
              className="bg-primary/5 border border-primary/20 text-primary hover:bg-primary/15 font-mono text-xs"
              variant="outline"
            >
              <Download className="w-3 h-3 mr-1.5" />
              DOWNLOAD REPORT
            </Button>
          )}
          <Button
            onClick={runAll}
            disabled={running}
            className="bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 font-mono text-xs"
            variant="outline"
          >
            <RefreshCw className={`w-3 h-3 mr-1.5 ${running ? "animate-spin" : ""}`} />
            {running ? "SCANNING..." : completed ? "RUN AGAIN" : "RUN LEAK TEST"}
          </Button>
        </div>
      </div>

      {/* Progress checklist */}
      <div className="border border-primary/10 bg-black/20 rounded-sm px-4 py-3">
        <p className="text-[9px] font-mono text-primary/40 uppercase mb-3 tracking-widest">Test Checklist</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { label: "Public IP", icon: Globe, state: ipTest, leaked: false },
            { label: "WebRTC / ICE", icon: Radio, state: webrtcTest, leaked: webrtcTest.result?.status === "leaked" },
            { label: "DNS Resolvers", icon: Wifi, state: dnsTest, leaked: dnsTest.result?.leakDetected },
            { label: "IPv6 Exposure", icon: Network, state: ipv6Test, leaked: ipv6Test.result?.leakDetected },
            { label: "DNS Rebinding", icon: Lock, state: dnsRebindTest, leaked: dnsRebindTest.result?.verdict === "CRITICAL" },
            { label: "Tor Exit Node", icon: EyeOff, state: torTest, leaked: false },
            { label: "Browser Fingerprint", icon: Fingerprint, state: fingerTest, leaked: false },
          ].map(({ label, icon: Icon, state, leaked }) => (
            <div key={label} className="flex items-center gap-2 text-xs font-mono">
              <StatusIcon status={state.status} leaked={leaked} />
              <Icon className="w-3 h-3 text-primary/40" />
              <span className={state.status === "done" ? (leaked ? "text-red-400" : "text-green-400") : "text-primary/50"}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Idle empty state */}
      {!running && !completed && (
        <div className="flex flex-col items-center justify-center h-52 text-primary/30 font-mono text-xs gap-4 border border-primary/10 bg-black/20 rounded-sm">
          <ShieldAlert className="w-10 h-10 opacity-30" />
          <span>Run the test to check WebRTC, DNS, IPv6, and browser fingerprint leaks</span>
        </div>
      )}

      {/* Results grid */}
      {(running || completed) && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

          {/* Public IP */}
          <Card className="bg-black border-primary/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-primary/10">
                <Globe className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-primary/50 flex-1">Public IP</span>
                <StatusIcon status={ipTest.status} leaked={false} />
              </div>
              {ipTest.status === "running" && <p className="text-[10px] font-mono text-primary/30 animate-pulse">Detecting IP...</p>}
              {ipTest.status === "done" && ipTest.result && (
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between"><span className="text-primary/50">IP ADDRESS</span><span className="text-green-400 font-bold">{ipTest.result.ip}</span></div>
                  <div className="flex justify-between"><span className="text-primary/50">COUNTRY</span><span className="text-primary">{ipTest.result.country} {ipTest.result.city ? `· ${ipTest.result.city}` : ""}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-primary/50">ISP / ORG</span><span className="text-primary/80 truncate max-w-[160px]" title={ipTest.result.org}>{ipTest.result.org}</span></div>
                  {ipTest.result.asn && <div className="flex justify-between"><span className="text-primary/50">ASN</span><span className="text-primary/70">{ipTest.result.asn}</span></div>}
                </div>
              )}
              {ipTest.status === "error" && <p className="text-[10px] font-mono text-red-400">Failed to detect IP</p>}
            </CardContent>
          </Card>

          {/* WebRTC Leak — with ICE candidate type classification */}
          <Card className={`bg-black border ${webrtcTest.result?.status === "leaked" ? "border-red-500/50" : webrtcTest.status === "done" ? "border-green-500/30" : "border-primary/20"}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-primary/10">
                <Radio className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-primary/50 flex-1">WebRTC / ICE Leak</span>
                <LeakBadge leaked={webrtcTest.status === "done" ? webrtcTest.result?.status === "leaked" : undefined} />
                <StatusIcon status={webrtcTest.status} leaked={webrtcTest.result?.status === "leaked"} />
              </div>
              {webrtcTest.status === "running" && (
                <p className="text-[10px] font-mono text-primary/30 animate-pulse">Gathering ICE candidates via 4 STUN servers — classifying host/srflx/relay...</p>
              )}
              {webrtcTest.status === "done" && webrtcTest.result && (() => {
                const rawCandidates: IceCandidate[] = webrtcTest.result.rawCandidates ?? [];
                const vpnIp: string = webrtcTest.result.realIp ?? "";
                const anyLeak = rawCandidates.some(c => classifyCandidate(c, vpnIp).isLeak);
                return (
                  <div className="space-y-2">
                    {rawCandidates.length === 0 && (
                      <p className="text-[10px] font-mono text-green-400">No ICE candidates gathered — WebRTC is blocked or STUN is unreachable. This is ideal.</p>
                    )}
                    <div className="space-y-1.5">
                      {rawCandidates.map((c, i) => {
                        const cls = classifyCandidate(c, vpnIp);
                        const typeColor = cls.isLeak
                          ? "text-red-400"
                          : cls.severity === "safe"
                          ? "text-green-400"
                          : "text-primary/50";
                        return (
                          <div key={i} className="border border-primary/10 rounded-sm px-2 py-1.5 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[10px] font-mono font-bold ${cls.isLeak ? "text-red-400" : "text-primary/80"}`}>
                                {c.isMdns ? c.ip : c.ip}
                              </span>
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                cls.isLeak
                                  ? "border-red-500/50 text-red-400 bg-red-900/20"
                                  : cls.severity === "safe"
                                  ? "border-green-500/30 text-green-400"
                                  : "border-primary/20 text-primary/40"
                              }`}>
                                {cls.isLeak ? "⚠ " : ""}{cls.label}
                              </span>
                            </div>
                            <div className="flex gap-3 text-[9px] font-mono text-primary/30">
                              <span className={typeColor}>typ:{c.candidateType}</span>
                              <span>{c.protocol.toUpperCase()}</span>
                              {c.port > 0 && <span>:{c.port}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {anyLeak && (
                      <div className="text-[9px] font-mono text-red-400/80 border border-red-500/20 bg-red-900/10 rounded-sm px-2 py-1.5">
                        ⚠ srflx candidate exposes your real public IP. This bypasses the VPN tunnel and reveals your ISP-assigned address.
                      </div>
                    )}
                    {!anyLeak && rawCandidates.length > 0 && (
                      <div className="text-[9px] font-mono text-green-400/70 border border-green-500/20 bg-green-900/10 rounded-sm px-2 py-1.5">
                        All candidates are private, VPN, relay, or mDNS. No real IP leaked.
                      </div>
                    )}
                    <p className="text-[9px] font-mono text-primary/30 border-t border-primary/10 pt-2">
                      srflx = real public IP (critical if not VPN IP) · host = local IP · relay = TURN (safe) · mDNS = .local alias (browser privacy mode)
                    </p>
                  </div>
                );
              })()}
              {webrtcTest.status === "error" && <p className="text-[10px] font-mono text-red-400">WebRTC test failed — browser may block RTCPeerConnection.</p>}
            </CardContent>
          </Card>

          {/* DNS */}
          <Card className={`bg-black border ${dnsTest.result?.leakDetected ? "border-yellow-500/40" : dnsTest.status === "done" ? "border-green-500/30" : "border-primary/20"}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-primary/10">
                <Wifi className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-primary/50 flex-1">DNS Resolvers</span>
                <LeakBadge leaked={dnsTest.status === "done" ? dnsTest.result?.leakDetected : undefined} label={dnsTest.result?.leakDetected ? "ISP DNS" : "SECURE"} />
                <StatusIcon status={dnsTest.status} leaked={dnsTest.result?.leakDetected} />
              </div>
              {dnsTest.status === "running" && <p className="text-[10px] font-mono text-primary/30 animate-pulse">Querying DNS servers...</p>}
              {dnsTest.status === "done" && dnsTest.result && (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    {(dnsTest.result.servers as DnsServer[]).map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px] font-mono gap-2">
                        <span className="text-primary/70">{s.ip}</span>
                        <span className={s.isPrivate ? "text-green-400" : s.isVpnDns ? "text-green-400" : "text-yellow-400"}>
                          {s.provider}
                        </span>
                      </div>
                    ))}
                    {dnsTest.result.servers.length === 0 && (
                      <p className="text-[10px] font-mono text-primary/40">No DNS servers detected.</p>
                    )}
                  </div>
                  <p className="text-[9px] font-mono text-primary/40 border-t border-primary/10 pt-2">{dnsTest.result.recommendation}</p>
                </div>
              )}
              {dnsTest.status === "error" && <p className="text-[10px] font-mono text-red-400">DNS check failed.</p>}
            </CardContent>
          </Card>

          {/* IPv6 */}
          <Card className={`bg-black border ${ipv6Test.result?.leakDetected ? "border-red-500/40" : ipv6Test.status === "done" ? "border-green-500/30" : "border-primary/20"}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-primary/10">
                <Network className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-primary/50 flex-1">IPv6 Exposure</span>
                <LeakBadge leaked={ipv6Test.status === "done" ? ipv6Test.result?.leakDetected : undefined} label={ipv6Test.result?.leakDetected ? "EXPOSED" : "BLOCKED"} />
                <StatusIcon status={ipv6Test.status} leaked={ipv6Test.result?.leakDetected} />
              </div>
              {ipv6Test.status === "running" && <p className="text-[10px] font-mono text-primary/30 animate-pulse">Probing IPv6 connectivity...</p>}
              {ipv6Test.status === "done" && (
                <>
                  {ipv6Test.result?.leakDetected
                    ? <p className="text-xs font-mono text-red-400 break-all">{ipv6Test.result.address}</p>
                    : <p className="text-xs font-mono text-green-400">No IPv6 address detected externally.</p>
                  }
                  <p className="text-[9px] font-mono text-primary/40 border-t border-primary/10 pt-2">{ipv6Test.result?.recommendation}</p>
                </>
              )}
              {ipv6Test.status === "error" && <p className="text-[10px] font-mono text-red-400">IPv6 check failed.</p>}
            </CardContent>
          </Card>

          {/* Tor */}
          <Card className={`bg-black border ${torTest.status === "done" && torTest.result?.connected ? "border-green-500/30" : "border-primary/20"}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-primary/10">
                <EyeOff className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-primary/50 flex-1">Tor Exit Node</span>
                {torTest.status === "done" && (
                  <Badge variant="outline" className={`text-[9px] font-mono ${torTest.result?.connected ? "text-green-400 border-green-400/50" : "text-primary/40 border-primary/20"}`}>
                    {torTest.result?.connected ? "TOR ACTIVE" : "NOT TOR"}
                  </Badge>
                )}
                <StatusIcon status={torTest.status} leaked={false} />
              </div>
              {torTest.status === "running" && <p className="text-[10px] font-mono text-primary/30 animate-pulse">Checking Tor exit node...</p>}
              {torTest.status === "done" && torTest.result && (
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-primary/50">STATUS</span>
                    <span className={torTest.result.connected ? "text-green-400 font-bold" : "text-primary/60"}>
                      {torTest.result.connected ? "Routing through Tor" : "Direct connection"}
                    </span>
                  </div>
                  {torTest.result.ip && (
                    <div className="flex justify-between">
                      <span className="text-primary/50">EXIT IP</span>
                      <span className="text-primary">{torTest.result.ip}</span>
                    </div>
                  )}
                  <p className="text-[9px] font-mono text-primary/40 border-t border-primary/10 pt-2">
                    {torTest.result.connected
                      ? "Traffic is exiting through the Tor network."
                      : "Not using Tor. Enable Ghost Chain for onion routing."}
                  </p>
                </div>
              )}
              {torTest.status === "error" && <p className="text-[10px] font-mono text-red-400">Tor check unavailable.</p>}
            </CardContent>
          </Card>

          {/* DNS Rebinding */}
          <Card className={`bg-black border ${
            dnsRebindTest.result?.verdict === "CRITICAL" ? "border-red-500/40" :
            dnsRebindTest.result?.verdict === "WARNING" ? "border-yellow-500/30" :
            dnsRebindTest.status === "done" ? "border-green-500/30" : "border-primary/20"
          }`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-primary/10">
                <Lock className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-primary/50 flex-1">DNS Rebinding / SSRF</span>
                <LeakBadge
                  leaked={dnsRebindTest.status === "done" ? dnsRebindTest.result?.verdict === "CRITICAL" : undefined}
                  label={
                    dnsRebindTest.result?.verdict === "CRITICAL" ? "CRITICAL" :
                    dnsRebindTest.result?.verdict === "WARNING" ? "WARNING" :
                    dnsRebindTest.status === "done" ? "SECURE" : undefined
                  }
                />
                <StatusIcon status={dnsRebindTest.status} leaked={dnsRebindTest.result?.verdict === "CRITICAL"} />
              </div>
              {dnsRebindTest.status === "running" && (
                <p className="text-[10px] font-mono text-primary/30 animate-pulse">Probing 8 internal metadata targets (AWS/GCP/Azure/router)...</p>
              )}
              {dnsRebindTest.status === "done" && dnsRebindTest.result && (() => {
                const r = dnsRebindTest.result;
                return (
                  <div className="space-y-2">
                    <p className={`text-[10px] font-mono ${
                      r.verdict === "CRITICAL" ? "text-red-400" :
                      r.verdict === "WARNING" ? "text-yellow-400" : "text-green-400"
                    }`}>{r.summary}</p>
                    <div className="space-y-1">
                      {(r.results as any[]).map((t: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-[9px] font-mono gap-2">
                          <span className="text-primary/50 truncate max-w-[180px]" title={t.label}>{t.label}</span>
                          <span className={t.reachable
                            ? t.critical ? "text-red-400 font-bold" : "text-yellow-400"
                            : "text-primary/30"}>
                            {t.reachable ? (t.critical ? "⚠ REACHABLE" : "reachable") : "blocked"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {dnsRebindTest.status === "error" && (
                <p className="text-[10px] font-mono text-red-400">DNS rebinding test failed.</p>
              )}
            </CardContent>
          </Card>

          {/* Browser Fingerprint */}
          <Card className="bg-black border-primary/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-primary/10">
                <Fingerprint className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-primary/50 flex-1">Browser Fingerprint</span>
                <StatusIcon status={fingerTest.status} leaked={false} />
              </div>
              {fingerTest.status === "running" && <p className="text-[10px] font-mono text-primary/30 animate-pulse">Reading browser attributes...</p>}
              {fingerTest.status === "done" && fingerTest.result && (() => {
                const fp = fingerTest.result as BrowserFingerprint;
                const rows: [string, string][] = [
                  ["Timezone", fp.timezone],
                  ["Language", fp.language],
                  ["Screen", fp.screen],
                  ["Platform", fp.platform],
                  ["CPU Cores", String(fp.hardwareConcurrency)],
                  ["RAM", fp.deviceMemory],
                  ["WebGL", fp.webglRenderer !== "unavailable" ? fp.webglRenderer.substring(0, 30) : "masked"],
                  ["Plugins", String(fp.plugins)],
                  ["DNT", fp.doNotTrack],
                  ["Connection", fp.connectionType],
                ];
                return (
                  <div className="space-y-1.5">
                    {rows.map(([k, v]) => (
                      <div key={k} className="flex justify-between text-[10px] font-mono gap-2">
                        <span className="text-primary/40 shrink-0">{k}</span>
                        <span className="text-primary/80 truncate text-right" title={v}>{v || "—"}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {fingerTest.status === "error" && <p className="text-[10px] font-mono text-red-400">Fingerprint collection failed.</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Verdict / fix recommendations */}
      {completed && overallVerdict && (
        <Card className={`bg-black border ${
          overallVerdict === "leaked" ? "border-red-500/40" :
          overallVerdict === "warning" ? "border-yellow-500/30" :
          "border-green-500/20"
        }`}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-primary/10">
              {overallVerdict === "secure"
                ? <ShieldCheck className="w-4 h-4 text-green-400" />
                : <ShieldAlert className="w-4 h-4 text-red-400" />}
              <span className="text-[10px] font-mono uppercase tracking-widest text-primary/50 flex-1">Recommendations</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {webrtcTest.result?.status === "leaked" && (
                <div className="space-y-1">
                  <p className="text-[9px] font-mono text-red-400 uppercase font-bold">WebRTC Fix</p>
                  <p className="text-[10px] font-mono text-primary/70">Firefox: set <code className="text-primary">media.peerconnection.enabled=false</code> in about:config.<br/>Chrome: Install a WebRTC blocker extension.<br/>Desktop app: Already fixed via <code className="text-primary">disable_non_proxied_udp</code> policy.</p>
                </div>
              )}
              {dnsTest.result?.leakDetected && (
                <div className="space-y-1">
                  <p className="text-[9px] font-mono text-yellow-400 uppercase font-bold">DNS Fix</p>
                  <p className="text-[10px] font-mono text-primary/70">Point your DNS to <code className="text-primary">10.99.0.1</code> (VPN gateway) or enable DNS Shield in the sidebar.</p>
                </div>
              )}
              {ipv6Test.result?.leakDetected && (
                <div className="space-y-1">
                  <p className="text-[9px] font-mono text-red-400 uppercase font-bold">IPv6 Fix</p>
                  <p className="text-[10px] font-mono text-primary/70">
                    Linux: <code className="text-primary">echo 'net.ipv6.conf.all.disable_ipv6=1' &gt;&gt; /etc/sysctl.conf && sysctl -p</code><br/>
                    Windows: Disable IPv6 in Network Adapter settings.
                  </p>
                </div>
              )}
              {overallVerdict === "secure" && (
                <div className="space-y-1 col-span-2">
                  <p className="text-[9px] font-mono text-green-400 uppercase font-bold">All Clear</p>
                  <p className="text-[10px] font-mono text-primary/70">No active leaks detected. Your connection appears to be properly tunneled.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
