// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, Clock, Server, Zap, ArrowRight,
  ToggleLeft, ToggleRight, History, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api  = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}/api/iprotator${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts }).then(r => r.json());

interface Node { id: number; name: string; ipAddress: string; location: string; layer: string; }
interface RotationEvent { from: number | null; to: number; fromName: string | null; toName: string; rotatedAt: string; triggeredBy: string; }
interface Settings { enabled: boolean; intervalMinutes: number; currentNodeId: number | null; nextRotationAt: string | null; rotationCount: number; }
interface IntervalOpt { minutes: number; label: string; }
interface RotatorData {
  settings: Settings;
  currentNode: Node | null;
  msUntilNext: number | null;
  logs: RotationEvent[];
  availableNodes: Node[];
  intervalOptions: IntervalOpt[];
}

function Countdown({ ms }: { ms: number }) {
  const [rem, setRem] = useState(ms);
  useEffect(() => {
    const t = setInterval(() => setRem(r => Math.max(0, r - 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.floor(rem / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return <span>{h > 0 ? `${h}h ` : ""}{m % 60}m {s % 60}s</span>;
}

export default function IpRotator() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<RotatorData>({
    queryKey: ["iprotator-settings"],
    queryFn: () => api("/settings"),
    refetchInterval: 10000,
  });

  const saveSettings = useMutation({
    mutationFn: (body: Partial<Settings>) => api("/settings", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["iprotator-settings"] }); toast({ title: "Rotator Settings Updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rotate = useMutation({
    mutationFn: () => api("/rotate", { method: "POST" }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["iprotator-settings"] });
      toast({ title: "IP Rotated", description: d.message });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-primary/40 font-mono text-sm">Loading rotator…</div>;
  }

  const d = data!;
  const s = d.settings;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <RefreshCw className="w-6 h-6" /> IP Rotator
          </h2>
          <p className="text-sm text-primary/50 mt-1 font-mono">
            Automatically rotate your VPN exit IP on a schedule — no disconnect required
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs font-mono ${s.enabled ? "text-primary border-primary" : "text-primary/30 border-primary/20"}`}>
            {s.enabled ? "ROTATING" : "STOPPED"}
          </Badge>
          {s.rotationCount > 0 && (
            <Badge variant="outline" className="text-xs font-mono border-primary/20 text-primary/40">
              {s.rotationCount} ROTATION{s.rotationCount !== 1 ? "S" : ""}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Controls */}
        <div className="space-y-4">
          {/* Current node display */}
          <div className="border border-primary/20 bg-black p-4 space-y-3">
            <div className="text-[10px] font-mono text-primary/40 tracking-widest">CURRENT EXIT NODE</div>
            {d.currentNode ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 border border-primary/30 bg-primary/5 flex items-center justify-center shrink-0">
                  <Server className="w-4 h-4 text-primary/50" />
                </div>
                <div>
                  <div className="text-sm font-mono font-bold text-primary">{d.currentNode.name}</div>
                  <div className="text-[9px] font-mono text-primary/40">
                    {d.currentNode.ipAddress} · {d.currentNode.location} · {d.currentNode.layer}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[10px] font-mono text-primary/25 py-2">No node selected — enable rotator to auto-assign</div>
            )}

            {/* Countdown */}
            {s.enabled && s.nextRotationAt && (
              <div className="border-t border-primary/10 pt-3 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-primary/30 shrink-0" />
                <div>
                  <div className="text-[9px] font-mono text-primary/30 uppercase">Next rotation in</div>
                  <div className="text-sm font-mono text-primary font-bold">
                    {d.msUntilNext !== null ? <Countdown ms={d.msUntilNext} /> : "—"}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Enable toggle + manual rotate */}
          <div className="border border-primary/20 bg-black p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-mono font-bold text-primary">AUTO ROTATION</div>
                <div className="text-[10px] text-primary/40 font-mono">Rotate exit IP every {s.intervalMinutes < 60 ? `${s.intervalMinutes}m` : `${s.intervalMinutes / 60}h`}</div>
              </div>
              <button
                onClick={() => saveSettings.mutate({ enabled: !s.enabled })}
                className={`relative w-10 h-5 rounded-full transition-colors ${s.enabled ? "bg-primary" : "bg-primary/20"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-black transition-transform ${s.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            <Button size="sm" variant="outline"
              className="w-full border-primary/30 text-primary/60 hover:bg-primary/10 text-xs font-mono"
              onClick={() => rotate.mutate()} disabled={rotate.isPending}>
              {rotate.isPending ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              ROTATE NOW
            </Button>
          </div>

          {/* Interval selection */}
          <div className="border border-primary/20 bg-black p-4 space-y-3">
            <div className="text-[10px] font-mono text-primary/40 tracking-widest">ROTATION INTERVAL</div>
            <div className="grid grid-cols-4 gap-1">
              {d.intervalOptions.map(opt => (
                <button key={opt.minutes} onClick={() => saveSettings.mutate({ intervalMinutes: opt.minutes })}
                  className={`text-[10px] font-mono py-1.5 border transition-colors ${s.intervalMinutes === opt.minutes ? "border-primary bg-primary/10 text-primary" : "border-primary/20 text-primary/40 hover:border-primary/40"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[9px] font-mono text-primary/30 leading-relaxed">
              Shorter intervals provide stronger anonymity but may cause brief reconnection delays. 30–60 minutes is recommended for most use cases.
            </p>
          </div>
        </div>

        {/* Right: Available nodes + rotation log */}
        <div className="space-y-4">
          {/* Available nodes */}
          <div className="border border-primary/20 bg-black p-4 space-y-3">
            <div className="text-[10px] font-mono text-primary/40 tracking-widest">AVAILABLE EXIT NODES ({d.availableNodes.length})</div>
            <div className="space-y-1.5 max-h-52 overflow-auto">
              {d.availableNodes.map(node => (
                <div key={node.id} className={`flex items-center gap-2 p-2 border transition-colors ${node.id === s.currentNodeId ? "border-primary/40 bg-primary/5" : "border-primary/10 hover:border-primary/20"}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${node.id === s.currentNodeId ? "bg-primary" : "bg-primary/20"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-mono text-primary truncate">{node.name}</div>
                    <div className="text-[9px] font-mono text-primary/30">{node.ipAddress} · {node.location}</div>
                  </div>
                  {node.id === s.currentNodeId && (
                    <span className="text-[8px] font-mono text-primary/60 border border-primary/30 px-1">ACTIVE</span>
                  )}
                </div>
              ))}
              {!d.availableNodes.length && (
                <div className="text-[10px] font-mono text-primary/20 py-3 text-center">No VPN nodes configured</div>
              )}
            </div>
          </div>

          {/* Rotation log */}
          <div className="border border-primary/20 bg-black p-4 space-y-3">
            <div className="text-[10px] font-mono text-primary/40 tracking-widest">ROTATION HISTORY</div>
            {d.logs.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-auto">
                {[...d.logs].reverse().map((log, i) => (
                  <div key={i} className="flex items-start gap-2 border-b border-primary/8 pb-2 last:border-0">
                    <div className="mt-0.5 shrink-0">
                      <ArrowRight className="w-3 h-3 text-primary/30" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-[10px] font-mono">
                        <span className="text-primary/40">{log.fromName ?? "—"}</span>
                        <ChevronRight className="w-2.5 h-2.5 text-primary/25" />
                        <span className="text-primary">{log.toName}</span>
                      </div>
                      <div className="flex gap-2 text-[8px] font-mono text-primary/25">
                        <span>{format(new Date(log.rotatedAt), "HH:mm:ss")}</span>
                        <span>·</span>
                        <span className="uppercase">{log.triggeredBy}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] font-mono text-primary/20 py-4 text-center">No rotations yet</div>
            )}
          </div>

          {/* How it works */}
          <div className="border border-primary/10 p-4 space-y-2">
            <div className="text-[9px] font-mono text-primary/35 tracking-widest font-bold">HOW IP ROTATION WORKS</div>
            {[
              "Your VPN exit node changes on a fixed schedule without disconnecting your session",
              "Each rotation picks a different server from your available node pool",
              "Websites and trackers see a different IP address after each rotation cycle",
              "Long-running sessions (downloads, video calls) continue uninterrupted",
            ].map(tip => (
              <div key={tip} className="text-[9px] font-mono text-primary/30 flex gap-1.5">
                <span className="text-primary/40 shrink-0">→</span> {tip}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
