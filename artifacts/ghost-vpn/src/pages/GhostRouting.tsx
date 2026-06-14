// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// GhostRouting — ephemeral offensive exit node provisioning.
// Ghost exit nodes are short-lived Vultr VPS instances that serve as WireGuard exit points.
// Attackers who probe the exit IP hit a deception/honeypot layer.
// On disconnect, Vultr destroys the instance → RAM cleared → no recoverable data.

import { useState, useEffect, useRef } from "react";
import {
  Shield, Zap, Wifi, WifiOff, RefreshCw, Trash2, Download,
  Globe, AlertTriangle, CheckCircle2, Clock, Eye, Copy,
  Server, Activity, Lock, MemoryStick,
} from "lucide-react";
import { apiPost, apiGet } from "@/lib/apiClient";

const REGIONS: { code: string; label: string; flag: string }[] = [
  { code: "lax", label: "Los Angeles",  flag: "🇺🇸" },
  { code: "lhr", label: "London",       flag: "🇬🇧" },
  { code: "ord", label: "Chicago",      flag: "🇺🇸" },
  { code: "nrt", label: "Tokyo",        flag: "🇯🇵" },
  { code: "ewr", label: "New Jersey",   flag: "🇺🇸" },
  { code: "ams", label: "Amsterdam",    flag: "🇳🇱" },
  { code: "fra", label: "Frankfurt",    flag: "🇩🇪" },
  { code: "par", label: "Paris",        flag: "🇫🇷" },
  { code: "syd", label: "Sydney",       flag: "🇦🇺" },
  { code: "sgp", label: "Singapore",    flag: "🇸🇬" },
  { code: "yto", label: "Toronto",      flag: "🇨🇦" },
  { code: "mia", label: "Miami",        flag: "🇺🇸" },
  { code: "sea", label: "Seattle",      flag: "🇺🇸" },
  { code: "dfw", label: "Dallas",       flag: "🇺🇸" },
  { code: "sao", label: "São Paulo",    flag: "🇧🇷" },
];

interface Session {
  id: string;
  region: string;
  exitIp: string | null;
  status: string;
  probeCount: number;
  provisionedAt: string;
  readyAt: string | null;
  endedAt: string | null;
  destroyedAt: string | null;
  burnReason: string | null;
}

interface Probe {
  id: number;
  eventType: string;
  sourceIp: string;
  sourcePort: number | null;
  geoCountry: string | null;
  geoCity: string | null;
  severity: string;
  createdAt: string;
}

function regionLabel(code: string): string {
  return REGIONS.find(r => r.code === code)?.label ?? code.toUpperCase();
}
function regionFlag(code: string): string {
  return REGIONS.find(r => r.code === code)?.flag ?? "🌐";
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "ready"        ? "bg-green-400"  :
    status === "provisioning" ? "bg-yellow-400" :
    status === "destroyed"    ? "bg-zinc-500"   :
    status === "error"        ? "bg-red-500"    : "bg-blue-400";
  return <span className={`inline-block w-2 h-2 rounded-full ${color} animate-pulse`} />;
}

