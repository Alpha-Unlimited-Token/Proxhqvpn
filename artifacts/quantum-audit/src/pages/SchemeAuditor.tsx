import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Search, AlertTriangle, CheckCircle, ChevronDown, ChevronRight,
  RefreshCw, Download, Eye, EyeOff, Copy, Zap, ShieldAlert,
  Layers, Link, Hash
} from "lucide-react";

const BASE = () => (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
const trunc = (s: string, n = 16) => s.length > n * 2 + 3 ? s.slice(0, n) + "…" + s.slice(-n) : s;
const copy = (s: string) => navigator.clipboard?.writeText(s);

type Tab = "solana" | "polkadot" | "monero";

// ── Shared types ──────────────────────────────────────────────────────────────
type SolanaResult = {
  address: string; anchorTx: string | null;
  totalTransactions: number; signaturesExtracted: number;
  nonceReusePairs: { sharedR: string; sig1: SolSig; sig2: SolSig; riskLevel: string }[];
  hasVulnerability: boolean; allSignatures: SolSig[]; scanTimestamp: string;
};
type SolSig = { txSignature: string; slot: number; blockTime: number | null; signerAddress: string; R: string; S: string; messageBytes: string };

type PolkadotResult = {
  address: string; chain: string; anchorExtrinsic: string | null;
  totalExtrinsics: number; signaturesExtracted: number;
  nonceReusePairs: { sharedR: string; sig1: DotSig; sig2: DotSig; riskLevel: string }[];
  hasVulnerability: boolean; allSignatures: DotSig[]; scanTimestamp: string;
};
type DotSig = { extrinsicHash: string; blockNumber: number; sigType: string; R: string; s: string; callModule: string; callFunction: string; nonce: number };

type MoneroResult = {
  anchorTxHash: string | null; anchorBlockHeight: number | null;
  blocksScanned: number[]; txHashesScanned: number; keyImagesExtracted: number;
  reuseDetected: XmrPair[]; hasDoubleSpend: boolean;
  allKeyImages: XmrKI[]; isKeyImageSpentStatus: Record<string, number>;
  note: string; scanTimestamp: string;
};
type XmrKI = { keyImage: string; txHash: string; blockHeight: number; inputIndex: number; ringSize: number };
type XmrPair = { keyImage: string; tx1: XmrKI; tx2: XmrKI; significance: string; ringIntersectionNote: string };

type RecoveryResult = {
  success: boolean; privateKeyHex?: string | null; privateKey?: string | null;
  derivedPublicKeyHex?: string | null; addressMatches?: boolean; error: string | null;
  math?: Record<string, string>;
};

// ── Helper components ─────────────────────────────────────────────────────────
function ScanInput({ label, placeholder, value, onChange, onScan, scanning }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; onScan: () => void; scanning: boolean;
}) {
  return (
    <Card className="border-primary/30 bg-card/80">
      <CardContent className="p-5 space-y-3">
        <label className="text-xs font-mono text-muted-foreground">{label}</label>
        <div className="flex gap-3">
          <Input
            placeholder={placeholder}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onScan()}
            className="font-mono text-sm flex-1"
          />
          <Button onClick={onScan} disabled={scanning || !value.trim()}
            className="bg-primary text-black hover:bg-primary/90 font-bold gap-2 flex-shrink-0">
            {scanning ? <><RefreshCw className="w-4 h-4 animate-spin" /> Scanning…</> : <><Search className="w-4 h-4" /> Scan</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

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
  return (
    <div className="bg-black/60 border border-red-500/40 rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-red-400 font-bold">RECOVERED PRIVATE KEY</span>
        <button onClick={() => setShow(p => !p)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {show ? "Hide" : "Reveal"}
        </button>
      </div>
      {show ? (
        <div className="flex items-center gap-2">
          <code className="text-red-300 font-mono text-xs break-all flex-1">{keyHex}</code>
          <button onClick={() => copy(keyHex)}><Copy className="w-3 h-3 text-muted-foreground hover:text-primary" /></button>
        </div>
      ) : <div className="h-5 bg-red-500/20 rounded flex items-center px-2"><span className="text-xs text-red-400/60 font-mono">{"█".repeat(64)}</span></div>}
    </div>
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
      setRecoveries(p => ({ ...p, [key]: (res.ok ? res.json() : { success: false, error: "API error" }) as unknown as RecoveryResult }));
      const json = await res.json();
      setRecoveries(p => ({ ...p, [key]: json }));
    } catch (e) { setRecoveries(p => ({ ...p, [key]: { success: false, error: String(e) } })); }
    setRecovering(p => ({ ...p, [key]: false }));
  };

  return (
    <div className="space-y-5">
      <div className="bg-primary/5 border border-primary/20 rounded p-4 text-xs space-y-2">
        <p className="font-mono text-primary font-bold">Ed25519 Nonce Reuse — Solana / Cardano</p>
        <p className="text-muted-foreground">
          Every Solana transaction signature is 64 bytes. Bytes 0–31 = R (the nonce commitment k·B). If any two signatures from the same wallet share the same R, the same nonce k was used.
          Recovery: <code className="text-yellow-400">a = (S1−S2) · H_diff⁻¹ mod l</code> where <code className="text-yellow-400">H_diff = H(R,A,M1) − H(R,A,M2)</code>.
        </p>
        <p className="text-muted-foreground">
          <strong className="text-foreground">Input:</strong> wallet address OR a single transaction signature. The scanner resolves the signer automatically from a tx hash, then fetches all transactions before and after the anchor, extracts every R value, and cross-references for duplicates.
        </p>
      </div>

      <ScanInput
        label="SOLANA WALLET ADDRESS OR TRANSACTION SIGNATURE"
        placeholder="Wallet: Base58 public key  —OR—  TX: 88-char base58 transaction signature"
        value={target} onChange={setTarget} onScan={runScan} scanning={scanning}
      />

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4 flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <ScanBanner
            vuln={result.hasVulnerability}
            label={result.hasVulnerability ? `⚠ NONCE REUSE — ${result.nonceReusePairs.length} pair(s) found` : "✓ No Ed25519 Nonce Reuse Detected"}
            sub={`${result.signaturesExtracted} signatures · ${result.totalTransactions} transactions · resolved address: ${trunc(result.address, 12)} ${result.anchorTx ? "· anchor tx scanned" : ""}`}
          />

          {result.nonceReusePairs.map((pair, i) => {
            const key = `pair-${i}`;
            const rec = recoveries[key];
            return (
              <Card key={i} className="border-red-500/40 bg-red-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono">PAIR {i + 1}</Badge>
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono text-xs">CONFIRMED NONCE REUSE</Badge>
                    </div>
                    {!rec && (
                      <Button onClick={() => recover(pair, key)} disabled={recovering[key]}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2 text-sm">
                        {recovering[key] ? <><RefreshCw className="w-3 h-3 animate-spin" /> Running…</> : <><Zap className="w-3 h-3" /> Recover Private Key</>}
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-black/40 rounded p-3">
                    <p className="text-xs font-mono text-red-400 mb-1">SHARED R (same nonce k used)</p>
                    <div className="flex items-center gap-2">
                      <code className="text-orange-300 font-mono text-xs break-all flex-1">{pair.sharedR}</code>
                      <button onClick={() => copy(pair.sharedR)}><Copy className="w-3 h-3 text-muted-foreground hover:text-primary" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[{ sig: pair.sig1, label: "TX 1" }, { sig: pair.sig2, label: "TX 2" }].map(({ sig, label }) => (
                      <div key={label} className="bg-black/30 rounded p-3 space-y-1.5 text-xs font-mono">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{label}</span>
                          <a href={`https://solscan.io/tx/${sig.txSignature}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Solscan ↗</a>
                        </div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Slot:</span><span>{sig.slot}</span></div>
                        <div><span className="text-muted-foreground">S: </span><code className="text-yellow-400">{trunc(sig.S, 12)}</code></div>
                        <div><span className="text-muted-foreground">Msg: </span><code className="text-blue-400">{trunc(sig.messageBytes, 12)}</code></div>
                      </div>
                    ))}
                  </div>
                  {rec && (
                    <div className={`rounded p-3 border ${rec.success ? "border-red-500/40 bg-red-500/5" : "border-border/40 bg-muted/20"}`}>
                      {rec.success ? (
                        <>
                          {rec.math && (
                            <div className="bg-black/40 rounded p-2 mb-3 space-y-1 text-xs font-mono">
                              {Object.entries(rec.math).map(([k, v]) => (
                                <div key={k} className="flex items-start gap-2">
                                  <span className="text-muted-foreground w-28 flex-shrink-0">{k}:</span>
                                  <code className="text-yellow-400 break-all flex-1">{trunc(v, 14)}</code>
                                </div>
                              ))}
                            </div>
                          )}
                          <PrivKeyBox keyHex={rec.privateKeyHex ?? rec.privateKey ?? ""} pairKey={key} />
                          {rec.addressMatches !== undefined && (
                            <p className="text-xs font-mono mt-2 text-muted-foreground">
                              Derived public key: <span className={rec.addressMatches ? "text-red-400" : "text-orange-400"}>{trunc(rec.derivedPublicKeyHex ?? "", 12)}</span>
                              <span className="ml-2">{rec.addressMatches ? "✓ MATCHES" : "⚠ different"}</span>
                            </p>
                          )}
                        </>
                      ) : <p className="text-xs text-muted-foreground">{rec.error}</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Card className="border-border/50">
            <button onClick={() => setShowAll(p => !p)} className="flex items-center justify-between w-full p-4 text-left">
              <span className="font-mono text-sm font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> All Signatures ({result.allSignatures.length})
              </span>
              {showAll ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {showAll && (
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border/50 text-muted-foreground">
                        <th className="py-2 pr-3 text-left">Slot</th>
                        <th className="py-2 pr-3 text-left">R (first 20 chars)</th>
                        <th className="py-2 pr-3 text-left">S</th>
                        <th className="py-2 text-left">Tx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.allSignatures.map((sig, i) => {
                        const isVuln = result.nonceReusePairs.some(p => p.sig1.txSignature === sig.txSignature || p.sig2.txSignature === sig.txSignature);
                        return (
                          <tr key={i} className={`border-b border-border/20 ${isVuln ? "bg-red-500/10" : ""}`}>
                            <td className="py-1.5 pr-3">{sig.slot}</td>
                            <td className="py-1.5 pr-3"><code className={isVuln ? "text-red-400 font-bold" : "text-yellow-400"}>{sig.R.slice(0, 20)}…</code>{isVuln && <Badge className="ml-1 bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">REUSE</Badge>}</td>
                            <td className="py-1.5 pr-3"><code className="text-muted-foreground">{sig.S.slice(0, 14)}…</code></td>
                            <td className="py-1.5"><a href={`https://solscan.io/tx/${sig.txSignature}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{trunc(sig.txSignature, 8)} ↗</a></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
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
  const [recovering, setRecovering] = useState<Record<string, boolean>>({});
  const [recoveries, setRecoveries] = useState<Record<string, RecoveryResult>>({});
  const [showAll, setShowAll] = useState(false);

  const SUB_CHAINS = ["polkadot", "kusama", "acala", "moonbeam", "astar"];

  const runScan = async () => {
    setScanning(true); setError(null); setResult(null); setRecoveries({});
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

  const recover = async (pair: PolkadotResult["nonceReusePairs"][0], key: string) => {
    setRecovering(p => ({ ...p, [key]: true }));
    try {
      const res = await fetch(`${BASE()}/api/quantum-audit/schnorr-recover`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ R: pair.sharedR, pubkey: pair.sig1.R, s1: pair.sig1.s, msg1: "", s2: pair.sig2.s, msg2: "" }),
      });
      const json = await res.json();
      setRecoveries(p => ({ ...p, [key]: json }));
    } catch (e) { setRecoveries(p => ({ ...p, [key]: { success: false, error: String(e) } })); }
    setRecovering(p => ({ ...p, [key]: false }));
  };

  return (
    <div className="space-y-5">
      <div className="bg-primary/5 border border-primary/20 rounded p-4 text-xs space-y-2">
        <p className="font-mono text-primary font-bold">Sr25519 / Schnorr Nonce Reuse — Polkadot / Substrate</p>
        <p className="text-muted-foreground">
          Every Polkadot extrinsic signature is 64 bytes. Bytes 0–31 = R (nonce point on Ristretto255). Matching R across two extrinsics from the same address proves the same nonce k was used.
          Recovery: <code className="text-yellow-400">key = (s1−s2) · (c1−c2)⁻¹ mod l</code>.
        </p>
        <p className="text-muted-foreground">
          <strong className="text-foreground">Input:</strong> SS58 wallet address OR a 0x-prefixed extrinsic hash. The scanner auto-resolves the signer from an extrinsic hash, then fetches multiple pages of history to scan before and after the anchor.
        </p>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4">
          <p className="text-xs font-mono text-muted-foreground mb-2">SUBSTRATE CHAIN</p>
          <div className="flex flex-wrap gap-2">
            {SUB_CHAINS.map(c => (
              <button key={c} onClick={() => setChain(c)}
                className={`px-3 py-1 rounded text-xs font-mono font-bold border transition-all capitalize ${chain === c ? "bg-primary text-black border-primary" : "border-primary/30 text-primary hover:bg-primary/10"}`}>
                {c}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <ScanInput
        label={`${chain.toUpperCase()} ADDRESS OR EXTRINSIC HASH`}
        placeholder="SS58 address (1xxx…)  —OR—  0x-prefixed extrinsic hash (0x…)"
        value={target} onChange={setTarget} onScan={runScan} scanning={scanning}
      />

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4 flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <ScanBanner
            vuln={result.hasVulnerability}
            label={result.hasVulnerability ? `⚠ NONCE REUSE — ${result.nonceReusePairs.length} Sr25519 pair(s)` : "✓ No Sr25519 Nonce Reuse Detected"}
            sub={`${result.signaturesExtracted} signatures · ${result.totalExtrinsics} extrinsics · ${result.chain} · ${result.anchorExtrinsic ? "anchor resolved" : "full history scan"}`}
          />

          {result.nonceReusePairs.map((pair, i) => {
            const key = `pair-${i}`;
            const rec = recoveries[key];
            return (
              <Card key={i} className="border-red-500/40 bg-red-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono">PAIR {i + 1}</Badge>
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono text-xs">Sr25519 NONCE REUSE</Badge>
                    </div>
                    {!rec && (
                      <Button onClick={() => recover(pair, key)} disabled={recovering[key]}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2 text-sm">
                        {recovering[key] ? <><RefreshCw className="w-3 h-3 animate-spin" /> Running…</> : <><Zap className="w-3 h-3" /> Recover Private Key</>}
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-black/40 rounded p-3">
                    <p className="text-xs font-mono text-red-400 mb-1">SHARED R (Ristretto255 nonce point)</p>
                    <code className="text-orange-300 font-mono text-xs break-all">{pair.sharedR}</code>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[{ sig: pair.sig1, label: "Extrinsic 1" }, { sig: pair.sig2, label: "Extrinsic 2" }].map(({ sig, label }) => (
                      <div key={label} className="bg-black/30 rounded p-3 space-y-1.5 text-xs font-mono">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{label}</span>
                          <a href={`https://${result.chain}.subscan.io/extrinsic/${sig.extrinsicHash}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Subscan ↗</a>
                        </div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Block:</span><span>{sig.blockNumber}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Scheme:</span><span className="text-primary">{sig.sigType}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Call:</span><span>{sig.callModule}.{sig.callFunction}</span></div>
                        <div><span className="text-muted-foreground">s: </span><code className="text-yellow-400">{trunc(sig.s, 12)}</code></div>
                      </div>
                    ))}
                  </div>
                  {rec && (
                    <div className={`rounded p-3 border ${rec.success ? "border-red-500/40 bg-red-500/5" : "border-border/40"}`}>
                      {rec.success
                        ? <PrivKeyBox keyHex={rec.privateKeyHex ?? ""} pairKey={key} />
                        : <p className="text-xs text-muted-foreground">{rec.error}</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Card className="border-border/50">
            <button onClick={() => setShowAll(p => !p)} className="flex items-center justify-between w-full p-4 text-left">
              <span className="font-mono text-sm font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> All Extrinsic Signatures ({result.allSignatures.length})
              </span>
              {showAll ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {showAll && (
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border/50 text-muted-foreground">
                        <th className="py-2 pr-3 text-left">Block</th>
                        <th className="py-2 pr-3 text-left">Type</th>
                        <th className="py-2 pr-3 text-left">R (nonce)</th>
                        <th className="py-2 pr-3 text-left">Call</th>
                        <th className="py-2 text-left">Hash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.allSignatures.map((sig, i) => {
                        const isVuln = result.nonceReusePairs.some(p => p.sig1.extrinsicHash === sig.extrinsicHash || p.sig2.extrinsicHash === sig.extrinsicHash);
                        return (
                          <tr key={i} className={`border-b border-border/20 ${isVuln ? "bg-red-500/10" : ""}`}>
                            <td className="py-1.5 pr-3">{sig.blockNumber}</td>
                            <td className="py-1.5 pr-3 text-primary">{sig.sigType}</td>
                            <td className="py-1.5 pr-3">
                              <code className={isVuln ? "text-red-400 font-bold" : "text-yellow-400"}>{sig.R.slice(0, 18)}…</code>
                              {isVuln && <Badge className="ml-1 bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">REUSE</Badge>}
                            </td>
                            <td className="py-1.5 pr-3 text-muted-foreground">{sig.callModule}</td>
                            <td className="py-1.5">
                              <a href={`https://${result.chain}.subscan.io/extrinsic/${sig.extrinsicHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{trunc(sig.extrinsicHash, 6)} ↗</a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        </>
      )}
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
  const [kiResult, setKiResult] = useState<null | { keyImages: { keyImage: string; spentOnChain: number; appearsCount: number }[]; duplicates: string[] }>(null);

  const runScan = async () => {
    setScanning(true); setError(null); setResult(null);
    try {
      const targets = target.trim().split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      const res = await fetch(`${BASE()}/api/quantum-audit/monero-scan`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: targets.length === 1 ? targets[0] : targets, blockWindow: Number(blockWindow) || 15 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? json.error);
      setResult(json);
    } catch (e) { setError(String(e)); }
    finally { setScanning(false); }
  };

  const runKiCheck = async () => {
    setScanning(true); setError(null); setKiResult(null);
    try {
      const kImages = kiInput.trim().split(/[\n,]+/).map(s => s.trim().toLowerCase()).filter(s => s.length === 64);
      if (kImages.length === 0) throw new Error("No valid 64-char hex key images found");
      const res = await fetch(`${BASE()}/api/quantum-audit/monero-keyimages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyImages: kImages }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? json.error);
      setKiResult(json);
    } catch (e) { setError(String(e)); }
    finally { setScanning(false); }
  };

  const SPEND_LABELS: Record<number, string> = { 0: "Unspent", 1: "Spent (confirmed)", 2: "Spent (pool)" };

  return (
    <div className="space-y-5">
      <div className="bg-primary/5 border border-primary/20 rounded p-4 text-xs space-y-2">
        <p className="font-mono text-primary font-bold">Monero CLSAG Key Image Reuse — Double-Spend Detection</p>
        <p className="text-muted-foreground">
          Every Monero spend publishes a <strong className="text-foreground">key image I = x·H_p(P)</strong> on-chain. This value is unique per UTXO — the same key image cannot legitimately appear in two transactions. A duplicate proves the same private spend key signed both, and the canonical chain rejects one; finding a duplicate in a non-canonical chain or in a buggy implementation is a confirmed double-spend.
        </p>
        <p className="text-muted-foreground">
          <strong className="text-foreground">Input (TX Hash mode):</strong> Provide a transaction hash. The scanner fetches its block height, then scans ±N surrounding blocks, collects every key image from every transaction in that window, and cross-references for duplicates. Also checks on-chain spend status via Monero daemon RPC.
        </p>
      </div>

      <div className="flex gap-2">
        {[{ id: false, label: "Scan by TX Hash", icon: Hash }, { id: true, label: "Check Key Images Directly", icon: Link }].map(({ id, label, icon: Icon }) => (
          <button key={String(id)} onClick={() => { setKiMode(id); setResult(null); setKiResult(null); setError(null); }}
            className={`flex-1 py-2 rounded text-xs font-mono font-bold border transition-all flex items-center justify-center gap-2 ${kiMode === id ? "bg-primary text-black border-primary" : "border-primary/30 text-primary hover:bg-primary/10"}`}>
            <Icon className="w-3 h-3" />{label}
          </button>
        ))}
      </div>

      {!kiMode ? (
        <>
          <Card className="border-primary/30 bg-card/80">
            <CardContent className="p-5 space-y-3">
              <label className="text-xs font-mono text-muted-foreground">TRANSACTION HASH(ES) — one per line or comma-separated</label>
              <Textarea
                placeholder={"64-char hex transaction hash\nMultiple hashes = cross-reference all key images across all of them"}
                value={target}
                onChange={e => setTarget(e.target.value)}
                className="font-mono text-sm h-24 resize-none"
              />
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <span>Block window ±</span>
                  <Input value={blockWindow} onChange={e => setBlockWindow(e.target.value)} className="w-16 h-7 text-xs font-mono text-center" />
                  <span>blocks around anchor</span>
                </div>
                <Button onClick={runScan} disabled={scanning || !target.trim()}
                  className="ml-auto bg-primary text-black hover:bg-primary/90 font-bold gap-2">
                  {scanning ? <><RefreshCw className="w-4 h-4 animate-spin" /> Scanning…</> : <><Search className="w-4 h-4" /> Scan</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {error && <Card className="border-destructive/50 bg-destructive/10"><CardContent className="p-4 flex gap-2 items-start"><AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" /><p className="text-sm">{error}</p></CardContent></Card>}

          {result && (
            <>
              <ScanBanner
                vuln={result.hasDoubleSpend}
                label={result.hasDoubleSpend ? `⚠ DUPLICATE KEY IMAGES — ${result.reuseDetected.length} double-spend pair(s)` : "✓ No Duplicate Key Images"}
                sub={`${result.keyImagesExtracted} key images · ${result.txHashesScanned} txs · blocks ${result.blocksScanned[0] ?? "?"}–${result.blocksScanned[result.blocksScanned.length - 1] ?? "?"}`}
              />

              <Card className="border-border/50 bg-card/80">
                <CardContent className="p-4 text-xs font-mono text-muted-foreground leading-relaxed">{result.note}</CardContent>
              </Card>

              {result.reuseDetected.map((pair, i) => (
                <Card key={i} className="border-red-500/40 bg-red-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono">DUPLICATE {i + 1}</Badge>
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono text-xs">DOUBLE-SPEND PROOF</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-black/40 rounded p-3">
                      <p className="text-xs font-mono text-red-400 mb-1">DUPLICATE KEY IMAGE I = x·H_p(P)</p>
                      <div className="flex items-center gap-2">
                        <code className="text-orange-300 text-xs font-mono break-all flex-1">{pair.keyImage}</code>
                        <button onClick={() => copy(pair.keyImage)}><Copy className="w-3 h-3 text-muted-foreground hover:text-primary" /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[{ ki: pair.tx1, label: "TX 1" }, { ki: pair.tx2, label: "TX 2" }].map(({ ki, label }) => (
                        <div key={label} className="bg-black/30 rounded p-3 text-xs font-mono space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold">{label}</span>
                            <a href={`https://xmrchain.net/tx/${ki.txHash}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">XMRChain ↗</a>
                          </div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Block:</span><span>{ki.blockHeight}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Input #:</span><span>{ki.inputIndex}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Ring size:</span><span>{ki.ringSize}</span></div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3 text-xs text-orange-400 font-mono space-y-1">
                      <p>{pair.significance}</p>
                      <p className="text-muted-foreground">{pair.ringIntersectionNote}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Card className="border-border/50">
                <button onClick={() => setShowAll(p => !p)} className="flex items-center justify-between w-full p-4 text-left">
                  <span className="font-mono text-sm font-bold flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> All Key Images ({result.allKeyImages.length})</span>
                  {showAll ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {showAll && (
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-mono">
                        <thead>
                          <tr className="border-b border-border/50 text-muted-foreground">
                            <th className="py-2 pr-3 text-left">Block</th>
                            <th className="py-2 pr-3 text-left">Input #</th>
                            <th className="py-2 pr-3 text-left">Key Image</th>
                            <th className="py-2 pr-3 text-left">Ring</th>
                            <th className="py-2 text-left">Spent</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.allKeyImages.map((ki, i) => {
                            const isDup = result.reuseDetected.some(p => p.keyImage === ki.keyImage);
                            const spentStatus = result.isKeyImageSpentStatus[ki.keyImage];
                            return (
                              <tr key={i} className={`border-b border-border/20 ${isDup ? "bg-red-500/10" : ""}`}>
                                <td className="py-1.5 pr-3">{ki.blockHeight}</td>
                                <td className="py-1.5 pr-3">{ki.inputIndex}</td>
                                <td className="py-1.5 pr-3">
                                  <code className={isDup ? "text-red-400 font-bold" : "text-yellow-400"}>{ki.keyImage.slice(0, 20)}…</code>
                                  {isDup && <Badge className="ml-1 bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">DUPE</Badge>}
                                </td>
                                <td className="py-1.5 pr-3 text-muted-foreground">{ki.ringSize}</td>
                                <td className="py-1.5">
                                  <span className={spentStatus === 1 ? "text-orange-400" : spentStatus === 0 ? "text-green-400" : "text-muted-foreground"}>
                                    {SPEND_LABELS[spentStatus] ?? "Unknown"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            </>
          )}
        </>
      ) : (
        <>
          <Card className="border-primary/30 bg-card/80">
            <CardContent className="p-5 space-y-3">
              <label className="text-xs font-mono text-muted-foreground">PASTE KEY IMAGES — one per line (64-char hex each)</label>
              <Textarea
                placeholder={"a1b2c3d4e5f6...  (64 hex chars)\nf6e5d4c3b2a1..."}
                value={kiInput} onChange={e => setKiInput(e.target.value)}
                className="font-mono text-xs h-32 resize-none"
              />
              <Button onClick={runKiCheck} disabled={scanning || !kiInput.trim()}
                className="bg-primary text-black hover:bg-primary/90 font-bold gap-2">
                {scanning ? <><RefreshCw className="w-4 h-4 animate-spin" /> Checking…</> : <><Search className="w-4 h-4" /> Check Key Images</>}
              </Button>
            </CardContent>
          </Card>

          {error && <Card className="border-destructive/50 bg-destructive/10"><CardContent className="p-4 flex gap-2"><AlertTriangle className="w-4 h-4 text-destructive" /><p className="text-sm">{error}</p></CardContent></Card>}

          {kiResult && (
            <>
              <ScanBanner
                vuln={kiResult.duplicates.length > 0}
                label={kiResult.duplicates.length > 0 ? `⚠ ${kiResult.duplicates.length} duplicate key image(s) found` : "✓ All key images unique"}
                sub={`${kiResult.keyImages.length} key images checked`}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono border border-border/30 rounded">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/20 text-muted-foreground">
                      <th className="py-2 px-3 text-left">Key Image</th>
                      <th className="py-2 px-3 text-left">Count</th>
                      <th className="py-2 px-3 text-left">On-Chain Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kiResult.keyImages.map((ki, i) => (
                      <tr key={i} className={`border-b border-border/20 ${ki.appearsCount > 1 ? "bg-red-500/10" : ""}`}>
                        <td className="py-1.5 px-3">
                          <code className={ki.appearsCount > 1 ? "text-red-400 font-bold" : "text-yellow-400"}>{ki.keyImage.slice(0, 24)}…</code>
                          {ki.appearsCount > 1 && <Badge className="ml-2 bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">DUPE</Badge>}
                        </td>
                        <td className="py-1.5 px-3 text-muted-foreground">{ki.appearsCount}×</td>
                        <td className="py-1.5 px-3">
                          <span className={ki.spentOnChain === 1 ? "text-orange-400" : ki.spentOnChain === 0 ? "text-green-400" : "text-muted-foreground"}>
                            {SPEND_LABELS[ki.spentOnChain] ?? "Unknown"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; scheme: string; chains: string; color: string }[] = [
  { id: "solana",   label: "Solana / Ed25519",       scheme: "Ed25519",   chains: "Solana · Cardano",                  color: "text-purple-400" },
  { id: "polkadot", label: "Polkadot / Sr25519",      scheme: "Sr25519",   chains: "Polkadot · Kusama · Substrate",      color: "text-pink-400"   },
  { id: "monero",   label: "Monero / CLSAG",          scheme: "CLSAG",     chains: "Monero",                             color: "text-orange-400" },
];

export default function SchemeAuditor() {
  const [tab, setTab] = useState<Tab>("solana");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <ShieldAlert className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-mono">Cryptographic Implementation Auditor</h1>
          <p className="text-sm text-muted-foreground">
            Real on-chain scanning for Ed25519, Sr25519 (Schnorr), and CLSAG signature vulnerabilities. Input an address or a single transaction hash — the scanner resolves everything automatically.
          </p>
        </div>
      </div>

      {/* Tab selector */}
      <div className="grid grid-cols-3 gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`p-3 rounded-lg border transition-all text-left ${tab === t.id ? "border-primary bg-primary/10" : "border-border/50 hover:border-border"}`}>
            <p className={`text-xs font-mono font-bold ${tab === t.id ? "text-primary" : t.color}`}>{t.scheme}</p>
            <p className="text-sm font-bold mt-0.5 truncate">{t.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.chains}</p>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "solana"   && <SolanaTab />}
      {tab === "polkadot" && <PolkadotTab />}
      {tab === "monero"   && <MoneroTab />}
    </div>
  );
}
