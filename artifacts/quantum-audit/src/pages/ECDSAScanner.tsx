import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Key, Search, AlertTriangle, CheckCircle, ChevronDown, ChevronRight,
  Zap, Copy, Download, RefreshCw, ArrowRight, ShieldAlert, Eye, EyeOff
} from "lucide-react";

type TxSig = {
  txHash: string; blockNumber: number; from: string; to: string | null;
  value: string; r: string; s: string; v: number; z: string; nonce: number;
};

type ReusePair = {
  sharedR: string;
  tx1: TxSig; tx2: TxSig;
  riskLevel: string;
};

type ScanResult = {
  address: string; chain: string;
  totalTransactions: number; signaturesExtracted: number;
  nonceReusePairs: ReusePair[];
  hasVulnerability: boolean;
  allSignatures: TxSig[];
  scanTimestamp: string;
};

type RecoveryResult = {
  success: boolean;
  privateKey: string | null;
  nonceK: string | null;
  derivedAddress: string | null;
  addressMatches: boolean;
  error: string | null;
  math: {
    step1_numerator: string; step1_denominator: string;
    step2_k: string; step3_privateKey: string; verification: string;
  };
};

const BASE = () => (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

function truncate(s: string, n = 20) {
  return s.length > n * 2 + 3 ? s.slice(0, n) + "…" + s.slice(-n) : s;
}

function generateReport(address: string, scan: ScanResult, pairs: { pair: ReusePair; result: RecoveryResult }[]) {
  const now = new Date().toLocaleString();
  return `
================================================================================
  QUANTUMAUDIT — ECDSA NONCE REUSE VULNERABILITY REPORT
  Responsible Disclosure Document
  Prepared by: ALPHA UNLIMITED TECHNOLOGIES LLC
================================================================================

  Date:                 ${now}
  Target Address:       ${address}
  Chain:                Ethereum (secp256k1 / ECDSA)
  Transactions Scanned: ${scan.totalTransactions}
  Signatures Extracted: ${scan.signaturesExtracted}
  Nonce Reuse Pairs:    ${scan.nonceReusePairs.length}
  Vulnerability Found:  ${scan.hasVulnerability ? "YES — CRITICAL" : "No"}

================================================================================
  TECHNICAL BACKGROUND
================================================================================

  ECDSA signatures on secp256k1 require a unique random nonce k per signature.
  The signature r-value is computed as r = (k·G).x mod n.
  If k is ever reused across two transactions, r is identical in both signatures.

  Detecting matching r values proves nonce reuse.
  Given matching r and both (s, z) pairs, the private key d is recovered as:
    k = (z1 - z2) · (s1 - s2)⁻¹  mod n
    d = (s1·k - z1) · r⁻¹          mod n

  This attack requires no brute force and runs in milliseconds.
  Historical precedent: Sony PS3 (2010), Android SecureRandom (2012),
  Bitcoin weak-RNG wallets (2013 — 1000+ BTC recovered by researchers).

================================================================================
  VULNERABILITY FINDINGS
================================================================================

${scan.nonceReusePairs.length === 0 ? "  No nonce reuse detected in the scanned transaction set.\n" : ""}
${pairs.map((p, i) => `
  [PAIR ${i + 1}] ${p.pair.riskLevel === "confirmed_reuse" ? "CONFIRMED NONCE REUSE" : "SAME K DETECTED"}
  ─────────────────────────────────────────────────────────
  Shared R Value (proves same k):
    ${p.pair.sharedR}

  Transaction 1:  ${p.pair.tx1.txHash}
    Block:        ${p.pair.tx1.blockNumber}
    Nonce:        ${p.pair.tx1.nonce}
    s value:      ${p.pair.tx1.s}
    z (msg hash): ${p.pair.tx1.z}

  Transaction 2:  ${p.pair.tx2.txHash}
    Block:        ${p.pair.tx2.blockNumber}
    Nonce:        ${p.pair.tx2.nonce}
    s value:      ${p.pair.tx2.s}
    z (msg hash): ${p.pair.tx2.z}

  Recovery Result:  ${p.result.success ? "PRIVATE KEY RECOVERED" : "Recovery attempted — " + p.result.error}
  ${p.result.success ? `
  Recovered Nonce k:   ${p.result.nonceK}
  Recovered Private Key: ${p.result.privateKey}
  Derived Address:     ${p.result.derivedAddress}
  Address Match:       ${p.result.addressMatches ? "YES — CONFIRMED" : "No (check signing address chain)"}

  Mathematical Steps:
    (z1 - z2) mod n = ${p.result.math.step1_numerator}
    (s1 - s2) mod n = ${p.result.math.step1_denominator}
    k =               ${p.result.math.step2_k}
    Private Key d =   ${p.result.math.step3_privateKey}
    Verification:     ${p.result.math.verification}
  ` : ""}
`).join("")}
================================================================================
  RECOMMENDATIONS
================================================================================

  IF this is your own wallet and a private key was recovered:
  - Transfer all funds to a freshly generated wallet immediately
  - Never reuse this wallet address
  - Investigate your wallet software's RNG implementation

  IF this is for bug bounty / responsible disclosure:
  - Report to the wallet software developer with this document
  - Include the recovered private key as proof-of-concept
  - Recommend auditing the CSPRNG used for k generation
  - Suggest migration to deterministic k (RFC 6979)

================================================================================
  ALPHA UNLIMITED TECHNOLOGIES LLC
  alphaunlimitedtechnologies@gmail.com
================================================================================
`;
}

export default function ECDSAScanner() {
  const [address, setAddress] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [recovering, setRecovering] = useState<Record<string, boolean>>({});
  const [recoveryResults, setRecoveryResults] = useState<Record<string, RecoveryResult>>({});
  const [showPrivKey, setShowPrivKey] = useState<Record<string, boolean>>({});
  const [showAllSigs, setShowAllSigs] = useState(false);

  const toggle = (k: string) => setExpanded(p => ({ ...p, [k]: !p[k] }));
  const copy = (s: string) => navigator.clipboard?.writeText(s);

  const runScan = async () => {
    if (!address.trim()) return;
    setScanning(true);
    setError(null);
    setScanResult(null);
    setRecoveryResults({});
    try {
      const res = await fetch(`${BASE()}/api/quantum-audit/ecdsa-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? json.error ?? "Scan failed");
      setScanResult(json as ScanResult);
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  };

  const runRecovery = async (pair: ReusePair, pairKey: string) => {
    setRecovering(p => ({ ...p, [pairKey]: true }));
    try {
      const res = await fetch(`${BASE()}/api/quantum-audit/ecdsa-recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          r: pair.sharedR,
          s1: pair.tx1.s,
          s2: pair.tx2.s,
          z1: pair.tx1.z,
          z2: pair.tx2.z,
          txHash1: pair.tx1.txHash,
          txHash2: pair.tx2.txHash,
          address: scanResult?.address ?? "",
        }),
      });
      const json = await res.json();
      setRecoveryResults(p => ({ ...p, [pairKey]: json as RecoveryResult }));
    } catch (e) {
      setRecoveryResults(p => ({ ...p, [pairKey]: { success: false, privateKey: null, nonceK: null, derivedAddress: null, addressMatches: false, error: String(e), math: { step1_numerator: "", step1_denominator: "", step2_k: "", step3_privateKey: "", verification: "" } } }));
    } finally {
      setRecovering(p => ({ ...p, [pairKey]: false }));
    }
  };

  const downloadReport = () => {
    if (!scanResult) return;
    const pairs = scanResult.nonceReusePairs.map((pair, i) => ({
      pair,
      result: recoveryResults[`pair-${i}`] ?? { success: false, privateKey: null, nonceK: null, derivedAddress: null, addressMatches: false, error: "Not yet run", math: { step1_numerator: "", step1_denominator: "", step2_k: "", step3_privateKey: "", verification: "" } },
    }));
    const text = generateReport(address, scanResult, pairs);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ecdsa-nonce-reuse-${address.slice(0, 10)}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Key className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-mono">ECDSA Nonce Reuse Scanner</h1>
            <p className="text-sm text-muted-foreground">
              Scan any Ethereum address for signature nonce reuse — the classical math attack that recovers private keys
            </p>
          </div>
        </div>
        {scanResult && (
          <Button onClick={downloadReport} variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
            <Download className="w-4 h-4" /> Disclosure Report
          </Button>
        )}
      </div>

      {/* How it works — collapsed info */}
      <Card className="border-primary/20 bg-primary/5">
        <button onClick={() => toggle("info")} className="w-full flex items-center justify-between p-4 hover:bg-white/5 text-left">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <span className="text-sm font-mono text-primary font-bold">How This Attack Works (No Quantum Computer Needed)</span>
          </div>
          {expanded["info"] ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-primary" />}
        </button>
        {expanded["info"] && (
          <div className="px-4 pb-4 space-y-3 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { step: "1", title: "Every ECDSA signature needs a unique random k", body: "r = (k·G).x mod n — the r value is derived directly from k. If k is ever the same in two signatures, r will be identical." },
                { step: "2", title: "Matching r values prove the same k was used", body: "Scanning all transactions from a wallet and grouping by r value reveals any nonce reuse instantly. This is pure pattern matching." },
                { step: "3", title: "Algebra recovers k, then the private key", body: "k = (z1−z2)·(s1−s2)⁻¹ mod n, then d = (s1·k−z1)·r⁻¹ mod n. Runs in milliseconds. No guessing. No brute force." },
              ].map(({ step, title, body }) => (
                <div key={step} className="bg-black/30 rounded p-3">
                  <div className="text-primary font-bold font-mono text-xs mb-1">STEP {step}</div>
                  <p className="font-bold text-xs mb-1">{title}</p>
                  <p className="text-xs text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3">
              <p className="text-xs text-orange-400 font-mono font-bold mb-1">REAL WORLD PRECEDENT</p>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Sony PS3 (2010)</strong> — Sony used a fixed k for all firmware signatures. Geohot recovered Sony's private signing key with this exact math. &nbsp;
                <strong className="text-foreground">Android Bitcoin wallets (2013)</strong> — Android's SecureRandom had a flaw causing k reuse. Researchers recovered private keys from on-chain signatures and swept 1000+ BTC.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Scan input */}
      <Card className="border-primary/30 bg-card/80">
        <CardContent className="p-6 space-y-4">
          <label className="text-xs font-mono text-muted-foreground">ETHEREUM WALLET ADDRESS TO SCAN</label>
          <div className="flex gap-3">
            <Input
              placeholder="0x... wallet address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runScan()}
              className="font-mono text-sm flex-1"
            />
            <Button
              onClick={runScan}
              disabled={scanning || !address.trim()}
              className="bg-primary text-black hover:bg-primary/90 font-bold gap-2 flex-shrink-0"
            >
              {scanning
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Scanning…</>
                : <><Search className="w-4 h-4" /> Scan Wallet</>}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            Scans up to 50 outgoing transactions, extracts ECDSA (r, s, z) from each, then groups by r value to detect nonce reuse.
          </p>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-destructive">Scan Error</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan results */}
      {scanResult && (
        <>
          {/* Summary banner */}
          <div className={`p-5 rounded-xl border-2 ${scanResult.hasVulnerability ? "border-red-500 bg-red-500/10 text-red-400" : "border-green-500 bg-green-500/10 text-green-400"}`}>
            <div className="flex items-center gap-3 mb-3">
              {scanResult.hasVulnerability
                ? <AlertTriangle className="w-7 h-7 flex-shrink-0" />
                : <CheckCircle className="w-7 h-7 flex-shrink-0" />}
              <div>
                <p className="font-bold font-mono text-xl">
                  {scanResult.hasVulnerability
                    ? `⚠ NONCE REUSE DETECTED — ${scanResult.nonceReusePairs.length} vulnerable pair(s)`
                    : "✓ No Nonce Reuse Detected"}
                </p>
                <p className="text-sm opacity-80">
                  {scanResult.signaturesExtracted} signatures extracted from {scanResult.totalTransactions} transactions
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Transactions Scanned", value: scanResult.totalTransactions },
                { label: "Signatures Extracted", value: scanResult.signaturesExtracted },
                { label: "Vulnerable Pairs", value: scanResult.nonceReusePairs.length },
              ].map(({ label, value }) => (
                <div key={label} className="text-center bg-black/20 rounded p-2">
                  <p className="text-2xl font-bold font-mono">{value}</p>
                  <p className="text-xs opacity-70">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Nonce reuse pairs */}
          {scanResult.nonceReusePairs.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-mono font-bold text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Nonce Reuse Pairs — Click to Run Recovery Math
              </h2>

              {scanResult.nonceReusePairs.map((pair, i) => {
                const pairKey = `pair-${i}`;
                const recovery = recoveryResults[pairKey];
                const isRecovering = recovering[pairKey];

                return (
                  <Card key={i} className="border-red-500/40 bg-red-500/5 overflow-hidden">
                    {/* Pair header */}
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono">PAIR {i + 1}</Badge>
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono text-xs">
                            {pair.riskLevel === "confirmed_reuse" ? "CONFIRMED NONCE REUSE" : "SAME K DETECTED"}
                          </Badge>
                        </div>
                        {!recovery && (
                          <Button
                            onClick={() => runRecovery(pair, pairKey)}
                            disabled={isRecovering}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2 text-sm"
                          >
                            {isRecovering
                              ? <><RefreshCw className="w-3 h-3 animate-spin" /> Running Math…</>
                              : <><Zap className="w-3 h-3" /> Run Private Key Recovery</>}
                          </Button>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Shared r */}
                      <div className="bg-black/40 rounded p-3">
                        <p className="text-xs font-mono text-red-400 mb-1">SHARED R VALUE (proves same nonce k was used)</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-orange-300 flex-1 break-all">{pair.sharedR}</code>
                          <button onClick={() => copy(pair.sharedR)} className="flex-shrink-0 text-muted-foreground hover:text-primary"><Copy className="w-3 h-3" /></button>
                        </div>
                      </div>

                      {/* Two transactions */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[{ tx: pair.tx1, label: "TX 1" }, { tx: pair.tx2, label: "TX 2" }].map(({ tx, label }) => (
                          <div key={label} className="bg-black/30 rounded p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono font-bold text-foreground">{label}</span>
                              <a
                                href={`https://etherscan.io/tx/${tx.txHash}`}
                                target="_blank" rel="noopener noreferrer"
                                className="text-xs font-mono text-primary hover:underline"
                              >
                                View on Etherscan ↗
                              </a>
                            </div>
                            <div className="space-y-1 text-xs font-mono">
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Block:</span>
                                <span className="text-foreground">{tx.blockNumber}</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Nonce:</span>
                                <span className="text-foreground">{tx.nonce}</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Value:</span>
                                <span className="text-foreground">{tx.value} ETH</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">s: </span>
                                <span className="text-yellow-400 break-all">{truncate(tx.s, 14)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">z: </span>
                                <span className="text-blue-400 break-all">{truncate(tx.z, 14)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Arrow showing both feed into recovery */}
                      <div className="flex items-center justify-center gap-3 text-xs font-mono text-muted-foreground">
                        <span className="text-yellow-400">s1, z1</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="text-red-400 font-bold">k = (z1−z2)·(s1−s2)⁻¹ mod n</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="text-green-400">private key</span>
                      </div>

                      {/* Recovery result */}
                      {recovery && (
                        <div className={`rounded-lg border-2 p-4 space-y-3 ${recovery.success && recovery.addressMatches ? "border-red-500 bg-red-500/10" : recovery.success ? "border-orange-500 bg-orange-500/10" : "border-yellow-500/50 bg-yellow-500/5"}`}>
                          <div className="flex items-center gap-2">
                            {recovery.success
                              ? <AlertTriangle className="w-5 h-5 text-red-400" />
                              : <CheckCircle className="w-5 h-5 text-green-400" />}
                            <span className="font-bold font-mono">
                              {recovery.success && recovery.addressMatches
                                ? "PRIVATE KEY RECOVERED — ADDRESS CONFIRMED"
                                : recovery.success
                                  ? "Private Key Computed (check address below)"
                                  : "No Private Key — " + recovery.error}
                            </span>
                          </div>

                          {recovery.success && (
                            <>
                              {/* Math steps */}
                              <div className="bg-black/40 rounded p-3 space-y-1.5">
                                <p className="text-xs font-mono text-primary mb-2">MATHEMATICAL STEPS</p>
                                {[
                                  { label: "(z1 − z2) mod n", value: recovery.math.step1_numerator },
                                  { label: "(s1 − s2) mod n", value: recovery.math.step1_denominator },
                                  { label: "k (nonce recovered)", value: recovery.math.step2_k },
                                ].map(({ label, value }) => (
                                  <div key={label} className="flex items-start gap-2 text-xs font-mono">
                                    <span className="text-muted-foreground flex-shrink-0 w-36">{label}:</span>
                                    <code className="text-yellow-400 break-all flex-1">{truncate(value, 16)}</code>
                                    <button onClick={() => copy(value)} className="flex-shrink-0"><Copy className="w-2.5 h-2.5 text-muted-foreground hover:text-primary" /></button>
                                  </div>
                                ))}
                              </div>

                              {/* Recovered private key */}
                              <div className="bg-black/60 border border-red-500/40 rounded p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-mono text-red-400 font-bold">RECOVERED PRIVATE KEY</p>
                                  <button
                                    onClick={() => setShowPrivKey(p => ({ ...p, [pairKey]: !p[pairKey] }))}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                  >
                                    {showPrivKey[pairKey] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                    {showPrivKey[pairKey] ? "Hide" : "Reveal"}
                                  </button>
                                </div>
                                {showPrivKey[pairKey] ? (
                                  <div className="flex items-center gap-2">
                                    <code className="text-red-300 font-mono text-xs break-all flex-1">{recovery.privateKey}</code>
                                    <button onClick={() => copy(recovery.privateKey!)}><Copy className="w-3 h-3 text-muted-foreground hover:text-primary" /></button>
                                  </div>
                                ) : (
                                  <div className="h-5 bg-red-500/20 rounded flex items-center px-2">
                                    <span className="text-xs text-red-400/60 font-mono">████████████████████████████████████████████████████████████████</span>
                                  </div>
                                )}
                                <div className="text-xs font-mono space-y-1">
                                  <div>
                                    <span className="text-muted-foreground">Nonce k: </span>
                                    <code className="text-yellow-400">{showPrivKey[pairKey] ? truncate(recovery.nonceK ?? "", 16) : "████████…"}</code>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Derived Address: </span>
                                    <code className={recovery.addressMatches ? "text-red-400" : "text-orange-400"}>{recovery.derivedAddress}</code>
                                    <span className="ml-2">{recovery.addressMatches ? "✓ MATCHES" : "⚠ different address"}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-xs font-mono p-2 rounded border border-border/30 text-muted-foreground">
                                {recovery.math.verification}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* All signatures table */}
          {scanResult.allSignatures.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <button onClick={() => setShowAllSigs(p => !p)} className="flex items-center justify-between w-full text-left">
                  <CardTitle className="font-mono text-sm flex items-center gap-2">
                    <Key className="w-4 h-4 text-primary" />
                    All Extracted Signatures ({scanResult.allSignatures.length})
                  </CardTitle>
                  {showAllSigs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </CardHeader>
              {showAllSigs && (
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground text-left">
                          <th className="py-2 pr-3">Block</th>
                          <th className="py-2 pr-3">Nonce</th>
                          <th className="py-2 pr-3">Value</th>
                          <th className="py-2 pr-3">r (first 16 chars)</th>
                          <th className="py-2 pr-3">s (first 16 chars)</th>
                          <th className="py-2">z — signed hash</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scanResult.allSignatures.map((sig, i) => {
                          const isVulnerable = scanResult.nonceReusePairs.some(
                            p => p.tx1.txHash === sig.txHash || p.tx2.txHash === sig.txHash
                          );
                          return (
                            <tr key={i} className={`border-b border-border/20 ${isVulnerable ? "bg-red-500/10" : ""}`}>
                              <td className="py-1.5 pr-3 text-foreground">{sig.blockNumber}</td>
                              <td className="py-1.5 pr-3">{sig.nonce}</td>
                              <td className="py-1.5 pr-3 text-primary">{sig.value}</td>
                              <td className="py-1.5 pr-3">
                                <code className={`${isVulnerable ? "text-red-400 font-bold" : "text-yellow-400"}`}>
                                  {sig.r.slice(0, 18)}…
                                </code>
                                {isVulnerable && <Badge className="ml-1 bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">REUSE</Badge>}
                              </td>
                              <td className="py-1.5 pr-3"><code className="text-muted-foreground">{sig.s.slice(0, 18)}…</code></td>
                              <td className="py-1.5">
                                <a href={`https://etherscan.io/tx/${sig.txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                  {sig.z.slice(0, 14)}… ↗
                                </a>
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
          )}

          {/* No vulnerability note */}
          {!scanResult.hasVulnerability && scanResult.signaturesExtracted > 0 && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="p-5 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-green-400 font-mono">This wallet's nonce generation appears sound</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    All {scanResult.signaturesExtracted} signatures have unique r values — no k reuse detected in the scanned set. This wallet's signing implementation generated a unique random nonce for each transaction.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Note: Only the most recent {scanResult.signaturesExtracted} outgoing transactions were analyzed. Historical transactions prior to this set were not checked.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
