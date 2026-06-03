// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Red Team Pattern Scanner — modern web security checks derived from Win32 RAT technique analysis
// Technique sources: Keylog.bas, Password.bas, Crypt.bas, CLIENT.BAS, Firewall.bas,
//                   Global.bas, disablectlaltdel.bas, Monitor.bas (Twizted v1.0)

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Target, Shield, ShieldAlert, ShieldCheck, AlertTriangle, Info,
  ChevronDown, ChevronRight, Loader2, Search, Copy, Download,
  CheckCircle, XCircle, Eye, Code2, Lock, Fingerprint,
  Zap, Globe, Server, Key, Monitor, Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}/api${path}`, {
    credentials: "include", ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = "critical" | "high" | "medium" | "low" | "info";

interface Finding {
  technique: string;
  module: string;
  title: string;
  description: string;
  severity: Severity;
  evidence?: string;
  recommendation: string;
}

interface ScanResult {
  ok: boolean;
  url: string;
  redirectUrl?: string;
  status: number;
  scanTime: string;
  score: number;
  counts: Record<Severity, number>;
  modulesRun: string | string[];
  findings: Finding[];
  headers: Record<string, string | null>;
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODULES = [
  { id: "keylogger",   label: "Keylogger Detection",       icon: <Key className="w-3 h-3" />,         color: "#ff4d4d", bas: "Keylog.bas",           desc: "CSP, key listeners, clipboard API, formjacking" },
  { id: "credentials", label: "Credential Exposure",       icon: <Lock className="w-3 h-3" />,         color: "#ff8c00", bas: "Password.bas",         desc: "Cookie flags, tokens in URLs/body, Basic Auth" },
  { id: "crypto",      label: "Weak Crypto Detection",     icon: <Shield className="w-3 h-3" />,       color: "#ffd700", bas: "Crypt.bas",            desc: "HSTS, XOR obfuscation, MD5/SHA1, base64 blobs" },
  { id: "c2",          label: "C2 Beacon Patterns",        icon: <Wifi className="w-3 h-3" />,         color: "#ff4dff", bas: "CLIENT.BAS",           desc: "eval(atob()), setInterval beacons, rogue WebSockets" },
  { id: "disclosure",  label: "Information Disclosure",    icon: <Eye className="w-3 h-3" />,          color: "#00bfff", bas: "Global.bas",           desc: "Stack traces, server banners, debug mode, dir listing" },
  { id: "ui",          label: "UI / Clickjacking",         icon: <Monitor className="w-3 h-3" />,      color: "#00ff88", bas: "disablectlaltdel.bas", desc: "X-Frame-Options, nosniff, Referrer-Policy, Permissions" },
  { id: "tracking",    label: "Fingerprinting & Tracking", icon: <Fingerprint className="w-3 h-3" />,  color: "#7b68ee", bas: "Monitor.bas",          desc: "Canvas fingerprinting, navigator enumeration, tracker SDKs" },
  { id: "waf",         label: "WAF Fingerprint",           icon: <Globe className="w-3 h-3" />,        color: "#20b2aa", bas: "Firewall.bas",         desc: "WAF vendor detection, bypass probe, block testing" },
] as const;

type ModuleId = typeof MODULES[number]["id"];

const SEV_CONFIG: Record<Severity, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  critical: { label: "Critical", color: "#ff2d2d", bg: "rgba(255,45,45,0.08)",    icon: <XCircle className="w-3.5 h-3.5" /> },
  high:     { label: "High",     color: "#ff8c00", bg: "rgba(255,140,0,0.08)",    icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  medium:   { label: "Medium",   color: "#ffd700", bg: "rgba(255,215,0,0.08)",    icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  low:      { label: "Low",      color: "#00bfff", bg: "rgba(0,191,255,0.08)",    icon: <Info className="w-3.5 h-3.5" /> },
  info:     { label: "Info",     color: "#888",    bg: "rgba(136,136,136,0.06)",  icon: <Info className="w-3.5 h-3.5" /> },
};

// ─── UI Components ────────────────────────────────────────────────────────────

function SeverityBadge({ sev }: { sev: Severity }) {
  const c = SEV_CONFIG[sev];
  return (
    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm" style={{ color: c.color, border: `1px solid ${c.color}40`, background: c.bg }}>
      {c.label}
    </span>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? "#00ff88" : score >= 60 ? "#ffd700" : score >= 40 ? "#ff8c00" : "#ff2d2d";
  const label = score >= 80 ? "Good" : score >= 60 ? "Fair" : score >= 40 ? "Poor" : "Critical";
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="text-center -mt-16">
        <div className="text-2xl font-bold font-mono" style={{ color }}>{score}</div>
        <div className="text-[9px] uppercase tracking-widest" style={{ color }}>{label}</div>
      </div>
    </div>
  );
}

function HeaderGrid({ headers }: { headers: Record<string, string | null> }) {
  const items = [
    { key: "csp",    label: "CSP",             good: !!headers.csp },
    { key: "hsts",   label: "HSTS",            good: !!headers.hsts },
    { key: "xfo",    label: "X-Frame-Options", good: !!headers.xfo },
    { key: "xcto",   label: "X-Content-Type",  good: !!headers.xcto },
    { key: "cors",   label: "CORS",            good: !headers.cors || headers.cors !== "*" },
    { key: "xpb",    label: "X-Powered-By",    good: !headers.xpb },
    { key: "server", label: "Server Banner",   good: !headers.server || /^(nginx|apache|caddy|cloudflare)$/i.test(headers.server ?? "") },
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {items.map(({ key, label, good }) => (
        <div key={key} className="flex items-center justify-between px-2 py-1.5 border border-primary/10 rounded-sm">
          <span className="text-[10px] text-primary/50">{label}</span>
          <div className="flex items-center gap-1">
            {good
              ? <CheckCircle className="w-3 h-3 text-[#00ff88]" />
              : <XCircle className="w-3 h-3 text-red-400" />}
            <span className="text-[9px] font-mono text-primary/30 max-w-[80px] truncate" title={headers[key] ?? "—"}>
              {headers[key] ? headers[key]!.substring(0, 20) : "—"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FindingCard({ f }: { f: Finding }) {
  const [open, setOpen] = useState(false);
  const c = SEV_CONFIG[f.severity];
  return (
    <div className="border rounded-sm overflow-hidden" style={{ borderColor: `${c.color}30` }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:opacity-90 transition-opacity" style={{ background: c.bg }}>
        <span className="mt-0.5 shrink-0" style={{ color: c.color }}>{c.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-primary/90">{f.title}</span>
            <SeverityBadge sev={f.severity} />
            <span className="text-[9px] text-primary/25 font-mono ml-auto shrink-0">{f.module}</span>
          </div>
          <div className="text-[9px] text-primary/30 mt-0.5 font-mono truncate">{f.technique}</div>
        </div>
        {open ? <ChevronDown className="w-3 h-3 text-primary/30 mt-1 shrink-0" /> : <ChevronRight className="w-3 h-3 text-primary/30 mt-1 shrink-0" />}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 space-y-2 border-t" style={{ borderColor: `${c.color}20` }}>
          <p className="text-[11px] text-primary/70 leading-relaxed">{f.description}</p>
          {f.evidence && (
            <div className="flex items-start gap-2">
              <span className="text-[9px] font-bold uppercase text-primary/25 mt-0.5 shrink-0">Evidence</span>
              <code className="text-[10px] text-orange-400/70 break-all font-mono leading-relaxed">{f.evidence}</code>
            </div>
          )}
          <div className="flex items-start gap-2 p-2 bg-[#00ff88]/5 border border-[#00ff88]/15 rounded-sm">
            <ShieldCheck className="w-3 h-3 text-[#00ff88]/60 mt-0.5 shrink-0" />
            <p className="text-[10px] text-[#00ff88]/70 leading-relaxed">{f.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RedTeamScan() {
  const [url, setUrl] = useState("");
  const [selectedMods, setSelectedMods] = useState<Set<ModuleId>>(new Set(MODULES.map(m => m.id)));
  const [result, setResult] = useState<ScanResult | null>(null);
  const [activeSev, setActiveSev] = useState<Severity | "all">("all");

  const toggleMod = (id: ModuleId) => {
    setSelectedMods(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const scanMut = useMutation({
    mutationFn: () => apiFetch("/redteam-scan/scan", {
      method: "POST",
      body: JSON.stringify({
        url: url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`,
        modules: selectedMods.size === MODULES.length ? [] : Array.from(selectedMods),
      }),
    }),
    onSuccess: (d: any) => setResult(d),
    onError: (e: Error) => setResult({ ok: false, url, status: 0, scanTime: new Date().toISOString(), score: 0, counts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }, modulesRun: [], findings: [], headers: {}, error: e.message }),
  });

  const filtered = result?.findings.filter(f => activeSev === "all" || f.severity === activeSev) ?? [];

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `redteam-scan-${Date.now()}.json`; a.click();
  };

  return (
    <div className="min-h-screen bg-black text-primary p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <Target className="w-5 h-5 text-red-400" />
          <h1 className="text-lg font-bold tracking-tight">Red Team Pattern Scanner</h1>
          <span className="text-[9px] border border-red-500/20 text-red-400/40 px-1.5 py-0.5 rounded uppercase tracking-widest">Dev Tool</span>
        </div>
        <p className="text-[10px] text-primary/30 leading-relaxed max-w-2xl">
          Security scanner for developers — detects 8 attack pattern classes derived from Win32 RAT technique analysis.
          Tests your app against keylogger injection, credential exposure, C2 beaconing, clickjacking, and more.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_260px] gap-5">
        {/* Left: Scanner */}
        <div className="space-y-4">

          {/* URL Input */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/20" />
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && url && !scanMut.isPending && scanMut.mutate()}
                  placeholder="https://yourdomain.com"
                  className="w-full bg-black/40 border border-primary/20 text-primary text-sm font-mono pl-8 pr-3 py-2 focus:outline-none focus:border-red-400/40 placeholder:text-primary/15 rounded-sm"
                />
              </div>
              <Button
                onClick={() => scanMut.mutate()}
                disabled={!url.trim() || scanMut.isPending}
                className="bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 text-xs px-5 h-10 rounded-sm"
              >
                {scanMut.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />Scanning...</> : <><Search className="w-3.5 h-3.5 mr-2" />Scan</>}
              </Button>
            </div>

            {/* Module selector */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
              {MODULES.map(m => {
                const active = selectedMods.has(m.id);
                return (
                  <button key={m.id} onClick={() => toggleMod(m.id)}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-[9px] font-semibold rounded-sm border transition-all text-left"
                    style={active ? { borderColor: `${m.color}40`, background: `${m.color}10`, color: m.color } : { borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.2)" }}>
                    <span style={{ color: active ? m.color : "rgba(255,255,255,0.15)" }}>{m.icon}</span>
                    <span className="leading-tight">{m.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 text-[9px]">
              <button onClick={() => setSelectedMods(new Set(MODULES.map(m => m.id)))} className="text-primary/25 hover:text-primary/50 transition-colors">Select All</button>
              <span className="text-primary/10">·</span>
              <button onClick={() => setSelectedMods(new Set())} className="text-primary/25 hover:text-primary/50 transition-colors">Clear</button>
              <span className="text-primary/15 ml-auto">{selectedMods.size}/{MODULES.length} modules active</span>
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="border border-primary/10 rounded-sm p-4">
                <div className="flex items-start gap-6 flex-wrap">
                  <ScoreGauge score={result.score} />
                  <div className="flex-1 space-y-3 min-w-0">
                    <div>
                      <div className="text-[9px] text-primary/25 uppercase tracking-widest mb-1">Target</div>
                      <div className="text-xs font-mono text-primary/60 break-all">{result.url}</div>
                      {result.redirectUrl && <div className="text-[9px] text-primary/25 mt-0.5">→ {result.redirectUrl}</div>}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[9px] text-primary/30">HTTP {result.status}</span>
                        <span className="text-[9px] text-primary/20">{new Date(result.scanTime).toLocaleString()}</span>
                      </div>
                    </div>
                    {/* Severity counts */}
                    <div className="flex flex-wrap gap-2">
                      {(["critical", "high", "medium", "low", "info"] as Severity[]).map(s => (
                        <button key={s} onClick={() => setActiveSev(prev => prev === s ? "all" : s)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-sm border text-[10px] font-bold transition-all ${activeSev === s ? "opacity-100" : "opacity-50 hover:opacity-75"}`}
                          style={{ borderColor: `${SEV_CONFIG[s].color}40`, color: SEV_CONFIG[s].color, background: activeSev === s ? SEV_CONFIG[s].bg : "transparent" }}>
                          <span>{SEV_CONFIG[s].icon}</span>
                          <span>{result.counts[s]}</span>
                          <span className="font-normal text-[9px]">{SEV_CONFIG[s].label}</span>
                        </button>
                      ))}
                      <button onClick={() => setActiveSev("all")} className={`px-2 py-1 rounded-sm border text-[9px] border-primary/15 text-primary/30 transition-all ${activeSev === "all" ? "bg-primary/5" : ""}`}>
                        All ({result.findings.length})
                      </button>
                      <button onClick={exportJson} className="ml-auto flex items-center gap-1 text-[9px] text-primary/25 hover:text-primary/50 px-2 border border-primary/10 rounded-sm">
                        <Download className="w-3 h-3" />JSON
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {result.error && (
                <div className="border border-red-500/20 bg-red-500/5 rounded-sm p-3 text-[11px] text-red-400">{result.error}</div>
              )}

              {/* Header Security Grid */}
              {Object.keys(result.headers).length > 0 && (
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-primary/25 mb-2">Security Headers</div>
                  <HeaderGrid headers={result.headers} />
                </div>
              )}

              {/* Findings */}
              {filtered.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-primary/25 mb-2">
                    {activeSev === "all" ? `All Findings (${filtered.length})` : `${SEV_CONFIG[activeSev].label} Findings (${filtered.length})`}
                  </div>
                  {filtered.map((f, i) => <FindingCard key={i} f={f} />)}
                </div>
              ) : (
                result.findings.length > 0 && (
                  <div className="text-center text-primary/20 text-xs py-8">No findings match selected severity filter</div>
                )
              )}

              {result.findings.length === 0 && result.ok && (
                <div className="text-center py-10 border border-[#00ff88]/10 rounded-sm">
                  <ShieldCheck className="w-8 h-8 text-[#00ff88]/30 mx-auto mb-2" />
                  <div className="text-sm text-[#00ff88]/50">No issues detected</div>
                  <div className="text-[10px] text-primary/20 mt-1">Score: {result.score}/100 — excellent security posture</div>
                </div>
              )}
            </div>
          )}

          {!result && !scanMut.isPending && (
            <div className="border border-primary/8 rounded-sm p-8 text-center">
              <Target className="w-10 h-10 text-red-400/15 mx-auto mb-3" />
              <div className="text-xs text-primary/20">Enter a URL and click Scan</div>
              <div className="text-[9px] text-primary/15 mt-1">Checks {MODULES.length} attack pattern classes · No installation required</div>
            </div>
          )}
        </div>

        {/* Right: Technique Reference */}
        <div className="space-y-3">
          <div className="border border-primary/10 rounded-sm">
            <div className="px-3 py-2 border-b border-primary/10">
              <div className="text-[9px] font-bold uppercase tracking-widest text-primary/25">VB6 → Modern Mapping</div>
              <div className="text-[8px] text-primary/15 mt-0.5">Technique sources: Twizted v1.0 RAT</div>
            </div>
            <div className="p-2 space-y-1.5">
              {MODULES.map(m => (
                <div key={m.id} className="p-2 rounded-sm border border-primary/8 hover:border-primary/15 transition-colors">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span style={{ color: m.color }}>{m.icon}</span>
                    <span className="text-[9px] font-bold font-mono" style={{ color: m.color }}>{m.bas}</span>
                  </div>
                  <div className="text-[9px] text-primary/50 leading-tight">{m.label}</div>
                  <div className="text-[8px] text-primary/25 leading-tight mt-0.5">{m.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Scoring guide */}
          <div className="border border-primary/10 rounded-sm p-3">
            <div className="text-[9px] font-bold uppercase tracking-widest text-primary/25 mb-2">Score Guide</div>
            <div className="space-y-1">
              {[
                { range: "80–100", label: "Good",     color: "#00ff88", note: "Production-ready" },
                { range: "60–79",  label: "Fair",     color: "#ffd700", note: "Address highs first" },
                { range: "40–59",  label: "Poor",     color: "#ff8c00", note: "Significant risk" },
                { range: "0–39",   label: "Critical", color: "#ff2d2d", note: "Fix before launch" },
              ].map(({ range, label, color, note }) => (
                <div key={range} className="flex items-center gap-2 text-[9px]">
                  <span className="font-mono w-14 shrink-0" style={{ color }}>{range}</span>
                  <span className="font-bold" style={{ color }}>{label}</span>
                  <span className="text-primary/20">— {note}</span>
                </div>
              ))}
            </div>
            <div className="text-[8px] text-primary/15 mt-2 leading-relaxed border-t border-primary/8 pt-2">
              Deduction: Critical −20 · High −10 · Medium −5 · Low −2
            </div>
          </div>

          {/* Disclaimer */}
          <div className="text-[8px] text-primary/15 leading-relaxed p-2 border border-primary/8 rounded-sm">
            For authorized security testing only. Only scan domains you own or have written permission to test. All requests originate from the ProxhqVPN API server.
          </div>
        </div>
      </div>
    </div>
  );
}
