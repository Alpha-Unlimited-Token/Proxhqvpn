// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EyeOff, Zap, RefreshCw, Terminal, Info, AlertTriangle, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api  = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}/api/daita${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts }).then(r => r.json());

interface DaitaData {
  settings: {
    enabled: boolean; intensity: number;
    packetPaddingMin: number; packetPaddingMax: number;
    timingJitterMin: number; timingJitterMax: number;
    dummyPacketRate: number; morphTraffic: boolean;
  };
  threat: { title: string; description: string; techniques: string[]; risk: string };
  presets: { id: string; label: string; intensity: number; desc: string }[];
}

export default function Daita() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showRules, setShowRules] = useState(false);

  const { data, isLoading } = useQuery<DaitaData>({
    queryKey: ["daita-settings"],
    queryFn: () => api("/settings"),
    refetchInterval: 30000,
  });

  const { data: rulesData, refetch: fetchRules } = useQuery<{ rules: string | null; message?: string }>({
    queryKey: ["daita-rules"],
    queryFn: () => api("/rules"),
    enabled: false,
  });

  const saveSettings = useMutation({
    mutationFn: (body: Record<string, unknown>) => api("/settings", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["daita-settings"] }); toast({ title: "DAITA Settings Updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-primary/40 font-mono text-sm">Initializing DAITA…</div>;
  }

  const s = data!.settings;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <EyeOff className="w-6 h-6" /> DAITA
          </h2>
          <p className="text-sm text-primary/50 mt-1 font-mono">
            Defense Against AI Traffic Analysis — defeats fingerprinting attacks on encrypted VPN traffic
          </p>
        </div>
        <Badge variant="outline" className={`text-xs uppercase font-mono ${s.enabled ? "text-primary border-primary" : "text-primary/30 border-primary/20"}`}>
          {s.enabled ? "ACTIVE" : "DISABLED"}
        </Badge>
      </div>

      {/* Threat panel */}
      <div className={`border p-4 ${s.enabled ? "border-primary/30 bg-primary/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${s.enabled ? "text-primary" : "text-yellow-400"}`} />
          <div className="flex-1">
            <div className={`text-xs font-mono font-bold uppercase tracking-widest mb-1 ${s.enabled ? "text-primary" : "text-yellow-400"}`}>
              {data!.threat.title}
            </div>
            <p className="text-[11px] font-mono text-primary/55 leading-relaxed mb-2">{data!.threat.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {data!.threat.techniques.map(t => (
                <div key={t} className="flex items-center gap-1.5 text-[9px] font-mono text-primary/40">
                  <ChevronRight className="w-2.5 h-2.5 text-yellow-400/60 shrink-0" /> {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Enable + presets */}
        <div className="space-y-4">
          {/* Master toggle */}
          <div className="border border-primary/20 bg-black p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-mono font-bold text-primary">DAITA PROTECTION</div>
                <div className="text-[10px] text-primary/40 font-mono mt-0.5">Packet morphing + timing randomization</div>
              </div>
              <button
                onClick={() => saveSettings.mutate({ enabled: !s.enabled })}
                className={`relative w-10 h-5 rounded-full transition-colors ${s.enabled ? "bg-primary" : "bg-primary/20"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-black transition-transform ${s.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>

          {/* Presets */}
          <div className="border border-primary/20 bg-black p-4 space-y-3">
            <div className="text-[10px] font-mono text-primary/40 tracking-widest">PROTECTION PRESETS</div>
            {data!.presets.map(p => (
              <button key={p.id}
                onClick={() => saveSettings.mutate({ applyPreset: p.id, enabled: true })}
                className={`w-full flex items-center gap-3 p-2.5 border text-left transition-colors ${s.intensity === p.intensity && s.enabled ? "border-primary/60 bg-primary/10" : "border-primary/15 hover:border-primary/30"}`}
              >
                <div className={`w-2 h-2 rounded-full border ${s.intensity === p.intensity && s.enabled ? "bg-primary border-primary" : "border-primary/30"}`} />
                <div>
                  <div className="text-[10px] font-mono font-semibold text-primary">{p.label} (intensity {p.intensity}/10)</div>
                  <div className="text-[9px] font-mono text-primary/40">{p.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Intensity slider */}
          <div className="border border-primary/20 bg-black p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono text-primary/40 tracking-widest">INTENSITY</div>
              <span className="text-xs font-mono text-primary font-bold">{s.intensity}/10</span>
            </div>
            <input type="range" min={1} max={10} value={s.intensity}
              onChange={e => saveSettings.mutate({ intensity: parseInt(e.target.value) })}
              className="w-full accent-primary h-1" />
            <div className="flex justify-between text-[9px] font-mono text-primary/30">
              <span>Low overhead</span><span>Max protection</span>
            </div>
          </div>

          {/* Traffic morphing toggle */}
          <div className="border border-primary/20 bg-black p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-primary/70">Traffic Morphing</div>
                <div className="text-[9px] text-primary/30 font-mono">Reshape packet size distribution to uniform</div>
              </div>
              <button
                onClick={() => saveSettings.mutate({ morphTraffic: !s.morphTraffic })}
                className={`relative w-8 h-4 rounded-full transition-colors ${s.morphTraffic ? "bg-primary/60" : "bg-primary/20"}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-black transition-transform ${s.morphTraffic ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Advanced params + rules */}
        <div className="space-y-4">
          {/* Current params */}
          <div className="border border-primary/20 bg-black p-4 space-y-3">
            <div className="text-[10px] font-mono text-primary/40 tracking-widest">CURRENT PARAMETERS</div>
            {[
              { label: "Packet Padding", value: `${s.packetPaddingMin}–${s.packetPaddingMax} bytes` },
              { label: "Timing Jitter",  value: `${s.timingJitterMin}–${s.timingJitterMax} ms` },
              { label: "Dummy Packets",  value: s.dummyPacketRate > 0 ? `${s.dummyPacketRate}/sec` : "disabled" },
              { label: "Traffic Morph",  value: s.morphTraffic ? "enabled" : "disabled" },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center border-b border-primary/8 pb-2 last:border-0 last:pb-0">
                <span className="text-[10px] font-mono text-primary/40">{row.label}</span>
                <span className="text-[10px] font-mono text-primary">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Custom params */}
          <div className="border border-primary/20 bg-black p-4 space-y-3">
            <div className="text-[10px] font-mono text-primary/40 tracking-widest">CUSTOM PARAMETERS</div>
            {[
              { label: "Dummy Packet Rate (pps)", key: "dummyPacketRate", min: 0, max: 50, val: s.dummyPacketRate },
              { label: "Max Padding Bytes",        key: "packetPaddingMax", min: 0, max: 9000, val: s.packetPaddingMax },
              { label: "Max Jitter (ms)",           key: "timingJitterMax", min: 0, max: 2000, val: s.timingJitterMax },
            ].map(p => (
              <div key={p.key}>
                <div className="flex justify-between mb-1">
                  <label className="text-[9px] font-mono text-primary/40">{p.label}</label>
                  <span className="text-[9px] font-mono text-primary">{p.val}</span>
                </div>
                <input type="range" min={p.min} max={p.max} value={p.val}
                  onChange={e => saveSettings.mutate({ [p.key]: parseInt(e.target.value) })}
                  className="w-full accent-primary h-1" />
              </div>
            ))}
          </div>

          {/* Generate kernel rules */}
          <div className="border border-primary/20 bg-black p-4 space-y-3">
            <div className="text-[10px] font-mono text-primary/40 tracking-widest">KERNEL RULES</div>
            <p className="text-[10px] font-mono text-primary/40">
              Generate <code className="text-primary/60">tc</code> + <code className="text-primary/60">iptables</code> rules to apply DAITA traffic shaping at the OS level.
            </p>
            <Button size="sm" variant="outline" className="w-full border-primary/30 text-primary/60 hover:bg-primary/10 text-xs font-mono"
              onClick={() => { fetchRules(); setShowRules(true); }}>
              <Terminal className="w-3 h-3 mr-1.5" /> GENERATE RULES
            </Button>
            {showRules && rulesData?.rules && (
              <pre className="text-[9px] font-mono text-primary/50 bg-black border border-primary/10 p-3 max-h-48 overflow-auto whitespace-pre-wrap leading-relaxed">
                {rulesData.rules}
              </pre>
            )}
            {showRules && rulesData?.message && !rulesData.rules && (
              <div className="text-[10px] font-mono text-primary/40 border border-primary/10 px-3 py-2">{rulesData.message}</div>
            )}
          </div>

          {/* How it works */}
          <div className="border border-primary/10 p-4 space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-mono text-primary/40 tracking-widest">
              <Info className="w-3.5 h-3.5" /> HOW DAITA WORKS
            </div>
            <ul className="space-y-1.5 text-[10px] font-mono text-primary/35 leading-relaxed">
              <li><span className="text-primary/50">Padding:</span> Random bytes appended to packets so all packets appear the same size</li>
              <li><span className="text-primary/50">Jitter:</span> Randomized inter-packet delays defeat timing correlation attacks</li>
              <li><span className="text-primary/50">Dummies:</span> Fake packets injected to disrupt traffic flow analysis</li>
              <li><span className="text-primary/50">Morphing:</span> Reshapes the statistical distribution of packet sizes to a uniform profile</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
