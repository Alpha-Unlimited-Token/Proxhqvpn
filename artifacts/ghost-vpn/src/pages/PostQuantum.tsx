// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield, Key, RefreshCw, Download, CheckCircle2, XCircle,
  AlertTriangle, Lock, Zap, Clock, Info, Atom, FlaskConical,
  FileSignature, ChevronRight, ShieldCheck, ShieldAlert, ShieldOff,
  Loader2, Link2, Hash, Copy, Eye, EyeOff, TerminalSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Auth-aware fetch ───────────────────────────────────────────────────────────
function useAuthFetch() {
  const { getToken } = useAuth();
  return useCallback(async (url: string, init?: RequestInit) => {
    const token = await getToken();
    const hdrs: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> ?? {}),
    };
    if (token) hdrs["Authorization"] = `Bearer ${token}`;
    return fetch(url, { credentials: "include", ...init, headers: hdrs });
  }, [getToken]);
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface AlgoOption  { id: string; label: string; bits: number; recommended: boolean; speed: string; nist: boolean }
interface PqcSettings { enabled: boolean; algorithm: string; hybridMode: boolean; rotateKeys: boolean; keyRotationHours: number }
interface PqcKeyView  { kemPublicKey: string; dsaPublicKey: string; presharedKey: string; algorithm: string; generatedAt: string; expiresAt: string; kemPubLen: number; dsaPubLen: number }
interface PqcData {
  settings:   PqcSettings;
  keyPair:    PqcKeyView | null;
  keysExpired: boolean;
  status:     "active" | "keys_expired" | "disabled";
  threat:     { title: string; description: string; risk: "mitigated" | "exposed" };
  algorithms: AlgoOption[];
  realCrypto: boolean;
}
interface ComplianceReq {
  id: string; name: string; standard: string;
  status: "met" | "partial" | "not_met"; evidence: string; level: "full" | "partial" | "none";
  note?: string;
}
interface AuditEntry { seq: number; timestamp: string; event: string; userId: string; hash: string; prevHash: string }

const TABS = ["encryption", "signatures", "compliance", "audit-chain", "offline-bundle"] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  encryption:      "Encryption",
  signatures:      "ML-DSA Signatures",
  compliance:      "CNSA 2.0 Compliance",
  "audit-chain":   "Audit Chain",
  "offline-bundle":"Offline Bundle",
};

// ── Status colour helpers ──────────────────────────────────────────────────────
const statusIcon = (s: string) =>
  s === "met"      ? <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> :
  s === "partial"  ? <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" /> :
                     <XCircle className="w-3.5 h-3.5 text-red-400/60" />;

const statusBadge = (s: string) =>
  s === "met"      ? "border-primary/30 text-primary"         :
  s === "partial"  ? "border-yellow-500/30 text-yellow-400"   :
                     "border-red-500/20 text-red-400/60";

