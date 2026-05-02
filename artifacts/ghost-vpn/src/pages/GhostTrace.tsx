// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Activity, AlertTriangle, Shield, ShieldOff, Wifi, WifiOff,
  Eye, Clock, TrendingUp, TrendingDown, Ban, CheckCircle,
  ChevronRight, Cpu, Smartphone, Monitor, RefreshCw,
  Radio, Radar, ZapOff, Database, Globe,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}/api${path}`, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

type DeviceStatus = "clean" | "warning" | "critical";
type AnomalyType = "beacon" | "exfil" | "malicious_dest" | "ghost_traffic" | "dns_tunnel";

interface Device {
  peerPublicKey: string;
  deviceName: string;
  nodeId: number;
  status: DeviceStatus;
  activeAnomalies: number;
  anomalyScore: number;
  baseline: { bytesOutPerHour: number; destCount: number };
  lastSeen: string;
}

interface Anomaly {
  id: number;
  peerPublicKey: string;
  deviceName: string;
  nodeId: number;
  anomalyType: AnomalyType;
  anomalyScore: number;
  bytesOut: number;
  bytesIn: number;
  destIpCount: number;
  uniqueNewDests: number;
  avgIntervalMs?: number;
  anomalyDetails: string | null;
  resolved: boolean;
  observedAt: string;
}

interface TimelinePoint {
  hour: string;
  bytesOut: number;
  bytesIn: number;
  anomaly: AnomalyType | null;
}

const STATUS_COLOR: Record<DeviceStatus, string> = {
  clean: "text-[#00ff88]",
  warning: "text-yellow-400",
  critical: "text-red-400",
};

const STATUS_BG: Record<DeviceStatus, string> = {
  clean: "bg-[#00ff88]/10 border-[#00ff88]/20",
  warning: "bg-yellow-400/10 border-yellow-400/20",
  critical: "bg-red-400/10 border-red-400/20",
};

const ANOMALY_LABEL: Record<AnomalyType, string> = {
  beacon: "C2 Beacon",
  exfil: "Data Exfiltration",
  malicious_dest: "Malicious Destination",
  ghost_traffic: "Ghost Traffic",
  dns_tunnel: "DNS Tunneling",
};

const ANOMALY_COLOR: Record<AnomalyType, string> = {
  beacon: "text-red-400 border-red-400/30 bg-red-400/10",
  exfil: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  malicious_dest: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  ghost_traffic: "text-purple-400 border-purple-400/30 bg-purple-400/10",
  dns_tunnel: "text-blue-400 border-blue-400/30 bg-blue-400/10",
};

function formatBytes(b: number): string {
  if (b >= 1_000_000_000) return `${(b / 1_000_000_000).toFixed(1)} GB`;
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1)} MB`;
  if (b >= 1_000) return `${(b / 1_000).toFixed(1)} KB`;
  return `${b} B`;
}

function DeviceIcon({ name }: { name: string }) {
  const lc = name.toLowerCase();
  if (lc.includes("iphone") || lc.includes("android") || lc.includes("mobile")) return <Smartphone className="w-4 h-4" />;
  if (lc.includes("macbook") || lc.includes("laptop") || lc.includes("windows")) return <Monitor className="w-4 h-4" />;
  return <Cpu className="w-4 h-4" />;
}

