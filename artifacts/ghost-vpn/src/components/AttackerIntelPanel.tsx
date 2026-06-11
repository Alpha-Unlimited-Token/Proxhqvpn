// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Reusable Attacker Intelligence Panel — Port Scan + Exploit Intel + SQLmap
// Used on: BeaconAlerts, Firewall, GhostTrace, SIEM, NetworkMonitor
import { useState, useEffect } from "react";
import {
  Search, Syringe, ShieldAlert, Loader2, XCircle,
  Globe, ExternalLink, ChevronDown, ChevronUp, TerminalSquare,
  Zap, AlertTriangle, CheckCircle2, Server, Wifi,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}/api${path}`, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  return r.json();
}

type IntelTab = "exploit" | "portscan" | "sqlmap" | "banner";

interface PortResult {
  port: number;
  open: boolean;
  service: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  cves: string[];
  exploitDbUrl: string;
  hacktricksUrl: string;
  nistUrl: string;
  mitre: string[];
  banner?: string | null;
  httpStatus?: number | null;
  httpServer?: string | null;
  httpPoweredBy?: string | null;
  rawHeaders?: string | null;
}

interface BannerPort {
  port: number;
  service: string;
  open: boolean;
  banner: string | null;
  httpStatus: number | null;
  httpServer: string | null;
  httpPoweredBy: string | null;
  rawHeaders: string | null;
  severity: string;
}

interface BannerScanResult {
  ip: string;
  durationMs: number;
  scannedAt: string;
  bannerCount: number;
  results: BannerPort[];
  openBanners: BannerPort[];
}

interface IntelResult {
  ip: string;
  geo: Record<string, unknown>;
  openCount: number;
  totalProbed: number;
  scanDurationMs: number;
  riskLevel: "critical" | "high" | "medium" | "low" | "clean";
  openPorts: PortResult[];
  ports: PortResult[];
}

const SEV_COLOR: Record<string, string> = {
  critical: "#ff2244",
  high:     "#ff6600",
  medium:   "#ffaa00",
  low:      "#44aaff",
};

const RISK_LABEL: Record<string, string> = {
  critical: "CRITICAL RISK",
  high:     "HIGH RISK",
  medium:   "MEDIUM RISK",
  low:      "LOW RISK",
  clean:    "NO OPEN PORTS",
};

export function AttackerIntelPanel({
  ip,
  onClose,
  initialTab = "exploit",
}: {
  ip: string;
  onClose: () => void;
  initialTab?: IntelTab;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<IntelTab>(initialTab);

  // ── Exploit Intel state ──────────────────────────────────────────────────
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelResult, setIntelResult]   = useState<IntelResult | null>(null);
  const [intelError,  setIntelError]    = useState<string | null>(null);
  const [expandedPort, setExpandedPort] = useState<number | null>(null);

  // ── Port Scan state ──────────────────────────────────────────────────────
  const [scanPorts,   setScanPorts]   = useState("1-10000");
  const [scanFlags,   setScanFlags]   = useState("-sV -T4");
  const [scanning,    setScanning]    = useState(false);
  const [scanOutput,  setScanOutput]  = useState<string | null>(null);
  const [scanCmd,     setScanCmd]     = useState<string | null>(null);

  // ── SQLmap state ─────────────────────────────────────────────────────────
  const [sqlTarget,   setSqlTarget]   = useState(`http://${ip}/`);
  const [sqlFlags,    setSqlFlags]    = useState("--dbs --forms");
  const [sqlRunning,  setSqlRunning]  = useState(false);
  const [sqlOutput,   setSqlOutput]   = useState<string | null>(null);
  const [sqlJobId,    setSqlJobId]    = useState<string | null>(null);
  const [sqlStatus,   setSqlStatus]   = useState("idle");

  // ── Banner Grab state ─────────────────────────────────────────────────────
  const [bannerLoading, setBannerLoading] = useState(false);
  const [bannerResult,  setBannerResult]  = useState<BannerScanResult | null>(null);
  const [bannerError,   setBannerError]   = useState<string | null>(null);
  const [expandedBanner, setExpandedBanner] = useState<number | null>(null);
  const [bannerPorts,   setBannerPorts]   = useState("21,22,23,25,80,110,143,443,445,993,3306,3389,5432,6379,8080,8443,8880,8888,9200,27017");

  // Reset on IP change
  useEffect(() => {
    setSqlTarget(`http://${ip}/`);
    setScanOutput(null); setScanCmd(null);
    setSqlOutput(null); setSqlJobId(null); setSqlStatus("idle");
    setIntelResult(null); setIntelError(null);
    setBannerResult(null); setBannerError(null);
  }, [ip]);

  // Auto-run exploit intel when panel opens
  useEffect(() => {
    if (tab === "exploit" && !intelResult && !intelLoading) runExploitIntel();
  }, [tab]);

  const runBannerGrab = async () => {
    setBannerLoading(true); setBannerError(null);
    try {
      const ports = bannerPorts.split(",").map(p => parseInt(p.trim())).filter(p => p > 0 && p < 65536);
      const data = await apiFetch("/attack-intel/banner", {
        method: "POST",
        body: JSON.stringify({ ip, ports: ports.length ? ports : undefined }),
      });
      if (data.error) { setBannerError(JSON.stringify(data.error)); }
      else { setBannerResult(data); }
    } catch (e: any) {
      setBannerError(e.message);
    }
    setBannerLoading(false);
  };

  const runExploitIntel = async () => {
    setIntelLoading(true); setIntelError(null);
    try {
      const data = await apiFetch("/attack-intel/probe", {
        method: "POST",
        body: JSON.stringify({ ip }),
      });
      if (data.error) { setIntelError(JSON.stringify(data.error)); }
      else { setIntelResult(data); }
    } catch (e: any) {
      setIntelError(e.message);
    }
    setIntelLoading(false);
  };

  const runPortScan = async () => {
    setScanning(true); setScanOutput(null); setScanCmd(null);
    try {
      const res = await fetch(`${BASE}/api/silkweb/scan/portscan`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, ports: scanPorts, flags: scanFlags }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Port Scan Error", description: data.error, variant: "destructive" }); setScanning(false); return; }
      setScanCmd(data.cmd);
      toast({ title: "Port Scan Launched", description: `Job ${data.jobId} — scanning ${ip}` });
      const poll = setInterval(async () => {
        try {
          const pr = await fetch(`${BASE}/api/silkweb/scan/portscan/${data.jobId}`, { credentials: "include" });
          const pd = await pr.json();
          if (pd.status !== "running") { setScanOutput(pd.results ?? "No output"); setScanning(false); clearInterval(poll); }
        } catch { /* ignore */ }
      }, 4000);
    } catch (e: any) { setScanOutput("Error: " + e.message); setScanning(false); }
  };

  const runSqlmap = async () => {
    setSqlRunning(true); setSqlOutput(null); setSqlStatus("running");
    try {
      const res = await fetch(`${BASE}/api/silkweb/scan/sqlmap`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, targetUrl: sqlTarget, extraFlags: sqlFlags }),
      });
      const data = await res.json();
      if (!res.ok) { setSqlStatus("error"); setSqlOutput(data.error ?? "Unknown error"); setSqlRunning(false); return; }
      setSqlJobId(data.jobId);
      toast({ title: "SQLmap Launched", description: `Job ${data.jobId}` });
      const poll = setInterval(async () => {
        try {
          const pr = await fetch(`${BASE}/api/silkweb/scan/sqlmap/${data.jobId}`, { credentials: "include" });
          const pd = await pr.json();
          if (pd.status !== "running") { setSqlStatus(pd.status ?? "complete"); setSqlOutput(pd.results ?? "No output"); setSqlRunning(false); clearInterval(poll); }
        } catch { /* ignore */ }
      }, 4000);
    } catch (e: any) { setSqlStatus("error"); setSqlOutput("Error: " + e.message); setSqlRunning(false); }
  };

  const sqlStatusColor: Record<string, string> = {
    idle: "text-primary/40", running: "text-yellow-400 animate-pulse",
    complete: "text-primary", error: "text-red-400",
  };

  const geo = intelResult?.geo as any;

  return (
    <div className="flex flex-col h-full bg-black font-mono text-xs">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-red-500/30 bg-red-500/5 shrink-0">
        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-red-400 text-sm">{ip}</div>
          <div className="text-[10px] text-primary/40">Attacker Intelligence</div>
        </div>
        <a href={`https://search.arin.net/rdap/?query=${ip}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-blue-400/60 hover:text-blue-400 border border-blue-500/20 px-2 py-1 rounded transition-colors">
          <Globe className="w-3 h-3" /> WHOIS
        </a>
        <button onClick={onClose} className="text-primary/30 hover:text-white transition-colors shrink-0">
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-red-500/20 shrink-0 overflow-x-auto">
        {([
          { id: "exploit",  label: "Exploit Intel", icon: <Zap className="w-3.5 h-3.5" />,          color: "border-red-500 text-red-400 bg-red-500/5" },
          { id: "banner",   label: "Banner Grab",   icon: <Server className="w-3.5 h-3.5" />,        color: "border-yellow-500 text-yellow-400 bg-yellow-500/5" },
          { id: "portscan", label: "Port Scan",      icon: <Search className="w-3.5 h-3.5" />,        color: "border-primary text-primary bg-primary/5" },
          { id: "sqlmap",   label: "SQLmap",         icon: <Syringe className="w-3.5 h-3.5" />,       color: "border-red-500 text-red-400 bg-red-500/5" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-[10px] uppercase tracking-widest border-b-2 whitespace-nowrap transition-colors ${tab === t.id ? t.color : "border-transparent text-primary/40 hover:text-primary/70"}`}>
            {t.icon} {t.label}
            {t.id === "sqlmap" && sqlStatus === "running" && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />}
            {t.id === "sqlmap" && sqlStatus === "complete" && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            {t.id === "banner" && bannerResult && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />}
          </button>
        ))}
        {/* Terminal shortcut */}
        <a href={`/terminal?ip=${ip}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2.5 text-[10px] uppercase tracking-widest border-b-2 border-transparent text-primary/30 hover:text-primary/60 whitespace-nowrap ml-auto transition-colors">
          <TerminalSquare className="w-3.5 h-3.5" /> Terminal
        </a>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">

        {/* ── EXPLOIT INTEL ────────────────────────────────────────── */}
        {tab === "exploit" && (
          <div className="space-y-4">
            <div className="text-[10px] text-red-400/50 border border-red-500/15 rounded px-3 py-2 bg-red-500/5">
              Probes <span className="text-red-400">{ip}</span> for {intelResult ? intelResult.totalProbed : "30+"} common attack-surface ports and maps open services to CVEs, ExploitDB entries, and Hacktricks guides.
            </div>

            {intelLoading && (
              <div className="flex items-center gap-2 text-yellow-400 border border-yellow-500/20 rounded px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Probing {ip} — scanning {30} high-value ports…
              </div>
            )}
            {intelError && (
              <div className="text-red-400 border border-red-500/20 rounded px-3 py-2 text-[10px]">Error: {intelError}</div>
            )}

            {intelResult && (
              <>
                {/* Risk Banner */}
                <div className="flex items-center justify-between border rounded px-3 py-2"
                  style={{ borderColor: (SEV_COLOR[intelResult.riskLevel] ?? "#333") + "44", background: (SEV_COLOR[intelResult.riskLevel] ?? "#333") + "11" }}>
                  <div>
                    <div className="font-bold text-sm" style={{ color: SEV_COLOR[intelResult.riskLevel] ?? "#888" }}>
                      {RISK_LABEL[intelResult.riskLevel]}
                    </div>
                    <div className="text-[10px] text-primary/40">
                      {intelResult.openCount} open / {intelResult.totalProbed} probed · {intelResult.scanDurationMs}ms
                    </div>
                  </div>
                  <button onClick={runExploitIntel} disabled={intelLoading}
                    className="text-[10px] border border-primary/20 px-2 py-1 rounded hover:border-primary/50 transition-colors text-primary/50 hover:text-primary">
                    Re-Scan
                  </button>
                </div>

                {/* Geo Banner */}
                {geo?.country && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-primary/50 border border-primary/10 rounded px-3 py-2">
                    <span>🌍 {geo.country} / {geo.regionName} / {geo.city}</span>
                    <span>🏢 {geo.isp}</span>
                    {geo.as && <span>🔗 {geo.as}</span>}
                    {geo.proxy && <span className="text-yellow-400">⚠ Proxy/VPN detected</span>}
                    {geo.hosting && <span className="text-orange-400">🖥 Datacenter/Hosting IP</span>}
                  </div>
                )}

                {/* Open Ports — Exploit Table */}
                {intelResult.openPorts.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[10px] text-primary/40 uppercase tracking-widest">Open Ports — Click to expand exploits</div>
                    {intelResult.openPorts.map(p => (
                      <div key={p.port} className="border rounded" style={{ borderColor: (SEV_COLOR[p.severity] ?? "#333") + "44" }}>
                        {/* Row */}
                        <div className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/3 transition-colors"
                          onClick={() => setExpandedPort(expandedPort === p.port ? null : p.port)}>
                          <span className="font-bold w-12 shrink-0" style={{ color: SEV_COLOR[p.severity] }}>:{p.port}</span>
                          <span className="text-primary font-semibold w-28 shrink-0">{p.service}</span>
                          <span className="text-primary/50 flex-1 truncate">{p.description}</span>
                          <span className="text-[9px] border px-1.5 py-0.5 rounded uppercase shrink-0" style={{ color: SEV_COLOR[p.severity], borderColor: SEV_COLOR[p.severity] + "44" }}>
                            {p.severity}
                          </span>
                          {expandedPort === p.port ? <ChevronUp className="w-3 h-3 text-primary/30 shrink-0" /> : <ChevronDown className="w-3 h-3 text-primary/30 shrink-0" />}
                        </div>

                        {/* Expanded CVE + Links */}
                        {expandedPort === p.port && (
                          <div className="border-t px-3 py-3 space-y-3" style={{ borderColor: (SEV_COLOR[p.severity] ?? "#333") + "30", background: "#050505" }}>
                            <p className="text-[10px] text-primary/60 leading-relaxed">{p.description}</p>

                            {p.cves.length > 0 && (
                              <div>
                                <div className="text-[9px] text-primary/30 uppercase mb-1.5">CVEs</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {p.cves.map(cve => (
                                    <a key={cve} href={`https://nvd.nist.gov/vuln/detail/${cve}`} target="_blank" rel="noopener noreferrer"
                                      className="text-[10px] border border-red-500/30 text-red-400/80 px-2 py-0.5 rounded hover:border-red-500 hover:text-red-400 transition-colors flex items-center gap-1">
                                      {cve} <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {p.mitre.length > 0 && (
                              <div>
                                <div className="text-[9px] text-primary/30 uppercase mb-1.5">MITRE ATT&amp;CK</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {p.mitre.map(t => (
                                    <a key={t} href={`https://attack.mitre.org/techniques/${t.replace(".","/")}/`} target="_blank" rel="noopener noreferrer"
                                      className="text-[10px] border border-orange-500/30 text-orange-400/80 px-2 py-0.5 rounded hover:border-orange-500 hover:text-orange-400 transition-colors flex items-center gap-1">
                                      {t} <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div>
                              <div className="text-[9px] text-primary/30 uppercase mb-1.5">References &amp; Exploit Guides</div>
                              <div className="flex flex-wrap gap-2">
                                <a href={p.hacktricksUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-[10px] border border-primary/20 text-primary/70 px-2.5 py-1.5 rounded hover:border-primary hover:text-primary transition-colors">
                                  <ShieldAlert className="w-3 h-3" />
                                  Hacktricks — Port {p.port} Pentesting Guide
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                                <a href={p.exploitDbUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-[10px] border border-red-500/20 text-red-400/70 px-2.5 py-1.5 rounded hover:border-red-500 hover:text-red-400 transition-colors">
                                  <AlertTriangle className="w-3 h-3" />
                                  Exploit-DB — {p.service} Exploits
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                                <a href={p.nistUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-[10px] border border-blue-500/20 text-blue-400/70 px-2.5 py-1.5 rounded hover:border-blue-500 hover:text-blue-400 transition-colors">
                                  <Globe className="w-3 h-3" />
                                  NIST NVD — CVE Database
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            </div>

                            {/* Banner (if captured during exploit intel probe) */}
                            {(p.httpServer || p.banner) && (
                              <div className="border border-yellow-500/20 rounded px-2 py-2 bg-yellow-500/5">
                                <div className="text-[9px] text-yellow-400/60 uppercase mb-1">Service Banner</div>
                                {p.httpServer && (
                                  <div className="text-yellow-300/80 text-[11px] font-semibold">{p.httpServer}</div>
                                )}
                                {p.httpPoweredBy && (
                                  <div className="text-yellow-300/50 text-[10px]">X-Powered-By: {p.httpPoweredBy}</div>
                                )}
                                {p.httpStatus && (
                                  <div className="text-primary/40 text-[10px]">HTTP {p.httpStatus}</div>
                                )}
                                {!p.httpServer && p.banner && (
                                  <div className="text-yellow-300/80 text-[10px] font-mono">{p.banner.split("\n")[0]}</div>
                                )}
                              </div>
                            )}

                            {/* Quick actions */}
                            <div className="flex flex-wrap gap-2">
                              {[80, 443, 8080, 8443, 8880, 8888].includes(p.port) && (
                                <button
                                  onClick={() => { setSqlTarget(`http${p.port === 443 || p.port === 8443 ? "s" : ""}://${ip}:${p.port}/`); setTab("sqlmap"); }}
                                  className="flex items-center gap-1.5 text-[10px] border border-red-500/30 text-red-400/70 px-2.5 py-1.5 rounded hover:border-red-500 hover:text-red-400 transition-colors">
                                  <Syringe className="w-3 h-3" />
                                  Launch SQLmap against port {p.port}
                                </button>
                              )}
                              <button
                                onClick={() => { setBannerPorts(String(p.port)); setTab("banner"); }}
                                className="flex items-center gap-1.5 text-[10px] border border-yellow-500/30 text-yellow-400/70 px-2.5 py-1.5 rounded hover:border-yellow-500 hover:text-yellow-400 transition-colors">
                                <Server className="w-3 h-3" />
                                Grab Banner from :{p.port}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-primary/40 border border-primary/10 rounded px-3 py-4">
                    <CheckCircle2 className="w-4 h-4 text-primary/30" />
                    No open ports found on common attack-surface ports.
                  </div>
                )}
              </>
            )}

            {!intelResult && !intelLoading && !intelError && (
              <button onClick={runExploitIntel}
                className="flex items-center gap-2 px-4 py-2 border border-red-500/40 text-red-400 uppercase hover:bg-red-500/10 hover:border-red-500 transition-colors rounded">
                <Zap className="w-3.5 h-3.5" /> Run Exploit Intelligence — {ip}
              </button>
            )}
          </div>
        )}

        {/* ── BANNER GRAB ──────────────────────────────────────────── */}
        {tab === "banner" && (
          <div className="space-y-4">
            <div className="text-[10px] text-yellow-400/50 border border-yellow-500/15 rounded px-3 py-2 bg-yellow-500/5">
              Connects to <span className="text-yellow-400">{ip}</span> and reads raw service banners — HTTP Server headers, SSH version strings, FTP/SMTP 220 banners. Identifies <span className="text-yellow-400">exact software versions</span> for targeted exploits.
            </div>

            <div>
              <label className="text-[10px] text-primary/50 uppercase block mb-1">Ports to Banner-Grab (comma-separated)</label>
              <input value={bannerPorts} onChange={e => setBannerPorts(e.target.value)}
                className="w-full bg-black border border-yellow-500/25 text-yellow-300 text-xs px-2 py-1.5 focus:outline-none focus:border-yellow-500/60 rounded font-mono"
                placeholder="80,443,22,21,8880..." />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { label: "Web Ports",    ports: "80,443,8080,8443,8880,8888,3000" },
                { label: "Shell Ports",  ports: "22,23,2222,3389" },
                { label: "DB Ports",     ports: "3306,5432,27017,6379,9200,1433" },
                { label: "Mail Ports",   ports: "25,110,143,465,587,993,995" },
                { label: "Common All",   ports: "21,22,23,25,80,110,143,443,445,993,3306,3389,5432,6379,8080,8443,8880,8888,9200,27017" },
                { label: "Custom POI",   ports: "8880,8080,4444,4899,9090,7070,10000" },
              ].map(({ label, ports }) => (
                <button key={label} onClick={() => setBannerPorts(ports)}
                  className="px-2 py-1 border border-yellow-500/20 text-yellow-400/60 text-[10px] hover:border-yellow-500/50 hover:text-yellow-400 transition-colors rounded">
                  {label}
                </button>
              ))}
            </div>

            <button onClick={runBannerGrab} disabled={bannerLoading}
              className="flex items-center gap-2 px-4 py-2 border border-yellow-500/50 text-yellow-400 text-xs uppercase hover:bg-yellow-500/10 hover:border-yellow-500 transition-colors disabled:opacity-40 rounded">
              {bannerLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
              {bannerLoading ? `Grabbing banners from ${ip}…` : `Grab All Banners — ${ip}`}
            </button>

            {bannerError && (
              <div className="text-red-400 border border-red-500/20 rounded px-3 py-2 text-[10px]">Error: {bannerError}</div>
            )}

            {bannerResult && (
              <div className="space-y-3">
                {/* Summary */}
                <div className="flex items-center gap-4 border border-yellow-500/20 rounded px-3 py-2 bg-yellow-500/5">
                  <div>
                    <div className="text-yellow-400 font-bold text-sm">{bannerResult.bannerCount} Open Service{bannerResult.bannerCount !== 1 ? "s" : ""}</div>
                    <div className="text-[10px] text-primary/40">{bannerResult.results.length} ports probed · {bannerResult.durationMs}ms</div>
                  </div>
                  <button onClick={runBannerGrab} disabled={bannerLoading}
                    className="ml-auto text-[10px] border border-yellow-500/20 px-2 py-1 rounded hover:border-yellow-500/50 text-yellow-400/50 hover:text-yellow-400 transition-colors">
                    Re-Grab
                  </button>
                </div>

                {/* Open service banners */}
                {bannerResult.openBanners.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[10px] text-primary/30 uppercase tracking-widest">Open Services — Click to expand raw response</div>
                    {bannerResult.openBanners.map(b => (
                      <div key={b.port} className="border border-yellow-500/25 rounded overflow-hidden">
                        {/* Header row */}
                        <div className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-yellow-500/5 transition-colors"
                          onClick={() => setExpandedBanner(expandedBanner === b.port ? null : b.port)}>
                          <span className="font-bold w-14 shrink-0 text-yellow-400">:{b.port}</span>
                          <span className="text-primary font-semibold w-28 shrink-0 text-[11px]">{b.service}</span>
                          <span className="text-yellow-300/80 flex-1 truncate font-mono text-[11px]">
                            {b.httpServer ?? (b.banner?.split("\n")[0] ?? "open")}
                          </span>
                          {b.httpStatus && (
                            <span className={`text-[9px] border px-1.5 py-0.5 rounded shrink-0 ${b.httpStatus < 400 ? "border-primary/30 text-primary/60" : "border-red-500/40 text-red-400/70"}`}>
                              HTTP {b.httpStatus}
                            </span>
                          )}
                          {expandedBanner === b.port ? <ChevronUp className="w-3 h-3 text-primary/30 shrink-0" /> : <ChevronDown className="w-3 h-3 text-primary/30 shrink-0" />}
                        </div>

                        {/* Expanded raw banner */}
                        {expandedBanner === b.port && (
                          <div className="border-t border-yellow-500/15 p-3 bg-black space-y-3">
                            {/* Parsed fields */}
                            <div className="grid grid-cols-2 gap-2">
                              {b.httpServer && (
                                <div className="border border-yellow-500/20 rounded px-2 py-1.5">
                                  <div className="text-[9px] text-yellow-400/50 uppercase mb-0.5">Server</div>
                                  <div className="text-yellow-300 text-[11px] font-semibold font-mono">{b.httpServer}</div>
                                </div>
                              )}
                              {b.httpPoweredBy && (
                                <div className="border border-orange-500/20 rounded px-2 py-1.5">
                                  <div className="text-[9px] text-orange-400/50 uppercase mb-0.5">X-Powered-By</div>
                                  <div className="text-orange-300 text-[11px] font-semibold font-mono">{b.httpPoweredBy}</div>
                                </div>
                              )}
                            </div>

                            {/* Raw headers / banner */}
                            {b.rawHeaders && (
                              <div>
                                <div className="text-[9px] text-primary/30 uppercase mb-1.5">Raw Response</div>
                                <pre className="text-[10px] text-primary/60 bg-[#050505] border border-primary/10 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-48">{b.rawHeaders}</pre>
                              </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex flex-wrap gap-2 pt-1">
                              {[80, 443, 8080, 8443, 8880, 8888, 3000].includes(b.port) && (
                                <button
                                  onClick={() => { setSqlTarget(`http${b.port === 443 || b.port === 8443 ? "s" : ""}://${ip}:${b.port}/`); setTab("sqlmap"); }}
                                  className="flex items-center gap-1.5 text-[10px] border border-red-500/30 text-red-400/70 px-2.5 py-1.5 rounded hover:border-red-500 hover:text-red-400 transition-colors">
                                  <Syringe className="w-3 h-3" /> SQLmap :{b.port}
                                </button>
                              )}
                              <a href={`/terminal?cmd=curl+-v+http://${ip}:${b.port}/`} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-[10px] border border-primary/20 text-primary/50 px-2.5 py-1.5 rounded hover:border-primary/50 hover:text-primary transition-colors">
                                <TerminalSquare className="w-3 h-3" /> curl :{b.port}
                              </a>
                              <a href={`/terminal?cmd=nmap+-sV+-p+${b.port}+${ip}`} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-[10px] border border-primary/20 text-primary/50 px-2.5 py-1.5 rounded hover:border-primary/50 hover:text-primary transition-colors">
                                <Search className="w-3 h-3" /> nmap :{b.port}
                              </a>
                              {b.port === 22 && (
                                <a href={`/terminal?cmd=ssh+root@${ip}`} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-[10px] border border-primary/20 text-primary/50 px-2.5 py-1.5 rounded hover:border-primary/50 hover:text-primary transition-colors">
                                  <Wifi className="w-3 h-3" /> SSH :{b.port}
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-primary/40 border border-primary/10 rounded px-3 py-4 text-[11px]">
                    <CheckCircle2 className="w-4 h-4 text-primary/30" />
                    No open ports returned banners on the specified port list.
                  </div>
                )}

                {/* Closed ports — collapsed list */}
                {bannerResult.results.filter(r => !r.open).length > 0 && (
                  <details className="text-[10px] text-primary/30">
                    <summary className="cursor-pointer hover:text-primary/50 transition-colors py-1">
                      {bannerResult.results.filter(r => !r.open).length} closed / filtered ports
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {bannerResult.results.filter(r => !r.open).map(r => (
                        <span key={r.port} className="border border-primary/10 px-1.5 py-0.5 rounded text-primary/25 font-mono">{r.port}</span>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {!bannerResult && !bannerLoading && !bannerError && (
              <div className="text-[10px] text-primary/30 border border-primary/10 rounded px-3 py-4 bg-primary/5">
                <div className="font-semibold text-primary/50 mb-1">What Banner Grabbing reveals:</div>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li>Exact web server version — <span className="text-yellow-400/70">Apache/2.4.51</span>, <span className="text-yellow-400/70">nginx/1.18.0</span>, etc.</li>
                  <li>SSH version — OpenSSH, Dropbear, Bitvise</li>
                  <li>FTP/SMTP server software and version</li>
                  <li>X-Powered-By headers — PHP version, framework</li>
                  <li>Custom response headers leaking infrastructure info</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── PORT SCAN ────────────────────────────────────────────── */}
        {tab === "portscan" && (
          <div className="space-y-4">
            <div className="text-[10px] text-primary/40 border border-primary/10 rounded px-3 py-2 bg-primary/5">
              Runs <span className="text-primary">nmap</span> against <span className="text-primary">{ip}</span> to discover open ports, services, and software versions.
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] text-primary/50 uppercase block mb-1">Port Range</label>
                <input value={scanPorts} onChange={e => setScanPorts(e.target.value)}
                  className="w-full bg-black border border-primary/20 text-primary text-xs px-2 py-1.5 focus:outline-none focus:border-primary/50 rounded" placeholder="1-65535" />
              </div>
              <div>
                <label className="text-[10px] text-primary/50 uppercase block mb-1">Nmap Flags</label>
                <input value={scanFlags} onChange={e => setScanFlags(e.target.value)}
                  className="w-full bg-black border border-primary/20 text-primary text-xs px-2 py-1.5 focus:outline-none focus:border-primary/50 rounded" placeholder="-sV -T4" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Fast Top 1000",  flags: "-F -T4" },
                { label: "Service Detect", flags: "-sV -T4 -p 1-10000" },
                { label: "OS Detect",      flags: "-O -sV -T4" },
                { label: "Full Scan",      flags: "-sV -O -T4 -p 1-65535" },
                { label: "UDP Top 100",    flags: "-sU --top-ports 100" },
                { label: "Stealth SYN",    flags: "-sS -T2 -p 1-10000" },
              ].map(({ label, flags }) => (
                <button key={label} onClick={() => setScanFlags(flags)}
                  className="px-2 py-1 border border-primary/20 text-primary/60 text-[10px] hover:border-primary/50 hover:text-primary transition-colors rounded">
                  {label}
                </button>
              ))}
            </div>
            <button onClick={runPortScan} disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 border border-primary/40 text-primary text-xs uppercase hover:bg-primary/10 hover:border-primary transition-colors disabled:opacity-40 rounded">
              {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              {scanning ? `Scanning ${ip}…` : `Run Port Scan — ${ip}`}
            </button>
            {scanCmd && <div className="text-[10px] text-primary/30 bg-black border border-primary/10 px-2 py-1.5 rounded">$ {scanCmd}</div>}
            {scanOutput && <div className="bg-black border border-primary/15 p-3 text-[11px] text-primary/75 max-h-96 overflow-auto whitespace-pre-wrap rounded">{scanOutput}</div>}
          </div>
        )}

        {/* ── SQLMAP ───────────────────────────────────────────────── */}
        {tab === "sqlmap" && (
          <div className="space-y-4">
            <div className="text-[10px] text-red-400/50 border border-red-500/15 rounded px-3 py-2 bg-red-500/5">
              Runs <span className="text-red-400">SQLmap</span> against <span className="text-red-400">{ip}</span>. For educational / authorized security testing purposes only.
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-primary/50 uppercase block mb-1">Target URL</label>
                <input value={sqlTarget} onChange={e => setSqlTarget(e.target.value)}
                  className="w-full bg-black border border-red-500/25 text-red-300 text-xs px-2 py-1.5 focus:outline-none focus:border-red-500/60 rounded" placeholder={`http://${ip}/`} />
              </div>
              <div>
                <label className="text-[10px] text-primary/50 uppercase block mb-1">SQLmap Flags</label>
                <input value={sqlFlags} onChange={e => setSqlFlags(e.target.value)}
                  className="w-full bg-black border border-red-500/25 text-red-300 text-xs px-2 py-1.5 focus:outline-none focus:border-red-500/60 rounded" placeholder="--dbs --forms --tables -D dbname" />
              </div>
            </div>
            <div>
              <div className="text-[10px] text-primary/40 uppercase mb-2">Quick Presets</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Enumerate DBs",  flags: "--dbs",                                       desc: "List all databases" },
                  { label: "Dump Tables",    flags: "--tables --dbs",                               desc: "List all tables" },
                  { label: "Blind SQLi",     flags: "--technique=B --level=3 --risk=2",             desc: "Boolean-based blind" },
                  { label: "Time-Based",     flags: "--technique=T --level=3",                      desc: "Time-delay blind" },
                  { label: "Error-Based",    flags: "--technique=E --dbs",                          desc: "Error extraction" },
                  { label: "Full Dump",      flags: "--level=5 --risk=3 --dbs --tables --dump-all", desc: "Maximum extraction" },
                  { label: "Get Users",      flags: "--users --passwords",                          desc: "Extract DB credentials" },
                  { label: "OS Shell",       flags: "--os-shell",                                   desc: "Attempt OS command shell" },
                ].map(({ label, flags, desc }) => (
                  <button key={label} onClick={() => setSqlFlags(flags)}
                    className="flex flex-col items-start px-2.5 py-2 border border-red-500/20 text-left hover:border-red-500/50 hover:bg-red-500/5 transition-colors rounded">
                    <span className="text-red-400/80 text-[10px] font-semibold">{label}</span>
                    <span className="text-primary/30 text-[9px]">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={runSqlmap} disabled={sqlRunning}
                className="flex items-center gap-2 px-4 py-2 border border-red-500/50 text-red-400 text-xs uppercase hover:bg-red-500/10 hover:border-red-500 transition-colors disabled:opacity-40 rounded">
                {sqlRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Syringe className="w-3.5 h-3.5" />}
                {sqlRunning ? `Running on ${ip}…` : `Launch SQLmap — ${ip}`}
              </button>
              <span className={`text-[10px] uppercase border px-1.5 py-0.5 rounded border-current ${sqlStatusColor[sqlStatus] ?? "text-primary/40"}`}>
                {sqlStatus}
              </span>
              {sqlJobId && <span className="text-[10px] text-primary/30">JOB:{sqlJobId}</span>}
            </div>
            {sqlOutput && (
              <div className="bg-black border border-red-500/15 p-3 text-[11px] text-red-300/75 max-h-96 overflow-auto whitespace-pre-wrap rounded">{sqlOutput}</div>
            )}
            {sqlStatus === "running" && !sqlOutput && (
              <div className="flex items-center gap-2 text-yellow-400 text-xs border border-yellow-500/20 rounded px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                SQLmap scanning {ip} — polling every 4s…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Slide-in drawer wrapper ────────────────────────────────────────────────
export function AttackerIntelDrawer({
  ip,
  onClose,
  initialTab = "exploit",
}: {
  ip: string | null;
  onClose: () => void;
  initialTab?: IntelTab;
}) {
  if (!ip) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-stretch pointer-events-none">
      {/* Backdrop */}
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      {/* Panel */}
      <div
        className="w-full max-w-xl border-l border-red-500/20 bg-black pointer-events-auto flex flex-col"
        style={{ boxShadow: "-8px 0 40px rgba(255,34,68,0.08)" }}
      >
        <AttackerIntelPanel ip={ip} onClose={onClose} initialTab={initialTab} />
      </div>
    </div>
  );
}

// ── Inline dropdown (for table rows) ──────────────────────────────────────
export function AttackerIntelInline({
  ip,
  onClose,
}: {
  ip: string;
  onClose: () => void;
}) {
  return (
    <div className="border border-red-500/20 rounded bg-black" style={{ boxShadow: "0 8px 32px rgba(255,34,68,0.10)" }}>
      <div className="max-h-[600px] overflow-hidden flex flex-col">
        <AttackerIntelPanel ip={ip} onClose={onClose} initialTab="exploit" />
      </div>
    </div>
  );
}

// ── IP badge with Intel trigger ───────────────────────────────────────────
export function AttackerIpBadge({ ip, label }: { ip: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-red-400 hover:text-red-300 font-mono text-xs underline underline-offset-2 decoration-red-500/40 transition-colors"
        title="Click for Attacker Intelligence"
      >
        {label ?? ip}
        <TerminalSquare className="w-3 h-3 text-red-500/50" />
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-50 w-[580px]">
          <AttackerIntelInline ip={ip} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