function elapsed(from: string): string {
  const ms = Date.now() - new Date(from).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60)  return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export default function GhostRouting() {
  const [region, setRegion]             = useState("lax");
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [wgConfig, setWgConfig]         = useState<string | null>(null);
  const [sessions, setSessions]         = useState<Session[]>([]);
  const [probes, setProbes]             = useState<Probe[]>([]);
  const [configCopied, setConfigCopied] = useState(false);
  const [burning, setBurning]           = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [timer, setTimer]               = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Poll active session until ready ────────────────────────────────────────
  const pollSession = async (sessionId: string) => {
    try {
      const data = await apiGet<{ session: Session; wgConfig: string | null }>(
        `/api/ghost-nodes/exit/${sessionId}`,
      );
      setActiveSession(data.session);
      if (data.wgConfig) setWgConfig(data.wgConfig);
      if (data.session.status !== "provisioning") {
        clearInterval(pollRef.current!);
        pollRef.current = null;
      }
    } catch { /* network blip — keep polling */ }
  };

  // ── Poll probes ─────────────────────────────────────────────────────────────
  const pollProbes = async (sessionId: string) => {
    try {
      const data = await apiGet<{ probes: Probe[] }>(`/api/ghost-nodes/exit/${sessionId}/probes`);
      setProbes(data.probes ?? []);
    } catch { /* silent */ }
  };

  // ── Load sessions on mount ──────────────────────────────────────────────────
  useEffect(() => {
    apiGet<{ sessions: Session[] }>("/api/ghost-nodes/exit/").then(data => {
      setSessions(data.sessions ?? []);
      const live = data.sessions.find(s => s.status === "provisioning" || s.status === "ready");
      if (live) {
        setActiveSession(live);
        pollSession(live.id);
        if (live.status === "provisioning") {
          pollRef.current = setInterval(() => pollSession(live.id), 6000);
        }
      }
    }).catch(() => {});
  }, []);

  // ── Session timer display ───────────────────────────────────────────────────
  useEffect(() => {
    if (!activeSession?.provisionedAt) return;
    const t = setInterval(() => setTimer(elapsed(activeSession.provisionedAt)), 1000);
    return () => clearInterval(t);
  }, [activeSession?.provisionedAt]);

  // ── Probe poller ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeSession?.id || activeSession.status === "destroyed") return;
    pollProbes(activeSession.id);
    const t = setInterval(() => pollProbes(activeSession.id!), 8000);
    return () => clearInterval(t);
  }, [activeSession?.id, activeSession?.status]);

  // ── Provision ───────────────────────────────────────────────────────────────
  const handleProvision = async () => {
    setProvisioning(true);
    setError(null);
    try {
      const data = await apiPost<{
        sessionId: string; status: string; region: string;
        wgConfig: string; estimatedReadySecs: number;
      }>("/api/ghost-nodes/exit/provision", { region });
      setWgConfig(data.wgConfig);
      setActiveSession({
        id: data.sessionId, region: data.region, exitIp: null,
        status: "provisioning", probeCount: 0,
        provisionedAt: new Date().toISOString(),
        readyAt: null, endedAt: null, destroyedAt: null, burnReason: null,
      });
      pollRef.current = setInterval(() => pollSession(data.sessionId), 6000);
    } catch (e: any) {
      setError(e.message ?? "Provisioning failed");
    } finally {
      setProvisioning(false);
    }
  };

  // ── Disconnect ──────────────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    if (!activeSession) return;
    setDisconnecting(true);
    try {
      await apiPost(`/api/ghost-nodes/exit/${activeSession.id}/disconnect`, {});
      clearInterval(pollRef.current!);
      setActiveSession(prev => prev ? { ...prev, status: "destroyed", destroyedAt: new Date().toISOString() } : null);
      setWgConfig(null);
    } catch (e: any) {
      setError(e.message ?? "Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  };

  // ── Burn + reprovision ──────────────────────────────────────────────────────
  const handleBurn = async () => {
    if (!activeSession) return;
    setBurning(true);
    setError(null);
    try {
      const data = await apiPost<{
        ok: boolean; sessionId: string; status: string;
        region: string; wgConfig: string;
      }>(`/api/ghost-nodes/exit/${activeSession.id}/burn`, {});
      clearInterval(pollRef.current!);
      setWgConfig(data.wgConfig);
      setActiveSession({
        id: data.sessionId, region: data.region, exitIp: null,
        status: "provisioning", probeCount: 0,
        provisionedAt: new Date().toISOString(),
        readyAt: null, endedAt: null, destroyedAt: null, burnReason: null,
      });
      pollRef.current = setInterval(() => pollSession(data.sessionId), 6000);
    } catch (e: any) {
      setError(e.message ?? "Burn failed");
    } finally {
      setBurning(false);
    }
  };

  const downloadConfig = () => {
    if (!wgConfig) return;
    const blob = new Blob([wgConfig], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `proxhq-ghost-${activeSession?.region ?? "exit"}.conf`;
    a.click();
  };

  const copyConfig = async () => {
    if (!wgConfig) return;
    await navigator.clipboard.writeText(wgConfig);
    setConfigCopied(true);
    setTimeout(() => setConfigCopied(false), 2000);
  };

  const isActive = activeSession && !["destroyed", "error"].includes(activeSession.status);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
          <Shield className="w-6 h-6 text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Ghost Routing Mode</h1>
          <p className="text-sm text-zinc-400">Ephemeral exit nodes — your traffic exits through a ghost IP. Attackers who probe that IP hit our deception layer.</p>
        </div>
      </div>

      {/* No-logs / Privacy indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: MemoryStick, label: "RAM-only keys", desc: "WG privkey never touches disk" },
          { icon: WifiOff,     label: "No traffic logs", desc: "Zero DNS, payload, or flow logs" },
          { icon: Trash2,      label: "Auto-wipe",        desc: "Vultr instance destroyed on disconnect" },
          { icon: Globe,       label: "Ephemeral IP",     desc: "New IP every session" },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex gap-2">
            <Icon className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-white">{label}</div>
              <div className="text-[11px] text-zinc-500">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Provision controls — only show if no active session */}
      {!isActive && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="text-sm font-semibold text-zinc-300">Provision Ghost Exit Node</div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {REGIONS.map(r => (
              <button
                key={r.code}
                onClick={() => setRegion(r.code)}
                className={`flex flex-col items-center gap-1 py-2 px-2 rounded-lg border text-xs transition-all ${
                  region === r.code
                    ? "border-green-500 bg-green-500/10 text-green-400"
                    : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                <span className="text-lg">{r.flag}</span>
                <span className="leading-tight text-center">{r.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={handleProvision}
            disabled={provisioning}
            className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all"
          >
            {provisioning ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Provisioning…</>
            ) : (
              <><Zap className="w-4 h-4" /> Go Ghost — {REGIONS.find(r => r.code === region)?.label}</>
            )}
          </button>
          <p className="text-xs text-zinc-500 text-center">
            A fresh Vultr VPS spins up (~60s). Your traffic exits through its IP. The node is destroyed when you disconnect.
          </p>
        </div>
      )}

      {/* Active session card */}
      {isActive && activeSession && (
        <div className="bg-zinc-900 border border-green-500/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusDot status={activeSession.status} />
              <div>
                <div className="text-white font-semibold text-sm">
                  {regionFlag(activeSession.region)} {regionLabel(activeSession.region)} Ghost Exit
                </div>
                <div className="text-xs text-zinc-400">
                  {activeSession.status === "provisioning"
                    ? "⏳ Provisioning — node booting (~60s)…"
                    : `✅ Ready — exit IP: ${activeSession.exitIp ?? "…"}`}
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-zinc-500">
              <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timer}</div>
              <div className="flex items-center gap-1 mt-0.5 text-orange-400">
                <Eye className="w-3 h-3" /> {activeSession.probeCount} probes
              </div>
            </div>
          </div>

          {/* Exit IP display */}
          {activeSession.exitIp && (
            <div className="bg-zinc-950 border border-zinc-700 rounded-lg p-3 font-mono text-green-400 text-sm flex items-center gap-2">
              <Globe className="w-4 h-4 shrink-0" />
              <span>Websites see: <strong>{activeSession.exitIp}</strong> — not your real IP</span>
            </div>
          )}

          {/* Provisioning spinner */}
          {activeSession.status === "provisioning" && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-yellow-400 text-xs flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              Node is booting and installing WireGuard in RAM-only mode. This takes ~60s. The config below has a placeholder endpoint — it will update automatically.
            </div>
          )}

          {/* WireGuard config */}
          {wgConfig && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400">WireGuard Config</span>
                <div className="flex gap-2">
                  <button onClick={copyConfig} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors">
                    <Copy className="w-3 h-3" />{configCopied ? "Copied!" : "Copy"}
                  </button>
                  <button onClick={downloadConfig} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors">
                    <Download className="w-3 h-3" /> Download .conf
                  </button>
                </div>
              </div>
              <pre className="bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-[11px] font-mono text-green-300 overflow-x-auto whitespace-pre-wrap">
                {wgConfig}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleBurn}
              disabled={burning}
              className="flex-1 py-2 rounded-lg border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {burning
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Rotating…</>
                : <><RefreshCw className="w-4 h-4" /> Burn IP</>}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex-1 py-2 rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {disconnecting
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Wiping…</>
                : <><Trash2 className="w-4 h-4" /> Disconnect + Wipe</>}
            </button>
          </div>
          <p className="text-[11px] text-zinc-600 text-center">
            Burn IP rotates to a fresh ghost exit in the same region. Disconnect destroys the Vultr instance — RAM cleared, WireGuard private key irrecoverably gone.
          </p>
        </div>
      )}

      {/* Probe feed */}
      {isActive && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-zinc-300">Live Probe Feed</span>
            <span className="text-xs text-zinc-500 ml-auto">Attackers who hit your exit IP</span>
          </div>
          {probes.length === 0 ? (
            <div className="text-xs text-zinc-500 text-center py-4">
              No probes yet — your exit IP has not been scanned.
            </div>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {probes.map(p => (
                <div key={p.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-zinc-800 last:border-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    p.severity === "critical" ? "bg-red-500" :
                    p.severity === "warn"     ? "bg-orange-400" : "bg-zinc-500"
                  }`} />
                  <span className="font-mono text-zinc-300 w-32 shrink-0">{p.sourceIp}</span>
                  <span className="text-zinc-500">{p.eventType}</span>
                  {p.geoCountry && <span className="text-zinc-600">{p.geoCity ? `${p.geoCity}, ` : ""}{p.geoCountry}</span>}
                  <span className="ml-auto text-zinc-600">{new Date(p.createdAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* What is and is not logged */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <Lock className="w-4 h-4 text-green-400" /> Privacy Architecture — What We Log vs. What We Don't
        </div>
        <div className="grid md:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-red-400 font-semibold mb-2">❌ Never stored anywhere</div>
            <ul className="space-y-1 text-zinc-400">
              <li>• Your real IP address</li>
              <li>• VPN traffic content</li>
              <li>• DNS queries you make through the tunnel</li>
              <li>• Websites you visit</li>
              <li>• WireGuard server private key (RAM-only on node)</li>
              <li>• System logs from the exit node (volatile RAM)</li>
            </ul>
          </div>
          <div>
            <div className="text-green-400 font-semibold mb-2">✅ Session metadata (retained)</div>
            <ul className="space-y-1 text-zinc-400">
              <li>• Session start/end time</li>
              <li>• Ghost exit IP (the node's IP, not yours)</li>
              <li>• Region selected</li>
              <li>• Probe count (attackers who scanned the exit IP)</li>
              <li>• Vultr instance ID (deleted on disconnect)</li>
            </ul>
          </div>
        </div>
        <div className="text-[11px] text-zinc-600 border-t border-zinc-800 pt-3">
          On disconnect, the Vultr instance is destroyed via API. Vultr wipes the underlying disk on reallocation. RAM is cleared immediately on power-off — including the WireGuard private key. Vultr retains billing records showing an instance existed, but has no VPN traffic data. ProxhqVPN retains session metadata above for billing and support — not traffic.
        </div>
      </div>

      {/* Session history */}
      {sessions.filter(s => s.status === "destroyed" || s.status === "error").length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Server className="w-4 h-4" /> Session History
          </div>
          <div className="space-y-1">
            {sessions.filter(s => s.status === "destroyed" || s.status === "error").slice(0, 10).map(s => (
              <div key={s.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-zinc-800 last:border-0">
                <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
                <span>{regionFlag(s.region)} {regionLabel(s.region)}</span>
                <span className="text-zinc-500 font-mono">{s.exitIp ?? "—"}</span>
                <span className="text-zinc-600 ml-auto">{new Date(s.provisionedAt).toLocaleString()}</span>
                <span className="text-zinc-500">{s.burnReason ?? s.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