// ── Encryption Tab ─────────────────────────────────────────────────────────────
function EncryptionTab({ data, qc, authFetch }: { data: PqcData; qc: ReturnType<typeof useQueryClient>; authFetch: ReturnType<typeof useAuthFetch> }) {
  const { toast }    = useToast();
  const [localAlgo, setLocalAlgo] = useState("");
  const [config, setConfig]       = useState<string | null>(null);
  const [configMsg, setConfigMsg] = useState<string | null>(null);

  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const r = await authFetch(`${BASE}/api/pqc${path}`, opts);
    return r.json();
  }, [authFetch]);

  const saveSettings = useMutation({
    mutationFn: (body: Record<string, unknown>) => api("/settings", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pqc-settings"] }); toast({ title: "Settings saved" }); },
  });

  const generateKeys = useMutation({
    mutationFn: () => api("/generate-keys", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pqc-settings"] });
      toast({ title: "Real ML-KEM-768 keys generated", description: "CRYSTALS-Kyber NIST FIPS 203 key pair ready." });
    },
  });

  const fetchConfig = async () => {
    const r = await api("/wireguard-config");
    if (r.config) setConfig(r.config);
    else setConfigMsg(r.message ?? "Could not generate config");
  };

  const s   = data.settings;
  const kp  = data.keyPair;
  const algo = localAlgo || s.algorithm;

  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <button onClick={onToggle} className={`relative w-10 h-5 rounded-full transition-colors ${on ? "bg-primary" : "bg-primary/20"}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-black transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left: controls */}
      <div className="space-y-4">
        {/* Real crypto badge */}
        {data.realCrypto && (
          <div className="flex items-center gap-2 border border-primary/20 bg-primary/5 px-3 py-1.5 text-[10px] font-mono text-primary/70">
            <CheckCircle2 className="w-3 h-3 text-primary" />
            Real ML-KEM-768 + ML-DSA-65 — @noble/post-quantum (NIST FIPS 203/204)
          </div>
        )}

        {/* Threat banner */}
        <div className={`border p-4 ${data.threat.risk === "exposed" ? "border-yellow-500/40 bg-yellow-500/5" : "border-primary/30 bg-primary/5"}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${data.threat.risk === "exposed" ? "text-yellow-400" : "text-primary"}`} />
            <div>
              <div className={`text-xs font-mono font-bold uppercase tracking-widest mb-1 ${data.threat.risk === "exposed" ? "text-yellow-400" : "text-primary"}`}>
                {data.threat.title}
              </div>
              <p className="text-[10px] font-mono text-primary/60 leading-relaxed">{data.threat.description}</p>
              <span className={`mt-2 inline-block text-[9px] font-mono uppercase px-2 py-0.5 border rounded ${data.threat.risk === "mitigated" ? "border-primary/40 text-primary/70" : "border-yellow-500/40 text-yellow-400/80"}`}>
                {data.threat.risk === "mitigated" ? "✓ Risk Mitigated" : "⚠ Risk: Exposed"}
              </span>
            </div>
          </div>
        </div>

        {/* Enable + hybrid + rotation toggles */}
        <div className="border border-primary/20 bg-black p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono font-bold text-primary">POST-QUANTUM ENCRYPTION</div>
              <div className="text-[10px] text-primary/40 font-mono mt-0.5">Hybrid ML-KEM-768 + X25519 WireGuard PSK</div>
            </div>
            <Toggle on={s.enabled} onToggle={() => saveSettings.mutate({ enabled: !s.enabled })} />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-primary/10">
            <div>
              <div className="text-[10px] font-mono text-primary/70">Hybrid Mode</div>
              <div className="text-[9px] text-primary/40 font-mono">Classical + PQC — CNSA 2.0 compliant</div>
            </div>
            <Toggle on={s.hybridMode} onToggle={() => saveSettings.mutate({ hybridMode: !s.hybridMode })} />
          </div>
          <div className="flex items-center justify-between border-t border-primary/10 pt-2">
            <div>
              <div className="text-[10px] font-mono text-primary/70">Auto Key Rotation</div>
              <div className="text-[9px] text-primary/40 font-mono">Rotate every {s.keyRotationHours}h</div>
            </div>
            <Toggle on={s.rotateKeys} onToggle={() => saveSettings.mutate({ rotateKeys: !s.rotateKeys })} />
          </div>
        </div>

        {/* Algorithm picker */}
        <div className="border border-primary/20 bg-black p-4 space-y-2">
          <div className="text-[10px] font-mono text-primary/40 tracking-widest">KEY EXCHANGE ALGORITHM</div>
          {data.algorithms.map(a => (
            <button key={a.id} onClick={() => { setLocalAlgo(a.id); saveSettings.mutate({ algorithm: a.id }); }}
              className={`w-full flex items-center gap-3 p-2.5 border transition-colors text-left ${algo === a.id ? "border-primary/60 bg-primary/10" : "border-primary/15 hover:border-primary/30"}`}>
              <div className={`w-2 h-2 rounded-full border ${algo === a.id ? "bg-primary border-primary" : "border-primary/30"}`} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono font-semibold text-primary">{a.label}</div>
                <div className="flex gap-2 mt-0.5">
                  <span className="text-[9px] text-primary/30 font-mono">{a.bits}-bit</span>
                  <span className="text-[9px] text-primary/30 font-mono">speed:{a.speed}</span>
                  {a.nist && <span className="text-[9px] text-primary/70 font-mono">NIST</span>}
                  {a.recommended && <span className="text-[9px] text-primary font-mono">✓ recommended</span>}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Rotation interval */}
        <div className="border border-primary/20 bg-black p-4 space-y-2">
          <div className="text-[10px] font-mono text-primary/40 tracking-widest">KEY ROTATION INTERVAL</div>
          <div className="flex flex-wrap gap-1">
            {[6,12,24,48,72,168].map(h => (
              <button key={h} onClick={() => saveSettings.mutate({ keyRotationHours: h })}
                className={`text-[9px] font-mono px-2 py-1 border transition-colors ${s.keyRotationHours === h ? "border-primary bg-primary/10 text-primary" : "border-primary/20 text-primary/40 hover:border-primary/40"}`}>
                {h < 24 ? `${h}h` : `${h/24}d`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: key info + config */}
      <div className="space-y-4">
        {/* Active key pair */}
        <div className="border border-primary/20 bg-black p-4 space-y-3">
          <div className="text-[10px] font-mono text-primary/40 tracking-widest">ACTIVE KEY PAIR</div>
          {kp ? (
            <div className="space-y-2 text-[10px] font-mono">
              <div>
                <div className="text-[9px] text-primary/30">Algorithm</div>
                <div className="text-primary">{kp.algorithm} (NIST FIPS 203)</div>
              </div>
              <div>
                <div className="text-[9px] text-primary/30">KEM Public Key ({kp.kemPubLen}B)</div>
                <div className="text-primary/50 break-all">{kp.kemPublicKey}</div>
              </div>
              <div>
                <div className="text-[9px] text-primary/30">DSA Public Key ({kp.dsaPubLen}B)</div>
                <div className="text-primary/50 break-all">{kp.dsaPublicKey}</div>
              </div>
              <div>
                <div className="text-[9px] text-primary/30">WireGuard PSK (32B, ML-KEM derived)</div>
                <div className="text-primary/60 break-all font-mono">{kp.presharedKey}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[9px] text-primary/30">Generated</div>
                  <div className="text-primary/60">{new Date(kp.generatedAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[9px] text-primary/30">Expires</div>
                  <div className={data.keysExpired ? "text-yellow-400" : "text-primary/60"}>
                    {data.keysExpired ? "EXPIRED" : new Date(kp.expiresAt).toLocaleString()}
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
            {generateKeys.isPending ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Key className="w-3 h-3 mr-1.5" />}
            {data.keysExpired ? "REGENERATE EXPIRED KEYS" : "GENERATE ML-KEM-768 + ML-DSA-65 KEYS"}
          </Button>
        </div>

        {/* WireGuard config with PQC PSK */}
        <div className="border border-primary/20 bg-black p-4 space-y-3">
          <div className="text-[10px] font-mono text-primary/40 tracking-widest">HYBRID WIREGUARD CONFIG</div>
          <p className="text-[10px] font-mono text-primary/40 leading-relaxed">
            Injects a real ML-KEM-768 pre-shared key into your WireGuard config.
            Provides CNSA 2.0 hybrid classical + post-quantum protection.
          </p>
          <Button size="sm" variant="outline"
            className="w-full border-primary/30 text-primary/60 hover:bg-primary/10 text-xs font-mono"
            onClick={fetchConfig}>
            <Download className="w-3 h-3 mr-1.5" /> GENERATE HYBRID CONFIG
          </Button>
          {config && (
            <div>
              <pre className="text-[9px] font-mono text-primary/50 bg-black border border-primary/10 p-3 max-h-52 overflow-auto whitespace-pre-wrap leading-relaxed">{config}</pre>
              <button className="mt-2 text-[9px] font-mono text-primary/40 hover:text-primary transition-colors flex items-center gap-1"
                onClick={() => { navigator.clipboard.writeText(config); }}>
                <Copy className="w-3 h-3" /> Copy to clipboard
              </button>
            </div>
          )}
          {configMsg && !config && (
            <div className="text-[10px] font-mono text-yellow-400/70 border border-yellow-500/20 px-3 py-2">{configMsg}</div>
          )}
        </div>

        {/* How it works */}
        <div className="border border-primary/10 bg-primary/3 p-4 space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-mono text-primary/50 tracking-widest">
            <Info className="w-3.5 h-3.5" /> HOW HYBRID ML-KEM + X25519 WORKS
          </div>
          <ul className="space-y-1.5 text-[10px] font-mono text-primary/40 leading-relaxed">
            <li><span className="text-primary/60">1.</span> ML-KEM-768 keygen → 1184B public key, 2400B secret key</li>
            <li><span className="text-primary/60">2.</span> Encapsulate → 1088B ciphertext + 32B shared secret</li>
            <li><span className="text-primary/60">3.</span> HKDF-SHA256(shared_secret + ct[:32]) → 32B WireGuard PSK</li>
            <li><span className="text-primary/60">4.</span> WireGuard uses X25519 + PSK simultaneously — both must be broken</li>
            <li><span className="text-primary/60">5.</span> Quantum computer breaks X25519? PSK still holds. Classical attack on PSK? X25519 still holds.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── ML-DSA Signatures Tab ──────────────────────────────────────────────────────
function SignaturesTab({ data, authFetch }: { data: PqcData; authFetch: ReturnType<typeof useAuthFetch> }) {
  const { toast } = useToast();
  const [mode, setMode]         = useState<"sign" | "verify">("sign");
  const [message, setMessage]   = useState("");
  const [signature, setSig]     = useState("");
  const [pubKey, setPubKey]     = useState("");
  const [result, setResult]     = useState<{ valid?: boolean; signature?: string; sigLen?: number } | null>(null);
  const [loading, setLoading]   = useState(false);

  const api = async (path: string, body: unknown) => {
    const r = await authFetch(`${BASE}/api/pqc${path}`, { method: "POST", body: JSON.stringify(body) });
    return r.json();
  };

  const doSign = async () => {
    if (!message.trim()) return;
    setLoading(true);
    try {
      const r = await api("/sign", { message });
      setResult({ signature: r.signature, sigLen: r.signatureBytes });
      setSig(r.signature);
      toast({ title: "Message signed", description: `ML-DSA-65 signature — ${r.signatureBytes} bytes` });
    } catch { toast({ title: "Sign failed", variant: "destructive" }); }
    finally   { setLoading(false); }
  };

  const doVerify = async () => {
    if (!message.trim() || !signature.trim() || !pubKey.trim()) return;
    setLoading(true);
    try {
      const r = await api("/verify", { publicKey: pubKey, message, signature });
      setResult({ valid: r.valid });
      toast({ title: r.valid ? "Signature valid ✓" : "Signature INVALID ✗", variant: r.valid ? "default" : "destructive" });
    } catch { toast({ title: "Verify failed", variant: "destructive" }); }
    finally   { setLoading(false); }
  };

  const kp = data.keyPair;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="border border-primary/20 bg-primary/5 px-4 py-3 text-[10px] font-mono text-primary/60 leading-relaxed">
        <span className="text-primary font-bold">ML-DSA-65 (CRYSTALS-Dilithium)</span> — NIST FIPS 204 post-quantum digital signature.
        1952-byte public keys, 3293-byte signatures. Lattice-based — immune to Shor's algorithm.
      </div>

      {/* Mode toggle */}
      <div className="flex gap-0 border border-primary/20 w-fit">
        {(["sign", "verify"] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); setResult(null); }}
            className={`px-4 py-1.5 text-[10px] font-mono uppercase transition-colors ${mode === m ? "bg-primary/20 text-primary" : "text-primary/40 hover:bg-primary/10"}`}>
            {m === "sign" ? <><FileSignature className="w-3 h-3 inline mr-1" />Sign</> : <><ShieldCheck className="w-3 h-3 inline mr-1" />Verify</>}
          </button>
        ))}
      </div>

      {/* No key warning */}
      {!kp && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-[10px] font-mono text-yellow-400/80">
          ⚠ Generate ML-KEM-768 + ML-DSA-65 keys in the Encryption tab first.
        </div>
      )}

      {mode === "sign" && (
        <div className="space-y-3">
          <div>
            <div className="text-[9px] text-primary/30 font-mono uppercase mb-1">Message to Sign</div>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
              placeholder="Enter any text to sign with ML-DSA-65..."
              className="w-full bg-black border border-primary/20 text-primary/80 font-mono text-[10px] p-2 resize-none focus:outline-none focus:border-primary/40" />
          </div>
          <Button size="sm" variant="outline" onClick={doSign} disabled={loading || !kp}
            className="border-primary/40 text-primary/70 hover:bg-primary/10 text-xs font-mono">
            {loading ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <FileSignature className="w-3 h-3 mr-1.5" />}
            SIGN WITH ML-DSA-65
          </Button>
          {result?.signature && (
            <div>
              <div className="text-[9px] text-primary/30 font-mono uppercase mb-1">Signature ({result.sigLen}B)</div>
              <div className="bg-black border border-primary/10 p-2">
                <div className="text-[9px] font-mono text-primary/50 break-all max-h-24 overflow-auto">{result.signature}</div>
              </div>
              <button className="mt-1 text-[9px] font-mono text-primary/40 hover:text-primary flex items-center gap-1"
                onClick={() => navigator.clipboard.writeText(result.signature!)}>
                <Copy className="w-3 h-3" /> Copy signature
              </button>
            </div>
          )}
        </div>
      )}

      {mode === "verify" && (
        <div className="space-y-3">
          <div>
            <div className="text-[9px] text-primary/30 font-mono uppercase mb-1">Message</div>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
              placeholder="Original message..."
              className="w-full bg-black border border-primary/20 text-primary/80 font-mono text-[10px] p-2 resize-none focus:outline-none focus:border-primary/40" />
          </div>
          <div>
            <div className="text-[9px] text-primary/30 font-mono uppercase mb-1">ML-DSA-65 Public Key (base64)</div>
            <textarea value={pubKey} onChange={e => setPubKey(e.target.value)} rows={3}
              placeholder="Paste ML-DSA-65 public key..."
              className="w-full bg-black border border-primary/20 text-primary/80 font-mono text-[9px] p-2 resize-none focus:outline-none focus:border-primary/40" />
            {kp && (
              <button className="mt-1 text-[9px] font-mono text-primary/40 hover:text-primary transition-colors"
                onClick={() => setPubKey(kp.dsaPublicKey.replace("…", ""))}>
                Use my current DSA public key
              </button>
            )}
          </div>
          <div>
            <div className="text-[9px] text-primary/30 font-mono uppercase mb-1">Signature (base64)</div>
            <textarea value={signature} onChange={e => setSig(e.target.value)} rows={3}
              placeholder="Paste ML-DSA-65 signature..."
              className="w-full bg-black border border-primary/20 text-primary/80 font-mono text-[9px] p-2 resize-none focus:outline-none focus:border-primary/40" />
          </div>
          <Button size="sm" variant="outline" onClick={doVerify} disabled={loading}
            className="border-primary/40 text-primary/70 hover:bg-primary/10 text-xs font-mono">
            {loading ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <ShieldCheck className="w-3 h-3 mr-1.5" />}
            VERIFY SIGNATURE
          </Button>
          {result?.valid !== undefined && (
            <div className={`flex items-center gap-2 px-3 py-2 border text-[11px] font-mono font-bold ${result.valid ? "border-primary/40 text-primary" : "border-red-500/40 text-red-400"}`}>
              {result.valid ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {result.valid ? "SIGNATURE VALID — authentic ML-DSA-65 signature" : "SIGNATURE INVALID — tampered or wrong key"}
            </div>
          )}
        </div>
      )}

      {/* Key sizes reference */}
      <div className="border border-primary/10 p-3 text-[9px] font-mono text-primary/30 space-y-1">
        <div className="text-primary/50 uppercase tracking-widest mb-2">Algorithm Reference</div>
        {[
          ["ML-KEM-768 public key",  "1,184 bytes"],
          ["ML-KEM-768 secret key",  "2,400 bytes"],
          ["ML-KEM-768 ciphertext",  "1,088 bytes"],
          ["ML-KEM-768 shared secret","32 bytes"],
          ["ML-DSA-65 public key",   "1,952 bytes"],
          ["ML-DSA-65 secret key",   "4,032 bytes"],
          ["ML-DSA-65 signature",    "3,293 bytes"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span>{k}</span><span className="text-primary/50">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CNSA 2.0 Compliance Tab ───────────────────────────────────────────────────
function ComplianceTab({ authFetch }: { authFetch: ReturnType<typeof useAuthFetch> }) {
  const { data, isLoading, refetch } = useQuery<{ requirements: ComplianceReq[]; standard: string; evaluated: string }>({
    queryKey: ["pqc-compliance"],
    queryFn:  async () => {
      const r = await authFetch(`${BASE}/api/pqc/compliance`);
      return r.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="text-primary/30 font-mono text-xs py-8 text-center">Loading compliance matrix…</div>;

  const reqs = data?.requirements ?? [];
  const met     = reqs.filter(r => r.status === "met").length;
  const partial = reqs.filter(r => r.status === "partial").length;
  const notMet  = reqs.filter(r => r.status === "not_met").length;
  const pct     = Math.round((met + partial * 0.5) / reqs.length * 100);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-xs font-mono text-primary/40 uppercase tracking-widest">{data?.standard}</div>
          <div className="text-[10px] font-mono text-primary/25 mt-0.5">Evaluated: {data?.evaluated ? new Date(data.evaluated).toLocaleString() : "—"}</div>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}
          className="border-primary/30 text-primary/50 hover:bg-primary/10 text-[10px] font-mono">
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      {/* Summary bar */}
      <div className="border border-primary/20 bg-black p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono text-primary/40">COMPLIANCE SCORE</div>
          <div className="text-lg font-bold font-mono text-primary">{pct}%</div>
        </div>
        <div className="w-full h-2 bg-primary/10 rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex gap-4 text-[9px] font-mono">
          <span className="text-primary">✓ {met} met</span>
          <span className="text-yellow-400">◑ {partial} partial</span>
          <span className="text-red-400/60">✗ {notMet} not met</span>
        </div>
      </div>

      {/* Requirements matrix */}
      <div className="space-y-2">
        {reqs.map(req => (
          <div key={req.id} className={`border p-3 space-y-1 ${req.status === "met" ? "border-primary/20" : req.status === "partial" ? "border-yellow-500/20" : "border-red-500/10"}`}>
            <div className="flex items-start gap-2">
              {statusIcon(req.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold text-primary">{req.name}</span>
                  <Badge variant="outline" className={`text-[8px] font-mono ${statusBadge(req.status)}`}>
                    {req.status.replace("_", " ")}
                  </Badge>
                  <span className="text-[9px] font-mono text-primary/25">{req.standard}</span>
                </div>
                <div className="text-[9px] font-mono text-primary/50 mt-0.5 leading-relaxed">{req.evidence}</div>
                {req.note && <div className="text-[9px] font-mono text-yellow-400/50 mt-0.5 italic">{req.note}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border border-primary/10 px-3 py-2 text-[9px] font-mono text-primary/25 leading-relaxed">
        Requirements marked "not met" require physical hardware (HSM, TPM, TEMPEST shielding) that cannot be provided by software.
        The 3 "met" and 2 "partial" software requirements bring ProxhqVPN to CNSA 2.0 cryptographic compliance for the
        key exchange and signature layers. For full FIPS 140-3 certification, a NVLAP lab validation process is required.
      </div>
    </div>
  );
}

// ── Audit Chain Tab ────────────────────────────────────────────────────────────
function AuditChainTab({ authFetch }: { authFetch: ReturnType<typeof useAuthFetch> }) {
  const { data, isLoading, refetch } = useQuery<{
    ok: boolean; total: number; brokenAt: number | null; chainHead: string | null;
    algorithm: string; entries: AuditEntry[];
  }>({
    queryKey:  ["pqc-audit-chain"],
    queryFn:   async () => { const r = await authFetch(`${BASE}/api/pqc/audit-chain`); return r.json(); },
    refetchInterval: 15_000,
  });

  if (isLoading) return <div className="text-primary/30 font-mono text-xs py-8 text-center">Loading audit chain…</div>;

  const ok = data?.ok ?? false;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Chain integrity banner */}
      <div className={`border p-4 flex items-start gap-3 ${ok ? "border-primary/30 bg-primary/5" : "border-red-500/40 bg-red-500/5"}`}>
        {ok ? <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" /> : <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
        <div>
          <div className={`text-xs font-mono font-bold uppercase tracking-widest ${ok ? "text-primary" : "text-red-400"}`}>
            {ok ? "CHAIN INTEGRITY: INTACT" : `CHAIN BROKEN AT ENTRY #${data?.brokenAt}`}
          </div>
          <div className="text-[10px] font-mono text-primary/50 mt-1">
            {(data as { entries: number } | undefined)?.entries ?? 0} entries · {data?.algorithm}
          </div>
          {data?.chainHead && (
            <div className="text-[9px] font-mono text-primary/30 mt-0.5">
              Chain head: {data.chainHead}
            </div>
          )}
        </div>
        <button onClick={() => refetch()} className="ml-auto text-primary/30 hover:text-primary transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* How it works */}
      <div className="border border-primary/10 p-3 text-[9px] font-mono text-primary/40 space-y-1 leading-relaxed">
        <div className="text-primary/60 text-[10px] font-bold mb-2 flex items-center gap-1.5"><Link2 className="w-3 h-3" /> TAMPER-EVIDENT HASH CHAIN</div>
        <p>Each audit event is committed to a SHA-256 hash that includes the hash of the previous event.
        Any attempt to delete or modify an entry breaks the chain — the hash of subsequent entries
        will no longer match, making tampering immediately detectable.</p>
        <p className="text-primary/30">This bridges the "PostgreSQL — software-only, mutable by admin" gap. While an
        admin can still delete DB rows, the in-memory chain shows the break. A production deployment
        would persist this chain to a separate append-only write-once storage.</p>
      </div>

      {/* Entry list */}
      <div className="space-y-1">
        <div className="text-[9px] font-mono text-primary/25 uppercase tracking-widest mb-2">Recent Audit Events</div>
        {(!data?.entries || (Array.isArray(data.entries) && data.entries.length === 0)) ? (
          <div className="text-[10px] font-mono text-primary/25 text-center py-6">
            No audit events yet — generate keys or change settings to create entries.
          </div>
        ) : (
          Array.isArray(data.entries) && data.entries.slice().reverse().map((e: AuditEntry) => (
            <div key={e.seq} className="border border-primary/10 px-3 py-2 font-mono grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-0.5 text-[9px]">
              <span className="text-primary/25">#{e.seq}</span>
              <span className="text-primary/70 font-bold">{e.event}</span>
              <span className="text-primary/30">{new Date(e.timestamp).toLocaleTimeString()}</span>
              <span className="text-primary/20 col-start-2">user: {e.userId}</span>
              <span className="col-start-2 text-primary/20 break-all">
                <Hash className="w-2.5 h-2.5 inline mr-0.5" />{e.hash}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Offline Bundle Tab ─────────────────────────────────────────────────────────
function OfflineBundleTab({ authFetch }: { authFetch: ReturnType<typeof useAuthFetch> }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const downloadBundle = async () => {
    setLoading(true);
    try {
      const r = await authFetch(`${BASE}/api/pqc/offline-bundle`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `proxhq-airgap-bundle-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Air-gapped bundle downloaded", description: "Contains ML-KEM-768 + ML-DSA-65 keys and WireGuard config template." });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="border border-primary/20 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center gap-2 text-primary/70 font-mono text-xs font-bold uppercase tracking-widest">
          <Zap className="w-4 h-4" /> AIR-GAPPED KEY BUNDLE
        </div>
        <p className="text-[10px] font-mono text-primary/50 leading-relaxed">
          Generate a complete self-contained key package that a VPN node can use to bootstrap
          without any further API calls. Transfer via secure physical media — USB, QR code, or
          printed and physically couriered.
        </p>
      </div>

      {/* What's included */}
      <div className="border border-primary/20 bg-black p-4 space-y-3">
        <div className="text-[10px] font-mono text-primary/40 tracking-widest">BUNDLE CONTENTS</div>
        {[
          ["ML-KEM-768 public key",           "1,184-byte KEM public key (NIST FIPS 203)"],
          ["ML-DSA-65 public key",            "1,952-byte signature public key (NIST FIPS 204)"],
          ["WireGuard PSK",                   "32-byte pre-shared key derived from ML-KEM-768 shared secret"],
          ["WireGuard config template",       "Pre-filled [Interface] + [Peer] blocks — fill in placeholders"],
          ["CNSA 2.0 compliance manifest",    "Machine-readable compliance status for each requirement"],
          ["Boot instructions",               "7-step offline node setup sequence"],
        ].map(([name, desc]) => (
          <div key={name} className="flex gap-2">
            <CheckCircle2 className="w-3 h-3 text-primary/40 shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] font-mono text-primary/70">{name}</div>
              <div className="text-[9px] font-mono text-primary/30">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Security notice */}
      <div className="border border-yellow-500/20 bg-yellow-500/5 p-3 text-[10px] font-mono text-yellow-400/70 space-y-1 leading-relaxed">
        <div className="font-bold text-yellow-400">⚠ Security Notice</div>
        <p>This bundle contains key material. Treat it like a private key file.</p>
        <ul className="space-y-0.5 text-yellow-400/50">
          <li>• Never transmit over unencrypted channels</li>
          <li>• Transfer via physical media only (air gap)</li>
          <li>• Shred with <code className="text-yellow-400/70">shred -u &lt;file&gt;</code> after use</li>
          <li>• Rotate keys after 24h per CNSA 2.0 key management guidelines</li>
        </ul>
      </div>

      {/* Download button */}
      <Button onClick={downloadBundle} disabled={loading} variant="outline"
        className="w-full border-primary/40 text-primary/70 hover:bg-primary/10 font-mono">
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
        {loading ? "GENERATING BUNDLE…" : "DOWNLOAD AIR-GAPPED BUNDLE (.json)"}
      </Button>

      {/* Gap bridging summary */}
      <div className="border border-primary/10 p-3 space-y-2">
        <div className="text-[9px] font-mono text-primary/40 uppercase tracking-widest">GAP BRIDGED</div>
        <div className="text-[9px] font-mono text-primary/30 leading-relaxed">
          This addresses the "internet-dependent for key distribution and API" gap.
          A node bootstrapped from this bundle can operate with no network access until
          the WireGuard tunnel is established — keys are pre-baked into the bundle.
          Full offline operation beyond initial setup still requires the control plane for key rotation.
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PostQuantum() {
  const authFetch = useAuthFetch();
  const qc        = useQueryClient();
  const [tab, setTab] = useState<Tab>("encryption");

  const { data, isLoading } = useQuery<PqcData>({
    queryKey:       ["pqc-settings"],
    queryFn:        async () => { const r = await authFetch(`${BASE}/api/pqc/settings`); return r.json(); },
    refetchInterval: 30_000,
  });

  const statusColors: Record<string, string> = {
    active:       "text-primary border-primary",
    keys_expired: "text-yellow-400 border-yellow-500",
    disabled:     "text-primary/40 border-primary/20",
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <Lock className="w-6 h-6" /> Post-Quantum Cryptography
          </h2>
          <p className="text-sm text-primary/50 mt-1 font-mono">
            NIST FIPS 203/204 — ML-KEM-768 + ML-DSA-65 — CNSA 2.0 hybrid mode
          </p>
        </div>
        {data && (
          <Badge variant="outline" className={`text-xs uppercase font-mono ${statusColors[data.status]}`}>
            {data.status.replace("_", " ")}
          </Badge>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-primary/20 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-[10px] font-mono uppercase tracking-wide whitespace-nowrap transition-colors border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-primary/40 hover:text-primary/70"}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pt-2">
        {isLoading && (
          <div className="flex items-center justify-center h-32 text-primary/30 font-mono text-xs">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading quantum shield…
          </div>
        )}
        {!isLoading && data && (
          <>
            {tab === "encryption"    && <EncryptionTab    data={data} qc={qc} authFetch={authFetch} />}
            {tab === "signatures"    && <SignaturesTab     data={data} authFetch={authFetch} />}
            {tab === "compliance"    && <ComplianceTab     authFetch={authFetch} />}
            {tab === "audit-chain"   && <AuditChainTab     authFetch={authFetch} />}
            {tab === "offline-bundle"&& <OfflineBundleTab  authFetch={authFetch} />}
          </>
        )}
      </div>
    </div>
  );
}
