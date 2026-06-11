// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Deception Engine Dashboard — ADMIN / EMPLOYEE ONLY.
// Regular subscribers cannot see this page at all (AdminGate blocks them).
// Shows attacker fingerprints, honeypot hit stats, fake banner management.

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Shield, RefreshCw, Loader2, AlertTriangle, Eye,
  Copy, Trash2, CheckCheck, ExternalLink, ChevronDown,
  ChevronRight, Globe, Server, Wifi, Lock, Ban,
  Activity, Terminal, Filter, Plus, X, Edit2,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function copyText(t: string, setCopied: (v: boolean) => void) {
  navigator.clipboard.writeText(t);
  setCopied(true);
  setTimeout(() => setCopied(false), 1400);
}

const SCORE_COLOR = (s: number) =>
  s >= 80 ? "text-red-400 bg-red-900/20 border-red-500/30" :
  s >= 50 ? "text-orange-400 bg-orange-900/20 border-orange-500/30" :
  s >= 25 ? "text-yellow-400 bg-yellow-900/20 border-yellow-500/30" :
            "text-white/40 bg-white/5 border-white/10";

const SVC_ICON: Record<string, React.ReactNode> = {
  http:    <Globe   className="w-3.5 h-3.5" />,
  ssh:     <Terminal className="w-3.5 h-3.5" />,
  ftp:     <Server  className="w-3.5 h-3.5" />,
  smtp:    <Server  className="w-3.5 h-3.5" />,
  telnet:  <Terminal className="w-3.5 h-3.5" />,
  rdp:     <Wifi   className="w-3.5 h-3.5" />,
  canary:  <Eye     className="w-3.5 h-3.5" />,
  generic: <Shield  className="w-3.5 h-3.5" />,
};

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 px-4 py-3">
      <div className="text-xs text-white/30 mb-0.5">{label}</div>
      <div className="text-2xl font-bold text-white font-mono">{value}</div>
      {sub && <div className="text-xs text-white/20 mt-0.5">{sub}</div>}
    </div>
  );
}

