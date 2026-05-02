// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import fetch from "node-fetch";
import dns from "dns";

const router = Router();

const KNOWN_DNS: Record<string, string> = {
  "8.8.8.8":        "Google DNS",
  "8.8.4.4":        "Google DNS",
  "1.1.1.1":        "Cloudflare",
  "1.0.0.1":        "Cloudflare",
  "9.9.9.9":        "Quad9",
  "149.112.112.112":"Quad9",
  "208.67.222.222": "OpenDNS",
  "208.67.220.220": "OpenDNS",
  "4.2.2.1":        "Level3",
  "4.2.2.2":        "Level3",
  "64.6.64.6":      "Verisign",
  "64.6.65.6":      "Verisign",
  "185.228.168.9":  "CleanBrowsing",
  "185.228.169.9":  "CleanBrowsing",
  "76.76.19.19":    "Alternate DNS",
  "76.223.122.150": "Alternate DNS",
  "94.140.14.14":   "AdGuard DNS",
  "94.140.15.15":   "AdGuard DNS",
  "77.88.8.8":      "Yandex DNS",
  "77.88.8.1":      "Yandex DNS",
  "156.154.70.1":   "Neustar DNS",
  "156.154.71.1":   "Neustar DNS",
};

const VPN_DNS_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

function classifyDns(ip: string) {
  const provider = KNOWN_DNS[ip] ?? "ISP / Unknown";
  const isPrivate = VPN_DNS_RANGES.some(rx => rx.test(ip));
  const isVpnDns = isPrivate ||
    ["ProtonVPN", "Mullvad", "ExpressVPN", "NordVPN", "Windscribe"].some(v => provider.includes(v));
  const isLeak = !isPrivate && !isVpnDns;
  return { provider, isVpnDns, isPrivate, isLeak };
}

function getSystemDnsServers(): Promise<{ ip: string; provider: string; isVpnDns: boolean; isPrivate: boolean; isLeak: boolean }[]> {
  return new Promise((resolve) => {
    try {
      const servers = dns.getServers();
      const results = servers
        .map(s => s.replace(/^\[|\]$/g, "").split(":")[0])
        .filter(Boolean)
        .map(ip => ({ ip, ...classifyDns(ip) }));
      resolve(results.length ? results : [{ ip: "127.0.0.1", ...classifyDns("127.0.0.1") }]);
    } catch {
      resolve([]);
    }
  });
}

async function getPublicIpInfo(): Promise<{ ip: string; country: string; city: string; isp: string; org: string; asn: string }> {
  const sources = [
    async () => {
      const r = await fetch("https://ipinfo.io/json", { signal: AbortSignal.timeout(7000), headers: { Accept: "application/json" } });
      const d = await r.json() as any;
      return { ip: d.ip ?? "unknown", country: d.country ?? "??", city: d.city ?? "", isp: d.org ?? "unknown", org: d.org ?? "unknown", asn: d.org?.split(" ")[0] ?? "" };
    },
    async () => {
      const r = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(7000) });
      const d = await r.json() as any;
      return { ip: d.ip ?? "unknown", country: "??", city: "", isp: "unknown", org: "unknown", asn: "" };
    },
  ];
  for (const fn of sources) {
    try { return await fn(); } catch {}
  }
  return { ip: "unavailable", country: "??", city: "", isp: "timeout", org: "timeout", asn: "" };
}

async function checkIpv6(): Promise<{ exposed: boolean; ipv6: string | null }> {
  const sources = ["https://ipv6.icanhazip.com", "https://api6.ipify.org"];
  for (const url of sources) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const txt = (await r.text()).trim();
      if (txt && txt.includes(":")) return { exposed: true, ipv6: txt };
    } catch {}
  }
  return { exposed: false, ipv6: null };
}

async function checkTor(): Promise<{ connected: boolean; ip: string | null }> {
  try {
    const r = await fetch("https://check.torproject.org/api/ip", {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "ProxhqVPN-LeakCheck/1.0" },
    });
    const d = await r.json() as any;
    return { connected: !!d.IsTor, ip: d.IP ?? null };
  } catch {
    return { connected: false, ip: null };
  }
}

// ── GET /api/leaks/check — full server-side leak report ───────────────────
router.get("/check", async (_req, res) => {
  const startedAt = Date.now();

  const [ipInfo, ipv6Info, dnsServers, torInfo] = await Promise.allSettled([
    getPublicIpInfo(),
    checkIpv6(),
    getSystemDnsServers(),
    checkTor(),
  ]);

  const publicIpResult = ipInfo.status === "fulfilled" ? ipInfo.value
    : { ip: "error", country: "??", city: "", isp: "error", org: "error", asn: "" };
  const ipv6Result = ipv6Info.status === "fulfilled" ? ipv6Info.value : { exposed: false, ipv6: null };
  const dnsResult = dnsServers.status === "fulfilled" ? dnsServers.value : [];
  const torResult = torInfo.status === "fulfilled" ? torInfo.value : { connected: false, ip: null };

  const dnsLeakDetected = dnsResult.some(d => d.isLeak);
  const ipv6Leaked = ipv6Result.exposed;

  const overallStatus: "secure" | "warning" | "leaked" =
    ipv6Leaked ? "leaked"
    : dnsLeakDetected ? "warning"
    : "secure";

  return res.json({
    runAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    overallStatus,
    publicIp: publicIpResult,
    tor: torResult,
    dns: {
      leakDetected: dnsLeakDetected,
      servers: dnsResult,
      recommendation: dnsLeakDetected
        ? "Your DNS resolvers are outside the VPN tunnel. Set DNS to your VPN gateway (10.99.0.1) or enable DoH."
        : dnsResult.length === 0
        ? "No DNS servers detected — unable to verify."
        : "DNS resolvers appear to be private / VPN-managed.",
    },
    ipv6: {
      leakDetected: ipv6Leaked,
      address: ipv6Result.ipv6,
      recommendation: ipv6Leaked
        ? "IPv6 is exposed externally. Add ip6tables rules to your kill switch or disable IPv6 system-wide."
        : "No IPv6 address detected externally.",
    },
  });
});

