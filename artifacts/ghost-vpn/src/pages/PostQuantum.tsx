// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield, Key, RefreshCw, Download, CheckCircle2,
  AlertTriangle, Lock, Zap, Clock, Info, Atom, FlaskConical,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const QA_BASE_PQ = import.meta.env.BASE_URL?.replace(/\/ghost-vpn\/?$/, "") ?? "";

function QuantumBlockchainThreatPanel() {
  const [qa, setQa] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${QA_BASE_PQ}/api/quantum-audit/cc-summary`, { credentials: "include" });
        if (r.ok) setQa(await r.json());
      } catch { /* best-effort */ }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  if (!qa) return null;

  const pct = qa.progress?.pct ?? 0;
  const totalSigs = qa.signatures?.totalSigs ?? 0;
  const addresses = qa.signatures?.addresses ?? 0;
  const keys = qa.keys?.recovered ?? 0;
  const unknownChain = qa.progress?.unknownChain ?? 0;

  return (
    <div className="border border-cyan-500/20 bg-black p-4 space-y-4 font-mono">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Atom className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] text-cyan-400/70 uppercase tracking-widest">Blockchain Quantum-Vulnerability Scan</span>
        </div>
        <Badge variant="outline" className="text-[8px] font-mono border-cyan-400/30 text-cyan-400/60">QUANTUMAUDIT</Badge>
      </div>

      <p className="text-[10px] text-primary/40 leading-relaxed">
        Classical ECDSA (secp256k1) signatures — used by every Ethereum, Bitcoin, and EVM-compatible transaction — are vulnerable to quantum attacks via Shor's algorithm.
        QuantumAudit mines live transaction hashes to find wallets with exploitable nonce reuse <em>today</em>, before quantum computers arrive.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "ECDSA Sigs Mined", value: totalSigs.toLocaleString(), color: "text-cyan-400", sub: "secp256k1 signatures" },
          { label: "Wallets Indexed", value: addresses.toLocaleString(), color: "text-primary/60", sub: "unique addresses" },
          { label: "Scan Coverage", value: `${pct}%`, color: "text-orange-400", sub: "of tx hash queue" },
          { label: "Keys Recovered", value: keys, color: keys > 0 ? "text-red-400" : "text-primary/20", sub: keys > 0 ? "CRITICAL" : "none yet" },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="border border-primary/10 p-2 text-center">
            <div className={`text-base font-bold ${color}`}>{value}</div>
            <div className="text-[9px] text-primary/30 uppercase">{label}</div>
            <div className={`text-[8px] ${color} opacity-60`}>{sub}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="text-[10px] text-primary/40 uppercase tracking-widest">Quantum Attack Vectors Monitored</div>
        {[
          { label: "Nonce Reuse (k-reuse)", detail: "Two transactions share the same ephemeral nonce → private key derivable via simple algebra", severity: "critical" },
          { label: "Shor's Algorithm", detail: "Future quantum computer can break secp256k1 ECDLP — harvested public keys are permanently at risk", severity: "future" },
          { label: "Weak RNG Bias", detail: "Biased random number generators produce predictable nonces → key recovery possible classically", severity: "high" },
        ].map(({ label, detail, severity }) => (
          <div key={label} className="flex gap-2 border border-primary/8 px-2 py-1.5 text-[10px]">
            <span className={`shrink-0 border px-1 text-[9px] uppercase ${severity === "critical" ? "border-red-400/30 text-red-400" : severity === "high" ? "border-orange-400/30 text-orange-400" : "border-yellow-400/30 text-yellow-400"}`}>{severity}</span>
            <div>
              <div className="text-primary/70 font-bold">{label}</div>
              <div className="text-primary/35 leading-relaxed">{detail}</div>
            </div>
          </div>
        ))}
      </div>

      {unknownChain > 0 && (
        <div className="text-[10px] text-yellow-400/60 border border-yellow-400/15 bg-yellow-900/5 px-2 py-1.5">
          {unknownChain} unresolved tx hashes — unidentified chains, queued for future research
        </div>
      )}
    </div>
  );
}

// ── Engine 5: Sequential / Counter-Derived Nonce Attack Panel ────────────────

const E5_ATTACK_META: Record<string, { label: string; color: string; formula: string; complexity: string; realWorld: string }> = {
  sequential_nonce: {
    label:      "Linear Counter Nonce",
    color:      "text-red-400",
    formula:    "k_i = k₀ + n_i·c (mod N)  →  d = (B₁−B₃−Δ₂Δ₁⁻¹(B₁−B₂))·(…)⁻¹",
    complexity: "O(1) — 3 signatures, pure modular algebra",
    realWorld:  "Android wallets using java.util.Random() with tx counter seed (2012–2014), counter-mode DRBG hardware wallets, minimal IoT signers",
  },
  geometric_nonce: {
    label:      "Geometric Ratio Nonce",
    color:      "text-red-400",
    formula:    "k_{i+1} = k_i·a (mod N)  →  quadratic equation in d",
    complexity: "O(1) — 3 consecutive txs + Tonelli-Shanks sqrt mod N",
    realWorld:  "Multiplicative congruential generators (MCG), LCG multiplier-only mode, LFSR-based nonce schemes",
  },
  low_s_violation: {
    label:      "EIP-2 High-S Violation",
    color:      "text-orange-400",
    formula:    "s > N/2  →  canonical form requires s = N − s, v XOR 1",
    complexity: "O(1) per signature",
    realWorld:  "Pre-Homestead wallets (block < 1,150,000), signing libraries missing BIP62 low-s normalization",
  },
  s_entropy_bias: {
    label:      "s-Value Entropy Bias",
    color:      "text-yellow-400",
    formula:    "E[bits(s)] << 254.8  →  k entropy = 255 − E[bits(s)] bits leaked",
    complexity: "LLL lattice on n×n matrix (polynomial time, seconds)",
    realWorld:  "Wallets with truncated k generation, embedded signers not using full 256-bit field",
  },
  lattice_bias_deep: {
    label:      "HNP Lattice Bias",
    color:      "text-yellow-400",
    formula:    "k_i < N/2^ℓ  →  k_i = a_i·d + b_i (mod N); SVP via LLL",
    complexity: "LLL on ℓ-biased lattice — Nguyen-Shparlinski 2002",
    realWorld:  "Biased RNGs, truncated entropy sources, hw wallets with non-uniform k distributions",
  },
};

function Engine5AttackPanel() {
  const [qa, setQa] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${QA_BASE_PQ}/api/quantum-audit/cc-summary`, { credentials: "include" });
        if (r.ok) setQa(await r.json());
      } catch { /* best-effort */ }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const e5 = qa?.engine5;

  return (
    <div className="border border-violet-500/20 bg-black p-4 space-y-4 font-mono">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[10px] text-violet-400/70 uppercase tracking-widest">Engine 5 — Counter-Derived Nonce Attack Suite</span>
        </div>
        <div className="flex items-center gap-2">
          {e5 && (
            <>
              <Badge variant="outline" className="text-[8px] border-violet-400/30 text-violet-400/60">
                {e5.totalFindings} finding{e5.totalFindings !== 1 ? "s" : ""}
              </Badge>
              {e5.keyRecoveries > 0 && (
                <Badge variant="outline" className="text-[8px] border-red-400/50 text-red-400">
                  {e5.keyRecoveries} key{e5.keyRecoveries !== 1 ? "s" : ""} recovered
                </Badge>
              )}
            </>
          )}
          <Badge variant="outline" className="text-[8px] font-mono border-violet-400/30 text-violet-400/60">E5</Badge>
        </div>
      </div>

      <p className="text-[10px] text-primary/40 leading-relaxed">
        Engine 5 detects an overlooked class of ECDSA vulnerability: wallets that derive the signing nonce
        <em> k</em> from the transaction counter or a fixed ratio between successive nonces. Unlike nonce reuse
        (two identical <em>k</em> values), this attack works even when every signature has a <em>different k</em> —
        it requires only 3 transactions and pure modular algebra, with <strong className="text-violet-400">zero brute force</strong>.
      </p>

      {/* Attack vector grid */}
      <div className="space-y-1.5">
        <div className="text-[9px] text-primary/30 uppercase tracking-widest mb-2">5 Detection Algorithms Active</div>
        {Object.entries(E5_ATTACK_META).map(([type, meta]) => {
          const count = e5?.byType?.[type] ?? 0;
          const isOpen = expanded === type;
          return (
            <div key={type} className="border border-primary/8 overflow-hidden">
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-primary/5 transition-colors"
                onClick={() => setExpanded(isOpen ? null : type)}
              >
                <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${count > 0 ? "bg-red-400" : "bg-primary/20"}`} />
                <span className={`text-[10px] font-bold flex-1 ${meta.color}`}>{meta.label}</span>
                <span className={`text-[9px] px-1 ${count > 0 ? "text-red-400" : "text-primary/20"}`}>
                  {count > 0 ? `${count} hit${count !== 1 ? "s" : ""}` : "monitoring"}
                </span>
                <span className="text-[8px] text-primary/20">{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-2 border-t border-primary/8 bg-primary/2">
                  <div className="pt-2 text-[9px] text-primary/50 uppercase tracking-wider">Mathematical Basis</div>
                  <code className="block text-[9px] text-violet-300/80 bg-violet-900/10 border border-violet-500/15 px-2 py-1.5 leading-relaxed break-all">
                    {meta.formula}
                  </code>
                  <div className="grid grid-cols-2 gap-2 text-[9px]">
                    <div>
                      <div className="text-primary/30 uppercase mb-0.5">Complexity</div>
                      <div className="text-primary/60">{meta.complexity}</div>
                    </div>
                    <div>
                      <div className="text-primary/30 uppercase mb-0.5">Real-World Sources</div>
                      <div className="text-primary/60 leading-relaxed">{meta.realWorld}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent E5 findings */}
      {e5?.recentFindings?.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[9px] text-primary/30 uppercase tracking-widest">Recent Engine 5 Hits</div>
          {e5.recentFindings.map((f: any, i: number) => (
            <div key={i} className="border border-violet-500/15 bg-violet-900/5 px-2 py-1.5 text-[9px] space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-violet-400 font-bold">{E5_ATTACK_META[f.kind]?.label ?? f.kind}</span>
                {f.hasKey && <span className="text-red-400 font-bold">⚠ KEY RECOVERED</span>}
              </div>
              <div className="text-primary/40 font-mono">{f.address}</div>
              <div className="text-primary/30 leading-relaxed">{f.detail?.slice(0, 120)}…</div>
            </div>
          ))}
        </div>
      )}

      {/* Developer note */}
      <div className="border border-violet-500/10 bg-violet-900/5 px-3 py-2 text-[9px] text-violet-400/50 leading-relaxed space-y-1">
        <div className="text-violet-400/80 font-bold text-[10px]">Security Research Note</div>
        <p>
          Engine 5 demonstrates that ECDSA key exposure is not limited to identical nonce reuse. Any deterministic
          relationship between successive signing nonces — linear, geometric, or otherwise — collapses the security
          of the private key to a system of modular equations solvable in microseconds.
        </p>
        <p>
          Defense: use RFC 6979 deterministic nonce generation correctly (include ALL context: key, hash, chain ID, and application tag),
          or use EdDSA (Ed25519) which derives nonces from the message itself and is structurally immune to this class of attack.
        </p>
      </div>
    </div>
  );
}

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

          <QuantumBlockchainThreatPanel />
          <Engine5AttackPanel />
        </div>
      </div>
    </div>
  );
}
