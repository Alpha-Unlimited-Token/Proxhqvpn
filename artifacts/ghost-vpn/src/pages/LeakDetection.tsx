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

function gatherWebRtcIps(): Promise<string[]> {
  return new Promise((resolve) => {
    const ips: string[] = [];
    const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9:]{3,}:[a-f0-9:]+)/gi;

    let pc: RTCPeerConnection | null = null;
    const done = () => { try { pc?.close(); } catch {} resolve([...new Set(ips)]); };
    const timer = setTimeout(done, 4000);

    try {
      pc = new RTCPeerConnection({ iceServers: STUN_SERVERS.map(u => ({ urls: u })) });
      pc.createDataChannel("");
      pc.onicecandidate = (e) => {
        if (!e.candidate) { clearTimeout(timer); done(); return; }
        const line = e.candidate.candidate;
        const matches = line.match(ipRegex) ?? [];
        matches.forEach(ip => { if (!ips.includes(ip)) ips.push(ip); });
      };
      pc.createOffer().then(o => pc!.setLocalDescription(o)).catch(() => { clearTimeout(timer); done(); });
    } catch { clearTimeout(timer); done(); }
  });
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

  const [ipTest,        setIpTest]        = useState<TestState>({ status: "idle" });
  const [webrtcTest,    setWebrtcTest]    = useState<TestState>({ status: "idle" });
  const [dnsTest,       setDnsTest]       = useState<TestState>({ status: "idle" });
  const [ipv6Test,      setIpv6Test]      = useState<TestState>({ status: "idle" });
  const [torTest,       setTorTest]       = useState<TestState>({ status: "idle" });
  const [fingerTest,    setFingerTest]    = useState<TestState>({ status: "idle" });

  const abortRef = useRef<AbortController | null>(null);

  const runAll = useCallback(async () => {
    setRunning(true);
    setCompleted(false);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    const reset = (fn: (s: TestState) => void) => fn({ status: "running" });
    [setIpTest, setWebrtcTest, setDnsTest, setIpv6Test, setTorTest, setFingerTest].forEach(reset);

    // 1 — Browser fingerprint (instant, local)
    try {
      const fp = getBrowserFingerprint();
      setFingerTest({ status: "done", result: fp });
    } catch (e: any) {
      setFingerTest({ status: "error", result: { error: e.message } });
    }

    // 2 — WebRTC (in-browser STUN gathering)
    let gatheredIps: string[] = [];
    try {
      gatheredIps = await gatherWebRtcIps();
      // Send to server for comparison against real IP
      const wrtcRes = await fetch(`${BASE}/api/leaks/webrtc-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iceIps: gatheredIps }),
        signal,
      }).then(r => r.json());
      setWebrtcTest({ status: "done", result: wrtcRes });
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

    setRunning(false);
    setCompleted(true);

    const wrtcLeaked = webrtcTest.result?.status === "leaked";
    toast({
      title: wrtcLeaked ? "WebRTC Leak Detected!" : "Leak scan complete",
      description: wrtcLeaked ? "Your real IP is exposed via WebRTC." : "Review results below.",
      variant: wrtcLeaked ? "destructive" : "default",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const overallLeaked =
    webrtcTest.result?.status === "leaked" ||
    ipv6Test.result?.leakDetected;
  const overallWarning = dnsTest.result?.leakDetected;

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
            { label: "WebRTC Leak", icon: Radio, state: webrtcTest, leaked: webrtcTest.result?.status === "leaked" },
            { label: "DNS Resolvers", icon: Wifi, state: dnsTest, leaked: dnsTest.result?.leakDetected },
            { label: "IPv6 Exposure", icon: Network, state: ipv6Test, leaked: ipv6Test.result?.leakDetected },
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

          {/* WebRTC Leak */}
          <Card className={`bg-black border ${webrtcTest.result?.status === "leaked" ? "border-red-500/50" : webrtcTest.status === "done" ? "border-green-500/30" : "border-primary/20"}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-primary/10">
                <Radio className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-primary/50 flex-1">WebRTC Leak</span>
                <LeakBadge leaked={webrtcTest.status === "done" ? webrtcTest.result?.status === "leaked" : undefined} />
                <StatusIcon status={webrtcTest.status} leaked={webrtcTest.result?.status === "leaked"} />
              </div>
              {webrtcTest.status === "running" && <p className="text-[10px] font-mono text-primary/30 animate-pulse">Gathering ICE candidates via STUN...</p>}
              {webrtcTest.status === "done" && webrtcTest.result && (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    {(webrtcTest.result.iceIps as WebRtcIp[]).length === 0 && (
                      <p className="text-[10px] font-mono text-green-400">No IPs gathered — WebRTC blocked or no STUN reachable.</p>
                    )}
                    {(webrtcTest.result.iceIps as WebRtcIp[]).map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px] font-mono gap-2">
                        <span className={item.isLeak ? "text-red-400 font-bold" : item.type === "private" ? "text-primary/60" : "text-green-400"}>
                          {item.ip}
                        </span>
                        <span className={`text-[9px] ${item.isLeak ? "text-red-400" : item.type === "private" ? "text-primary/40" : "text-green-400"}`}>
                          {item.isLeak ? "⚠ REAL IP" : item.type === "private" ? "local" : "VPN"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] font-mono text-primary/40 border-t border-primary/10 pt-2">{webrtcTest.result.recommendation}</p>
                </div>
              )}
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
