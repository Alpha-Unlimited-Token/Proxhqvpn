// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useCallback } from "react";
import { Gauge, Wifi, ArrowDown, ArrowUp, Clock, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SpeedResult {
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  jitterMs: number;
  serverIp: string;
  serverRegion: string;
  timestamp: string;
  status: "ok" | "error";
  error?: string;
}

function GaugeMeter({ value, max, label, unit, color }: { value: number; max: number; label: string; unit: string; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const circumference = 2 * Math.PI * 54;
  const dash = (pct / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="54" fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{value > 0 ? value.toFixed(1) : "—"}</span>
          <span className="text-xs text-white/40">{unit}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-white/60 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function StatBadge({ icon: Icon, label, value, color }: { icon: typeof ArrowDown; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
      <Icon className={`w-4 h-4 shrink-0 ${color}`} />
      <div>
        <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

export default function SpeedTest() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SpeedResult | null>(null);
  const [phase, setPhase] = useState<"idle" | "ping" | "download" | "upload" | "done">("idle");
  const { toast } = useToast();

  const runTest = useCallback(async () => {
    setRunning(true);
    setResult(null);
    setPhase("ping");

    try {
      const pingRes = await fetch("/api/speedtest/ping");
      setPhase("download");
      if (!pingRes.ok) throw new Error("Ping test failed");

      const dlRes = await fetch("/api/speedtest/download");
      setPhase("upload");
      if (!dlRes.ok) throw new Error("Download test failed");

      const ulRes = await fetch("/api/speedtest/upload", { method: "POST", body: JSON.stringify({}), headers: { "Content-Type": "application/json" } });
      setPhase("done");
      if (!ulRes.ok) throw new Error("Upload test failed");

      const [ping, dl, ul] = await Promise.all([
        pingRes.json() as Promise<{ pingMs: number; jitterMs: number; serverIp: string; serverRegion: string }>,
        dlRes.json() as Promise<{ downloadMbps: number }>,
        ulRes.json() as Promise<{ uploadMbps: number }>,
      ]);

      setResult({
        downloadMbps: dl.downloadMbps,
        uploadMbps: ul.uploadMbps,
        pingMs: ping.pingMs,
        jitterMs: ping.jitterMs,
        serverIp: ping.serverIp,
        serverRegion: ping.serverRegion,
        timestamp: new Date().toISOString(),
        status: "ok",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Speed test failed";
      toast({ title: "Speed Test Failed", description: msg, variant: "destructive" });
      setResult({ downloadMbps: 0, uploadMbps: 0, pingMs: 0, jitterMs: 0, serverIp: "", serverRegion: "", timestamp: new Date().toISOString(), status: "error", error: msg });
    } finally {
      setRunning(false);
      if (phase !== "done") setPhase("done");
    }
  }, [toast, phase]);

  const phaseLabel: Record<typeof phase, string> = {
    idle: "Ready",
    ping: "Measuring latency...",
    download: "Testing download speed...",
    upload: "Testing upload speed...",
    done: "Complete",
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Gauge className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-white">VPN Speed Test</h1>
          </div>
          <p className="text-sm text-white/50">
            Measure your tunneled download, upload, and latency through ProxhqVPN's GhostNet infrastructure.
          </p>
        </div>

        {/* Run button */}
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] py-10 px-6">
          <div className={`w-28 h-28 rounded-full border-4 flex items-center justify-center transition-colors ${running ? "border-primary/60 bg-primary/10 animate-pulse" : "border-white/20 bg-white/[0.04]"}`}>
            <Wifi className={`w-10 h-10 ${running ? "text-primary" : "text-white/30"}`} />
          </div>
          <p className="text-sm text-white/50">{phaseLabel[phase]}</p>
          <button
            onClick={runTest}
            disabled={running}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-black font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Gauge className="w-4 h-4" />
            )}
            {running ? "Running..." : result ? "Run Again" : "Start Speed Test"}
          </button>
        </div>

        {/* Results */}
        {result && result.status === "ok" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle className="w-4 h-4" />
              Test completed — {new Date(result.timestamp).toLocaleTimeString()}
            </div>

            {/* Gauges */}
            <div className="grid grid-cols-3 gap-4 rounded-2xl border border-white/10 bg-white/[0.03] py-8 px-4">
              <GaugeMeter value={result.downloadMbps} max={500} label="Download" unit="Mbps" color="#00ff88" />
              <GaugeMeter value={result.uploadMbps}   max={200} label="Upload"   unit="Mbps" color="#38bdf8" />
              <GaugeMeter value={result.pingMs}        max={200} label="Latency"  unit="ms"   color="#f59e0b" />
            </div>

            {/* Stat badges */}
            <div className="grid grid-cols-2 gap-3">
              <StatBadge icon={ArrowDown} label="Download"  value={`${result.downloadMbps.toFixed(1)} Mbps`} color="text-primary" />
              <StatBadge icon={ArrowUp}   label="Upload"    value={`${result.uploadMbps.toFixed(1)} Mbps`}   color="text-sky-400" />
              <StatBadge icon={Clock}     label="Ping"      value={`${result.pingMs.toFixed(1)} ms`}          color="text-amber-400" />
              <StatBadge icon={Wifi}      label="Jitter"    value={`${result.jitterMs.toFixed(1)} ms`}        color="text-violet-400" />
            </div>

            {/* Server info */}
            {result.serverIp && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/40 space-y-0.5">
                <p>Server: <span className="text-white/70">{result.serverRegion || "ProxhqVPN GhostNet Node"}</span></p>
                <p>IP: <span className="text-white/70 font-mono">{result.serverIp}</span></p>
              </div>
            )}
          </div>
        )}

        {result && result.status === "error" && (
          <div className="flex items-start gap-3 rounded-xl border border-red-900/40 bg-red-950/20 p-4">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-red-300">Speed test failed</p>
              <p className="text-xs text-red-400/80">{result.error}</p>
            </div>
          </div>
        )}

        {/* Info footer */}
        <div className="text-xs text-white/25 text-center space-y-1">
          <p>Speed test runs through your active WireGuard tunnel. Results reflect real tunnel throughput.</p>
          <p>For accurate results, close bandwidth-heavy applications before running the test.</p>
        </div>

      </div>
    </div>
  );
}