function EventRow({ evt, onSelect }: { evt: any; onSelect: (e: any) => void }) {
  const [copied, setCopied] = useState(false);
  const tags: string[] = (() => { try { return JSON.parse(evt.scanPatterns ?? "[]"); } catch { return []; } })();

  return (
    <tr className="border-b border-white/5 hover:bg-white/3 transition-colors cursor-pointer text-xs"
      onClick={() => onSelect(evt)}>
      <td className="py-2 px-3 font-mono text-white/40">{evt.id}</td>
      <td className="py-2 px-3">
        <div className="flex items-center gap-1.5">
          <button onClick={e => { e.stopPropagation(); copyText(evt.attackerIp, setCopied); }}
            className="text-green-400 font-mono hover:text-green-300 flex items-center gap-1">
            {evt.attackerIp}
            {copied ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3 opacity-50" />}
          </button>
        </div>
      </td>
      <td className="py-2 px-3">
        <div className="flex items-center gap-1 text-white/50">
          {SVC_ICON[evt.honeypotService] ?? <Shield className="w-3.5 h-3.5" />}
          <span className="uppercase font-mono">{evt.honeypotService}</span>
        </div>
      </td>
      <td className="py-2 px-3 text-white/40 max-w-[120px] truncate">{evt.honeypotEndpoint}</td>
      <td className="py-2 px-3">
        <span className={`px-1.5 py-0.5 rounded font-mono text-xs border ${SCORE_COLOR(evt.threatScore ?? 0)}`}>
          {evt.threatScore ?? 0}
        </span>
      </td>
      <td className="py-2 px-3">
        <div className="flex flex-wrap gap-1">
          {evt.country && <Badge className="bg-blue-900/20 text-blue-400 border-blue-500/20 text-[10px] border">{evt.country}</Badge>}
          {evt.isTorExit && <Badge className="bg-purple-900/20 text-purple-400 border-purple-500/20 text-[10px] border">TOR</Badge>}
          {evt.isVpn    && <Badge className="bg-yellow-900/20 text-yellow-400 border-yellow-500/20 text-[10px] border">VPN</Badge>}
          {evt.capturedCreds && <Badge className="bg-red-900/20 text-red-400 border-red-500/20 text-[10px] border">CREDS</Badge>}
          {tags.slice(0, 2).map((t: string) => (
            <Badge key={t} className="bg-orange-900/20 text-orange-400 border-orange-500/20 text-[10px] border">{t}</Badge>
          ))}
        </div>
      </td>
      <td className="py-2 px-3 text-white/30 whitespace-nowrap">
        {new Date(evt.sessionStart).toLocaleString()}
      </td>
    </tr>
  );
}

function EventDetailPanel({ evt, onClose }: { evt: any; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  function cp(key: string, val: string) { navigator.clipboard.writeText(val); setCopied(key); setTimeout(() => setCopied(null), 1400); }

  const tags: string[] = (() => { try { return JSON.parse(evt.scanPatterns ?? "[]"); } catch { return []; } })();
  const headers: Record<string, string> = (() => { try { return JSON.parse(evt.requestHeaders ?? "{}"); } catch { return {}; } })();
  const creds: Record<string, string> | null = (() => {
    if (!evt.capturedCreds) return null;
    try { return JSON.parse(evt.capturedCreds); } catch { return null; }
  })();

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-end" onClick={onClose}>
      <div className="w-full max-w-xl h-full overflow-y-auto bg-zinc-950 border-l border-white/10 p-5 space-y-5"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${evt.threatScore >= 70 ? "bg-red-400" : evt.threatScore >= 40 ? "bg-yellow-400" : "bg-green-400"}`} />
            <span className="font-mono text-white font-semibold">{evt.attackerIp}</span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-mono border ${SCORE_COLOR(evt.threatScore ?? 0)}`}>
              score {evt.threatScore ?? 0}
            </span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {/* Identity */}
        <div className="rounded border border-white/10 bg-black/40 p-3 space-y-1.5 text-xs">
          <div className="text-white/30 font-semibold uppercase tracking-wider mb-2">Attacker Identity</div>
          {[
            ["Session ID",   evt.sessionId],
            ["IP",           evt.attackerIp],
            ["Port",         evt.attackerPort],
            ["Country",      evt.country],
            ["City",         evt.city],
            ["ISP",          evt.isp],
            ["ASN",          evt.asn],
            ["ASN Org",      evt.asnOrg],
            ["OS Fingerprint", evt.osFingerprint],
            ["User Agent",   evt.userAgent],
            ["Accept-Language", evt.acceptLanguage],
          ].map(([k, v]) => v ? (
            <div key={k} className="flex gap-2 justify-between">
              <span className="text-white/30 shrink-0">{k}</span>
              <span className="text-white/70 font-mono text-right break-all flex items-center gap-1">
                {String(v).slice(0, 80)}
                <button onClick={() => cp(k!, String(v))} className="text-white/20 hover:text-green-400">
                  {copied === k ? <CheckCheck className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </span>
            </div>
          ) : null)}
          <div className="flex gap-3 pt-1">
            {evt.isTorExit && <Badge className="bg-purple-900/20 text-purple-400 border-purple-500/20 text-xs border">Tor Exit</Badge>}
            {evt.isVpn    && <Badge className="bg-yellow-900/20 text-yellow-400 border-yellow-500/20 text-xs border">VPN/Proxy</Badge>}
          </div>
        </div>

        {/* Captured credentials (high priority) */}
        {creds && (
          <div className="rounded border border-red-500/30 bg-red-900/10 p-3 space-y-1.5 text-xs">
            <div className="text-red-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Captured Credential Attempt
            </div>
            {Object.entries(creds).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-red-400/60 shrink-0">{k}</span>
                <span className="text-red-300 font-mono break-all">{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Request details */}
        <div className="rounded border border-white/10 bg-black/40 p-3 space-y-1.5 text-xs">
          <div className="text-white/30 font-semibold uppercase tracking-wider mb-2">Request</div>
          {[
            ["Service",   evt.honeypotService?.toUpperCase()],
            ["Method",    evt.requestMethod],
            ["Path",      evt.requestPath],
            ["Endpoint",  evt.honeypotEndpoint],
            ["Banner",    evt.fakeBannerServed],
            ["Tarpit",    evt.tarpitDurationMs ? `${evt.tarpitDurationMs}ms` : null],
          ].map(([k, v]) => v ? (
            <div key={k} className="flex gap-2">
              <span className="text-white/30 shrink-0">{k}</span>
              <span className="text-white/60 font-mono break-all">{String(v)}</span>
            </div>
          ) : null)}
        </div>

        {/* Scan patterns */}
        {tags.length > 0 && (
          <div className="rounded border border-orange-500/20 bg-orange-900/5 p-3">
            <div className="text-orange-400/70 text-xs font-semibold uppercase tracking-wider mb-2">Detected Tool Signatures</div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(t => (
                <Badge key={t} className="bg-orange-900/20 text-orange-400 border-orange-500/30 text-xs border">{t}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* HTTP headers */}
        {Object.keys(headers).length > 0 && (
          <div className="rounded border border-white/10 bg-black/40 p-3">
            <div className="text-white/30 text-xs font-semibold uppercase tracking-wider mb-2">HTTP Headers</div>
            <div className="space-y-0.5 text-xs font-mono max-h-48 overflow-y-auto">
              {Object.entries(headers).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-blue-400/60 shrink-0">{k}:</span>
                  <span className="text-white/40 break-all">{String(v).slice(0, 120)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payload hex dump */}
        {evt.payloadHex && (
          <div className="rounded border border-white/10 bg-black/40 p-3">
            <div className="text-white/30 text-xs font-semibold uppercase tracking-wider mb-2">Payload Hex</div>
            <pre className="text-xs font-mono text-green-400/50 break-all whitespace-pre-wrap max-h-32 overflow-y-auto">
              {evt.payloadHex}
            </pre>
          </div>
        )}

        {/* OSINT quick links */}
        <div className="rounded border border-white/10 bg-black/40 p-3">
          <div className="text-white/30 text-xs font-semibold uppercase tracking-wider mb-2">OSINT Quick Links</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              [`AbuseIPDB`,     `https://www.abuseipdb.com/check/${evt.attackerIp}`],
              [`Shodan`,        `https://www.shodan.io/host/${evt.attackerIp}`],
              [`VirusTotal`,    `https://www.virustotal.com/gui/ip-address/${evt.attackerIp}`],
              [`MXToolbox`,     `https://mxtoolbox.com/SuperTool.aspx?action=blacklist%3a${evt.attackerIp}`],
              [`IPInfo.io`,     `https://ipinfo.io/${evt.attackerIp}`],
              [`Censys`,        `https://search.censys.io/hosts/${evt.attackerIp}`],
              [`GreyNoise`,     `https://viz.greynoise.io/ip/${evt.attackerIp}`],
            ].map(([label, url]) => (
              <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 rounded border border-white/10 bg-black/20 text-white/50 hover:text-green-400 hover:border-green-500/30 transition-colors">
                <ExternalLink className="w-3 h-3" /> {label}
              </a>
            ))}
          </div>
        </div>

        <div className="text-xs text-white/20">
          {new Date(evt.sessionStart).toLocaleString()} — Session #{evt.sessionId?.slice(0, 8)}
        </div>
      </div>
    </div>
  );
}

function BannersTab() {
  const { toast } = useToast();
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", serviceType: "http", bannerContent: "", delayMs: 500 });

  async function load() {
    try {
      const r = await fetch(`${BASE}/api/deception/banners`, { credentials: "include" });
      if (r.ok) setBanners(await r.json());
    } finally { setLoading(false); }
  }

  async function toggleActive(b: any) {
    await fetch(`${BASE}/api/deception/banners/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !b.isActive }),
      credentials: "include",
    });
    await load();
  }

  async function createBanner() {
    if (!newForm.name || !newForm.bannerContent) {
      toast({ title: "Name and content required", variant: "destructive" }); return;
    }
    const r = await fetch(`${BASE}/api/deception/banners`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newForm),
      credentials: "include",
    });
    if (r.ok) { toast({ title: "Banner created" }); setShowNew(false); setNewForm({ name: "", serviceType: "http", bannerContent: "", delayMs: 500 }); await load(); }
    else toast({ title: "Failed to create banner", variant: "destructive" });
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/30">Manage fake service banners served to attackers. Active banners are rotated per service type.</p>
        <Button onClick={() => setShowNew(true)} size="sm" className="bg-green-700 hover:bg-green-600 gap-1 text-xs">
          <Plus className="w-3 h-3" /> New Banner
        </Button>
      </div>

      {showNew && (
        <div className="rounded-lg border border-green-500/20 bg-green-900/5 p-4 space-y-3">
          <div className="text-xs font-semibold text-green-400 mb-2">Create Custom Banner</div>
          <div className="grid grid-cols-2 gap-3">
            <Input value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Banner name" className="bg-black/40 border-white/10 text-white text-xs" />
            <Select value={newForm.serviceType} onValueChange={v => setNewForm(f => ({ ...f, serviceType: v }))}>
              <SelectTrigger className="bg-black/40 border-white/10 text-white text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10">
                {["http","ssh","ftp","smtp","telnet","rdp","generic"].map(s => (
                  <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input value={String(newForm.delayMs)} onChange={e => setNewForm(f => ({ ...f, delayMs: Number(e.target.value) }))}
            placeholder="Tarpit delay (ms)" type="number" className="bg-black/40 border-white/10 text-white text-xs" />
          <textarea value={newForm.bannerContent} onChange={e => setNewForm(f => ({ ...f, bannerContent: e.target.value }))}
            placeholder="Banner content (HTML for http, plain text for others)..."
            className="w-full h-32 text-xs font-mono bg-black/60 border border-white/10 rounded p-2 text-green-400/80 resize-none" />
          <div className="flex gap-2">
            <Button onClick={createBanner} size="sm" className="bg-green-700 hover:bg-green-600 text-xs">Save Banner</Button>
            <Button onClick={() => setShowNew(false)} variant="outline" size="sm"
              className="border-white/10 text-white/50 text-xs">Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {banners.map(b => (
          <div key={b.id} className={`rounded-lg border p-4 ${b.isActive ? "border-green-500/20 bg-green-900/5" : "border-white/10 bg-black/20 opacity-60"}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${b.isActive ? "bg-green-400" : "bg-white/20"}`} />
                <span className="text-sm font-semibold text-white">{b.name}</span>
                <Badge className="bg-blue-900/20 text-blue-400 border-blue-500/20 text-xs border">{b.serviceType.toUpperCase()}</Badge>
                {b.delayMs > 0 && <span className="text-xs text-white/30">tarpit {b.delayMs}ms</span>}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setEditId(editId === b.id ? null : b.id)} variant="ghost" size="sm"
                  className="text-white/30 hover:text-white h-7 w-7 p-0">
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button onClick={() => toggleActive(b)} variant="ghost" size="sm"
                  className={`h-7 px-2 text-xs ${b.isActive ? "text-green-400 hover:text-red-400" : "text-white/30 hover:text-green-400"}`}>
                  {b.isActive ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
            {editId === b.id && (
              <pre className="mt-3 text-xs font-mono text-white/30 bg-black/40 rounded p-2 max-h-40 overflow-y-auto">
                {b.bannerContent}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HoneypotUrlsTab() {
  const BASE_URL = `${window.location.origin}`;
  const [copied, setCopied] = useState<string | null>(null);
  function cp(key: string, val: string) { navigator.clipboard.writeText(val); setCopied(key); setTimeout(() => setCopied(null), 1400); }

  const endpoints = [
    { path: `${BASE}/api/deception/trap/index.php`, service: "HTTP", desc: "Generic Apache trap — logs all requests" },
    { path: `${BASE}/api/deception/trap-pma`,       service: "HTTP", desc: "phpMyAdmin fake login — captures credentials" },
    { path: `${BASE}/api/deception/trap-admin`,     service: "HTTP", desc: "Generic admin panel with credential capture" },
    { path: `${BASE}/api/deception/trap-wp`,        service: "HTTP", desc: "WordPress wp-login.php clone" },
    { path: `${BASE}/api/deception/trap-ssh`,       service: "SSH",  desc: "OpenSSH 7.4 banner (for scanners probing over HTTP)" },
    { path: `${BASE}/api/deception/trap-ftp`,       service: "FTP",  desc: "vsftpd 2.3.4 banner" },
    { path: `${BASE}/api/deception/trap-smtp`,      service: "SMTP", desc: "Sendmail 8.14 banner" },
    { path: `${BASE}/api/deception/canary/1`,       service: "CANARY", desc: "Silent canary token — registers any access" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded border border-yellow-500/20 bg-yellow-900/5 p-3 text-xs text-yellow-400/70">
        <span className="font-semibold text-yellow-400">Honeypot Endpoint URLs</span> — embed these in robots.txt, DNS records,
        HTML comments, config file leaks, or any other deception layer. Every hit is logged with full attacker fingerprint.
      </div>
      <div className="space-y-2">
        {endpoints.map(ep => (
          <div key={ep.path} className="rounded border border-white/10 bg-black/40 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-blue-900/20 text-blue-400 border-blue-500/20 text-[10px] border">{ep.service}</Badge>
                <span className="text-xs text-white/30">{ep.desc}</span>
              </div>
              <code className="text-xs font-mono text-green-400/70 break-all">{BASE_URL}{ep.path}</code>
            </div>
            <button onClick={() => cp(ep.path, `${BASE_URL}${ep.path}`)}
              className="shrink-0 text-white/20 hover:text-green-400 transition-colors">
              {copied === ep.path ? <CheckCheck className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        ))}
      </div>
      <div className="rounded border border-white/10 bg-black/40 p-3 text-xs space-y-1.5">
        <div className="text-white/30 font-semibold mb-2">Deployment Ideas</div>
        {[
          "Add trap-pma and trap-admin to your nginx/Apache virtual host as rewrite rules",
          "Plant honeypot URLs in robots.txt Disallow entries to catch automated scrapers",
          "Embed canary tokens in HTML comments of your public pages",
          "Include fake database credentials pointing to trap-pma in leaked .env files",
          "Reference trap-ssh URL in DNS TXT records as a fake SSH jump host",
          "Add to /etc/hosts on test VMs to log any lateral movement attempts",
        ].map((tip, i) => (
          <div key={i} className="flex gap-2 text-white/40">
            <span className="text-green-400/40 shrink-0">›</span> {tip}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DeceptionEngine() {
  const { toast } = useToast();
  const [tab, setTab]               = useState<"events"|"stats"|"banners"|"honeypots">("events");
  const [events, setEvents]         = useState<any[]>([]);
  const [stats, setStats]           = useState<any>(null);
  const [loading, setLoading]       = useState(false);
  const [total, setTotal]           = useState(0);
  const [offset, setOffset]         = useState(0);
  const [filterSvc, setFilterSvc]   = useState("all");
  const [filterMinScore, setFilterMinScore] = useState("");
  const [filterIp, setFilterIp]     = useState("");
  const [selectedEvt, setSelectedEvt] = useState<any>(null);
  const LIMIT = 50;

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (filterSvc !== "all") params.set("service", filterSvc);
      if (filterMinScore)      params.set("minScore", filterMinScore);
      if (filterIp.trim())     params.set("ip", filterIp.trim());
      const r = await fetch(`${BASE}/api/deception/events?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      const d = await r.json();
      setEvents(d.events ?? []);
      setTotal(d.total ?? 0);
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    setLoading(false);
  }, [offset, filterSvc, filterMinScore, filterIp]);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/deception/stats`, { credentials: "include" });
      if (r.ok) setStats(await r.json());
    } catch {}
  }, []);

  useEffect(() => { if (tab === "events") loadEvents(); }, [tab, loadEvents]);
  useEffect(() => { if (tab === "stats") loadStats(); }, [tab, loadStats]);

  async function purgeIp(ip: string) {
    await fetch(`${BASE}/api/deception/events/purge`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip }), credentials: "include",
    });
    toast({ title: `Purged events for ${ip}` });
    await loadEvents();
  }

  const TABS = [
    { id: "events",    label: "Live Feed",     icon: <Activity className="w-3.5 h-3.5" /> },
    { id: "stats",     label: "Analytics",     icon: <Shield className="w-3.5 h-3.5" /> },
    { id: "banners",   label: "Banners",       icon: <Server className="w-3.5 h-3.5" /> },
    { id: "honeypots", label: "Honeypot URLs", icon: <Globe className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Lock className="w-4 h-4 text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Deception Engine</h1>
            <Badge className="bg-red-900/20 text-red-400 border-red-500/30 border text-xs">ADMIN ONLY</Badge>
          </div>
          <p className="text-xs text-white/30">
            Honeypot infrastructure — attracts, fingerprints, and logs attacker activity.
            Fake banners, tarpit connections, credential traps. Invisible to all subscribers.
          </p>
        </div>
        <Button onClick={() => tab === "events" ? loadEvents() : loadStats()} variant="outline" size="sm"
          className="border-white/10 text-white/50 gap-1.5" disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 pb-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px
              ${tab === t.id
                ? "border-green-500 text-green-400"
                : "border-transparent text-white/40 hover:text-white/70"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* EVENTS TAB */}
      {tab === "events" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="w-3.5 h-3.5 text-white/30" />
            <Select value={filterSvc} onValueChange={v => { setFilterSvc(v); setOffset(0); }}>
              <SelectTrigger className="bg-black/40 border-white/10 text-white text-xs w-32 h-7">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10">
                <SelectItem value="all">All Services</SelectItem>
                {["http","ssh","ftp","smtp","telnet","rdp","canary","generic"].map(s => (
                  <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={filterMinScore} onChange={e => setFilterMinScore(e.target.value)}
              placeholder="Min score (0-100)" className="bg-black/40 border-white/10 text-white text-xs w-36 h-7" />
            <Input value={filterIp} onChange={e => setFilterIp(e.target.value)}
              placeholder="Filter by IP..." className="bg-black/40 border-white/10 text-white text-xs w-36 h-7" />
            <Button onClick={() => { setOffset(0); loadEvents(); }} size="sm"
              className="bg-green-700 hover:bg-green-600 h-7 text-xs gap-1">
              <Filter className="w-3 h-3" /> Apply
            </Button>
            <span className="text-xs text-white/20 ml-auto">{total} total events</span>
          </div>

          {/* Events table */}
          <div className="rounded-lg border border-white/10 bg-black/40 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/30">
                  <th className="text-left px-3 py-2 w-12">#</th>
                  <th className="text-left px-3 py-2">Attacker IP</th>
                  <th className="text-left px-3 py-2">Service</th>
                  <th className="text-left px-3 py-2">Endpoint</th>
                  <th className="text-left px-3 py-2">Score</th>
                  <th className="text-left px-3 py-2">Intelligence</th>
                  <th className="text-left px-3 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-white/30 mx-auto" />
                  </td></tr>
                ) : events.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-white/20 text-xs">
                    No deception events yet. Deploy honeypot URLs to start capturing attackers.
                  </td></tr>
                ) : events.map((evt: any) => (
                  <EventRow key={evt.id} evt={evt} onSelect={setSelectedEvt} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex items-center justify-between text-xs text-white/30">
              <span>Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
              <div className="flex gap-2">
                <Button onClick={() => setOffset(Math.max(0, offset - LIMIT))} disabled={offset === 0}
                  variant="outline" size="sm" className="border-white/10 h-7 text-xs">Prev</Button>
                <Button onClick={() => setOffset(offset + LIMIT)} disabled={offset + LIMIT >= total}
                  variant="outline" size="sm" className="border-white/10 h-7 text-xs">Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STATS TAB */}
      {tab === "stats" && (
        <div className="space-y-5">
          {!stats ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="Total Events"   value={stats.totals?.total ?? 0} />
                <StatCard label="High Threat"    value={stats.totals?.highThreat ?? 0} sub="score ≥ 70" />
                <StatCard label="Creds Captured" value={stats.totals?.withCreds ?? 0} />
                <StatCard label="Tor Exit Nodes" value={stats.totals?.torCount ?? 0} />
                <StatCard label="VPN / Proxy"    value={stats.totals?.vpnCount ?? 0} />
                <StatCard label="Avg Threat Score" value={`${stats.totals?.avgScore ?? 0}/100`} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Top attacker IPs */}
                <div className="rounded-lg border border-white/10 bg-black/40 p-4">
                  <div className="text-xs font-semibold text-white/40 mb-3">Top Attacker IPs</div>
                  <div className="space-y-2">
                    {(stats.topIps ?? []).map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono text-green-400/80">{r.ip}</span>
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs border font-mono ${SCORE_COLOR(r.maxScore ?? 0)}`}>{r.maxScore}</span>
                          <span className="text-white/30">{r.count}×</span>
                          <button onClick={() => purgeIp(r.ip)} title="Purge events for this IP"
                            className="text-white/20 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {!stats.topIps?.length && <p className="text-xs text-white/20">No data yet</p>}
                  </div>
                </div>

                {/* By service */}
                <div className="rounded-lg border border-white/10 bg-black/40 p-4">
                  <div className="text-xs font-semibold text-white/40 mb-3">Hits by Honeypot</div>
                  <div className="space-y-2">
                    {(stats.byService ?? []).map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-white/60">
                          {SVC_ICON[r.service] ?? <Shield className="w-3.5 h-3.5" />}
                          <span className="uppercase font-mono">{r.service}</span>
                        </div>
                        <span className="text-green-400 font-mono">{r.count}</span>
                      </div>
                    ))}
                    {!stats.byService?.length && <p className="text-xs text-white/20">No data yet</p>}
                  </div>
                </div>

                {/* By country */}
                <div className="rounded-lg border border-white/10 bg-black/40 p-4">
                  <div className="text-xs font-semibold text-white/40 mb-3">Top Source Countries</div>
                  <div className="space-y-2">
                    {(stats.byCountry ?? []).map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-white/60">{r.country ?? "Unknown"}</span>
                        <span className="text-green-400 font-mono">{r.count}</span>
                      </div>
                    ))}
                    {!stats.byCountry?.length && <p className="text-xs text-white/20">No data yet</p>}
                  </div>
                </div>
              </div>

              {/* Recent events */}
              {stats.recent?.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-black/40 p-4">
                  <div className="text-xs font-semibold text-white/40 mb-3">5 Most Recent Hits</div>
                  <div className="space-y-2">
                    {stats.recent.map((e: any) => (
                      <div key={e.id} className="flex items-center gap-3 text-xs cursor-pointer hover:bg-white/3 -mx-2 px-2 py-1 rounded"
                        onClick={() => { setSelectedEvt(e); }}>
                        <span className="font-mono text-green-400">{e.attackerIp}</span>
                        <span className="text-white/30 uppercase">{e.honeypotService}</span>
                        <span className={`px-1.5 rounded border ${SCORE_COLOR(e.threatScore ?? 0)}`}>{e.threatScore}</span>
                        <span className="text-white/20 ml-auto">{new Date(e.sessionStart).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "banners"   && <BannersTab />}
      {tab === "honeypots" && <HoneypotUrlsTab />}

      {/* Detail panel */}
      {selectedEvt && <EventDetailPanel evt={selectedEvt} onClose={() => setSelectedEvt(null)} />}
    </div>
  );
}
