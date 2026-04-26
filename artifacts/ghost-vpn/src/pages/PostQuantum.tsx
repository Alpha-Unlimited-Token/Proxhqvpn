import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield, Key, RefreshCw, Download, CheckCircle2,
  AlertTriangle, Lock, Zap, Clock, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api  = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}/api/pqc${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts }).then(r => r.json());

interface AlgoOption { id: string; label: string; bits: number; recommended: boolean; speed: string; }
interface PqcData {
  settings:   { enabled: boolean; algorithm: string; hybridMode: boolean; rotateKeys: boolean; keyRotationHours: number };
  keyPair:    { publicKey: string; algorithm: string; generatedAt: string; expiresAt: string } | null;
  keysExpired: boolean;
  status:     "active" | "keys_expired" | "disabled";
  threat:     { title: string; description: string; risk: "mitigated" | "exposed" };
  algorithms: AlgoOption[];
}

export default function PostQuantum() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<PqcData>({
    queryKey: ["pqc-settings"],
    queryFn: () => api("/settings"),
    refetchInterval: 30000,
  });

  const [localAlgo, setLocalAlgo] = useState<string>("");

  const saveSettings = useMutation({
    mutationFn: (body: Record<string, unknown>) => api("/settings", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pqc-settings"] }); toast({ title: "Settings Saved" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const generateKeys = useMutation({
    mutationFn: () => api("/generate-keys", { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pqc-settings"] }); toast({ title: "Key Pair Generated", description: "New ML-KEM keys ready for injection." }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { data: configData, refetch: fetchConfig } = useQuery<{ config: string | null; message?: string }>({
    queryKey: ["pqc-wg-config"],
    queryFn: () => api("/wireguard-config"),
    enabled: false,
  });

  const algo = localAlgo || data?.settings.algorithm || "ML-KEM-768";

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-primary/40 font-mono text-sm">Loading quantum shield…</div>;
  }

  const s = data!;
  const statusColors: Record<string, string> = {
    active:       "text-primary border-primary",
    keys_expired: "text-yellow-400 border-yellow-500",
    disabled:     "text-primary/40 border-primary/20",
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <Lock className="w-6 h-6" /> Post-Quantum Encryption
          </h2>
          <p className="text-sm text-primary/50 mt-1 font-mono">
            Hybrid ML-KEM + Curve25519 — future-proof your WireGuard sessions against quantum computers
          </p>
        </div>
        <Badge variant="outline" className={`text-xs uppercase font-mono ${statusColors[s.status]}`}>
          {s.status.replace("_", " ")}
        </Badge>
      </div>

      {/* Threat banner */}
      <div className={`border p-4 rounded ${s.threat.risk === "exposed" ? "border-yellow-500/40 bg-yellow-500/5" : "border-primary/30 bg-primary/5"}`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${s.threat.risk === "exposed" ? "text-yellow-400" : "text-primary"}`} />
          <div>
            <div className={`text-xs font-mono font-bold uppercase tracking-widest mb-1 ${s.threat.risk === "exposed" ? "text-yellow-400" : "text-primary"}`}>
              {s.threat.title}
            </div>
            <p className="text-[11px] font-mono text-primary/60 leading-relaxed">{s.threat.description}</p>
            <div className="mt-2">
              <span className={`text-[9px] font-mono uppercase px-2 py-0.5 border rounded ${s.threat.risk === "mitigated" ? "border-primary/40 text-primary/70" : "border-yellow-500/40 text-yellow-400/80"}`}>
                {s.threat.risk === "mitigated" ? "✓ Risk Mitigated" : "⚠ Risk: Exposed"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Controls */}
        <div className="space-y-4">
          {/* Enable toggle */}
          <div className="border border-primary/20 bg-black p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-mono font-bold text-primary">POST-QUANTUM ENCRYPTION</div>
                <div className="text-[10px] text-primary/40 font-mono mt-0.5">Hybrid ML-KEM + X25519 WireGuard PSK</div>
              </div>
              <button
                onClick={() => saveSettings.mutate({ enabled: !s.settings.enabled })}
                className={`relative w-10 h-5 rounded-full transition-colors ${s.settings.enabled ? "bg-primary" : "bg-primary/20"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-black transition-transform ${s.settings.enabled ? "left-5.5 translate-x-0.5" : "left-0.5"}`} />
              </button>
            </div>

            {/* Hybrid mode */}
            <div className="flex items-center justify-between pt-2 border-t border-primary/10">
              <div>
                <div className="text-[10px] font-mono text-primary/70">Hybrid Mode</div>
                <div className="text-[9px] text-primary/40 font-mono">Classical + Post-Quantum — recommended</div>
              </div>
              <button
                onClick={() => saveSettings.mutate({ hybridMode: !s.settings.hybridMode })}
                className={`relative w-8 h-4 rounded-full transition-colors ${s.settings.hybridMode ? "bg-primary/60" : "bg-primary/20"}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-black transition-transform ${s.settings.hybridMode ? "left-4.5" : "left-0.5"}`} />
              </button>
            </div>

            {/* Auto key rotation */}
            <div className="flex items-center justify-between border-t border-primary/10 pt-2">
              <div>
                <div className="text-[10px] font-mono text-primary/70">Auto Key Rotation</div>
                <div className="text-[9px] text-primary/40 font-mono">Rotate PQC keys every {s.settings.keyRotationHours}h</div>
              </div>
              <button
                onClick={() => saveSettings.mutate({ rotateKeys: !s.settings.rotateKeys })}
                className={`relative w-8 h-4 rounded-full transition-colors ${s.settings.rotateKeys ? "bg-primary/60" : "bg-primary/20"}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-black transition-transform ${s.settings.rotateKeys ? "left-4.5" : "left-0.5"}`} />
              </button>
            </div>
          </div>

          {/* Algorithm selection */}
          <div className="border border-primary/20 bg-black p-4 space-y-3">
            <div className="text-[10px] font-mono text-primary/40 tracking-widest">KEY EXCHANGE ALGORITHM</div>
            {s.algorithms.map(a => (
              <button
                key={a.id}
                onClick={() => { setLocalAlgo(a.id); saveSettings.mutate({ algorithm: a.id }); }}
                className={`w-full flex items-center gap-3 p-2.5 border transition-colors text-left ${algo === a.id ? "border-primary/60 bg-primary/10" : "border-primary/15 hover:border-primary/30"}`}
              >
                <div className={`w-2 h-2 rounded-full border ${algo === a.id ? "bg-primary border-primary" : "border-primary/30"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono font-semibold text-primary">{a.label}</div>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[9px] text-primary/30 font-mono">{a.bits}-bit</span>
                    <span className="text-[9px] text-primary/30 font-mono">speed: {a.speed}</span>
                    {a.recommended && <span className="text-[9px] text-primary font-mono">✓ recommended</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Key rotation interval */}
          <div className="border border-primary/20 bg-black p-4 space-y-2">
            <div className="text-[10px] font-mono text-primary/40 tracking-widest">KEY ROTATION INTERVAL</div>
            <div className="flex flex-wrap gap-1">
              {[6, 12, 24, 48, 72, 168].map(h => (
                <button key={h} onClick={() => saveSettings.mutate({ keyRotationHours: h })}
                  className={`text-[9px] font-mono px-2 py-1 border transition-colors ${s.settings.keyRotationHours === h ? "border-primary bg-primary/10 text-primary" : "border-primary/20 text-primary/40 hover:border-primary/40"}`}>
                  {h < 24 ? `${h}h` : `${h / 24}d`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Key status + WireGuard config */}
        <div className="space-y-4">
          {/* Current key info */}
          <div className="border border-primary/20 bg-black p-4 space-y-3">
            <div className="text-[10px] font-mono text-primary/40 tracking-widest">ACTIVE KEY PAIR</div>
            {s.keyPair ? (
              <div className="space-y-2">
                <div>
                  <div className="text-[9px] text-primary/30 font-mono">Algorithm</div>
                  <code className="text-[10px] text-primary font-mono">{s.keyPair.algorithm}</code>
                </div>
                <div>
                  <div className="text-[9px] text-primary/30 font-mono">Public Key (truncated)</div>
                  <code className="text-[9px] text-primary/60 font-mono break-all">{s.keyPair.publicKey}</code>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[9px] text-primary/30 font-mono">Generated</div>
                    <div className="text-[9px] text-primary/60 font-mono">{new Date(s.keyPair.generatedAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-primary/30 font-mono">Expires</div>
                    <div className={`text-[9px] font-mono ${s.keysExpired ? "text-yellow-400" : "text-primary/60"}`}>
                      {s.keysExpired ? "EXPIRED" : new Date(s.keyPair.expiresAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[10px] font-mono text-primary/30 py-4 text-center">No keys generated yet</div>
            )}
            <Button size="sm" variant="outline"
              className="w-full border-primary/40 text-primary/70 hover:bg-primary/10 text-xs font-mono"
              onClick={() => generateKeys.mutate()} disabled={generateKeys.isPending}>
              {generateKeys.isPending ? <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" /> : <Key className="w-3 h-3 mr-1.5" />}
              {s.keysExpired ? "REGENERATE EXPIRED KEYS" : "GENERATE NEW KEY PAIR"}
            </Button>
          </div>

          {/* WireGuard config with PSK */}
          <div className="border border-primary/20 bg-black p-4 space-y-3">
            <div className="text-[10px] font-mono text-primary/40 tracking-widest">WIREGUARD CONFIG WITH PQC PSK</div>
            <p className="text-[10px] font-mono text-primary/40 leading-relaxed">
              Generate a WireGuard config that injects the PQ pre-shared key. Copy this to your WireGuard client to activate quantum-safe encryption.
            </p>
            <Button size="sm" variant="outline"
              className="w-full border-primary/30 text-primary/60 hover:bg-primary/10 text-xs font-mono"
              onClick={() => fetchConfig()}>
              <Download className="w-3 h-3 mr-1.5" /> GENERATE CONFIG
            </Button>

            {configData?.config && (
              <div className="mt-2">
                <pre className="text-[9px] font-mono text-primary/50 bg-black border border-primary/10 p-3 max-h-48 overflow-auto whitespace-pre-wrap leading-relaxed">
                  {configData.config}
                </pre>
                <button className="mt-2 text-[9px] font-mono text-primary/40 hover:text-primary transition-colors"
                  onClick={() => { navigator.clipboard.writeText(configData.config!); toast({ title: "Config Copied" }); }}>
                  Copy to clipboard
                </button>
              </div>
            )}
            {configData?.message && !configData.config && (
              <div className="text-[10px] font-mono text-yellow-400/70 border border-yellow-500/20 px-3 py-2 mt-2">
                {configData.message}
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="border border-primary/10 bg-primary/3 p-4 space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-mono text-primary/50 tracking-widest">
              <Info className="w-3.5 h-3.5" /> HOW IT WORKS
            </div>
            <ul className="space-y-1.5 text-[10px] font-mono text-primary/40 leading-relaxed">
              <li><span className="text-primary/60">1.</span> Your device generates an ML-KEM key pair alongside the standard Curve25519 WireGuard key</li>
              <li><span className="text-primary/60">2.</span> Both keys participate in the handshake — the server combines them into a pre-shared key</li>
              <li><span className="text-primary/60">3.</span> Session traffic is encrypted with AES-256-GCM, keyed from both the classical + post-quantum exchange</li>
              <li><span className="text-primary/60">4.</span> Even if a future quantum computer breaks Curve25519, the ML-KEM component keeps your session private</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
