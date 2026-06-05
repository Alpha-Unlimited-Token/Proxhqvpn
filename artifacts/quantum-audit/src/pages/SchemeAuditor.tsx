// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Search, AlertTriangle, CheckCircle, ChevronDown, ChevronRight,
  RefreshCw, Eye, EyeOff, Copy, Zap, ShieldAlert,
  Layers, Hash, Cpu, Activity, Info, ChevronUp,
  Link as LinkIcon, ArrowRight, Radar
} from "lucide-react";

const BASE = () => (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
const trunc = (s: string, n = 16) => !s ? "" : s.length > n * 2 + 3 ? s.slice(0, n) + "…" + s.slice(-n) : s;
const cp = (s: string) => navigator.clipboard?.writeText(s).catch(() => {});

type Tab = "auto" | "solana" | "polkadot" | "monero";

// ── Shared types ──────────────────────────────────────────────────────────────
type CurveParams = { name: string; order: string; hashAlgorithm: string; sigFormat: string };
type RecoveryEquation = { label: string; formula: string; latexHint: string; variables: Record<string, string> };
type ChainInfo = {
  chain: string; displayName: string; signatureScheme: string; schemeLabel: string;
  inputType: string; confidence: number; curveParams: CurveParams;
  recoveryEquations: RecoveryEquation[]; explorerBase: string; apiNote: string; reuseRisk: string;
};
type DetectResult = { target: string; detected: ChainInfo; alternatives: ChainInfo[]; scanPlan: string };
type SolSig = { txSignature: string; slot: number; blockTime: number | null; signerAddress: string; R: string; S: string; messageBytes: string };
type SolanaResult = { address: string; anchorTx: string | null; totalTransactions: number; signaturesExtracted: number; nonceReusePairs: { sharedR: string; sig1: SolSig; sig2: SolSig; riskLevel: string }[]; hasVulnerability: boolean; allSignatures: SolSig[]; scanTimestamp: string };
type DotSig = { extrinsicHash: string; blockNumber: number; sigType: string; R: string; s: string; callModule: string; callFunction: string; nonce: number };
type PolkadotResult = { address: string; chain: string; anchorExtrinsic: string | null; totalExtrinsics: number; signaturesExtracted: number; nonceReusePairs: { sharedR: string; sig1: DotSig; sig2: DotSig; riskLevel: string }[]; hasVulnerability: boolean; allSignatures: DotSig[]; scanTimestamp: string };
type XmrKI = { keyImage: string; txHash: string; blockHeight: number; inputIndex: number; ringSize: number };
type XmrPair = { keyImage: string; tx1: XmrKI; tx2: XmrKI; significance: string; ringIntersectionNote: string };
type MoneroResult = { anchorTxHash: string | null; anchorBlockHeight: number | null; blocksScanned: number[]; txHashesScanned: number; keyImagesExtracted: number; reuseDetected: XmrPair[]; hasDoubleSpend: boolean; allKeyImages: XmrKI[]; isKeyImageSpentStatus: Record<string, number>; note: string; scanTimestamp: string };
type AdaptiveResult = { target: string; detectedChain: ChainInfo; alternativeCandidates: ChainInfo[]; scanPlan: string; result: SolanaResult | PolkadotResult | MoneroResult | unknown; hasVulnerability: boolean; vulnerabilityCount: number; executionTimeMs: number; scanTimestamp: string };
type RecoveryResult = { success: boolean; privateKeyHex?: string | null; privateKey?: string | null; derivedPublicKeyHex?: string | null; addressMatches?: boolean; error: string | null; math?: Record<string, string> };

// ── Scheme color map ──────────────────────────────────────────────────────────
const SCHEME_COLORS: Record<string, string> = {
  "secp256k1-ecdsa": "text-blue-400",
  "ed25519":         "text-purple-400",
  "sr25519-schnorr": "text-pink-400",
  "clsag":           "text-orange-400",
  "p256-ecdsa":      "text-teal-400",
};
const SCHEME_BG: Record<string, string> = {
  "secp256k1-ecdsa": "bg-blue-500/10 border-blue-500/30 text-blue-400",
  "ed25519":         "bg-purple-500/10 border-purple-500/30 text-purple-400",
  "sr25519-schnorr": "bg-pink-500/10 border-pink-500/30 text-pink-400",
  "clsag":           "bg-orange-500/10 border-orange-500/30 text-orange-400",
  "p256-ecdsa":      "bg-teal-500/10 border-teal-500/30 text-teal-400",
};

// ── Helper components ─────────────────────────────────────────────────────────
function ScanBanner({ vuln, label, sub }: { vuln: boolean; label: string; sub: string }) {
  return (
    <div className={`p-4 rounded-xl border-2 flex items-center gap-3 ${vuln ? "border-red-500 bg-red-500/10 text-red-400" : "border-green-500 bg-green-500/10 text-green-400"}`}>
      {vuln ? <AlertTriangle className="w-6 h-6 flex-shrink-0" /> : <CheckCircle className="w-6 h-6 flex-shrink-0" />}
      <div>
        <p className="font-bold font-mono">{label}</p>
        <p className="text-xs opacity-80">{sub}</p>
      </div>
    </div>
  );
}

function PrivKeyBox({ keyHex, pairKey }: { keyHex: string; pairKey: string }) {
  const [show, setShow] = useState(false);
  if (!keyHex) return null;
  return (
    <div className="bg-black/60 border border-red-500/40 rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-red-400 font-bold">RECOVERED PRIVATE KEY</span>
        <button onClick={() => setShow(p => !p)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}{show ? "Hide" : "Reveal"}
        </button>
      </div>
      {show
        ? <div className="flex items-center gap-2"><code className="text-red-300 font-mono text-xs break-all flex-1">{keyHex}</code><button onClick={() => cp(keyHex)}><Copy className="w-3 h-3 text-muted-foreground hover:text-primary" /></button></div>
        : <div className="h-5 bg-red-500/20 rounded flex items-center px-2"><span className="text-xs text-red-400/60 font-mono">{"█".repeat(48)}</span></div>
      }
    </div>
  );
}

// ── Chain detection card ──────────────────────────────────────────────────────
function ChainDetectionCard({ info, alternatives, scanPlan, target }: { info: ChainInfo; alternatives: ChainInfo[]; scanPlan: string; target: string }) {
  const [showPlan, setShowPlan] = useState(false);
  const [showEqs, setShowEqs] = useState(true);
  const schemeCls = SCHEME_COLORS[info.signatureScheme] ?? "text-primary";
  const schemeBg  = SCHEME_BG[info.signatureScheme] ?? "bg-primary/10 border-primary/30 text-primary";

  return (
    <div className="space-y-3">
      {/* Detection header */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5">
        <Radar className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold">{info.displayName}</span>
            <Badge className="font-mono text-xs bg-primary/10 border-primary/30 text-primary">{info.confidence}% confident</Badge>
            {info.inputType !== "ambiguous" && <Badge className="font-mono text-xs border-border/50">{info.inputType}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{trunc(target, 24)}</p>
        </div>
        {alternatives.length > 0 && (
          <div className="text-xs text-muted-foreground font-mono flex-shrink-0">
            +{alternatives.length} alt{alternatives.length > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Signature scheme + curve */}
      <div className={`p-4 rounded-xl border ${schemeBg}`}>
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-4 h-4 flex-shrink-0" />
          <span className="font-mono text-sm font-bold">Signature Scheme: {info.schemeLabel}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div className="space-y-1">
            <p className="text-muted-foreground">Curve / Protocol</p>
            <p className={`font-bold ${schemeCls}`}>{info.curveParams.name}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Hash Algorithm</p>
            <p className="font-bold">{info.curveParams.hashAlgorithm}</p>
          </div>
          <div className="col-span-full space-y-1">
            <p className="text-muted-foreground">Group Order (n / l)</p>
            <p className={`font-bold break-all ${schemeCls}`}>0x{info.curveParams.order}</p>
          </div>
          <div className="col-span-full space-y-1">
            <p className="text-muted-foreground">Signature Format</p>
            <p className="text-foreground">{info.curveParams.sigFormat}</p>
          </div>
        </div>
      </div>

      {/* Recovery equations */}
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 overflow-hidden">
        <button onClick={() => setShowEqs(p => !p)} className="flex items-center justify-between w-full p-3 text-left">
          <span className="font-mono text-xs font-bold text-yellow-400 flex items-center gap-2">
            <Activity className="w-3 h-3" /> Adaptive Recovery Equations ({info.recoveryEquations.length})
          </span>
          {showEqs ? <ChevronUp className="w-3 h-3 text-yellow-400" /> : <ChevronDown className="w-3 h-3 text-yellow-400" />}
        </button>
        {showEqs && (
          <div className="px-3 pb-3 space-y-3">
            {info.recoveryEquations.map((eq, i) => (
              <div key={i} className="bg-black/40 rounded p-3 space-y-2">
                <p className="text-xs font-mono font-bold text-yellow-400">{eq.label}</p>
                <div className="bg-yellow-500/10 rounded px-3 py-2">
                  <code className="text-yellow-200 text-sm font-mono font-bold">{eq.formula}</code>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {Object.entries(eq.variables).map(([k, v]) => (
                    <div key={k} className="flex items-start gap-2 text-xs font-mono">
                      <code className="text-yellow-400 flex-shrink-0 w-16 truncate">{k}</code>
                      <span className="text-muted-foreground flex-1">= {v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reuse risk */}
      <div className="rounded p-3 border border-red-500/20 bg-red-500/5 text-xs font-mono text-red-400">
        <span className="font-bold">Risk: </span>{info.reuseRisk}
      </div>

      {/* Scan plan */}
      <div className="rounded-xl border border-border/40 overflow-hidden">
        <button onClick={() => setShowPlan(p => !p)} className="flex items-center justify-between w-full p-3 text-left">
          <span className="font-mono text-xs font-bold flex items-center gap-2"><Info className="w-3 h-3 text-primary" /> Scan Plan</span>
          {showPlan ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {showPlan && (
          <div className="px-3 pb-3">
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">{scanPlan}</pre>
          </div>
        )}
      </div>

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-mono text-muted-foreground">Ambiguous input — also matches:</p>
          <div className="flex flex-wrap gap-2">
            {alternatives.map((alt, i) => (
              <div key={i} className={`px-2 py-1 rounded text-xs font-mono border ${SCHEME_BG[alt.signatureScheme] ?? "border-border/30"}`}>
                {alt.displayName} ({alt.confidence}%)
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Auto-Detect Tab ───────────────────────────────────────────────────────────
function AutoTab() {
  const [target, setTarget] = useState("");
  const [detection, setDetection] = useState<DetectResult | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<AdaptiveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Live detection as user types
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (target.length < 5) { setDetection(null); return; }
    debounceRef.current = setTimeout(async () => {
      setDetecting(true);
      try {
        const res = await fetch(`${BASE()}/api/quantum-audit/detect-chain`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: target.trim() }),
        });
        if (res.ok) setDetection(await res.json());
        else setDetection(null);
      } catch { setDetection(null); }
      setDetecting(false);
    }, 500);
  }, [target]);

  const runScan = async (forceChain?: string) => {
    setScanning(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${BASE()}/api/quantum-audit/auto-scan`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: target.trim(), forceChain }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? json.error);
      setResult(json);
    } catch (e) { setError(String(e)); }
    finally { setScanning(false); }
  };

  return (
    <div className="space-y-5">
      <div className="bg-primary/5 border border-primary/20 rounded p-4 text-xs space-y-2">
        <p className="font-mono text-primary font-bold">Adaptive Multi-Chain Scanner</p>
        <p className="text-muted-foreground">
          Paste any address or transaction hash from any supported blockchain. The system instantly identifies the chain, selects the correct signature scheme and curve parameters, builds the matching recovery equations, then runs the appropriate scan — all automatically.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {[["secp256k1", "blue"],["Ed25519", "purple"],["Sr25519/Schnorr", "pink"],["CLSAG", "orange"],["P-256", "teal"]].map(([l, c]) => (
            <span key={l} className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border bg-${c}-500/10 border-${c}-500/30 text-${c}-400`}>{l}</span>
          ))}
        </div>
      </div>

      {/* Input */}
      <Card className="border-primary/30 bg-card/80">
        <CardContent className="p-5 space-y-3">
          <label className="text-xs font-mono text-muted-foreground">ANY ADDRESS OR TRANSACTION HASH</label>
          <div className="relative">
            <Input
              placeholder="0x… Ethereum/EVM  ·  1… Bitcoin  ·  bc1… Bech32  ·  Base58 Solana  ·  1… Polkadot  ·  addr1… Cardano  ·  tz1… Tezos  ·  64-char hex Monero/BTC …"
              value={target}
              onChange={e => setTarget(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !detecting && target.trim() && runScan()}
              className="font-mono text-sm pr-10"
            />
            {detecting && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
          </div>
          {detection && !scanning && (
            <Button onClick={() => runScan()} disabled={scanning}
              className="w-full bg-primary text-black hover:bg-primary/90 font-bold gap-2">
              <Radar className="w-4 h-4" />
              Scan {detection.detected.displayName} ({detection.detected.schemeLabel})
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Live detection preview */}
      {detection && !result && (
        <ChainDetectionCard
          info={detection.detected}
          alternatives={detection.alternatives}
          scanPlan={detection.scanPlan}
          target={target}
        />
      )}

      {scanning && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6 flex items-center gap-4">
            <RefreshCw className="w-8 h-8 text-primary animate-spin flex-shrink-0" />
            <div>
              <p className="font-mono font-bold">Running adaptive scan…</p>
              <p className="text-xs text-muted-foreground mt-0.5">{detection?.detected.displayName} · {detection?.detected.schemeLabel}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4 flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold">Scan error</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* Detected chain summary */}
          <ChainDetectionCard
            info={result.detectedChain}
            alternatives={result.alternativeCandidates}
            scanPlan={result.scanPlan}
            target={result.target}
          />

          <ScanBanner
            vuln={result.hasVulnerability}
            label={result.hasVulnerability ? `⚠ VULNERABILITY — ${result.vulnerabilityCount} instance(s) found` : "✓ No Cryptographic Vulnerability Detected"}
            sub={`${result.detectedChain.schemeLabel} · ${result.executionTimeMs}ms · ${result.scanTimestamp.slice(0, 19).replace("T", " ")} UTC`}
          />

          {/* Render chain-specific result */}
          <AdaptiveResultCard result={result} />
        </>
      )}
    </div>
  );
}

function AdaptiveResultCard({ result }: { result: AdaptiveResult }) {
  const [expanded, setExpanded] = useState(false);
  const scheme = result.detectedChain.signatureScheme;
  const raw = result.result as Record<string, unknown>;

  const pairs = (raw?.nonceReusePairs ?? raw?.reuseDetected ?? []) as unknown[];
  const sigs  = (raw?.allSignatures ?? raw?.allKeyImages ?? []) as unknown[];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          Raw Scan Data — {result.detectedChain.displayName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Transactions / Blocks", value: String(raw?.totalTransactions ?? raw?.txHashesScanned ?? raw?.totalExtrinsics ?? "—") },
            { label: "Signatures / Key Images", value: String(raw?.signaturesExtracted ?? raw?.keyImagesExtracted ?? "—") },
            { label: "Vulnerable Pairs", value: String(pairs.length), highlight: pairs.length > 0 },
            { label: "Scheme", value: result.detectedChain.schemeLabel.split("/")[0].trim() },
          ].map(({ label, value, highlight }) => (
            <div key={label} className={`p-3 rounded border ${highlight ? "border-red-500/40 bg-red-500/10" : "border-border/30 bg-muted/10"}`}>
              <p className="text-xs text-muted-foreground font-mono">{label}</p>
              <p className={`text-lg font-bold font-mono ${highlight ? "text-red-400" : "text-foreground"}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Nonce/key image pairs for any scheme */}
        {pairs.length > 0 && (
          <div className="space-y-3">
            {scheme === "clsag" ? (
              (pairs as XmrPair[]).map((pair, i) => (
                <div key={i} className="bg-red-500/5 border border-red-500/40 rounded p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono">DOUBLE-SPEND #{i + 1}</Badge>
                  </div>
                  <div className="bg-black/40 rounded p-2 text-xs font-mono">
                    <p className="text-red-400 mb-1">Duplicate Key Image I = x·H_p(P)</p>
                    <code className="text-orange-300 break-all">{pair.keyImage}</code>
                  </div>
                  <p className="text-xs text-orange-400 font-mono">{pair.significance?.slice(0, 120)}…</p>
                </div>
              ))
            ) : (
              (pairs as Array<{ sharedR?: string; sig1?: Record<string, unknown>; sig2?: Record<string, unknown>; riskLevel?: string }>).map((pair, i) => {
                const shared = pair.sharedR ?? "";
                return (
                  <div key={i} className="bg-red-500/5 border border-red-500/40 rounded p-3 space-y-2">
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono">NONCE REUSE #{i + 1}</Badge>
                    <div className="bg-black/40 rounded p-2 text-xs font-mono">
                      <p className="text-red-400 mb-1">Shared R (same nonce k or point K used twice)</p>
                      <code className="text-orange-300 break-all">{shared}</code>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-black/30 rounded p-2 space-y-1">
                        <p className="text-muted-foreground">TX / Extrinsic 1</p>
                        <code className="text-blue-400">{trunc(String(pair.sig1?.txSignature ?? pair.sig1?.extrinsicHash ?? ""), 10)}</code>
                      </div>
                      <div className="bg-black/30 rounded p-2 space-y-1">
                        <p className="text-muted-foreground">TX / Extrinsic 2</p>
                        <code className="text-blue-400">{trunc(String(pair.sig2?.txSignature ?? pair.sig2?.extrinsicHash ?? ""), 10)}</code>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Collapsible raw data table */}
        <button onClick={() => setExpanded(p => !p)} className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground w-full">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {sigs.length} {scheme === "clsag" ? "key images" : "signatures"} extracted
        </button>
        {expanded && sigs.length > 0 && (
          <div className="overflow-x-auto rounded border border-border/30">
            <table className="w-full text-xs font-mono">
              <tbody>
                {(sigs as Record<string, unknown>[]).slice(0, 50).map((item, i) => (
                  <tr key={i} className="border-b border-border/20 hover:bg-muted/10">
                    <td className="py-1 px-3 text-muted-foreground">{i + 1}</td>
                    <td className="py-1 px-3"><code className="text-yellow-400">{trunc(String(item.R ?? item.keyImage ?? ""), 14)}</code></td>
                    <td className="py-1 px-3 text-muted-foreground">{trunc(String(item.txSignature ?? item.extrinsicHash ?? item.txHash ?? ""), 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Solana Tab ────────────────────────────────────────────────────────────────
function SolanaTab() {
  const [target, setTarget] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<SolanaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState<Record<string, boolean>>({});
  const [recoveries, setRecoveries] = useState<Record<string, RecoveryResult>>({});
  const [showAll, setShowAll] = useState(false);

  const EQUATIONS = [
    { f: "H₁ = H(R ‖ A ‖ M₁) mod l", note: "SHA-512 nonce challenge hash, message 1" },
    { f: "H₂ = H(R ‖ A ‖ M₂) mod l", note: "SHA-512 nonce challenge hash, message 2" },
    { f: "a  = (S₁ − S₂) · (H₁ − H₂)⁻¹  mod l", note: "Recovered private scalar" },
    { f: "l  = 2²⁵² + 27742317777372353535851937790883648493", note: "Ed25519 group order" },
  ];

  const runScan = async () => {
    setScanning(true); setError(null); setResult(null); setRecoveries({});
    try {
      const res = await fetch(`${BASE()}/api/quantum-audit/ed25519-scan`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? json.error);
      setResult(json);
    } catch (e) { setError(String(e)); }
    finally { setScanning(false); }
  };

  const recover = async (pair: SolanaResult["nonceReusePairs"][0], key: string) => {
    setRecovering(p => ({ ...p, [key]: true }));
    try {
      const res = await fetch(`${BASE()}/api/quantum-audit/ed25519-recover`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ R: pair.sharedR, pubkey: pair.sig1.signerAddress, S1: pair.sig1.S, msg1: pair.sig1.messageBytes, S2: pair.sig2.S, msg2: pair.sig2.messageBytes }),
      });
      setRecoveries(p => ({ ...p, [key]: (res.ok ? {} : { success: false, error: "API error" }) as RecoveryResult }));
      const json = await res.json();
      setRecoveries(p => ({ ...p, [key]: json }));
    } catch (e) { setRecoveries(p => ({ ...p, [key]: { success: false, error: String(e) } })); }
    setRecovering(p => ({ ...p, [key]: false }));
  };

  return (
    <div className="space-y-5">
      <div className="bg-purple-500/5 border border-purple-500/20 rounded p-4 text-xs space-y-2">
        <p className="font-mono text-purple-400 font-bold">Curve: Ed25519 · Scheme: EdDSA · Chain: Solana / Cardano</p>
        <div className="space-y-1">
          {EQUATIONS.map((eq, i) => (
            <div key={i} className="flex items-start gap-2">
              <code className="text-yellow-400 font-mono flex-1">{eq.f}</code>
              <span className="text-muted-foreground flex-shrink-0 hidden sm:block">{eq.note}</span>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground">Input: wallet address OR a single tx signature — signer auto-resolved from tx hash, all surrounding transactions scanned.</p>
      </div>

      <Card className="border-purple-500/30 bg-card/80">
        <CardContent className="p-5 space-y-3">
          <label className="text-xs font-mono text-muted-foreground">SOLANA ADDRESS OR TX SIGNATURE</label>
          <div className="flex gap-3">
            <Input placeholder="Base58 wallet address  ―OR―  88-char base58 tx signature" value={target} onChange={e => setTarget(e.target.value)} onKeyDown={e => e.key === "Enter" && runScan()} className="font-mono text-sm flex-1" />
            <Button onClick={runScan} disabled={scanning || !target.trim()} className="bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2 flex-shrink-0">
              {scanning ? <><RefreshCw className="w-4 h-4 animate-spin" />Scanning…</> : <><Search className="w-4 h-4" />Scan</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <Card className="border-destructive/50 bg-destructive/10"><CardContent className="p-4 flex gap-2"><AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" /><p className="text-sm">{error}</p></CardContent></Card>}

      {result && (
        <>
          <ScanBanner vuln={result.hasVulnerability} label={result.hasVulnerability ? `⚠ ${result.nonceReusePairs.length} Ed25519 Nonce Reuse Pair(s)` : "✓ No Ed25519 Nonce Reuse Detected"} sub={`${result.signaturesExtracted} sigs · ${result.totalTransactions} txs · ${trunc(result.address, 10)}${result.anchorTx ? " · anchor resolved" : ""}`} />

          {result.nonceReusePairs.map((pair, i) => {
            const key = `s-${i}`;
            const rec = recoveries[key];
            return (
              <Card key={i} className="border-red-500/40 bg-red-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex gap-2"><Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono">PAIR {i+1}</Badge><Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 font-mono text-xs">Ed25519 NONCE REUSE</Badge></div>
                    {!rec && <Button onClick={() => recover(pair, key)} disabled={recovering[key]} className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2 text-sm">{recovering[key] ? <><RefreshCw className="w-3 h-3 animate-spin" />Running…</> : <><Zap className="w-3 h-3" />Recover Private Key</>}</Button>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-black/40 rounded p-3"><p className="text-xs font-mono text-red-400 mb-1">Shared R (same nonce k·B used in two transactions)</p><code className="text-orange-300 font-mono text-xs break-all">{pair.sharedR}</code></div>
                  <div className="grid grid-cols-2 gap-3">
                    {[{sig: pair.sig1, n: 1},{sig: pair.sig2, n: 2}].map(({sig, n}) => (
                      <div key={n} className="bg-black/30 rounded p-3 text-xs font-mono space-y-1">
                        <div className="flex justify-between"><span className="font-bold">TX {n}</span><a href={`https://solscan.io/tx/${sig.txSignature}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">↗</a></div>
                        <div><span className="text-muted-foreground">Slot: </span>{sig.slot}</div>
                        <div><span className="text-muted-foreground">S: </span><code className="text-yellow-400">{trunc(sig.S, 10)}</code></div>
                      </div>
                    ))}
                  </div>
                  {rec && (
                    <div className={`rounded p-3 border ${rec.success ? "border-red-500/40" : "border-border/30"}`}>
                      {rec.success ? <><PrivKeyBox keyHex={rec.privateKeyHex ?? ""} pairKey={key} />{rec.math && <div className="mt-2 space-y-1 text-xs font-mono">{Object.entries(rec.math).map(([k,v]) => <div key={k} className="flex gap-2"><span className="text-muted-foreground w-24 flex-shrink-0">{k}:</span><code className="text-yellow-400 break-all">{trunc(v, 12)}</code></div>)}</div>}</> : <p className="text-xs text-muted-foreground">{rec.error}</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Card className="border-border/50">
            <button onClick={() => setShowAll(p => !p)} className="flex items-center justify-between w-full p-4">
              <span className="font-mono text-sm font-bold flex gap-2"><Layers className="w-4 h-4 text-primary" />All Signatures ({result.allSignatures.length})</span>
              {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showAll && <CardContent><div className="overflow-x-auto"><table className="w-full text-xs font-mono"><thead><tr className="border-b border-border/50 text-muted-foreground"><th className="py-2 pr-3 text-left">Slot</th><th className="py-2 pr-3 text-left">R nonce</th><th className="py-2 text-left">Tx</th></tr></thead><tbody>{result.allSignatures.map((sig, i) => { const v = result.nonceReusePairs.some(p => p.sig1.txSignature === sig.txSignature || p.sig2.txSignature === sig.txSignature); return <tr key={i} className={`border-b border-border/20 ${v?"bg-red-500/10":""}`}><td className="py-1.5 pr-3">{sig.slot}</td><td className="py-1.5 pr-3"><code className={v?"text-red-400 font-bold":"text-yellow-400"}>{sig.R.slice(0,20)}…</code>{v&&<Badge className="ml-1 bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">REUSE</Badge>}</td><td className="py-1.5"><a href={`https://solscan.io/tx/${sig.txSignature}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{trunc(sig.txSignature,7)} ↗</a></td></tr>; })}</tbody></table></div></CardContent>}
          </Card>
        </>
      )}
    </div>
  );
}

// ── Polkadot Tab ──────────────────────────────────────────────────────────────
function PolkadotTab() {
  const [target, setTarget] = useState("");
  const [chain, setChain] = useState("polkadot");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<PolkadotResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const CHAINS = ["polkadot", "kusama", "acala", "moonbeam", "astar"];
  const EQUATIONS = [
    { f: "c₁ = H(R ‖ pub ‖ M₁) mod l", note: "Schnorr challenge (Blake2b/Merlin)" },
    { f: "c₂ = H(R ‖ pub ‖ M₂) mod l", note: "Schnorr challenge, message 2" },
    { f: "x  = (s₁ − s₂) · (c₁ − c₂)⁻¹  mod l", note: "Recovered private key" },
    { f: "l  = 2²⁵² + 27742317777372353535851937790883648493", note: "Ristretto255 / Sr25519 order" },
  ];

  const runScan = async () => {
    setScanning(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${BASE()}/api/quantum-audit/schnorr-scan`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, chain }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? json.error);
      setResult(json);
    } catch (e) { setError(String(e)); }
    finally { setScanning(false); }
  };

  return (
    <div className="space-y-5">
      <div className="bg-pink-500/5 border border-pink-500/20 rounded p-4 text-xs space-y-2">
        <p className="font-mono text-pink-400 font-bold">Curve: Ristretto255 · Scheme: Sr25519 / Schnorr · Chain: Polkadot / Substrate</p>
        <div className="space-y-1">{EQUATIONS.map((eq, i) => <div key={i} className="flex items-start gap-2"><code className="text-yellow-400 font-mono flex-1">{eq.f}</code><span className="text-muted-foreground flex-shrink-0 hidden sm:block">{eq.note}</span></div>)}</div>
        <p className="text-muted-foreground">Accepts SS58 address OR 0x-prefixed extrinsic hash. Signer auto-resolved, before+after history fetched, Sr25519 R values cross-referenced.</p>
      </div>
      <div className="flex flex-wrap gap-2">{CHAINS.map(c => <button key={c} onClick={() => setChain(c)} className={`px-3 py-1 rounded text-xs font-mono font-bold border capitalize transition-all ${chain===c?"bg-pink-500 text-white border-pink-500":"border-pink-500/30 text-pink-400 hover:bg-pink-500/10"}`}>{c}</button>)}</div>
      <Card className="border-pink-500/30 bg-card/80"><CardContent className="p-5 space-y-3"><label className="text-xs font-mono text-muted-foreground">{chain.toUpperCase()} ADDRESS OR EXTRINSIC HASH</label><div className="flex gap-3"><Input placeholder="SS58 address (1xxx…)  ―OR―  0x extrinsic hash" value={target} onChange={e => setTarget(e.target.value)} onKeyDown={e => e.key === "Enter" && runScan()} className="font-mono text-sm flex-1" /><Button onClick={runScan} disabled={scanning||!target.trim()} className="bg-pink-600 hover:bg-pink-700 text-white font-bold gap-2 flex-shrink-0">{scanning?<><RefreshCw className="w-4 h-4 animate-spin"/>Scanning…</>:<><Search className="w-4 h-4"/>Scan</>}</Button></div></CardContent></Card>
      {error && <Card className="border-destructive/50 bg-destructive/10"><CardContent className="p-4 flex gap-2"><AlertTriangle className="w-4 h-4 text-destructive" /><p className="text-sm">{error}</p></CardContent></Card>}
      {result && (<>
        <ScanBanner vuln={result.hasVulnerability} label={result.hasVulnerability ? `⚠ ${result.nonceReusePairs.length} Sr25519 Nonce Reuse Pair(s)` : "✓ No Sr25519 Nonce Reuse Detected"} sub={`${result.signaturesExtracted} sigs · ${result.totalExtrinsics} extrinsics · ${result.chain}${result.anchorExtrinsic?" · anchor resolved":""}`} />
        {result.nonceReusePairs.map((pair, i) => (
          <Card key={i} className="border-red-500/40 bg-red-500/5"><CardHeader className="pb-2"><CardTitle className="flex gap-2"><Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono">PAIR {i+1}</Badge><Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30 font-mono text-xs">Schnorr NONCE REUSE</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-black/40 rounded p-3"><p className="text-xs font-mono text-red-400 mb-1">Shared R (Ristretto255 nonce point)</p><code className="text-orange-300 font-mono text-xs break-all">{pair.sharedR}</code></div>
            <div className="grid grid-cols-2 gap-3">{[{sig:pair.sig1,n:1},{sig:pair.sig2,n:2}].map(({sig,n}) => (<div key={n} className="bg-black/30 rounded p-3 text-xs font-mono space-y-1"><div className="flex justify-between"><span className="font-bold">Extrinsic {n}</span><a href={`https://${result.chain}.subscan.io/extrinsic/${sig.extrinsicHash}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Subscan ↗</a></div><div><span className="text-muted-foreground">Block: </span>{sig.blockNumber}</div><div><span className="text-muted-foreground">Type: </span><span className="text-pink-400">{sig.sigType}</span></div><div><span className="text-muted-foreground">s: </span><code className="text-yellow-400">{trunc(sig.s,10)}</code></div></div>))}</div>
          </CardContent></Card>
        ))}
        <Card className="border-border/50">
          <button onClick={() => setShowAll(p=>!p)} className="flex items-center justify-between w-full p-4"><span className="font-mono text-sm font-bold flex gap-2"><Layers className="w-4 h-4 text-primary"/>All Signatures ({result.allSignatures.length})</span>{showAll?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}</button>
          {showAll && <CardContent><div className="overflow-x-auto"><table className="w-full text-xs font-mono"><thead><tr className="border-b border-border/50 text-muted-foreground"><th className="py-2 pr-3 text-left">Block</th><th className="py-2 pr-3 text-left">Type</th><th className="py-2 pr-3 text-left">R nonce</th><th className="py-2 text-left">Hash</th></tr></thead><tbody>{result.allSignatures.map((sig,i) => { const v=result.nonceReusePairs.some(p=>p.sig1.extrinsicHash===sig.extrinsicHash||p.sig2.extrinsicHash===sig.extrinsicHash); return <tr key={i} className={`border-b border-border/20 ${v?"bg-red-500/10":""}`}><td className="py-1.5 pr-3">{sig.blockNumber}</td><td className="py-1.5 pr-3 text-pink-400">{sig.sigType}</td><td className="py-1.5 pr-3"><code className={v?"text-red-400 font-bold":"text-yellow-400"}>{sig.R.slice(0,18)}…</code>{v&&<Badge className="ml-1 bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">REUSE</Badge>}</td><td className="py-1.5"><a href={`https://${result.chain}.subscan.io/extrinsic/${sig.extrinsicHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{trunc(sig.extrinsicHash,7)} ↗</a></td></tr>; })}</tbody></table></div></CardContent>}
        </Card>
      </>)}
    </div>
  );
}

// ── Monero Tab ────────────────────────────────────────────────────────────────
function MoneroTab() {
  const [target, setTarget] = useState("");
  const [blockWindow, setBlockWindow] = useState("15");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<MoneroResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [kiMode, setKiMode] = useState(false);
  const [kiInput, setKiInput] = useState("");
  const [kiResult, setKiResult] = useState<{keyImages:{keyImage:string;spentOnChain:number;appearsCount:number}[];duplicates:string[]}|null>(null);

  const EQUATIONS = [
    { f: "I  = x · H_p(P)", note: "Key image: unique per UTXO spend" },
    { f: "H_p(P) = hash-to-curve(P)", note: "Point hash of public spend key" },
    { f: "If I_tx1 = I_tx2 → x_1 = x_2", note: "Same key image = same private key = double-spend" },
    { f: "True signer ∈ ring(tx1) ∩ ring(tx2)", note: "Anonymity broken by ring intersection" },
  ];

  const SPEND_LABELS: Record<number, string> = { 0:"Unspent", 1:"Spent (confirmed)", 2:"Spent (pool)" };

  const runScan = async () => {
    setScanning(true); setError(null); setResult(null);
    try {
      const targets = target.trim().split(/[\n,]+/).map(s=>s.trim()).filter(Boolean);
      const res = await fetch(`${BASE()}/api/quantum-audit/monero-scan`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: targets.length===1?targets[0]:targets, blockWindow: Number(blockWindow)||15 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? json.error);
      setResult(json);
    } catch (e) { setError(String(e)); }
    finally { setScanning(false); }
  };

  const runKi = async () => {
    setScanning(true); setError(null); setKiResult(null);
    try {
      const kImages = kiInput.trim().split(/[\n,]+/).map(s=>s.trim().toLowerCase()).filter(s=>s.length===64);
      if (!kImages.length) throw new Error("No valid 64-char hex key images found");
      const res = await fetch(`${BASE()}/api/quantum-audit/monero-keyimages`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({keyImages:kImages}) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? json.error);
      setKiResult(json);
    } catch (e) { setError(String(e)); }
    finally { setScanning(false); }
  };

  return (
    <div className="space-y-5">
      <div className="bg-orange-500/5 border border-orange-500/20 rounded p-4 text-xs space-y-2">
        <p className="font-mono text-orange-400 font-bold">Scheme: CLSAG Ring Signature · Curve: Ed25519 base · Chain: Monero</p>
        <div className="space-y-1">{EQUATIONS.map((eq,i) => <div key={i} className="flex items-start gap-2"><code className="text-yellow-400 font-mono flex-1">{eq.f}</code><span className="text-muted-foreground flex-shrink-0 hidden sm:block">{eq.note}</span></div>)}</div>
        <p className="text-muted-foreground">TX Hash mode: resolves block height → scans ±N surrounding blocks → extracts all key images → cross-references for duplicates. Also checks on-chain spend status via Monero daemon RPC.</p>
      </div>
      <div className="flex gap-2">
        {[{id:false,label:"Scan by TX Hash",icon:Hash},{id:true,label:"Check Key Images",icon:LinkIcon}].map(({id,label,icon:Icon}) => (
          <button key={String(id)} onClick={() => {setKiMode(id);setResult(null);setKiResult(null);setError(null);}} className={`flex-1 py-2 rounded text-xs font-mono font-bold border transition-all flex items-center justify-center gap-2 ${kiMode===id?"bg-orange-500 text-white border-orange-500":"border-orange-500/30 text-orange-400 hover:bg-orange-500/10"}`}><Icon className="w-3 h-3"/>{label}</button>
        ))}
      </div>
      {!kiMode ? (
        <Card className="border-orange-500/30 bg-card/80"><CardContent className="p-5 space-y-3">
          <label className="text-xs font-mono text-muted-foreground">MONERO TX HASH(ES) — one per line</label>
          <Textarea placeholder={"64-char hex tx hash\nMultiple = cross-reference all key images"} value={target} onChange={e=>setTarget(e.target.value)} className="font-mono text-sm h-24 resize-none" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground"><span>Block window ±</span><Input value={blockWindow} onChange={e=>setBlockWindow(e.target.value)} className="w-16 h-7 text-xs font-mono text-center" /><span>blocks</span></div>
            <Button onClick={runScan} disabled={scanning||!target.trim()} className="ml-auto bg-orange-600 hover:bg-orange-700 text-white font-bold gap-2">{scanning?<><RefreshCw className="w-4 h-4 animate-spin"/>Scanning…</>:<><Search className="w-4 h-4"/>Scan</>}</Button>
          </div>
        </CardContent></Card>
      ) : (
        <Card className="border-orange-500/30 bg-card/80"><CardContent className="p-5 space-y-3">
          <label className="text-xs font-mono text-muted-foreground">KEY IMAGES — one per line (64-char hex)</label>
          <Textarea placeholder="a1b2c3d4e5f6… (64 hex chars)" value={kiInput} onChange={e=>setKiInput(e.target.value)} className="font-mono text-xs h-32 resize-none" />
          <Button onClick={runKi} disabled={scanning||!kiInput.trim()} className="bg-orange-600 hover:bg-orange-700 text-white font-bold gap-2">{scanning?<><RefreshCw className="w-4 h-4 animate-spin"/>Checking…</>:<><Search className="w-4 h-4"/>Check</>}</Button>
        </CardContent></Card>
      )}
      {error && <Card className="border-destructive/50 bg-destructive/10"><CardContent className="p-4 flex gap-2"><AlertTriangle className="w-4 h-4 text-destructive" /><p className="text-sm">{error}</p></CardContent></Card>}
      {result && (<>
        <ScanBanner vuln={result.hasDoubleSpend} label={result.hasDoubleSpend?`⚠ ${result.reuseDetected.length} Duplicate Key Image(s) — Double-Spend Proven`:"✓ No Duplicate Key Images"} sub={`${result.keyImagesExtracted} key images · ${result.txHashesScanned} txs · ${result.blocksScanned.length} blocks (${result.blocksScanned[0]??'?'}–${result.blocksScanned[result.blocksScanned.length-1]??'?'})`} />
        <Card className="border-border/50 bg-card/80"><CardContent className="p-4 text-xs font-mono text-muted-foreground leading-relaxed">{result.note}</CardContent></Card>
        {result.reuseDetected.map((pair,i) => (
          <Card key={i} className="border-red-500/40 bg-red-500/5"><CardHeader className="pb-2"><CardTitle className="flex gap-2"><Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono">DUPE {i+1}</Badge><Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 font-mono text-xs">DOUBLE-SPEND PROOF</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-black/40 rounded p-3"><p className="text-xs font-mono text-red-400 mb-1">Duplicate I = x·H_p(P)</p><div className="flex gap-2"><code className="text-orange-300 text-xs font-mono break-all flex-1">{pair.keyImage}</code><button onClick={()=>cp(pair.keyImage)}><Copy className="w-3 h-3 text-muted-foreground hover:text-primary"/></button></div></div>
            <div className="grid grid-cols-2 gap-3">{[{ki:pair.tx1,n:1},{ki:pair.tx2,n:2}].map(({ki,n}) => <div key={n} className="bg-black/30 rounded p-3 text-xs font-mono space-y-1"><div className="flex justify-between"><span className="font-bold">TX {n}</span><a href={`https://xmrchain.net/tx/${ki.txHash}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">XMRChain ↗</a></div><div><span className="text-muted-foreground">Block: </span>{ki.blockHeight}</div><div><span className="text-muted-foreground">Input #: </span>{ki.inputIndex}</div><div><span className="text-muted-foreground">Ring: </span>{ki.ringSize}</div></div>)}</div>
            <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3 text-xs text-orange-400 font-mono space-y-1"><p>{pair.ringIntersectionNote}</p></div>
          </CardContent></Card>
        ))}
        <Card className="border-border/50">
          <button onClick={()=>setShowAll(p=>!p)} className="flex items-center justify-between w-full p-4"><span className="font-mono text-sm font-bold flex gap-2"><Layers className="w-4 h-4 text-primary"/>All Key Images ({result.allKeyImages.length})</span>{showAll?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}</button>
          {showAll && <CardContent><div className="overflow-x-auto"><table className="w-full text-xs font-mono"><thead><tr className="border-b border-border/50 text-muted-foreground"><th className="py-2 pr-3 text-left">Block</th><th className="py-2 pr-3 text-left">In#</th><th className="py-2 pr-3 text-left">Key Image</th><th className="py-2 pr-3 text-left">Ring</th><th className="py-2 text-left">Spent</th></tr></thead><tbody>{result.allKeyImages.map((ki,i)=>{const d=result.reuseDetected.some(p=>p.keyImage===ki.keyImage);const sp=result.isKeyImageSpentStatus[ki.keyImage];return(<tr key={i} className={`border-b border-border/20 ${d?"bg-red-500/10":""}`}><td className="py-1.5 pr-3">{ki.blockHeight}</td><td className="py-1.5 pr-3">{ki.inputIndex}</td><td className="py-1.5 pr-3"><code className={d?"text-red-400 font-bold":"text-yellow-400"}>{ki.keyImage.slice(0,20)}…</code>{d&&<Badge className="ml-1 bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">DUPE</Badge>}</td><td className="py-1.5 pr-3 text-muted-foreground">{ki.ringSize}</td><td className="py-1.5"><span className={sp===1?"text-orange-400":sp===0?"text-green-400":"text-muted-foreground"}>{SPEND_LABELS[sp]??"—"}</span></td></tr>)})}</tbody></table></div></CardContent>}
        </Card>
      </>)}
      {kiResult && (<>
        <ScanBanner vuln={kiResult.duplicates.length>0} label={kiResult.duplicates.length>0?`⚠ ${kiResult.duplicates.length} duplicate key image(s)`:"✓ All key images unique"} sub={`${kiResult.keyImages.length} key images checked`} />
        <div className="overflow-x-auto rounded border border-border/30"><table className="w-full text-xs font-mono"><thead><tr className="border-b border-border/50 bg-muted/20 text-muted-foreground"><th className="py-2 px-3 text-left">Key Image</th><th className="py-2 px-3 text-left">Count</th><th className="py-2 px-3 text-left">On-Chain</th></tr></thead><tbody>{kiResult.keyImages.map((ki,i) => <tr key={i} className={`border-b border-border/20 ${ki.appearsCount>1?"bg-red-500/10":""}`}><td className="py-1.5 px-3"><code className={ki.appearsCount>1?"text-red-400 font-bold":"text-yellow-400"}>{ki.keyImage.slice(0,24)}…</code>{ki.appearsCount>1&&<Badge className="ml-2 bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">DUPE</Badge>}</td><td className="py-1.5 px-3 text-muted-foreground">{ki.appearsCount}×</td><td className="py-1.5 px-3"><span className={ki.spentOnChain===1?"text-orange-400":ki.spentOnChain===0?"text-green-400":"text-muted-foreground"}>{SPEND_LABELS[ki.spentOnChain]??"Unknown"}</span></td></tr>)}</tbody></table></div>
      </>)}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; sub: string; accent: string }[] = [
  { id: "auto",     label: "Auto-Detect",        sub: "Any chain · Any format",        accent: "text-primary border-primary bg-primary/10" },
  { id: "solana",   label: "Solana / Ed25519",   sub: "EdDSA · Ed25519",               accent: "text-purple-400 border-purple-500/50 bg-purple-500/10" },
  { id: "polkadot", label: "Polkadot / Sr25519", sub: "Schnorr · Ristretto255",        accent: "text-pink-400 border-pink-500/50 bg-pink-500/10"   },
  { id: "monero",   label: "Monero / CLSAG",     sub: "Ring Sig · Key Images",         accent: "text-orange-400 border-orange-500/50 bg-orange-500/10" },
];

export default function SchemeAuditor() {
  const [tab, setTab] = useState<Tab>("auto");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <ShieldAlert className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-mono">Cryptographic Implementation Auditor</h1>
          <p className="text-sm text-muted-foreground">
            Adaptive multi-chain scanner — paste any address or tx hash. The engine identifies the blockchain, selects the correct signature scheme and curve, builds the matching recovery equations, then runs the full scan automatically.
          </p>
        </div>
      </div>

      {/* Chain support matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs font-mono">
        {[
          { scheme: "secp256k1", chains: "ETH · BTC · LTC · DOGE · BSC · MATIC · AVAX · Cosmos", color: "blue" },
          { scheme: "Ed25519", chains: "Solana · Cardano · Stellar · Algorand · NEAR · Tezos tz1", color: "purple" },
          { scheme: "Sr25519", chains: "Polkadot · Kusama · Acala · Astar · Moonbeam", color: "pink" },
          { scheme: "CLSAG", chains: "Monero (ring sig + key images)", color: "orange" },
          { scheme: "P-256", chains: "Tezos tz3 · WebAuthn / Passkeys", color: "teal" },
        ].map(({ scheme, chains, color }) => (
          <div key={scheme} className={`p-2 rounded border bg-${color}-500/5 border-${color}-500/20`}>
            <p className={`font-bold text-${color}-400`}>{scheme}</p>
            <p className="text-muted-foreground text-[10px] mt-0.5 leading-tight">{chains}</p>
          </div>
        ))}
      </div>

      {/* Tab selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`p-3 rounded-lg border transition-all text-left ${tab === t.id ? t.accent : "border-border/50 hover:border-border"}`}>
            <p className="text-xs font-mono font-bold truncate">{t.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{t.sub}</p>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "auto"     && <AutoTab />}
      {tab === "solana"   && <SolanaTab />}
      {tab === "polkadot" && <PolkadotTab />}
      {tab === "monero"   && <MoneroTab />}
    </div>
  );
}