// ── POST /api/leaks/webrtc-analyze — client sends gathered ICE IPs, server compares to real IP ─
router.post("/webrtc-analyze", async (req, res) => {
  const { iceIps = [] } = req.body as { iceIps?: string[] };

  let publicIp = "unknown";
  try {
    const r = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(6000) });
    const d = await r.json() as any;
    publicIp = d.ip ?? "unknown";
  } catch {}

  const privateRanges = [
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^169\.254\./,
    /^127\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/,
  ];

  const analyzed = iceIps.map(ip => {
    const isPrivate = privateRanges.some(rx => rx.test(ip));
    const isPublicIp = ip === publicIp;
    const isLeak = !isPrivate && !isPublicIp;
    return {
      ip,
      type: isPrivate ? "private" : isPublicIp ? "vpn-public" : "leak",
      label: isPrivate ? "Local network IP" : isPublicIp ? "VPN public exit IP" : "REAL IP — LEAK DETECTED",
      isLeak,
    };
  });

  const leaked = analyzed.filter(a => a.isLeak);
  const status = leaked.length > 0 ? "leaked" : "secure";

  return res.json({
    status,
    publicIp,
    iceIps: analyzed,
    leakedIps: leaked.map(l => l.ip),
    recommendation: leaked.length > 0
      ? `WebRTC is exposing your real IP: ${leaked.map(l => l.ip).join(", ")}. Use Firefox with media.peerconnection.enabled=false, or install a WebRTC blocker extension. The ProxhqVPN desktop app enforces webRTCIPHandlingPolicy=disable_non_proxied_udp.`
      : "No WebRTC IP leak detected. All gathered IPs are either private or route through the VPN.",
  });
});

// ── GET /api/leaks/fingerprint — server-side observable metadata ───────────
router.get("/fingerprint", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress ?? "unknown";
  return res.json({
    ip,
    userAgent: req.headers["user-agent"] ?? "unknown",
    acceptLanguage: req.headers["accept-language"] ?? "unknown",
    acceptEncoding: req.headers["accept-encoding"] ?? "unknown",
    dnt: req.headers["dnt"] ?? "not set",
    via: req.headers["via"] ?? "none",
    xForwardedFor: req.headers["x-forwarded-for"] ?? "none",
  });
});

// ── GET /api/leaks/dns-rebind — server-side DNS rebinding protection test ─────
// Checks whether internal metadata services, local routers, or cloud provider
// instance metadata are reachable from the server's network. If they are, the
// server may be misconfigured and vulnerable to DNS rebinding or SSRF attacks.
router.get("/dns-rebind", async (_req, res) => {
  const TARGETS = [
    { label: "AWS Metadata (169.254.169.254)", url: "http://169.254.169.254/latest/meta-data/", critical: true },
    { label: "GCP Metadata (metadata.google.internal)", url: "http://metadata.google.internal/computeMetadata/v1/", critical: true },
    { label: "Azure Metadata (169.254.169.254 IMDS)", url: "http://169.254.169.254/metadata/instance?api-version=2021-02-01", critical: true },
    { label: "Link-local gateway (169.254.0.1)", url: "http://169.254.0.1/", critical: false },
    { label: "Common router (192.168.1.1)", url: "http://192.168.1.1/", critical: false },
    { label: "Docker internal (172.17.0.1)", url: "http://172.17.0.1/", critical: false },
    { label: "Kubernetes API (10.96.0.1)", url: "http://10.96.0.1/", critical: false },
    { label: "Localhost port 22 (SSH)", url: "http://127.0.0.1:22/", critical: false },
  ];

  const results = await Promise.all(
    TARGETS.map(async (t) => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2500);
        const resp = await fetch(t.url, {
          signal: ctrl.signal,
          redirect: "manual",
          headers: { "Metadata": "true" },
        }).catch(e => ({ ok: false, status: 0, _err: e.message ?? "timeout" })) as any;
        clearTimeout(timer);
        const reachable = resp.status > 0 && resp.status !== 0;
        return { ...t, reachable, statusCode: resp.status ?? 0, error: null };
      } catch (e: any) {
        return { ...t, reachable: false, statusCode: 0, error: e.message ?? "unreachable" };
      }
    })
  );

  const criticalExposed = results.filter(r => r.critical && r.reachable);
  const noncriticalExposed = results.filter(r => !r.critical && r.reachable);

  const verdict =
    criticalExposed.length > 0 ? "CRITICAL" :
    noncriticalExposed.length > 0 ? "WARNING" :
    "SECURE";

  res.json({
    verdict,
    criticalExposed: criticalExposed.map(r => r.label),
    noncriticalExposed: noncriticalExposed.map(r => r.label),
    results,
    summary:
      verdict === "CRITICAL"
        ? `${criticalExposed.length} cloud metadata endpoint(s) are reachable from this server. An SSRF vulnerability could allow an attacker to steal cloud credentials or instance identity tokens.`
        : verdict === "WARNING"
        ? `${noncriticalExposed.length} internal network endpoint(s) are reachable. Review firewall rules to restrict access to internal services.`
        : "No internal metadata services or private network endpoints are reachable from this server. DNS rebinding protection is working.",
  });
});

export default router;
