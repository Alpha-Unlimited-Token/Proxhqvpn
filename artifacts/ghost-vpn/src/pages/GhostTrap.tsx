// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useCallback } from "react";
import {
  Skull, Zap, Ban, RefreshCw, Trash2, Settings, Clock, Globe,
  AlertTriangle, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Download, Radio, MapPin, Building2, Wifi, Shield, FileText,
  Network, ArrowRight, Server, Home, Layers, Search,
  Copy, Check, Link2, Laptop,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ProbeType = "sql_injection" | "xss" | "cmd_injection" | "path_traversal" | "auth_brute" | "recon" | "other";
type NodeType  = "vpn_exit" | "datacenter" | "residential" | "corporate" | "private_network" | "tor_exit" | "unknown";

interface Probe {
  id: number;
  probeId: string;
  attackerIp: string;
  attackerPort: number | null;
  attackerUa: string | null;
  method: string;
  endpoint: string;
  probeType: ProbeType;
  attackVector: string | null;
  fakeResponse: string | null;
  tarpitMs: number;
  autoBlocked: boolean;
  silkTrapped: boolean;
  beaconFired: boolean;
  beaconFiredAt: string | null;
  hopChain: string | null;
  vpnDetected: boolean;
  torDetected: boolean;
  geoCountry: string | null;
  geoCity: string | null;
  geoIsp: string | null;
  geoOrg: string | null;
  geoAsn: string | null;
  geoTimezone: string | null;
  probedAt: string;
}

interface Stats {
  total: number; uniqueIps: number; sqlCount: number; xssCount: number;
  cmdCount: number; blocked: number; silkTrapped: number; beaconFires: number;
  avgTarpit: number; vpnCount: number;
}

interface Config {
  id: number; enabled: boolean; tarpitMinMs: number; tarpitMaxMs: number;
  autoBlockAfter: number; silkTrapAfter: number; fakeSiteName: string; fakeDbVersion: string;
  userToken: string | null;
  deviceMode: "personal" | "server";
  userDomain: string | null;
  userDetectedIp: string | null;
}

interface HopNode {
  ip: string;
  port: number | null;
  rdns: string | null;
  isp: string | null;
  org: string | null;
  country: string | null;
  city: string | null;
  asn: string | null;
  nodeType: NodeType;
  vpnProvider: string | null;
  confidence: number;
  isPrivate: boolean;
}

interface BacktraceResult {
  targetIp: string;
  sourcePort: number | null;
  hopChain: HopNode[];
  vpnDetected: boolean;
  vpnNodes: HopNode[];
  likelyRealOrigin: HopNode | null;
  portHints: { port: number; service: string; likely: boolean }[];
  summary: string;
  analysedAt: string;
}

const TYPE_COLOR: Record<ProbeType, string> = {
  sql_injection:  "bg-red-500/15 text-red-400 border-red-500/30",
  xss:            "bg-orange-500/15 text-orange-400 border-orange-500/30",
  cmd_injection:  "bg-purple-500/15 text-purple-400 border-purple-500/30",
  path_traversal: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  auth_brute:     "bg-blue-500/15 text-blue-400 border-blue-500/30",
  recon:          "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  other:          "bg-white/10 text-white/50 border-white/20",
};
const TYPE_LABEL: Record<ProbeType, string> = {
  sql_injection: "SQL Inject", xss: "XSS", cmd_injection: "CMD Inject",
  path_traversal: "Path Traversal", auth_brute: "Auth Brute", recon: "Recon", other: "Other",
};

const NODE_TYPE_CONFIG: Record<NodeType, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  vpn_exit:       { color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",    icon: <Layers className="w-3.5 h-3.5" />,  label: "VPN Exit Node" },
  datacenter:     { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", icon: <Server className="w-3.5 h-3.5" />,  label: "Datacenter / VPS" },
  residential:    { color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30",  icon: <Home className="w-3.5 h-3.5" />,    label: "Residential ISP" },
  corporate:      { color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/30",   icon: <Building2 className="w-3.5 h-3.5" />, label: "Corporate / Edu" },
  private_network:{ color: "text-white/40",   bg: "bg-white/5",       border: "border-white/10",      icon: <Wifi className="w-3.5 h-3.5" />,    label: "Private Network" },
  tor_exit:       { color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", icon: <Globe className="w-3.5 h-3.5" />,   label: "Tor Exit Node" },
  unknown:        { color: "text-white/40",   bg: "bg-white/5",       border: "border-white/10",      icon: <Globe className="w-3.5 h-3.5" />,   label: "Unknown" },
};

function StatCard({ label, value, color = "text-white", sub }: { label: string; value: number | string; color?: string; sub?: string }) {
  return (
    <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-white/50 mt-1">{label}</div>
      {sub && <div className="text-[10px] text-white/30 mt-0.5">{sub}</div>}
    </div>
  );
}

function HopChainViz({ chain, targetIp }: { chain: HopNode[]; targetIp: string }) {
  const allNodes = [...chain, { ip: "YOUR SERVER", nodeType: "residential" as NodeType, isPrivate: true, port: 443, rdns: null, isp: "ProxhqVPN", org: null, country: null, city: null, asn: null, vpnProvider: null, confidence: 100 }];
  return (
    <div className="space-y-2">
      <div className="text-[10px] text-white/30 uppercase tracking-widest">Connection Hop Chain (left = probable origin)</div>
      <div className="flex items-center gap-1 overflow-x-auto pb-2 flex-wrap">
        {allNodes.map((node, i) => {
          const cfg = NODE_TYPE_CONFIG[node.nodeType as NodeType] ?? NODE_TYPE_CONFIG.unknown;
          const isTarget = node.ip === targetIp;
          const isServer = node.ip === "YOUR SERVER";
          return (
            <div key={i} className="flex items-center gap-1 shrink-0">
              <div className={`rounded-xl border px-3 py-2 text-xs ${cfg.bg} ${cfg.border} ${isTarget ? "ring-1 ring-red-400/50" : ""}`}>
                <div className={`flex items-center gap-1.5 font-semibold ${cfg.color}`}>
                  {cfg.icon}
                  <span className="font-mono">{isServer ? "Your Server" : node.ip}</span>
                  {node.port && <span className="text-[9px] text-white/30 font-normal">:{node.port}</span>}
                </div>
                <div className={`text-[9px] mt-0.5 ${cfg.color} opacity-70`}>{cfg.label}</div>
                {node.vpnProvider && <div className="text-[9px] font-bold mt-0.5" style={{ color: "inherit" }}>{node.vpnProvider}</div>}
                {node.country && <div className="text-[9px] text-white/40">{node.city ?? node.country}</div>}
                {node.rdns && <div className="text-[9px] text-white/30 font-mono truncate max-w-[140px]">{node.rdns}</div>}
                {!isServer && <div className={`text-[9px] mt-0.5 ${cfg.color} opacity-50`}>{node.confidence}% confidence</div>}
              </div>
              {i < allNodes.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 text-white/20 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface WhoisData { ip?: string; isp?: string; org?: string; country?: string; city?: string; timezone?: string; asn?: string; error?: string; }

export default function GhostTrap() {
  const [probes, setProbes]   = useState<Probe[]>([]);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [config, setConfig]   = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [clearing, setClearing]     = useState(false);
  const [whoisCache, setWhoisCache] = useState<Record<string, WhoisData>>({});
  const [whoisLoading, setWhoisLoading] = useState<Record<string, boolean>>({});
  const [reportLoading, setReportLoading] = useState<Record<string, boolean>>({});
  const [backtraceCache, setBacktraceCache] = useState<Record<string, BacktraceResult>>({});
  const [backtraceLoading, setBacktraceLoading] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"probes" | "info" | "how">("probes");

  const load = useCallback(async () => {
    const [pr, cr] = await Promise.all([
      fetch(`${BASE}/api/ghost-trap/probes?limit=200`, { credentials: "include" }),
      fetch(`${BASE}/api/ghost-trap/config`,           { credentials: "include" }),
    ]);
    if (pr.ok) { const d = await pr.json(); setProbes(d.probes ?? []); setStats(d.stats ?? null); }
    if (cr.ok) setConfig(await cr.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  const saveConfig = async (patch: Partial<Config>) => {
    const r = await fetch(`${BASE}/api/ghost-trap/config`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (r.ok) setConfig(await r.json());
  };

  const lookupWhois = async (ip: string) => {
    if (whoisCache[ip] || whoisLoading[ip]) return;
    setWhoisLoading(w => ({ ...w, [ip]: true }));
    try {
      const r = await fetch(`${BASE}/api/ghost-trap/whois/${encodeURIComponent(ip)}`, { credentials: "include" });
      setWhoisCache(c => ({ ...c, [ip]: r.ok ? {} : { error: "Lookup failed" } }));
      if (r.ok) setWhoisCache(c => ({ ...c, [ip]: {} }));
      const d = await r.json();
      setWhoisCache(c => ({ ...c, [ip]: d }));
    } catch { setWhoisCache(c => ({ ...c, [ip]: { error: "Lookup failed" } })); }
    setWhoisLoading(w => ({ ...w, [ip]: false }));
  };

  const runBacktrace = async (ip: string) => {
    if (backtraceCache[ip] || backtraceLoading[ip]) return;
    setBacktraceLoading(b => ({ ...b, [ip]: true }));
    try {
      const r = await fetch(`${BASE}/api/ghost-trap/backtrace/${encodeURIComponent(ip)}`, { credentials: "include" });
      if (r.ok) { const d = await r.json(); setBacktraceCache(c => ({ ...c, [ip]: d })); }
    } catch { /* ignore */ }
    setBacktraceLoading(b => ({ ...b, [ip]: false }));
  };

  const downloadReport = async (ip: string) => {
    setReportLoading(r => ({ ...r, [ip]: true }));
    const r = await fetch(`${BASE}/api/ghost-trap/report/${encodeURIComponent(ip)}?download=1`, { credentials: "include" });
    if (r.ok) {
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `proxhqvpn-incident-${ip.replace(/[.:]/g, "_")}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
    setReportLoading(r => ({ ...r, [ip]: false }));
  };

  const clearProbes = async () => {
    setClearing(true);
    await fetch(`${BASE}/api/ghost-trap/probes`, { method: "DELETE", credentials: "include" });
    setWhoisCache({}); setBacktraceCache({}); await load(); setClearing(false);
  };

  const [copied, setCopied] = useState<string | null>(null);
  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  const [domainInput, setDomainInput] = useState(config?.userDomain ?? "");
  useEffect(() => { if (config?.userDomain) setDomainInput(config.userDomain); }, [config?.userDomain]);

  const lureTokenBase = config?.userToken
    ? `${window.location.origin}${BASE}/api/ghost-trap/u/${config.userToken}/lure`
    : null;

  const PERSONAL_PORTS = [
    { port: 22,   service: "SSH remote access",         trapPath: "/ssh" },
    { port: 80,   service: "Web server (HTTP)",          trapPath: "/http" },
    { port: 8080, service: "Router / NAS admin",         trapPath: "/admin" },
    { port: 3389, service: "Remote Desktop (RDP)",       trapPath: "/rdp" },
    { port: 21,   service: "FTP file transfer",          trapPath: "/ftp" },
    { port: 9090, service: "Smart device panel",         trapPath: "/device" },
    { port: 8443, service: "Secure admin (HTTPS)",       trapPath: "/secure-admin" },
    { port: 5900, service: "VNC remote display",         trapPath: "/vnc" },
  ];

  const SERVER_PATHS = [
    { path: "/wp-admin/",     label: "WordPress admin",     trapPath: "/wp-admin" },
    { path: "/.env",          label: "Config / secrets",    trapPath: "/.env" },
    { path: "/phpmyadmin/",   label: "Database admin",      trapPath: "/phpmyadmin" },
    { path: "/api/users",     label: "User data API",       trapPath: "/api/users" },
    { path: "/.git/config",   label: "Git repository",      trapPath: "/.git" },
    { path: "/config.php",    label: "PHP config file",     trapPath: "/config.php" },
    { path: "/admin/login",   label: "Admin panel login",   trapPath: "/admin" },
    { path: "/api/v1/login",  label: "REST auth endpoint",  trapPath: "/api/login" },
  ];

  const deploySnippet = lureTokenBase
    ? (config?.deviceMode === "server"
      ? `# ProxhqVPN Ghost Trap — nginx config\n# Paste inside your server { } block\n\nlocation ~ ^/(wp-admin|\\.env|phpmyadmin|api/users|\\.git|config\\.php|admin|api/v1) {\n    proxy_pass ${lureTokenBase}$request_uri;\n    proxy_set_header X-Real-IP $remote_addr;\n    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n    proxy_ssl_verify off;\n}`
      : `# ProxhqVPN Ghost Trap — Linux port setup\n# Run as root on your device\n\nTRAP_BASE="${lureTokenBase}"\n\nfor PORT in 22 80 8080 3389 21 9090 8443 5900; do\n  iptables -t nat -A PREROUTING -p tcp --dport $PORT \\\\\n    -j DNAT --to-destination 127.0.0.1:7070\ndone\n\n# /etc/nginx/conf.d/ghosttrap.conf:\n# server {\n#   listen 7070;\n#   location / { proxy_pass $TRAP_BASE/; }\n# }`)
    : "";

  const uniqueIps = [...new Set(probes.map(p => p.attackerIp))];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Skull className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Ghost Trap — Counter Intel</h1>
            <p className="text-xs text-white/40">Honeypot · port tracking · VPN hop backtrace · authority reports</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowConfig(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-white/60 hover:text-white border border-white/10 rounded-xl hover:bg-white/5 transition-all">
            <Settings className="w-4 h-4" /> Config
          </button>
          <button onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-white/60 hover:text-white border border-white/10 rounded-xl hover:bg-white/5 transition-all">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          {config && (
            <button onClick={() => saveConfig({ enabled: !config.enabled })}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border transition-all ${
                config.enabled
                  ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15"
                  : "bg-white/5 border-white/15 text-white/50 hover:bg-white/8"
              }`}>
              {config.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              {config.enabled ? "Trap Active" : "Trap Off"}
            </button>
          )}
        </div>
      </div>

      {/* Ghost Trap — Mode & Decoy Setup */}
      <div className="bg-[#0d1610] border border-primary/20 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-white">Ghost Trap Setup</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary/70 uppercase tracking-widest">Private to You</span>
          </div>
          {/* Mode picker */}
          <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1">
            <button
              onClick={() => saveConfig({ deviceMode: "personal" })}
              className={`px-3 py-1.5 text-xs rounded-md transition-all flex items-center gap-1.5 ${
                (config?.deviceMode ?? "personal") !== "server"
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              <Laptop className="w-3 h-3" /> Personal Device
            </button>
            <button
              onClick={() => saveConfig({ deviceMode: "server" })}
              className={`px-3 py-1.5 text-xs rounded-md transition-all flex items-center gap-1.5 ${
                config?.deviceMode === "server"
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              <Server className="w-3 h-3" /> Website / Server
            </button>
          </div>
        </div>

        {/* Plain-language description — no raw endpoints shown */}
        <p className="text-xs text-white/50 leading-relaxed">
          Ghost Trap silently places fake services on your{" "}
          {config?.deviceMode === "server" ? "website" : "connection"} that look
          completely real to attackers. The moment someone tries to break in, their full
          identity is captured — IP address, real location, what they were targeting, and
          how they tried to hide. Every hit generates an instant incident report you can
          file directly with law enforcement.
        </p>

        {/* ── Personal device mode ─────────────────────────────────────────── */}
        {(config?.deviceMode ?? "personal") !== "server" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-xs text-white/40">Your detected public IP:</div>
              <div className="font-mono text-sm text-primary/80 bg-black/40 rounded-lg px-3 py-1">
                {config?.userDetectedIp ?? "Detecting…"}
              </div>
            </div>

            {!lureTokenBase || !config?.userDetectedIp ? (
              <div className="text-xs text-white/30 italic">Configuring trap…</div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">
                  What an attacker scanning your IP sees — these look like real device services
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {PERSONAL_PORTS.map(({ port, service, trapPath }) => {
                    const trapUrl = `${lureTokenBase}${trapPath}`;
                    const isCopied = copied === trapUrl;
                    return (
                      <button
                        key={port}
                        onClick={() => copyUrl(trapUrl)}
                        className="group flex items-center justify-between bg-black/40 hover:bg-black/60 border border-white/5 hover:border-primary/20 rounded-lg px-3 py-2 text-left transition-all"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-xs text-primary/70 truncate">
                            {config.userDetectedIp}:{port}/
                          </div>
                          <div className="text-[10px] text-white/35 mt-0.5">{service}</div>
                        </div>
                        <div className={`ml-2 shrink-0 transition-colors ${isCopied ? "text-green-400" : "text-white/20 group-hover:text-white/50"}`}>
                          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-white/25 pt-1">
                  Copy any trap URL above and paste into your proxy/redirect config below. The copied URL routes silently to your private Ghost Trap.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Website / server mode ────────────────────────────────────────── */}
        {config?.deviceMode === "server" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Your website domain</label>
              <div className="flex gap-2 max-w-sm">
                <input
                  value={domainInput}
                  onChange={e => setDomainInput(e.target.value)}
                  placeholder="yourdomain.com"
                  className="flex-1 text-sm bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/30"
                />
                <button
                  onClick={() => domainInput && saveConfig({ userDomain: domainInput })}
                  className="px-3 py-2 text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/15 transition-all"
                >
                  Save
                </button>
              </div>
            </div>

            {!lureTokenBase ? (
              <div className="text-xs text-white/30 italic">Configuring trap…</div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">
                  What an attacker targeting your site sees — these blend into your real site structure
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {SERVER_PATHS.map(({ path, label, trapPath }) => {
                    const domain = config.userDomain || "yourdomain.com";
                    const trapUrl = `${lureTokenBase}${trapPath}`;
                    const isCopied = copied === trapUrl;
                    return (
                      <button
                        key={path}
                        onClick={() => copyUrl(trapUrl)}
                        className="group flex items-center justify-between bg-black/40 hover:bg-black/60 border border-white/5 hover:border-cyan-400/20 rounded-lg px-3 py-2 text-left transition-all"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-xs text-cyan-400/60 truncate">
                            {domain}{path}
                          </div>
                          <div className="text-[10px] text-white/35 mt-0.5">{label}</div>
                        </div>
                        <div className={`ml-2 shrink-0 transition-colors ${isCopied ? "text-green-400" : "text-white/20 group-hover:text-white/50"}`}>
                          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-white/25 pt-1">
                  Copy any trap URL above and paste it into your nginx proxy config below. The copied URL routes to your private Ghost Trap — your visitors never see it.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Deploy config ─────────────────────────────────────────────────── */}
        {lureTokenBase && deploySnippet && (
          <div className="border-t border-white/5 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-white/30 uppercase tracking-widest">
                {config?.deviceMode === "server" ? "nginx proxy config — paste into your server { } block" : "Linux setup — run as root on your device"}
              </div>
              <button
                onClick={() => copyUrl(deploySnippet)}
                className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-white/40 hover:text-white/70 border border-white/10 rounded-lg transition-all"
              >
                {copied === deploySnippet ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                Copy
              </button>
            </div>
            <pre className="text-[10px] font-mono text-primary/40 bg-black/50 rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre">
              {deploySnippet}
            </pre>
            <div className="text-[10px] text-white/25 leading-relaxed">
              {config?.deviceMode === "server"
                ? "Attackers hitting these paths are silently proxied to your Ghost Trap and captured. They see a convincing fake response and have no idea they've been logged."
                : "Port scanners and brute-force bots targeting your IP hit these ports and get routed into your Ghost Trap. For Windows and macOS, the ProxhqVPN desktop app configures this automatically."}
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3">
          <StatCard label="Total Probes"   value={stats.total}       color="text-white" />
          <StatCard label="Unique IPs"     value={stats.uniqueIps}   color="text-cyan-400" />
          <StatCard label="SQL Inject"     value={stats.sqlCount}    color="text-red-400" />
          <StatCard label="XSS"            value={stats.xssCount}    color="text-orange-400" />
          <StatCard label="CMD Inject"     value={stats.cmdCount}    color="text-purple-400" />
          <StatCard label="Auto-Blocked"   value={stats.blocked}     color="text-yellow-400" />
          <StatCard label="Silk-Trapped"   value={stats.silkTrapped} color="text-primary" />
          <StatCard label="Beacon Fires"   value={stats.beaconFires} color="text-red-300" sub="live confirmed" />
          <StatCard label="VPN Detected"   value={stats.vpnCount}    color="text-orange-300" sub="surface IP" />
          <StatCard label="Avg Tarpit"     value={`${((stats.avgTarpit ?? 0) / 1000).toFixed(1)}s`} color="text-white/70" />
        </div>
      )}

      {/* Config panel */}
      {showConfig && config && (
        <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-5 space-y-4">
          <div className="text-sm font-semibold text-white">Trap Configuration</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Tarpit Min (ms)",           field: "tarpitMinMs",    type: "number" },
              { label: "Tarpit Max (ms)",           field: "tarpitMaxMs",    type: "number" },
              { label: "Auto-block after N probes", field: "autoBlockAfter", type: "number" },
              { label: "Silk-trap after N probes",  field: "silkTrapAfter",  type: "number" },
              { label: "Fake Site Name",            field: "fakeSiteName",   type: "text" },
              { label: "Fake DB Version",           field: "fakeDbVersion",  type: "text" },
            ].map(({ label, field, type }) => (
              <div key={field}>
                <label className="text-xs text-white/50 mb-1 block">{label}</label>
                <input
                  type={type}
                  value={(config as any)[field]}
                  onChange={e => setConfig(c => c ? { ...c, [field]: type === "number" ? Number(e.target.value) : e.target.value } : c)}
                  onBlur={e => saveConfig({ [field]: type === "number" ? Number(e.target.value) : e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/40"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.06]">
        {([["probes", "Probe Feed"], ["info", "Attacker Intel"], ["how", "How It Works"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-all ${
              activeTab === key ? "text-white bg-[#0d1610] border border-b-0 border-white/[0.07]" : "text-white/40 hover:text-white/60"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── PROBE FEED ─────────────────────────────────────────────────────────── */}
      {activeTab === "probes" && (
        <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Live Probe Feed
              <span className="text-xs text-white/30 font-normal ml-1">({probes.length})</span>
            </div>
            <button onClick={clearProbes} disabled={clearing}
              className="flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Clear All
            </button>
          </div>

          {loading && <div className="p-8 text-center text-white/30 text-sm">Loading…</div>}
          {!loading && probes.length === 0 && (
            <div className="p-10 text-center">
              <Shield className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <div className="text-sm text-white/30">No probes yet.</div>
              <div className="text-xs text-white/20 mt-1">When attackers hit the lure URLs, they'll appear here instantly.</div>
            </div>
          )}

          <div className="divide-y divide-white/[0.04]">
            {probes.map(p => (
              <div key={p.id}>
                <div
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                >
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${TYPE_COLOR[p.probeType]}`}>
                    {TYPE_LABEL[p.probeType]}
                  </span>
                  {/* IP + Port */}
                  <div className="flex items-center gap-1 text-sm text-white/80 font-mono shrink-0">
                    <Globe className="w-3.5 h-3.5 text-white/30" />
                    {p.attackerIp}
                    {p.attackerPort && (
                      <span className="text-[10px] text-yellow-400/70 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded font-mono">
                        :{p.attackerPort}
                      </span>
                    )}
                    {p.geoCountry && <span className="text-white/30 text-xs">({p.geoCity ?? p.geoCountry})</span>}
                  </div>
                  <div className="text-xs text-white/40 font-mono flex-1 truncate">
                    <span className="text-white/25">{p.method} </span>{p.endpoint}
                  </div>
                  {p.attackVector && (
                    <div className="text-[10px] text-orange-400/70 bg-orange-500/10 px-2 py-0.5 rounded shrink-0 truncate max-w-[120px]">
                      {p.attackVector}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-white/30 shrink-0">
                    <Clock className="w-3 h-3" />{(p.tarpitMs / 1000).toFixed(1)}s
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {p.vpnDetected && <Layers className="w-3.5 h-3.5 text-red-300" aria-label="VPN detected" />}
                    {p.beaconFired && <Radio className="w-3.5 h-3.5 text-red-400" aria-label="Beacon fired" />}
                    {p.autoBlocked && <Ban className="w-3.5 h-3.5 text-yellow-400" aria-label="Auto-blocked" />}
                    {p.silkTrapped && <AlertTriangle className="w-3.5 h-3.5 text-primary" aria-label="Silk-trapped" />}
                  </div>
                  {expandedId === p.id ? <ChevronUp className="w-3.5 h-3.5 text-white/20 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-white/20 shrink-0" />}
                </div>

                {expandedId === p.id && (
                  <div className="px-4 pb-4 space-y-3 bg-black/20">
                    {/* Port + Geo */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-black/30 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-1 text-white/30 mb-1"><Network className="w-3 h-3" /><span className="uppercase tracking-widest text-[9px]">Source Port</span></div>
                        <div className={`font-mono font-bold ${p.attackerPort ? "text-yellow-400" : "text-white/30"}`}>{p.attackerPort ? `:${p.attackerPort}` : "Not captured"}</div>
                      </div>
                      {p.geoCountry && <>
                        <div className="bg-black/30 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-1 text-white/30 mb-1"><MapPin className="w-3 h-3" /><span className="uppercase tracking-widest text-[9px]">Location</span></div>
                          <div className="text-white/70">{p.geoCity ?? "—"}, {p.geoCountry}</div>
                        </div>
                        <div className="bg-black/30 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-1 text-white/30 mb-1"><Building2 className="w-3 h-3" /><span className="uppercase tracking-widest text-[9px]">ISP</span></div>
                          <div className="text-white/70 truncate">{p.geoIsp ?? "—"}</div>
                        </div>
                        <div className="bg-black/30 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-1 text-white/30 mb-1"><Wifi className="w-3 h-3" /><span className="uppercase tracking-widest text-[9px]">ASN</span></div>
                          <div className="text-white/70">{p.geoAsn ?? "—"}</div>
                        </div>
                      </>}
                    </div>

                    {/* Hop chain (if multi-hop) */}
                    {p.hopChain && (() => {
                      try {
                        const chain: string[] = JSON.parse(p.hopChain);
                        if (chain.length > 1) return (
                          <div>
                            <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Detected Hop Chain (raw XFF headers)</div>
                            <div className="flex items-center gap-1 flex-wrap">
                              {chain.map((hop, i) => (
                                <div key={i} className="flex items-center gap-1">
                                  <span className="font-mono text-xs text-cyan-400/70 bg-cyan-500/10 border border-cyan-500/20 rounded px-2 py-0.5">{hop}</span>
                                  {i < chain.length - 1 && <ArrowRight className="w-3 h-3 text-white/20" />}
                                </div>
                              ))}
                              <ArrowRight className="w-3 h-3 text-white/20" />
                              <span className="font-mono text-xs text-primary/70 bg-primary/10 border border-primary/20 rounded px-2 py-0.5">Your Server</span>
                            </div>
                          </div>
                        );
                      } catch { return null; }
                      return null;
                    })()}

                    {/* UA */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">User Agent</div>
                        <div className="text-xs text-white/60 font-mono break-all">{p.attackerUa || "—"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Timestamp</div>
                        <div className="text-xs text-white/60">{new Date(p.probedAt).toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Fake data fed */}
                    {p.fakeResponse && (
                      <div>
                        <div className="text-[10px] text-primary/50 uppercase tracking-widest mb-1">Poisoned Data Fed (includes tracking beacon)</div>
                        <pre className="text-[10px] text-primary/70 bg-black/40 rounded-lg p-3 overflow-auto max-h-36 border border-primary/10 whitespace-pre-wrap break-all">
                          {(() => { try { return JSON.stringify(JSON.parse(p.fakeResponse), null, 2); } catch { return p.fakeResponse; } })()}
                        </pre>
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap items-center">
                      {p.vpnDetected && <span className="bg-red-300/10 border border-red-300/20 text-red-300 text-[10px] px-2 py-1 rounded-full">🛡 VPN exit node detected at surface IP</span>}
                      {p.beaconFired && <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] px-2 py-1 rounded-full">🔥 Beacon fired {p.beaconFiredAt ? `at ${new Date(p.beaconFiredAt).toLocaleTimeString()}` : ""} — attacker confirmed live</span>}
                      {p.autoBlocked && <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] px-2 py-1 rounded-full">✓ IP auto-blocked</span>}
                      {p.silkTrapped && <span className="bg-primary/10 border border-primary/20 text-primary text-[10px] px-2 py-1 rounded-full">✓ Silk-trapped</span>}
                      <span className="bg-white/5 border border-white/10 text-white/40 text-[10px] px-2 py-1 rounded-full">⏱ {p.tarpitMs.toLocaleString()}ms delay</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ATTACKER INTEL ─────────────────────────────────────────────────────── */}
      {activeTab === "info" && (
        <div className="space-y-4">
          {uniqueIps.length === 0 && (
            <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-10 text-center">
              <Shield className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <div className="text-sm text-white/30">No attackers captured yet.</div>
            </div>
          )}
          {uniqueIps.map(ip => {
            const ipProbes   = probes.filter(p => p.attackerIp === ip);
            const first      = ipProbes[ipProbes.length - 1]!;
            const beaconFired = ipProbes.some(p => p.beaconFired);
            const vpnDetected = ipProbes.some(p => p.vpnDetected);
            const whois      = whoisCache[ip];
            const backtrace  = backtraceCache[ip];
            const sourcePort = ipProbes.find(p => p.attackerPort)?.attackerPort;

            return (
              <div key={ip} className="bg-[#0d1610] border border-white/[0.07] rounded-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/[0.06] flex-wrap">
                  <div className="flex items-center gap-3">
                    <Skull className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="font-mono text-base font-bold text-white">{ip}</span>
                    {sourcePort && (
                      <span className="font-mono text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded">:{sourcePort}</span>
                    )}
                    {first.geoCountry && <span className="text-xs text-white/40">{first.geoCity}, {first.geoCountry}</span>}
                    {vpnDetected && <span className="text-[10px] bg-red-300/10 border border-red-300/20 text-red-300 px-2 py-0.5 rounded-full">🛡 VPN exit</span>}
                    {beaconFired && <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full">🔥 Beacon confirmed</span>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => lookupWhois(ip)} disabled={!!whoisCache[ip] || whoisLoading[ip]}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cyan-400 border border-cyan-500/20 bg-cyan-500/5 rounded-lg hover:bg-cyan-500/10 transition-all disabled:opacity-50">
                      <Globe className="w-3.5 h-3.5" />
                      {whoisLoading[ip] ? "Looking up…" : whoisCache[ip] ? "WHOIS ✓" : "WHOIS Lookup"}
                    </button>
                    <button onClick={() => runBacktrace(ip)} disabled={!!backtraceCache[ip] || backtraceLoading[ip]}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-orange-400 border border-orange-500/20 bg-orange-500/5 rounded-lg hover:bg-orange-500/10 transition-all disabled:opacity-50">
                      <Network className="w-3.5 h-3.5" />
                      {backtraceLoading[ip] ? "Tracing…" : backtraceCache[ip] ? "Traced ✓" : "VPN Backtrace"}
                    </button>
                    <button onClick={() => downloadReport(ip)} disabled={reportLoading[ip]}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary border border-primary/20 bg-primary/5 rounded-lg hover:bg-primary/10 transition-all disabled:opacity-50">
                      <Download className="w-3.5 h-3.5" />
                      {reportLoading[ip] ? "Generating…" : "Authority Report"}
                    </button>
                  </div>
                </div>

                {/* Summary row */}
                <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-white/[0.04]">
                  <div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest">Total Probes</div>
                    <div className="text-lg font-bold text-white">{ipProbes.length}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest">Source Port</div>
                    <div className={`font-mono text-lg font-bold mt-0.5 ${sourcePort ? "text-yellow-400" : "text-white/20"}`}>
                      {sourcePort ? `:${sourcePort}` : "—"}
                    </div>
                    <div className="text-[9px] text-white/20">TCP source port</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest">Attack Types</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {[...new Set(ipProbes.map(p => p.probeType))].map(t => (
                        <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded border ${TYPE_COLOR[t as ProbeType]}`}>{TYPE_LABEL[t as ProbeType]}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest">Status</div>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {ipProbes.some(p => p.autoBlocked) && <span className="text-[9px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded">BLOCKED</span>}
                      {ipProbes.some(p => p.silkTrapped) && <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded">SILK-TRAPPED</span>}
                      {beaconFired && <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">BEACON ✓</span>}
                      {vpnDetected && <span className="text-[9px] bg-red-300/10 text-red-300 border border-red-300/20 px-1.5 py-0.5 rounded">VPN</span>}
                    </div>
                  </div>
                </div>

                {/* WHOIS panel */}
                {whois && !whois.error && (
                  <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-cyan-500/[0.03] border-b border-cyan-500/10">
                    {[
                      { icon: <Building2 className="w-3 h-3" />, label: "ISP",      val: whois.isp },
                      { icon: <MapPin className="w-3 h-3" />,    label: "Location", val: `${whois.city ?? "—"}, ${whois.country ?? "—"}` },
                      { icon: <Wifi className="w-3 h-3" />,      label: "ASN",      val: whois.asn },
                      { icon: <Clock className="w-3 h-3" />,     label: "Timezone", val: whois.timezone },
                    ].map(({ icon, label, val }) => (
                      <div key={label}>
                        <div className="flex items-center gap-1 text-cyan-400/50 text-[9px] uppercase tracking-widest mb-1">{icon}{label}</div>
                        <div className="text-xs text-white/70 truncate">{val ?? "—"}</div>
                      </div>
                    ))}
                  </div>
                )}
                {whois?.error && (
                  <div className="px-4 py-2 text-xs text-red-400/60 border-b border-white/[0.04]">WHOIS error: {whois.error}</div>
                )}

                {/* ── VPN BACKTRACE PANEL ─────────────────────────────────────── */}
                {backtrace && (
                  <div className="px-4 py-4 space-y-4 bg-orange-500/[0.03] border-b border-orange-500/10">
                    {/* Summary sentence */}
                    <div className="flex items-start gap-2">
                      <Network className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                      <div className="text-xs text-white/70 leading-relaxed">{backtrace.summary}</div>
                    </div>

                    {/* Hop chain visualization */}
                    <HopChainViz chain={backtrace.hopChain} targetIp={ip} />

                    {/* VPN nodes highlight */}
                    {backtrace.vpnNodes.length > 0 && (
                      <div>
                        <div className="text-[10px] text-orange-400/60 uppercase tracking-widest mb-2">Identified VPN / Proxy Nodes</div>
                        <div className="space-y-2">
                          {backtrace.vpnNodes.map((n, i) => (
                            <div key={i} className="bg-red-500/5 border border-red-500/15 rounded-xl px-4 py-3">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <Layers className="w-3.5 h-3.5 text-red-400" />
                                  <span className="font-mono text-sm text-white/80">{n.ip}</span>
                                  {n.vpnProvider && <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded">{n.vpnProvider}</span>}
                                </div>
                                <div className="text-[10px] text-red-400/60">{n.confidence}% confidence</div>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs text-white/50">
                                {n.country  && <span>📍 {n.city ?? n.country}</span>}
                                {n.isp      && <span>🏢 {n.isp}</span>}
                                {n.asn      && <span>📡 {n.asn}</span>}
                                {n.rdns     && <span className="font-mono truncate">🔤 {n.rdns}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Likely real origin */}
                    {backtrace.likelyRealOrigin && backtrace.likelyRealOrigin.nodeType !== "vpn_exit" && backtrace.likelyRealOrigin.nodeType !== "datacenter" && (
                      <div className="bg-green-500/5 border border-green-500/15 rounded-xl px-4 py-3">
                        <div className="text-[10px] text-green-400/60 uppercase tracking-widest mb-2">Probable Real-World Origin</div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <Home className="w-4 h-4 text-green-400 shrink-0" />
                          <span className="font-mono text-sm text-white/80">{backtrace.likelyRealOrigin.ip}</span>
                          {backtrace.likelyRealOrigin.city && <span className="text-xs text-white/50">📍 {backtrace.likelyRealOrigin.city}, {backtrace.likelyRealOrigin.country}</span>}
                          {backtrace.likelyRealOrigin.isp  && <span className="text-xs text-white/50">🏢 {backtrace.likelyRealOrigin.isp}</span>}
                          <span className="text-[10px] text-green-400/60">{backtrace.likelyRealOrigin.confidence}% confidence</span>
                        </div>
                      </div>
                    )}

                    {/* Port hints */}
                    <div>
                      <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Common VPN/Proxy Ports Associated With This Attack Profile</div>
                      <div className="flex flex-wrap gap-1.5">
                        {backtrace.portHints.map(ph => (
                          <div key={ph.port} className={`text-[10px] px-2.5 py-1 rounded-lg border font-mono ${
                            ph.likely
                              ? "bg-orange-500/10 border-orange-500/25 text-orange-300"
                              : "bg-white/[0.03] border-white/10 text-white/30"
                          }`}>
                            :{ph.port} <span className="font-sans">{ph.service}</span>
                            {ph.likely && <span className="ml-1 text-orange-400">← likely</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Law enforcement note */}
                    {backtrace.vpnNodes.length > 0 && (
                      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-xs text-white/40 leading-relaxed">
                        <span className="text-white/60 font-semibold">Law Enforcement Note: </span>
                        The attacker's real identity is behind {backtrace.vpnNodes.map(n => n.vpnProvider ?? "unknown VPN").join(", ")}.
                        {" "}A subpoena or court order to {backtrace.vpnNodes.map(n => n.vpnProvider ?? "the VPN provider").join(", ")} for
                        subscriber records matching these timestamps would be required to identify the true subscriber.
                        Download the Authority Report below — it includes all timestamps formatted for this purpose.
                      </div>
                    )}
                  </div>
                )}

                {/* Report CTA */}
                <div className="px-4 py-3 flex items-center gap-3">
                  <FileText className="w-4 h-4 text-white/20 shrink-0" />
                  <div className="text-xs text-white/40 flex-1">
                    Authority Report: full probe timeline, all attack vectors, port info, hop chain, beacon confirmation, geo/WHOIS — formatted for law enforcement handover.
                  </div>
                  <button onClick={() => downloadReport(ip)} disabled={reportLoading[ip]}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-primary bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/15 transition-all shrink-0 disabled:opacity-50">
                    <Download className="w-4 h-4" />
                    {reportLoading[ip] ? "Generating…" : "Download Report"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── HOW IT WORKS ───────────────────────────────────────────────────────── */}
      {activeTab === "how" && (
        <div className="space-y-4">

          {/* Intro banner */}
          <div className="bg-[#0d1610] border border-primary/10 rounded-xl p-5 flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-base font-bold text-white mb-1">Ghost Trap — Active Counter-Intelligence System</div>
              <p className="text-sm text-white/55 leading-relaxed">
                Ghost Trap is a purpose-built honeypot and attacker attribution engine. It does not just detect hackers —
                it lures them in, wastes their resources, feeds them poisoned intelligence, and builds a forensic dossier
                on their real identity so you can report them to ISPs, hosting providers, or law enforcement.
              </p>
            </div>
          </div>

          {/* 7-stage pipeline */}
          <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <div className="text-sm font-semibold text-white">The 7-Stage Trap Pipeline</div>
              <div className="text-xs text-white/40 mt-0.5">What happens from the moment a hacker touches your infrastructure to the moment you have a report</div>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {[
                {
                  num: "01",
                  color: "text-red-400",
                  bg: "bg-red-500/8",
                  border: "border-l-red-500/50",
                  icon: <AlertTriangle className="w-4 h-4" />,
                  title: "Attacker Probes a Lure Endpoint",
                  summary: "The trap is triggered the moment a hacker scans or requests a lure URL.",
                  detail: "Ghost Trap exposes a set of convincing decoy endpoints that mimic real vulnerable servers — /login, /admin, /wp-admin, /.env, /config.php, /backup.sql, /api/users, /api/search. These look exactly like mis-configured or exposed web services. Any automated scanner, exploit kit, or manual hacker probing for weaknesses will naturally hit them. The moment any request arrives at a lure endpoint, Stage 2 begins instantly.",
                },
                {
                  num: "02",
                  color: "text-orange-400",
                  bg: "bg-orange-500/8",
                  border: "border-l-orange-500/50",
                  icon: <Clock className="w-4 h-4" />,
                  title: "Tarpit — Wasting the Attacker's Time",
                  summary: "Every response is deliberately slow. The attacker's scanner grinds to a halt.",
                  detail: "Ghost Trap artificially delays every response by 1,500–8,000 milliseconds (configurable). For an attacker running an automated scanner against thousands of targets, this is devastating — their threads block, their concurrency saturates, and their scan rate collapses. A scan that would normally take 30 seconds now takes hours. Meanwhile, every millisecond of that delay is time we are collecting data. The attacker receives no error and has no indication they've been detected.",
                },
                {
                  num: "03",
                  color: "text-yellow-400",
                  bg: "bg-yellow-500/8",
                  border: "border-l-yellow-500/50",
                  icon: <Search className="w-4 h-4" />,
                  title: "Deep Fingerprinting",
                  summary: "Everything about the attacker's connection is captured silently.",
                  detail: "During the tarpit delay, Ghost Trap records: IP address and source port (TCP source port reveals the attacker's NAT table and session), all HTTP headers, the exact attack payload and vector (SQL injection string, path traversal attempt, brute-force credentials, etc.), user agent, accept-language, encoding preferences, geo-location (country, city, ISP, ASN, timezone), VPN/datacenter detection, and Tor exit node detection. The source port is especially valuable — it persists across requests from the same attacker session and can help de-anonymize even VPN users.",
                },
                {
                  num: "04",
                  color: "text-primary",
                  bg: "bg-primary/8",
                  border: "border-l-primary/50",
                  icon: <FileText className="w-4 h-4" />,
                  title: "Poisoned Response with Embedded Beacons",
                  summary: "The attacker receives fake data. Every piece of it is a tracking device.",
                  detail: 'Ghost Trap serves a realistic but entirely fabricated response — fake database credentials, fake admin panel HTML, fake API keys, fake configuration files. Embedded inside every poisoned response is one or more tracking beacons: a 1×1 transparent image URL (web bug), a unique token URL, or a redirect URL. When the attacker copies the fake credentials into their tools, opens the fake admin panel, or shares the stolen data with a colleague, the beacon fires back to us — from their real browser, their real IP, their real device.',
                },
                {
                  num: "05",
                  color: "text-red-300",
                  bg: "bg-red-400/8",
                  border: "border-l-red-300/50",
                  icon: <Radio className="w-4 h-4" />,
                  title: "Beacon Fires — Attacker Confirmed Live",
                  summary: "The moment the attacker uses the fake data, their real identity is revealed.",
                  detail: "A beacon fire is the most powerful event in Ghost Trap. It means the attacker is confirmed live and active. Their real browser made a request — which means we now have their true IP (even if they were using a VPN to probe us), their real user agent (browser version, OS), and a precise timestamp. If the attacker was hiding behind Tor or a VPN during the probe but switched networks to test the stolen credentials, we capture their real address. The beacon fire timestamp, combined with the probe timestamp, is admissible forensic evidence.",
                },
                {
                  num: "06",
                  color: "text-purple-400",
                  bg: "bg-purple-500/8",
                  border: "border-l-purple-500/50",
                  icon: <Network className="w-4 h-4" />,
                  title: "Silk Web Trap — Infinite Decoy Maze",
                  summary: "Repeat attackers are routed into a dead-end network that loops them forever.",
                  detail: "After a configurable number of probes (default: 3), the attacker's IP is silently redirected into the SilkWeb decoy network. SilkWeb is a topology of 60 nodes organized into route types: Highway (fast-looking paths that loop back), Dead End (paths that terminate with convincing fake errors), Decoy (paths that mirror legitimate-looking services), and Collapse Zone (paths that simulate a crashing server). The attacker spends hours navigating what appears to be a complex network, generating no real damage, while we gather an increasingly complete picture of their tooling, timing, and methodology.",
                },
                {
                  num: "07",
                  color: "text-cyan-400",
                  bg: "bg-cyan-500/8",
                  border: "border-l-cyan-500/50",
                  icon: <Shield className="w-4 h-4" />,
                  title: "Auto-Block + Authority Report",
                  summary: "Attacker is blocked. A law-enforcement-ready report is generated in one click.",
                  detail: "After the trap threshold is reached, the attacker's IP is automatically added to your firewall block list with a timestamped reason. From the Attacker Intel tab, you can generate a full Authority Report — a structured document containing: all probe timestamps, attack vectors and payloads, source port, geo-location, ISP and ASN, VPN/Tor detection results, hop chain analysis, beacon fire confirmation, and a law enforcement note explaining what subpoena would be required to unmask the attacker's true identity. This report can be submitted directly to the attacker's hosting provider, their ISP, or law enforcement agencies.",
                },
              ].map(({ num, color, bg, border, icon, title, summary, detail }) => (
                <div key={num} className={`flex gap-4 px-5 py-5 border-l-2 ${border} ${bg}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${color} bg-black/20`}
                    style={{ borderColor: "currentColor", opacity: 1 }}>
                    <span className={color}>{icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-widest opacity-50 ${color}`}>Stage {num}</span>
                    </div>
                    <div className={`text-sm font-semibold mb-1 ${color}`}>{title}</div>
                    <div className="text-xs text-white/70 font-medium mb-2">{summary}</div>
                    <p className="text-xs text-white/42 leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lure endpoints reference */}
          <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-5 space-y-3">
            <div className="text-sm font-semibold text-white">Active Lure Endpoints</div>
            <p className="text-xs text-white/45 leading-relaxed">
              These paths are always live on your server. Attackers scanning for vulnerabilities will inevitably discover them.
              They are designed to look exactly like real exposed attack surfaces.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {["/login", "/admin", "/wp-admin", "/api/users", "/api/search", "/.env", "/config.php", "/backup.sql"].map(ep => (
                <div key={ep} className="font-mono text-[11px] bg-black/40 border border-white/[0.06] rounded-lg px-3 py-2 text-primary/70">{ep}</div>
              ))}
            </div>
            <p className="text-[11px] text-white/30 leading-relaxed">
              Each endpoint serves a different poisoned payload type: /login returns fake credentials, /.env returns fake environment variables with embedded API keys (beacon-tracked), /backup.sql returns a fake database dump, /api/users returns fake user records with embedded tracking tokens.
            </p>
          </div>

          {/* Data collected reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-5 space-y-3">
              <div className="text-sm font-semibold text-white">What Ghost Trap Captures Per Probe</div>
              <div className="space-y-1.5">
                {[
                  ["IP Address + Source Port", "text-red-400"],
                  ["All HTTP Headers (UA, Accept, Encoding)", "text-orange-400"],
                  ["Exact Attack Payload & Vector Type", "text-yellow-400"],
                  ["Geo-location (Country, City, ISP, ASN)", "text-primary"],
                  ["VPN Exit Node Detection", "text-red-300"],
                  ["Tor Exit Node Detection", "text-purple-400"],
                  ["Multi-hop X-Forwarded-For Chain", "text-cyan-400"],
                  ["Precise Timestamp (ms resolution)", "text-white/60"],
                ].map(([label, color]) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color} bg-current`} />
                    <span className="text-white/55">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#0d1610] border border-white/[0.07] rounded-xl p-5 space-y-3">
              <div className="text-sm font-semibold text-white">Authority Report Contains</div>
              <div className="space-y-1.5">
                {[
                  ["Full probe timeline with all attack payloads", "text-primary"],
                  ["Source port (TCP) for session correlation", "text-yellow-400"],
                  ["Beacon fire timestamp + real IP (if different)", "text-red-300"],
                  ["Hop chain: Attacker → VPN nodes → Your server", "text-orange-400"],
                  ["ISP and hosting provider contact information", "text-cyan-400"],
                  ["VPN provider identification + confidence %", "text-red-400"],
                  ["Law enforcement subpoena guidance", "text-purple-400"],
                  ["Formatted for direct ISP abuse submission", "text-white/60"],
                ].map(([label, color]) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color} bg-current`} />
                    <span className="text-white/55">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
