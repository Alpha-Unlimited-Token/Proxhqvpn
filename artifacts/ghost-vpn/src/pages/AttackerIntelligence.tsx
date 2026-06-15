// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Attacker Intelligence Center — owner-only admin panel.
// Aggregates all data captured on every attacker IP: geo, ISP, payloads,
// beacon fingerprints, banner transcripts, hop chains, evidence, and
// law-enforcement report generation.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Skull, Globe, Clock, Shield, ShieldAlert, AlertTriangle,
  Download, RefreshCw, Loader2, ChevronRight, ChevronDown,
  Radio, Ban, Network, FileText, Search, Copy, Check,
  Activity, Crosshair, Eye, Zap, Server, MapPin, Building2,
  Wifi, Lock, Key, Database, Layers, Target, ExternalLink,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function severityColor(s: string) {
  if (s === "critical") return "text-red-400 bg-red-950/60 border-red-800";
  if (s === "high")     return "text-orange-400 bg-orange-950/60 border-orange-800";
  if (s === "medium")   return "text-yellow-400 bg-yellow-950/60 border-yellow-800";
  return "text-green-400 bg-green-950/60 border-green-800";
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${color}`}>
      {label.toUpperCase()}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-gray-500 hover:text-green-400 transition-colors ml-1"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

interface AttackerRow {
  attackerIp: string;
  probeCount: number;
  firstSeen: string;
  lastSeen: string;
  geoCountry: string | null;
  geoCity: string | null;
  geoIsp: string | null;
  geoOrg: string | null;
  geoAsn: string | null;
  vpnDetected: boolean;
  torDetected: boolean;
  autoBlocked: boolean;
  silkTrapped: boolean;
  beaconFires: number;
  sqlCount: number;
  xssCount: number;
  cmdCount: number;
  attackerPort: number | null;
  attackerUa: string | null;
  severity: string;
}

interface IntelDossier {
  ip: string;
  severity: string;
  geo: {
    country: string | null; city: string | null; isp: string | null;
    org: string | null; asn: string | null; timezone: string | null;
    vpnDetected: boolean; torDetected: boolean;
  } | null;
  summary: {
    totalProbes: number; totalBeacons: number; totalEvidence: number;
    totalSessions: number; firstSeen: string | null; lastSeen: string | null;
    autoBlocked: boolean; silkTrapped: boolean;
    probeTypes: string[]; attackVectors: string[]; userAgents: string[];
    endpoints: string[]; sourcePort: number | null;
  };
  payloads: Array<{
    at: string; method: string; endpoint: string; type: string;
    payload: string | null; fakeResp: string | null; tarpitMs: number;
    beaconFired: boolean; headers: Record<string, string>;
  }>;
  bannerTranscripts: Array<{ at: string; endpoint: string; banner: string | null }>;
  beaconFingerprints: Array<{
    beaconId: string; firedAt: string; fromIp: string | null;
    userAgent: string | null; screenSize: string | null;
    language: string | null; timezone: string | null;
    headers: Record<string, string>;
  }>;
  wormCallbacks: Array<{ at: string; sessionId: string; stage: string; data: unknown }>;
  hopChains: string[][];
  evidence: unknown[];
  sessions: Array<{
    id: number; sessionId: string; stage: number; stageLabel: string;
    loopCount: number; interactionCount: number; totalTarpitMs: number;
    triggerType: string; initialPayload: string | null; fakeSessionToken: string | null;
    fakeUsername: string | null; isActive: boolean; lastSeenAt: string; createdAt: string;
  }>;
}

// ── Sub-panel: Geo card ───────────────────────────────────────────────────────
function GeoCard({ geo, ip }: { geo: IntelDossier["geo"]; ip: string }) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 text-green-400 font-mono text-sm font-bold mb-3">
        <Globe size={14} /> GEOLOCATION / NETWORK IDENTITY
      </div>
      <Row label="IP Address" value={ip} copy />
      <Row label="Country" value={geo?.country ?? "—"} />
      <Row label="City" value={geo?.city ?? "—"} />
      <Row label="ISP" value={geo?.isp ?? "—"} />
      <Row label="Organization" value={geo?.org ?? "—"} />
      <Row label="ASN" value={geo?.asn ?? "—"} />
      <Row label="Timezone" value={geo?.timezone ?? "—"} />
      <Row label="VPN Exit" value={geo?.vpnDetected ? "⚠ YES — routing through VPN exit node" : "Not detected"} warn={geo?.vpnDetected} />
      <Row label="Tor Exit" value={geo?.torDetected ? "⚠ YES — Tor exit node" : "Not detected"} warn={geo?.torDetected} />
    </div>
  );
}

function Row({ label, value, copy, warn }: { label: string; value: string; copy?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-start gap-2 text-xs font-mono">
      <span className="text-gray-500 w-28 shrink-0">{label}</span>
      <span className={warn ? "text-yellow-400" : "text-gray-200"}>
        {value}
        {copy && <CopyButton text={value} />}
      </span>
    </div>
  );
}

// ── Sub-panel: Payload feed ───────────────────────────────────────────────────
function PayloadFeed({ payloads }: { payloads: IntelDossier["payloads"] }) {
  const [limit, setLimit] = useState(20);
  if (!payloads.length) return <Empty label="No payloads captured" />;
  return (
    <div className="space-y-2">
      {payloads.slice(0, limit).map((p, i) => (
        <div key={i} className="bg-gray-900 border border-gray-700 rounded p-3 font-mono text-xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-gray-500">{new Date(p.at).toISOString()}</span>
            <span className="text-blue-400">{p.method}</span>
            <span className="text-green-300">/{p.endpoint}</span>
            <Badge label={p.type} color="text-orange-400 bg-orange-950/40 border-orange-800" />
            {p.beaconFired && <Badge label="BEACON FIRED" color="text-red-400 bg-red-950/40 border-red-800" />}
            <span className="text-gray-600 ml-auto">tarpit {p.tarpitMs}ms</span>
          </div>
          {p.payload && (
            <div className="bg-black/60 border border-gray-800 rounded p-2 mt-1 text-red-300 break-all">
              <span className="text-gray-500 mr-2">PAYLOAD:</span>{p.payload}
              <CopyButton text={p.payload} />
            </div>
          )}
          {p.fakeResp && (
            <div className="bg-black/40 border border-gray-800 rounded p-2 mt-1 text-cyan-300 break-all">
              <span className="text-gray-500 mr-2">BANNER SENT:</span>{p.fakeResp.slice(0, 200)}{p.fakeResp.length > 200 ? "…" : ""}
            </div>
          )}
          {Object.keys(p.headers).length > 0 && (
            <details className="mt-1">
              <summary className="text-gray-500 cursor-pointer hover:text-gray-400">Headers ({Object.keys(p.headers).length})</summary>
              <div className="pl-2 pt-1 space-y-0.5">
                {Object.entries(p.headers).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-gray-500 shrink-0">{k}:</span>
                    <span className="text-gray-300 break-all">{String(v)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      ))}
      {payloads.length > limit && (
        <button onClick={() => setLimit(l => l + 20)} className="text-xs text-green-400 hover:text-green-300 font-mono">
          + {payloads.length - limit} more payloads
        </button>
      )}
    </div>
  );
}

// ── Sub-panel: Beacon fingerprints ────────────────────────────────────────────
function BeaconPanel({ fingerprints }: { fingerprints: IntelDossier["beaconFingerprints"] }) {
  if (!fingerprints.length) return <Empty label="No beacon callbacks recorded" />;
  return (
    <div className="space-y-3">
      {fingerprints.map((b, i) => (
        <div key={i} className="bg-gray-900 border border-red-900/50 rounded p-3 font-mono text-xs">
          <div className="flex items-center gap-2 mb-2">
            <Radio size={12} className="text-red-400 animate-pulse" />
            <span className="text-red-400 font-bold">BEACON CALLBACK</span>
            <span className="text-gray-500">{new Date(b.firedAt).toISOString()}</span>
          </div>
          <Row label="Fired From IP" value={b.fromIp ?? "—"} copy />
          <Row label="User-Agent" value={b.userAgent ?? "—"} />
          <Row label="Screen Size" value={b.screenSize ?? "—"} />
          <Row label="Language" value={b.language ?? "—"} />
          <Row label="Timezone" value={b.timezone ?? "—"} />
          {Object.keys(b.headers).length > 0 && (
            <details className="mt-2">
              <summary className="text-gray-500 cursor-pointer hover:text-gray-400">Request Headers ({Object.keys(b.headers).length})</summary>
              <div className="pl-2 pt-1 space-y-0.5">
                {Object.entries(b.headers).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-gray-500 shrink-0">{k}:</span>
                    <span className="text-gray-300 break-all">{String(v)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Sub-panel: Tarpit sessions ────────────────────────────────────────────────
function SessionPanel({ sessions }: { sessions: IntelDossier["sessions"] }) {
  if (!sessions.length) return <Empty label="No tarpit loop sessions" />;
  return (
    <div className="space-y-2">
      {sessions.map((s, i) => (
        <div key={i} className="bg-gray-900 border border-gray-700 rounded p-3 font-mono text-xs">
          <div className="flex items-center gap-2 mb-1">
            <Layers size={12} className="text-purple-400" />
            <span className="text-purple-300 font-bold">{s.stageLabel.toUpperCase()}</span>
            {s.isActive && <Badge label="ACTIVE" color="text-green-400 bg-green-950/40 border-green-800" />}
            <span className="text-gray-500 ml-auto">{new Date(s.createdAt).toISOString()}</span>
          </div>
          <Row label="Session ID" value={s.sessionId.slice(0, 16) + "…"} />
          <Row label="Stage" value={`${s.stage} — ${s.stageLabel}`} />
          <Row label="Loop Count" value={String(s.loopCount)} />
          <Row label="Interactions" value={String(s.interactionCount)} />
          <Row label="Total Tarpit" value={`${(s.totalTarpitMs / 1000).toFixed(1)}s`} />
          <Row label="Trigger" value={s.triggerType} />
          {s.fakeUsername && <Row label="Fake Identity Used" value={s.fakeUsername} />}
          {s.fakeSessionToken && <Row label="Fake Token Issued" value={s.fakeSessionToken.slice(0, 40) + "…"} />}
          {s.initialPayload && (
            <div className="bg-black/60 border border-gray-800 rounded p-2 mt-2 text-red-300 break-all">
              <span className="text-gray-500 mr-2">INITIAL PAYLOAD:</span>{s.initialPayload}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Sub-panel: Hop chain ──────────────────────────────────────────────────────
function HopChainPanel({ chains }: { chains: string[][] }) {
  if (!chains.length) return <Empty label="No hop chain data — direct connection or single hop" />;
  return (
    <div className="space-y-4">
      {chains.map((chain, i) => (
        <div key={i} className="bg-gray-900 border border-gray-700 rounded p-3">
          <div className="text-xs text-gray-500 font-mono mb-2">Chain #{i + 1} — {chain.length} hops</div>
          <div className="flex items-center flex-wrap gap-1 font-mono text-xs">
            {chain.map((hop, j) => (
              <div key={j} className="flex items-center gap-1">
                <span className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-cyan-300">
                  {j === 0 ? "🎯 " : ""}{hop}
                </span>
                {j < chain.length - 1 && <ChevronRight size={12} className="text-gray-600" />}
              </div>
            ))}
            <span className="text-gray-600 ml-1">→ <span className="text-green-400">YOUR SERVER</span></span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sub-panel: Banner transcripts ─────────────────────────────────────────────
function BannerPanel({ transcripts }: { transcripts: IntelDossier["bannerTranscripts"] }) {
  if (!transcripts.length) return <Empty label="No banner exchanges recorded" />;
  return (
    <div className="space-y-2 font-mono text-xs">
      {transcripts.map((t, i) => (
        <div key={i} className="bg-black border border-gray-800 rounded p-3">
          <div className="text-gray-500 mb-1">{new Date(t.at).toISOString()} → /{t.endpoint}</div>
          <div className="text-cyan-300 whitespace-pre-wrap break-all">{t.banner}</div>
        </div>
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="text-gray-600 font-mono text-xs py-4 text-center">{label}</div>;
}

// ── Dossier drawer ────────────────────────────────────────────────────────────
type Tab = "geo" | "payloads" | "beacons" | "sessions" | "hops" | "banners";

function DossierPanel({ ip, onClose }: { ip: string; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("geo");
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery<IntelDossier>({
    queryKey: ["ghost-trap-intel", ip],
    queryFn: () => apiFetch(`/api/ghost-trap/intel/${encodeURIComponent(ip)}`),
  });

  const downloadReport = () => {
    window.open(`${BASE}/api/ghost-trap/report/${encodeURIComponent(ip)}?download=1`, "_blank");
  };
  const downloadEvidence = async () => {
    const r = await fetch(`${BASE}/api/ghost-trap/export-evidence`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip }),
    });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `evidence-${ip}.zip`; a.click();
    URL.revokeObjectURL(url);
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "geo",      label: "Identity",  icon: <Globe size={13} /> },
    { id: "payloads", label: "Payloads",  icon: <Zap size={13} />,    count: data?.payloads.length },
    { id: "beacons",  label: "Beacons",   icon: <Radio size={13} />,  count: data?.beaconFingerprints.length },
    { id: "sessions", label: "Tarpit",    icon: <Layers size={13} />, count: data?.sessions.length },
    { id: "hops",     label: "Hop Chain", icon: <Network size={13} />, count: data?.hopChains.length },
    { id: "banners",  label: "Banners",   icon: <FileText size={13} />, count: data?.bannerTranscripts.length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/80">
      <div className="ml-auto w-full max-w-4xl bg-gray-950 border-l border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-700 p-4 flex items-center gap-3">
          <Skull size={18} className="text-red-400" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-white font-bold text-lg">{ip}</span>
              <CopyButton text={ip} />
              {data && <Badge label={data.severity} color={severityColor(data.severity)} />}
              {data?.geo?.vpnDetected && <Badge label="VPN" color="text-yellow-400 bg-yellow-950/40 border-yellow-800" />}
              {data?.geo?.torDetected && <Badge label="TOR" color="text-purple-400 bg-purple-950/40 border-purple-800" />}
            </div>
            {data && (
              <div className="text-xs text-gray-500 font-mono mt-0.5">
                {data.summary.totalProbes} probes · {data.summary.totalBeacons} beacon fires · {data.geo?.country ?? "unknown"}, {data.geo?.isp ?? "unknown ISP"}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadReport} className="flex items-center gap-1.5 text-xs bg-blue-900/40 hover:bg-blue-900/60 border border-blue-700 text-blue-300 px-3 py-1.5 rounded font-mono transition-colors">
              <FileText size={13} /> LE Report
            </button>
            <button onClick={downloadEvidence} className="flex items-center gap-1.5 text-xs bg-purple-900/40 hover:bg-purple-900/60 border border-purple-700 text-purple-300 px-3 py-1.5 rounded font-mono transition-colors">
              <Download size={13} /> Evidence ZIP
            </button>
            <a href={`${BASE}/api/ghost-trap/backtrace/${encodeURIComponent(ip)}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs bg-cyan-900/40 hover:bg-cyan-900/60 border border-cyan-700 text-cyan-300 px-3 py-1.5 rounded font-mono transition-colors">
              <Network size={13} /> VPN Trace
            </a>
            <button onClick={onClose} className="text-gray-500 hover:text-white ml-2 text-lg font-bold">✕</button>
          </div>
        </div>

        {/* Quick stats */}
        {data && (
          <div className="grid grid-cols-5 gap-px bg-gray-800 border-b border-gray-700">
            {[
              { label: "Probes", value: data.summary.totalProbes, icon: <Target size={13} />, color: "text-red-400" },
              { label: "Beacon Fires", value: data.summary.totalBeacons, icon: <Radio size={13} />, color: "text-orange-400" },
              { label: "Evidence Items", value: data.summary.totalEvidence, icon: <Database size={13} />, color: "text-purple-400" },
              { label: "Tarpit Sessions", value: data.summary.totalSessions, icon: <Layers size={13} />, color: "text-cyan-400" },
              { label: "Silk Trapped", value: data.summary.silkTrapped ? "YES" : "NO", icon: <Network size={13} />, color: data.summary.silkTrapped ? "text-green-400" : "text-gray-500" },
            ].map(s => (
              <div key={s.label} className="bg-gray-950 px-3 py-2 text-center">
                <div className={`flex items-center justify-center gap-1 ${s.color} font-mono text-sm font-bold`}>
                  {s.icon} {s.value}
                </div>
                <div className="text-gray-600 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-700 bg-gray-900 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono whitespace-nowrap transition-colors border-b-2 ${tab === t.id ? "border-green-400 text-green-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
              {t.icon} {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${tab === t.id ? "bg-green-900/60 text-green-300" : "bg-gray-800 text-gray-400"}`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="flex items-center justify-center h-40 gap-2 text-green-400 font-mono text-sm">
              <Loader2 size={18} className="animate-spin" /> Loading intelligence…
            </div>
          )}
          {error && <div className="text-red-400 font-mono text-sm text-center py-8">Failed to load dossier: {String(error)}</div>}
          {data && tab === "geo"      && <GeoCard geo={data.geo} ip={ip} />}
          {data && tab === "payloads" && <PayloadFeed payloads={data.payloads} />}
          {data && tab === "beacons"  && <BeaconPanel fingerprints={data.beaconFingerprints} />}
          {data && tab === "sessions" && <SessionPanel sessions={data.sessions} />}
          {data && tab === "hops"     && <HopChainPanel chains={data.hopChains} />}
          {data && tab === "banners"  && <BannerPanel transcripts={data.bannerTranscripts} />}
        </div>

        {/* Footer — attack type breakdown */}
        {data && (
          <div className="bg-gray-900 border-t border-gray-700 p-3">
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <span className="text-gray-500">Attack types:</span>
              {data.summary.probeTypes.map(t => (
                <Badge key={t} label={t.replace("_", " ")} color="text-blue-400 bg-blue-950/40 border-blue-800" />
              ))}
              {data.summary.probeTypes.length === 0 && <span className="text-gray-600">None classified</span>}
            </div>
            {data.summary.userAgents.length > 0 && (
              <div className="flex flex-wrap gap-1 text-xs font-mono mt-1">
                <span className="text-gray-500">UA:</span>
                <span className="text-gray-400">{data.summary.userAgents[0]}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AttackerIntelligence() {
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "critical" | "high" | "blocked" | "beacon">("all");

  const { data, isLoading, refetch, isFetching } = useQuery<{ attackers: AttackerRow[]; total: number }>({
    queryKey: ["ghost-trap-intel-summary"],
    queryFn: () => apiFetch("/api/ghost-trap/intel-summary"),
    refetchInterval: 30000,
  });

  const filtered = (data?.attackers ?? []).filter(a => {
    if (search && !a.attackerIp.includes(search) && !(a.geoCountry ?? "").toLowerCase().includes(search.toLowerCase()) && !(a.geoIsp ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "critical" && a.severity !== "critical") return false;
    if (filter === "high"     && a.severity !== "high" && a.severity !== "critical") return false;
    if (filter === "blocked"  && !a.autoBlocked) return false;
    if (filter === "beacon"   && a.beaconFires === 0) return false;
    return true;
  });

  const stats = data?.attackers ?? [];
  const criticalCount = stats.filter(a => a.severity === "critical").length;
  const beaconCount   = stats.filter(a => a.beaconFires > 0).length;
  const blockedCount  = stats.filter(a => a.autoBlocked).length;
  const vpnCount      = stats.filter(a => a.vpnDetected).length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-mono">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-950 border border-red-700 flex items-center justify-center">
              <Skull size={16} className="text-red-400" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-wide">ATTACKER INTELLIGENCE CENTER</h1>
              <p className="text-gray-500 text-xs">Ghost Trap — captured attacker dossiers — owner only</p>
            </div>
          </div>
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-2 text-xs text-green-400 border border-green-800 hover:bg-green-950/30 px-3 py-1.5 rounded transition-colors">
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-800 border-b border-gray-700">
        {[
          { label: "Total Attackers",  value: stats.length,   icon: <Skull size={14} />,    color: "text-white" },
          { label: "Critical Threats", value: criticalCount,  icon: <AlertTriangle size={14} />, color: "text-red-400" },
          { label: "Beacon Callbacks", value: beaconCount,    icon: <Radio size={14} />,     color: "text-orange-400" },
          { label: "VPN Routing",      value: vpnCount,       icon: <Lock size={14} />,      color: "text-yellow-400" },
        ].map(s => (
          <div key={s.label} className="bg-gray-950 px-6 py-4">
            <div className={`flex items-center gap-2 ${s.color} text-2xl font-bold`}>
              {s.icon} {s.value}
            </div>
            <div className="text-gray-600 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="p-6">
        {/* Search + filter */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search IP, country, ISP…"
              className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-600"
            />
          </div>
          <div className="flex gap-1">
            {(["all", "critical", "high", "blocked", "beacon"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${filter === f ? "bg-green-900/40 border-green-700 text-green-300" : "bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-300"}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <span className="text-gray-600 text-xs ml-auto">{filtered.length} of {stats.length} attackers</span>
        </div>

        {/* Attacker table */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-green-400">
            <Loader2 size={20} className="animate-spin" /> Querying intelligence database…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <Skull size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{stats.length === 0 ? "No attackers captured yet. Ghost Trap is listening." : "No attackers match the current filter."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(a => (
              <div key={a.attackerIp}
                onClick={() => setSelectedIp(a.attackerIp)}
                className="bg-gray-900 border border-gray-700 hover:border-gray-500 rounded-lg p-4 cursor-pointer transition-all group">
                <div className="flex items-center gap-4">
                  {/* Severity indicator */}
                  <div className={`w-1.5 h-12 rounded-full ${a.severity === "critical" ? "bg-red-500" : a.severity === "high" ? "bg-orange-500" : a.severity === "medium" ? "bg-yellow-500" : "bg-green-700"}`} />

                  {/* IP + geo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-bold text-sm group-hover:text-green-300 transition-colors">{a.attackerIp}</span>
                      {a.attackerPort && <span className="text-gray-500 text-xs">:{a.attackerPort}</span>}
                      <Badge label={a.severity} color={severityColor(a.severity)} />
                      {a.vpnDetected && <Badge label="VPN" color="text-yellow-400 bg-yellow-950/40 border-yellow-800" />}
                      {a.torDetected && <Badge label="TOR" color="text-purple-400 bg-purple-950/40 border-purple-800" />}
                      {a.autoBlocked && <Badge label="BLOCKED" color="text-red-400 bg-red-950/40 border-red-800" />}
                      {a.silkTrapped && <Badge label="SILK" color="text-cyan-400 bg-cyan-950/40 border-cyan-800" />}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><MapPin size={11} /> {[a.geoCity, a.geoCountry].filter(Boolean).join(", ") || "Unknown location"}</span>
                      <span className="flex items-center gap-1"><Building2 size={11} /> {a.geoIsp ?? a.geoOrg ?? "Unknown ISP"}</span>
                      {a.geoAsn && <span className="flex items-center gap-1"><Server size={11} /> {a.geoAsn}</span>}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="hidden md:flex items-center gap-6 text-xs">
                    <div className="text-center">
                      <div className="text-red-400 font-bold text-sm">{a.probeCount}</div>
                      <div className="text-gray-600">probes</div>
                    </div>
                    {a.beaconFires > 0 && (
                      <div className="text-center">
                        <div className="text-orange-400 font-bold text-sm flex items-center gap-1">
                          <Radio size={11} className="animate-pulse" /> {a.beaconFires}
                        </div>
                        <div className="text-gray-600">beacons</div>
                      </div>
                    )}
                    {a.sqlCount > 0 && (
                      <div className="text-center">
                        <div className="text-red-300 font-bold text-sm">{a.sqlCount}</div>
                        <div className="text-gray-600">SQL inj.</div>
                      </div>
                    )}
                    {a.cmdCount > 0 && (
                      <div className="text-center">
                        <div className="text-red-300 font-bold text-sm">{a.cmdCount}</div>
                        <div className="text-gray-600">cmd inj.</div>
                      </div>
                    )}
                  </div>

                  {/* Timestamps */}
                  <div className="hidden lg:block text-right text-xs text-gray-600">
                    <div>First: {new Date(a.firstSeen).toLocaleString()}</div>
                    <div>Last:  {new Date(a.lastSeen).toLocaleString()}</div>
                  </div>

                  <ChevronRight size={16} className="text-gray-600 group-hover:text-green-400 transition-colors shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dossier drawer */}
      {selectedIp && <DossierPanel ip={selectedIp} onClose={() => setSelectedIp(null)} />}
    </div>
  );
}