function TrafficHeatmap({ data }: { data: TimelinePoint[] }) {
  if (!data.length) return null;
  const maxBytes = Math.max(...data.map(d => d.bytesOut), 1);
  const last24 = data.slice(-24);

  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-px h-16">
        {last24.map((pt, i) => {
          const pct = pt.bytesOut / maxBytes;
          const heightPct = Math.max(4, Math.floor(pct * 100));
          const isAnomaly = !!pt.anomaly;
          const barColor = isAnomaly
            ? "bg-red-400"
            : pct > 0.7
            ? "bg-[#00ff88]/80"
            : pct > 0.3
            ? "bg-[#00ff88]/50"
            : "bg-[#00ff88]/20";
          return (
            <div
              key={i}
              className="flex-1 flex flex-col justify-end group relative"
              title={`${new Date(pt.hour).getHours()}:00 — ${formatBytes(pt.bytesOut)} out${isAnomaly ? ` ⚠ ${pt.anomaly}` : ""}`}
            >
              <div
                className={`rounded-sm transition-all ${barColor} ${isAnomaly ? "ring-1 ring-red-400/50" : ""}`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-primary/30 font-mono">
        <span>-24h</span>
        <span>-12h</span>
        <span>now</span>
      </div>
    </div>
  );
}

function AnomalyCard({ anomaly, onResolve, onBlock }: { anomaly: Anomaly; onResolve: (id: number) => void; onBlock: (ip: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const details = anomaly.anomalyDetails ? (() => { try { return JSON.parse(anomaly.anomalyDetails!); } catch { return null; } })() : null;

  return (
    <div className={`border rounded-sm p-3 space-y-2 text-xs font-mono ${ANOMALY_COLOR[anomaly.anomalyType] || "text-primary border-primary/20 bg-primary/5"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Radio className="w-3.5 h-3.5 shrink-0 animate-pulse" />
          <span className="font-bold uppercase tracking-wider truncate">
            {ANOMALY_LABEL[anomaly.anomalyType] || anomaly.anomalyType}
          </span>
          <span className="text-current/60 shrink-0">Score: {anomaly.anomalyScore}/100</span>
        </div>
        <button
          className="text-current/40 hover:text-current/80 transition-colors shrink-0"
          onClick={() => setExpanded(e => !e)}
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
      </div>

      {details && (
        <p className="text-current/70 leading-relaxed">{details.description}</p>
      )}

      <div className="flex items-center gap-3 text-[10px] text-current/50">
        <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{formatBytes(anomaly.bytesOut)} out</span>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(anomaly.observedAt).toLocaleTimeString()}</span>
        {anomaly.avgIntervalMs && (
          <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{(anomaly.avgIntervalMs / 1000).toFixed(1)}s interval</span>
        )}
      </div>

      {expanded && details && (
        <div className="border-t border-current/20 pt-2 space-y-1.5">
          {details.destinationIp && (
            <div className="flex justify-between">
              <span className="text-current/50">Destination IP</span>
              <span className="text-current font-bold">{details.destinationIp}:{details.destinationPort}</span>
            </div>
          )}
          {details.asnInfo && (
            <div className="flex justify-between">
              <span className="text-current/50">ASN Info</span>
              <span className="text-current/80 text-right max-w-[200px]">{details.asnInfo}</span>
            </div>
          )}
          {details.threatCategory && (
            <div className="flex justify-between">
              <span className="text-current/50">Category</span>
              <span className="text-current font-bold">{details.threatCategory}</span>
            </div>
          )}
          {details.feeds && (
            <div>
              <span className="text-current/50">Intel Feeds</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {details.feeds.map((f: string) => <span key={f} className="text-[9px] border border-current/30 px-1 py-0.5 rounded">{f}</span>)}
              </div>
            </div>
          )}
          {details.baselineMultiplier && (
            <div className="flex justify-between">
              <span className="text-current/50">Traffic Spike</span>
              <span className="text-current font-bold">{details.baselineMultiplier}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {details?.destinationIp && (
          <button
            onClick={() => onBlock(details.destinationIp)}
            className="flex items-center gap-1 text-[10px] border border-current/30 px-2 py-1 rounded hover:bg-current/10 transition-colors"
          >
            <Ban className="w-3 h-3" />Block Destination
          </button>
        )}
        <button
          onClick={() => onResolve(anomaly.id)}
          className="flex items-center gap-1 text-[10px] border border-current/20 px-2 py-1 rounded hover:bg-current/10 transition-colors text-current/50 hover:text-current"
        >
          <CheckCircle className="w-3 h-3" />Resolve
        </button>
      </div>
    </div>
  );
}

export default function GhostTrace() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { data: devices = [], isLoading: loadingDevices, refetch: refetchDevices } = useQuery<Device[]>({
    queryKey: ["ghost-trace-devices"],
    queryFn: () => apiFetch("/ghost-trace/devices"),
    refetchInterval: 15_000,
  });

  const { data: anomalies = [], isLoading: loadingAnomalies, refetch: refetchAnomalies } = useQuery<Anomaly[]>({
    queryKey: ["ghost-trace-anomalies"],
    queryFn: () => apiFetch("/ghost-trace/anomalies"),
    refetchInterval: 15_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["ghost-trace-stats"],
    queryFn: () => apiFetch("/ghost-trace/stats"),
    refetchInterval: 30_000,
  });

  const { data: timeline = [] } = useQuery<TimelinePoint[]>({
    queryKey: ["ghost-trace-timeline", selectedKey],
    queryFn: () => apiFetch(`/ghost-trace/timeline/${encodeURIComponent(selectedKey!)}`),
    enabled: !!selectedKey,
    refetchInterval: 30_000,
  });

  const resolveMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/ghost-trace/anomalies/${id}/resolve`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Anomaly Resolved", description: "Marked as resolved in Ghost Trace." });
      queryClient.invalidateQueries({ queryKey: ["ghost-trace-anomalies"] });
    },
  });

  const blockMut = useMutation({
    mutationFn: ({ ip, key }: { ip: string; key: string }) => apiFetch(`/ghost-trace/block/${encodeURIComponent(key)}`, {
      method: "POST",
      body: JSON.stringify({ ip, reason: "Ghost Trace anomaly — manual block" }),
    }),
    onSuccess: (_data, vars) => {
      toast({ title: "IP Blocked", description: `${vars.ip} added to firewall block list.` });
    },
    onError: () => toast({ title: "Block Failed", variant: "destructive" }),
  });

  const selectedDevice = devices.find(d => d.peerPublicKey === selectedKey) || devices[0] || null;
  const selectedAnomalies = anomalies.filter(a => a.peerPublicKey === (selectedKey || devices[0]?.peerPublicKey));

  useEffect(() => {
    if (!selectedKey && devices.length > 0) {
      setSelectedKey(devices[0].peerPublicKey);
    }
  }, [devices, selectedKey]);

  const totalCritical = anomalies.filter(a => a.anomalyScore >= 80 && !a.resolved).length;
  const totalActive = anomalies.filter(a => !a.resolved).length;

  return (
    <div className="p-4 md:p-6 space-y-6 font-mono min-h-screen">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Radar className="w-5 h-5 text-[#00ff88]" />
            <h1 className="text-lg font-bold text-primary tracking-tight">Ghost Trace</h1>
            <Badge className="text-[9px] border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88] font-mono uppercase tracking-widest px-1.5">
              Outbound AI
            </Badge>
          </div>
          <p className="text-xs text-primary/40 leading-relaxed max-w-xl">
            VPN-native agentless behavioral analysis. Detects C2 beaconing, data exfiltration, and malicious destinations
            from every connected device — no agents, no installs, no blind spots.
          </p>
        </div>
        <button
          onClick={() => { refetchDevices(); refetchAnomalies(); }}
          className="p-1.5 border border-primary/20 hover:border-[#00ff88]/40 rounded transition-colors text-primary/40 hover:text-[#00ff88]"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Summary bar ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Monitored Devices", value: devices.length, icon: Wifi, color: "text-[#00ff88]" },
          { label: "Active Anomalies", value: totalActive, icon: AlertTriangle, color: totalActive > 0 ? "text-yellow-400" : "text-[#00ff88]" },
          { label: "Critical Threats", value: totalCritical, icon: ShieldOff, color: totalCritical > 0 ? "text-red-400" : "text-[#00ff88]" },
          { label: "Detection Engine", value: "Agentless", icon: Shield, color: "text-[#00ff88]" },
        ].map(s => (
          <div key={s.label} className="border border-primary/10 bg-primary/3 p-3 rounded-sm">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              <span className="text-[10px] text-primary/40 uppercase tracking-wider">{s.label}</span>
            </div>
            <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Device List ──────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-2">
          <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-3">Connected Devices</div>

          {loadingDevices ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 border border-primary/10 animate-pulse rounded-sm" />
              ))}
            </div>
          ) : devices.length === 0 ? (
            <div className="border border-primary/10 p-6 text-center text-primary/30 text-xs rounded-sm">
              <WifiOff className="w-6 h-6 mx-auto mb-2 opacity-40" />
              No devices connected via VPN
            </div>
          ) : (
            devices.map(device => (
              <button
                key={device.peerPublicKey}
                onClick={() => setSelectedKey(device.peerPublicKey)}
                className={`w-full text-left border p-3 rounded-sm transition-all ${
                  (selectedKey || devices[0]?.peerPublicKey) === device.peerPublicKey
                    ? "border-[#00ff88]/40 bg-[#00ff88]/5"
                    : "border-primary/10 hover:border-primary/20 bg-primary/2"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`mt-0.5 ${STATUS_COLOR[device.status]}`}>
                    <DeviceIcon name={device.deviceName} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-primary truncate">{device.deviceName}</span>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        device.status === "critical" ? "bg-red-400 animate-pulse" :
                        device.status === "warning" ? "bg-yellow-400" : "bg-[#00ff88]"
                      }`} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold uppercase ${STATUS_COLOR[device.status]}`}>
                        {device.status === "clean" ? "Clean" : device.status === "warning" ? `${device.activeAnomalies} anomaly` : `${device.activeAnomalies} critical`}
                      </span>
                      <span className="text-[10px] text-primary/30">
                        {formatBytes(device.baseline.bytesOutPerHour)}/hr baseline
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}

          {/* Detection types legend */}
          <div className="border border-primary/10 p-3 rounded-sm space-y-2 mt-4">
            <div className="text-[10px] text-primary/40 uppercase tracking-widest">Detection Types</div>
            {Object.entries(ANOMALY_LABEL).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  key === "beacon" ? "bg-red-400" :
                  key === "exfil" ? "bg-orange-400" :
                  key === "malicious_dest" ? "bg-yellow-400" :
                  key === "ghost_traffic" ? "bg-purple-400" : "bg-blue-400"
                }`} />
                <span className="text-[10px] text-primary/50">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Device Detail Panel ──────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {selectedDevice ? (
            <>
              {/* Device header */}
              <div className={`border rounded-sm p-4 ${STATUS_BG[selectedDevice.status]}`}>
                <div className="flex items-center gap-3">
                  <div className={STATUS_COLOR[selectedDevice.status]}>
                    <DeviceIcon name={selectedDevice.deviceName} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-primary">{selectedDevice.deviceName}</div>
                    <div className="text-[11px] text-primary/40 mt-0.5">
                      Key: {selectedDevice.peerPublicKey.slice(0, 24)}...
                      {" · "} Node {selectedDevice.nodeId}
                      {" · "} Last seen {new Date(selectedDevice.lastSeen).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className={`text-2xl font-bold ${STATUS_COLOR[selectedDevice.status]}`}>
                      {selectedDevice.anomalyScore}
                    </div>
                    <div className="text-[10px] text-primary/40 uppercase">Risk Score</div>
                  </div>
                </div>
              </div>

              {/* Traffic timeline */}
              <div className="border border-primary/10 p-4 rounded-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-primary/40 uppercase tracking-widest">Traffic Timeline (24h)</span>
                  <span className="text-[10px] text-primary/30">Red bars = anomaly detected</span>
                </div>
                {timeline.length > 0 ? (
                  <TrafficHeatmap data={timeline} />
                ) : (
                  <div className="h-16 flex items-center justify-center text-primary/20 text-xs">
                    Loading timeline...
                  </div>
                )}
              </div>

              {/* Baseline stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Baseline Out/hr",
                    value: formatBytes(selectedDevice.baseline.bytesOutPerHour),
                    icon: TrendingUp,
                  },
                  {
                    label: "Baseline Dests",
                    value: `${selectedDevice.baseline.destCount} IPs`,
                    icon: Globe,
                  },
                  {
                    label: "Active Anomalies",
                    value: selectedAnomalies.filter(a => !a.resolved).length,
                    icon: AlertTriangle,
                  },
                ].map(s => (
                  <div key={s.label} className="border border-primary/10 p-3 rounded-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                      <s.icon className="w-3 h-3 text-primary/40" />
                      <span className="text-[10px] text-primary/40 uppercase tracking-wider">{s.label}</span>
                    </div>
                    <span className="text-sm font-bold text-[#00ff88]">{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Anomaly feed */}
              <div>
                <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-3">
                  Active Anomalies {selectedAnomalies.filter(a => !a.resolved).length > 0 && (
                    <span className="text-red-400 ml-1">({selectedAnomalies.filter(a => !a.resolved).length})</span>
                  )}
                </div>

                {loadingAnomalies ? (
                  <div className="space-y-2">
                    {[1, 2].map(i => <div key={i} className="h-20 border border-primary/10 animate-pulse rounded-sm" />)}
                  </div>
                ) : selectedAnomalies.filter(a => !a.resolved).length === 0 ? (
                  <div className="border border-[#00ff88]/20 bg-[#00ff88]/5 p-4 rounded-sm text-center">
                    <Shield className="w-5 h-5 text-[#00ff88] mx-auto mb-2" />
                    <span className="text-xs text-[#00ff88]/80">No active anomalies — device behavior is within baseline</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedAnomalies
                      .filter(a => !a.resolved)
                      .sort((a, b) => b.anomalyScore - a.anomalyScore)
                      .map(anomaly => (
                        <AnomalyCard
                          key={anomaly.id}
                          anomaly={anomaly}
                          onResolve={id => resolveMut.mutate(id)}
                          onBlock={ip => blockMut.mutate({ ip, key: selectedDevice.peerPublicKey })}
                        />
                      ))
                    }
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="border border-primary/10 p-8 text-center rounded-sm">
              <Radar className="w-8 h-8 text-primary/20 mx-auto mb-3" />
              <span className="text-sm text-primary/30">Select a device to view behavioral analysis</span>
            </div>
          )}
        </div>
      </div>

      {/* ── How It Works ────────────────────────────────────────────────── */}
      <div className="border border-primary/10 p-4 rounded-sm">
        <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-3">How Ghost Trace Works</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {[
            {
              step: "01",
              icon: Database,
              title: "WireGuard Telemetry",
              desc: "Per-peer traffic stats are collected from every VPN node — bytes transferred, destination counts, timing patterns.",
            },
            {
              step: "02",
              icon: Activity,
              title: "Baseline Learning",
              desc: "Each device's normal traffic profile is learned: hourly volumes, typical destination count, active hours.",
            },
            {
              step: "03",
              icon: Radar,
              title: "Anomaly Detection",
              desc: "Deviations from baseline trigger scoring: beacon intervals, volume spikes, off-hours activity, known-bad IPs.",
            },
            {
              step: "04",
              icon: ZapOff,
              title: "Instant Response",
              desc: "One-click block suspicious destinations via the built-in firewall. No agent on the device required.",
            },
          ].map(s => (
            <div key={s.step} className="flex gap-3">
              <span className="text-[#00ff88]/30 text-lg font-bold shrink-0">{s.step}</span>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon className="w-3 h-3 text-[#00ff88]/60" />
                  <span className="text-[#00ff88]/80 font-bold text-[11px] uppercase tracking-wide">{s.title}</span>
                </div>
                <span className="text-primary/40 leading-relaxed">{s.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
