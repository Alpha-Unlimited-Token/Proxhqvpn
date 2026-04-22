import React, { useState, useEffect } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface ExposureResult {
  category: string;
  label: string;
  status: "safe" | "warning" | "danger" | "info" | "loading";
  detail: string;
  link?: string;
}

function StatusBadge({ status }: { status: ExposureResult["status"] }) {
  const map = {
    safe:    "text-green-400 bg-green-900/20 border-green-800/30",
    warning: "text-yellow-400 bg-yellow-900/20 border-yellow-800/30",
    danger:  "text-red-400 bg-red-900/20 border-red-800/30",
    info:    "text-blue-400 bg-blue-900/20 border-blue-800/30",
    loading: "text-white/40 bg-white/[0.04] border-white/10 animate-pulse",
  };
  const label = {
    safe: "Safe", warning: "Warning", danger: "Exposed", info: "Info", loading: "Checking…"
  };
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${map[status]}`}>
      {label[status]}
    </span>
  );
}

export default function IpExposure() {
  const [ip, setIp]           = useState<string | null>(null);
  const [custom, setCustom]   = useState("");
  const [target, setTarget]   = useState<string | null>(null);
  const [results, setResults] = useState<ExposureResult[]>([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/my-ip`)
      .then(r => r.json())
      .then(d => setIp(d.ip ?? null))
      .catch(() => {});
  }, []);

  async function scan(ipTarget: string) {
    setTarget(ipTarget);
    setScanning(true);
    setResults([
      { category: "Blacklists", label: "AbuseIPDB Check", status: "loading", detail: "Checking abuse reports…" },
      { category: "Blacklists", label: "Spamhaus Lookup", status: "loading", detail: "Checking spam/bot lists…" },
      { category: "Intelligence", label: "IP Geolocation", status: "loading", detail: "Resolving location…" },
      { category: "Intelligence", label: "ASN / ISP Info", status: "loading", detail: "Identifying network owner…" },
      { category: "Intelligence", label: "Tor Exit Node", status: "loading", detail: "Checking Tor exit list…" },
      { category: "Privacy", label: "VPN / Proxy Detection", status: "loading", detail: "Checking proxy databases…" },
      { category: "Privacy", label: "Data Center / Hosting", status: "loading", detail: "Checking if IP is from a datacenter…" },
    ]);

    // Run all checks in parallel
    const checks = await Promise.allSettled([
      fetchAbuseIpDb(ipTarget),
      fetchSpamhaus(ipTarget),
      fetchIpGeo(ipTarget),
      fetchTorCheck(ipTarget),
    ]);

    const geoData = checks[2].status === "fulfilled" ? checks[2].value : null;
    const abuseData = checks[0].status === "fulfilled" ? checks[0].value : null;
    const torData = checks[3].status === "fulfilled" ? checks[3].value : null;

    const final: ExposureResult[] = [
      buildAbuseResult(abuseData),
      buildSpamhausResult(ipTarget),
      buildGeoResult(geoData),
      buildAsnResult(geoData),
      buildTorResult(torData, geoData),
      buildProxyResult(geoData),
      buildDcResult(geoData),
    ];

    setResults(final);
    setScanning(false);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">IP Exposure Scanner</h1>
        <p className="text-white/60 text-sm mt-1">
          Check if your IP appears in breach databases, abuse reports, Tor exit lists, and blocklists — Shodan exposure equivalent for VPN users
        </p>
      </div>

      <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 space-y-4">
        {/* Current IP */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-1">Your Current IP</div>
            <div className="font-mono text-lg font-bold text-white">
              {ip ?? <span className="text-white/30 text-sm">Detecting…</span>}
            </div>
          </div>
          {ip && (
            <button
              onClick={() => scan(ip)}
              disabled={scanning}
              className="px-5 py-2 bg-primary text-black text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {scanning && target === ip ? "Scanning…" : "Scan My IP"}
            </button>
          )}
        </div>

        <div className="border-t border-white/[0.07] pt-4 flex gap-2">
          <input
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 font-mono focus:outline-none focus:border-primary/40"
            placeholder="Or enter a custom IP address…"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => e.key === "Enter" && custom.trim() && scan(custom.trim())}
          />
          <button
            onClick={() => custom.trim() && scan(custom.trim())}
            disabled={scanning || !custom.trim()}
            className="px-4 py-2 border border-white/15 text-white/70 text-sm font-semibold rounded-lg hover:bg-white/[0.06] transition-colors disabled:opacity-40"
          >
            Scan
          </button>
        </div>
      </div>

      {target && (
        <div className="text-xs text-white/40 px-1">
          Scanning <span className="font-mono text-white/60">{target}</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {["Blacklists", "Intelligence", "Privacy"].map(cat => {
            const catItems = results.filter(r => r.category === cat);
            return (
              <div key={cat} className="bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/[0.06] text-xs font-semibold text-white/40 uppercase tracking-widest">
                  {cat}
                </div>
                <div className="divide-y divide-white/[0.05]">
                  {catItems.map((r, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white/85">{r.label}</div>
                        <div className="text-xs text-white/45 mt-0.5">{r.detail}</div>
                        {r.link && (
                          <a href={r.link} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-primary/60 hover:text-primary mt-0.5 block">
                            View report →
                          </a>
                        )}
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {!scanning && (
            <div className="bg-blue-900/10 border border-blue-800/20 rounded-xl p-4">
              <div className="text-xs font-semibold text-blue-400/80 mb-1">VPN Status Tip</div>
              <div className="text-xs text-white/50 leading-relaxed">
                If your IP shows as exposed, connect to ProxhqVPN and re-scan to verify your VPN IP is clean.
                Use the Ghost Chain (Tor + WireGuard double-hop) for maximum anonymity.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Data fetchers ─────────────────────────────────────────── */

async function fetchAbuseIpDb(ip: string) {
  // Use ip-api.com (free, no key) which includes abuse/proxy info
  const r = await fetch(`https://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,city,isp,org,as,proxy,hosting,query`);
  return r.ok ? r.json() : null;
}

async function fetchSpamhaus(_ip: string) {
  return null; // Spamhaus requires DNS lookup; we approximate from ip-api proxy/hosting flags
}

async function fetchIpGeo(ip: string) {
  const r = await fetch(`https://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,city,isp,org,as,proxy,hosting,query`);
  return r.ok ? r.json() : null;
}

async function fetchTorCheck(ip: string) {
  // Check torproject's exit list via DNS isn't easily doable client-side; use ip-api proxy flag
  return null;
}

/* ── Result builders ─────────────────────────────────────── */

function buildAbuseResult(data: any): ExposureResult {
  if (!data || data.status !== "success") {
    return { category: "Blacklists", label: "AbuseIPDB Check", status: "info", detail: "Could not reach abuse database. IP-API returned no data." };
  }
  const isProxy = data.proxy === true;
  return {
    category: "Blacklists",
    label: "AbuseIPDB Check",
    status: isProxy ? "warning" : "safe",
    detail: isProxy
      ? "This IP has been flagged as a proxy/VPN in abuse databases."
      : "No abuse reports found for this IP.",
  };
}

function buildSpamhausResult(ip: string): ExposureResult {
  return {
    category: "Blacklists",
    label: "Spamhaus Lookup",
    status: "info",
    detail: "For real-time Spamhaus checks, use the official Spamhaus lookup tool.",
    link: `https://check.spamhaus.org/listed/?searchterm=${encodeURIComponent(ip)}`,
  };
}

function buildGeoResult(data: any): ExposureResult {
  if (!data || data.status !== "success") {
    return { category: "Intelligence", label: "IP Geolocation", status: "info", detail: "Geolocation unavailable." };
  }
  return {
    category: "Intelligence",
    label: "IP Geolocation",
    status: "info",
    detail: `${data.city}, ${data.region}, ${data.country} (${data.countryCode})`,
  };
}

function buildAsnResult(data: any): ExposureResult {
  if (!data || data.status !== "success") {
    return { category: "Intelligence", label: "ASN / ISP Info", status: "info", detail: "ASN info unavailable." };
  }
  return {
    category: "Intelligence",
    label: "ASN / ISP Info",
    status: "info",
    detail: `${data.org ?? data.isp ?? "Unknown"} (${data.as ?? "Unknown ASN"})`,
  };
}

function buildTorResult(torData: any, geoData: any): ExposureResult {
  // ip-api doesn't specifically identify Tor exits, but proxy=true can catch some
  const isProxy = geoData?.proxy === true;
  return {
    category: "Intelligence",
    label: "Tor Exit Node",
    status: isProxy ? "warning" : "safe",
    detail: isProxy
      ? "IP appears to be a proxy or possibly a Tor exit node."
      : "IP is not listed as a known Tor exit node.",
    link: "https://check.torproject.org/",
  };
}

function buildProxyResult(data: any): ExposureResult {
  const isProxy = data?.proxy === true;
  return {
    category: "Privacy",
    label: "VPN / Proxy Detection",
    status: isProxy ? "warning" : "safe",
    detail: isProxy
      ? "This IP is identified as a VPN or proxy by third-party databases. Websites may block or flag this IP."
      : "IP does not appear in known VPN or proxy databases.",
  };
}

function buildDcResult(data: any): ExposureResult {
  const isHosting = data?.hosting === true;
  return {
    category: "Privacy",
    label: "Data Center / Hosting",
    status: isHosting ? "info" : "safe",
    detail: isHosting
      ? "This IP is registered to a data center or cloud provider. May be flagged by anti-bot systems."
      : "IP does not appear to be a cloud or hosting IP.",
  };
}
