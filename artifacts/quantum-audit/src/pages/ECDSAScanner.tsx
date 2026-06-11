// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Key, Search, AlertTriangle, CheckCircle, ChevronDown, ChevronRight,
  Zap, Copy, Download, RefreshCw, ArrowRight, ShieldAlert, Eye, EyeOff,
  Lock, ShieldCheck, Info, Cpu, Database, BarChart3, Terminal
} from "lucide-react";

type ChainCapability = {
  chain: string; name: string;
  sigScheme: "secp256k1-ecdsa" | "ed25519" | "clsag" | "schnorr";
  nonceReuseVulnerable: boolean; note: string; canScan: boolean;
};

type TxSig = {
  txHash: string; blockNumber: number; from: string; to: string | null;
  value: string; r: string; s: string; v: number; z: string; nonce: number;
};
type ReusePair = { sharedR: string; tx1: TxSig; tx2: TxSig; riskLevel: string };
type ScanResult = {
  address: string; chain: string; totalTransactions: number;
  signaturesExtracted: number; nonceReusePairs: ReusePair[];
  hasVulnerability: boolean; allSignatures: TxSig[]; scanTimestamp: string;
};
type RecoveryResult = {
  success: boolean; privateKey: string | null; nonceK: string | null;
  derivedAddress: string | null; addressMatches: boolean; error: string | null;
  math: { step1_numerator: string; step1_denominator: string; step2_k: string; step3_privateKey: string; verification: string };
};

const BASE = () => (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
const truncate = (s: string, n = 18) => s.length > n * 2 + 3 ? s.slice(0, n) + "…" + s.slice(-n) : s;

const STATIC_CHAINS: ChainCapability[] = [
  { chain: "ethereum",    name: "Ethereum (ETH)",     sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — extracts r, s, z from every outgoing transaction" },
  { chain: "polygon",     name: "Polygon (MATIC)",     sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — same secp256k1 ECDSA as Ethereum" },
  { chain: "bsc",         name: "BNB Chain (BSC)",     sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — same secp256k1 ECDSA as Ethereum" },
  { chain: "arbitrum",    name: "Arbitrum (ARB)",      sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — same secp256k1 ECDSA as Ethereum" },
  { chain: "avalanche",   name: "Avalanche (AVAX)",    sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — Avalanche C-Chain uses same secp256k1 ECDSA" },
  { chain: "optimism",    name: "Optimism (OP)",       sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — same secp256k1 ECDSA as Ethereum" },
  { chain: "bitcoin",     name: "Bitcoin (BTC)",       sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Parses DER-encoded signatures from scriptSig and witness data. Supports P2PKH, P2WPKH." },
  { chain: "litecoin",    name: "Litecoin (LTC)",      sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Same secp256k1 ECDSA as Bitcoin — full DER signature scan" },
  { chain: "dogecoin",    name: "Dogecoin (DOGE)",     sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Same secp256k1 ECDSA as Bitcoin — full DER signature scan" },
  { chain: "bitcoincash", name: "Bitcoin Cash (BCH)",  sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Same secp256k1 ECDSA as Bitcoin — full DER signature scan" },
  { chain: "solana",      name: "Solana (SOL)",        sigScheme: "ed25519",          nonceReuseVulnerable: false, canScan: false, note: "Ed25519 (RFC 8032) generates each nonce deterministically as k = H(private_key_b || message). Two different messages always produce different nonces by mathematical necessity — making this attack impossible by design." },
  { chain: "monero",      name: "Monero (XMR)",        sigScheme: "clsag",            nonceReuseVulnerable: false, canScan: false, note: "CLSAG ring signatures have no exposed r value to match across transactions. There is no (r, s, z) triple to extract. Monero's post-quantum vulnerabilities lie in ECDLP on Curve25519, not nonce reuse." },
  { chain: "cardano",     name: "Cardano (ADA)",       sigScheme: "ed25519",          nonceReuseVulnerable: false, canScan: false, note: "Ed25519 deterministic signatures — same immunity as Solana. The signing algorithm makes nonce reuse cryptographically impossible." },
  { chain: "polkadot",    name: "Polkadot (DOT)",      sigScheme: "schnorr",          nonceReuseVulnerable: false, canScan: false, note: "Sr25519 (Schnorr/Ristretto) uses deterministic nonce generation via Merlin transcripts — not vulnerable to nonce reuse." },
];

const SCHEME_LABELS: Record<string, string> = {
  "secp256k1-ecdsa": "secp256k1 ECDSA",
  "ed25519": "Ed25519",
  "clsag": "CLSAG Ring Sigs",
  "schnorr": "Schnorr/Sr25519",
};

const CHAIN_EXPLORER_TX: Record<string, string> = {
  ethereum:    "https://etherscan.io/tx/",
  polygon:     "https://polygonscan.com/tx/",
  bsc:         "https://bscscan.com/tx/",
  arbitrum:    "https://arbiscan.io/tx/",
  avalanche:   "https://snowtrace.io/tx/",
  optimism:    "https://optimistic.etherscan.io/tx/",
  bitcoin:     "https://mempool.space/tx/",
  litecoin:    "https://litecoinspace.org/tx/",
  dogecoin:    "https://dogechain.info/tx/",
  bitcoincash: "https://explorer.bitcoincash.org/tx/",
};

const CHAIN_PLACEHOLDER: Record<string, string> = {
  ethereum: "0x... (Ethereum address)", polygon: "0x... (Polygon address)",
  bsc: "0x... (BSC address)", arbitrum: "0x... (Arbitrum address)",
  avalanche: "0x... (Avalanche C-Chain address)", optimism: "0x... (Optimism address)",
  bitcoin: "bc1... or 1... or 3... (Bitcoin address)",
  litecoin: "L... or ltc1... (Litecoin address)",
  dogecoin: "D... (Dogecoin address)",
  bitcoincash: "bitcoincash:q... or 1... (BCH address)",
};

function generateReport(address: string, chain: string, scan: ScanResult, pairs: { pair: ReusePair; result: RecoveryResult }[]) {
  const now = new Date().toLocaleString();
  const capName = chain.charAt(0).toUpperCase() + chain.slice(1);
  return `
================================================================================
  QUANTUMAUDIT — ECDSA NONCE REUSE VULNERABILITY REPORT
  Responsible Disclosure Document
  Prepared by: ALPHA UNLIMITED TECHNOLOGIES LLC
================================================================================

  Date:                 ${now}
  Target Address:       ${address}
  Chain:                ${capName} (secp256k1 / ECDSA)
  Transactions Scanned: ${scan.totalTransactions}
  Signatures Extracted: ${scan.signaturesExtracted}
  Nonce Reuse Pairs:    ${scan.nonceReusePairs.length}
  Vulnerability Found:  ${scan.hasVulnerability ? "YES — CRITICAL" : "No"}

================================================================================
  TECHNICAL BACKGROUND
================================================================================

  ECDSA signatures on secp256k1 require a unique random nonce k per signature.
  r = (k·G).x mod n.  If k is reused, r is identical across both signatures.
  Detecting matching r values proves nonce reuse.

  k = (z1 - z2) · (s1 - s2)⁻¹  mod n
  d = (s1·k - z1) · r⁻¹          mod n

  No brute force. Runs in milliseconds.
  This applies to all secp256k1 ECDSA chains: ${capName}, Ethereum, Bitcoin, and
  every EVM-compatible network.

================================================================================
  VULNERABILITY FINDINGS
================================================================================
${scan.nonceReusePairs.length === 0 ? "\n  No nonce reuse detected in the scanned transaction set.\n" : ""}
${pairs.map((p, i) => `
  [PAIR ${i + 1}] ${p.pair.riskLevel === "confirmed_reuse" ? "CONFIRMED NONCE REUSE" : "SAME K DETECTED"}
  Shared R: ${p.pair.sharedR}
  TX 1: ${p.pair.tx1.txHash} (block ${p.pair.tx1.blockNumber})
    s: ${p.pair.tx1.s}   z: ${p.pair.tx1.z}
  TX 2: ${p.pair.tx2.txHash} (block ${p.pair.tx2.blockNumber})
    s: ${p.pair.tx2.s}   z: ${p.pair.tx2.z}
  Recovery: ${p.result.success ? "PRIVATE KEY RECOVERED" : "Not run / failed — " + p.result.error}
  ${p.result.success ? `
  Private Key: ${p.result.privateKey}
  Nonce k:     ${p.result.nonceK}
  Derived Addr:${p.result.derivedAddress}
  Match:       ${p.result.addressMatches ? "YES" : "No"}
  ` : ""}
`).join("")}
================================================================================
  ALPHA UNLIMITED TECHNOLOGIES LLC
  alphaunlimitedtechnologies@gmail.com
================================================================================
`;
}

export default function ECDSAScanner() {
  const [chains] = useState<ChainCapability[]>(STATIC_CHAINS);
  const [selectedChain, setSelectedChain] = useState("ethereum");
  const [address, setAddress] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [notScannableInfo, setNotScannableInfo] = useState<{ name: string; sigScheme: string; reason: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [recovering, setRecovering] = useState<Record<string, boolean>>({});
  const [recoveryResults, setRecoveryResults] = useState<Record<string, RecoveryResult>>({});
  const [showPrivKey, setShowPrivKey] = useState<Record<string, boolean>>({});
  const [showAllSigs, setShowAllSigs] = useState(false);


  const toggle = (k: string) => setExpanded(p => ({ ...p, [k]: !p[k] }));
  const copy = (s: string) => navigator.clipboard?.writeText(s);

  // ── Advanced Attack Panel state ──────────────────────────────────────────────
  type AdvState = {
    running: boolean; startedAt: string | null;
    log: string[]; lastReport: string | null; reports: string[];
  };
  const [advState, setAdvState]             = useState<AdvState | null>(null);
  const [advLimit, setAdvLimit]             = useState("500");
  const [advPolling, setAdvPolling]         = useState(false);
  const [advPanelOpen, setAdvPanelOpen]     = useState(false);
  const [advReport, setAdvReport]           = useState<Record<string, unknown> | null>(null);

  const pollAdvStatus = async () => {
    try {
      const r = await fetch(`${BASE()}/api/quantum-audit/advanced-attack-status`);
      if (r.ok) setAdvState(await r.json());
    } catch {}
  };

  useEffect(() => {
    if (!advPanelOpen) return;
    pollAdvStatus();
    const id = setInterval(pollAdvStatus, 4000);
    return () => clearInterval(id);
  }, [advPanelOpen]);

  const startAdvScan = async () => {
    setAdvPolling(true);
    try {
      const r = await fetch(`${BASE()}/api/quantum-audit/advanced-attack-scan`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: parseInt(advLimit) || 500, targeted: true }),
      });
      const j = await r.json();
      if (!r.ok && r.status !== 409) throw new Error(j.error ?? "Failed");
      await pollAdvStatus();
    } catch (e) { alert(String(e)); }
    setAdvPolling(false);
  };

  const loadAdvReport = async (filePath: string) => {
    const filename = filePath.split("/").pop();
    try {
      const r = await fetch(`${BASE()}/api/quantum-audit/advanced-attack-report/${filename}`);
      if (r.ok) setAdvReport(await r.json());
    } catch {}
  };

  const currentChainInfo = chains.find(c => c.chain === selectedChain);
  const scannableChains = chains.filter(c => c.canScan);
  const nonScannableChains = chains.filter(c => !c.canScan);

  const runScan = async () => {
    if (!address.trim()) return;
    setScanning(true);
    setError(null);
    setScanResult(null);
    setNotScannableInfo(null);
    setRecoveryResults({});
    try {
      const res = await fetch(`${BASE()}/api/quantum-audit/ecdsa-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chain: selectedChain }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === "not_scannable") {
          setNotScannableInfo({ name: json.name, sigScheme: json.sigScheme, reason: json.reason });
          return;
        }
        throw new Error(json.detail ?? json.error ?? "Scan failed");
      }
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
        body: JSON.stringify({ r: pair.sharedR, s1: pair.tx1.s, s2: pair.tx2.s, z1: pair.tx1.z, z2: pair.tx2.z, address: scanResult?.address ?? "" }),
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
      result: recoveryResults[`pair-${i}`] ?? { success: false, privateKey: null, nonceK: null, derivedAddress: null, addressMatches: false, error: "Not run", math: { step1_numerator: "", step1_denominator: "", step2_k: "", step3_privateKey: "", verification: "" } },
    }));
    const blob = new Blob([generateReport(address, selectedChain, scanResult, pairs)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ecdsa-scan-${selectedChain}-${address.slice(0, 10)}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const explorerBase = CHAIN_EXPLORER_TX[selectedChain] ?? "https://etherscan.io/tx/";

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
            <p className="text-sm text-muted-foreground">Scan any secp256k1 blockchain for signature nonce reuse — recovers private keys using classical algebra</p>
          </div>
        </div>
        {scanResult && (
          <Button onClick={downloadReport} variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
            <Download className="w-4 h-4" /> Disclosure Report
          </Button>
        )}
      </div>

      {/* ── Advanced Attack Panel ─────────────────────────────────────────────── */}
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <button onClick={() => setAdvPanelOpen(p => !p)} className="w-full flex items-center justify-between p-4 hover:bg-white/5 text-left">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-mono text-yellow-400 font-bold">Advanced Attack Battery — 8 Attack Vectors</span>
            {advState?.running && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] animate-pulse">RUNNING</Badge>}
          </div>
          {advPanelOpen ? <ChevronDown className="w-4 h-4 text-yellow-400" /> : <ChevronRight className="w-4 h-4 text-yellow-400" />}
        </button>
        {advPanelOpen && (
          <CardContent className="pt-0 pb-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
              {[
                "NONCE REUSE (r collision)",
                "CROSS-ADDRESS r COLLISION",
                "RELATED NONCE (k₂=k₁+Δ)",
                "WEAK-k BRUTE FORCE (k≤500k)",
                "LLL LATTICE ATTACK",
                "BIAS / POLYNONCE",
                "MALLEABILITY PAIRS",
                "EXACT DUPLICATE SIGS",
              ].map(v => (
                <div key={v} className="flex items-center gap-1.5 bg-yellow-500/10 rounded px-2 py-1.5 border border-yellow-500/20">
                  <Zap className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                  <span className="text-yellow-300/80 truncate">{v}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground font-mono">Address limit:</label>
                <Input
                  value={advLimit}
                  onChange={e => setAdvLimit(e.target.value)}
                  className="w-24 h-8 text-xs font-mono"
                  placeholder="500"
                />
              </div>
              <Button
                onClick={startAdvScan}
                disabled={advPolling || advState?.running}
                size="sm"
                className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/30 gap-2"
              >
                {advState?.running ? <><RefreshCw className="w-3 h-3 animate-spin" /> Running…</> : <><Cpu className="w-3 h-3" /> Start Full Attack Scan</>}
              </Button>
              {advState && (
                <Button onClick={pollAdvStatus} variant="ghost" size="sm" className="text-muted-foreground gap-1">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </Button>
              )}
            </div>

            {advState && (
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                  <span>Status: <span className={advState.running ? "text-yellow-400" : "text-green-400"}>{advState.running ? "RUNNING" : "IDLE"}</span></span>
                  {advState.startedAt && <span>Started: {new Date(advState.startedAt).toLocaleTimeString()}</span>}
                  {advState.reports.length > 0 && <span className="text-primary">{advState.reports.length} report{advState.reports.length > 1 ? "s" : ""} saved</span>}
                </div>

                {advState.log.length > 0 && (
                  <div className="bg-black/40 rounded border border-border/30 p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-0.5">
                    {advState.log.map((line, i) => (
                      <div key={i} className={line.includes("ERROR") ? "text-red-400" : line.includes("Complete") ? "text-green-400" : "text-muted-foreground"}>
                        {line}
                      </div>
                    ))}
                  </div>
                )}

                {advState.reports.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-mono text-muted-foreground">Saved reports:</p>
                    {advState.reports.slice(0, 5).map(r => {
                      const fn = r.split("/").pop();
                      return (
                        <button key={r} onClick={() => loadAdvReport(r)}
                          className="text-xs font-mono text-primary hover:text-primary/80 underline block truncate max-w-full">{fn}</button>
                      );
                    })}
                  </div>
                )}

                {advReport && (
                  <div className="bg-primary/5 border border-primary/20 rounded p-3 space-y-2">
                    <p className="text-xs font-mono font-bold text-primary flex items-center gap-1.5"><BarChart3 className="w-3 h-3" /> Report Summary</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                      {[
                        ["Addresses", String(advReport.addressesScanned ?? 0)],
                        ["Signatures", String(advReport.totalSignatures ?? 0)],
                        ["Findings", String(advReport.totalFindings ?? 0)],
                        ["Keys Recovered", String(advReport.verifiedKeyCount ?? (advReport as Record<string,unknown[]>).recoveredKeys?.length ?? 0)],
                      ].map(([label, val]) => (
                        <div key={label} className="bg-black/30 rounded p-2 border border-border/30">
                          <p className="text-muted-foreground text-[10px]">{label}</p>
                          <p className={label === "Keys Recovered" && parseInt(val) > 0 ? "text-red-400 font-bold text-lg" : "text-foreground font-bold"}>{val}</p>
                        </div>
                      ))}
                    </div>
                    {(advReport.recoveredKeys as string[] | undefined)?.length ? (
                      <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                        <p className="text-red-400 font-mono font-bold text-xs mb-1">⚠️ PRIVATE KEYS RECOVERED:</p>
                        {(advReport.recoveredKeys as string[]).map(k => (
                          <div key={k} className="flex items-center gap-2">
                            <code className="text-red-300 text-xs font-mono break-all">{k}</code>
                            <button onClick={() => copy(k)} className="text-muted-foreground hover:text-primary">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {!!advReport.findingsByType && (
                      <div className="space-y-0.5">
                        {Object.entries(advReport.findingsByType as Record<string, number>).map(([t, c]) => (
                          <div key={t} className="flex justify-between text-xs font-mono text-muted-foreground">
                            <span>{t}</span><span className="text-primary">{String(c)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* How it works */}
      <Card className="border-primary/20 bg-primary/5">
        <button onClick={() => toggle("info")} className="w-full flex items-center justify-between p-4 hover:bg-white/5 text-left">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <span className="text-sm font-mono text-primary font-bold">How This Attack Works</span>
          </div>
          {expanded["info"] ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-primary" />}
        </button>
        {expanded["info"] && (
          <div className="px-4 pb-4 space-y-3 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { step: "1", title: "Every secp256k1 signature needs a unique k", body: "r = (k·G).x mod n. The r-value is computed directly from k. Same k in two signatures → identical r values." },
                { step: "2", title: "Matching r proves the same nonce was used", body: "Group all signatures by r. Any r that appears more than once proves nonce reuse — pattern matching only, no brute force." },
                { step: "3", title: "Algebra recovers the private key", body: "k=(z1−z2)·(s1−s2)⁻¹ mod n, then d=(s1·k−z1)·r⁻¹ mod n. Milliseconds of computation." },
              ].map(({ step, title, body }) => (
                <div key={step} className="bg-black/30 rounded p-3">
                  <div className="text-primary font-bold font-mono text-xs mb-1">STEP {step}</div>
                  <p className="font-bold text-xs mb-1">{title}</p>
                  <p className="text-xs text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3 text-xs text-muted-foreground">
              <span className="text-orange-400 font-bold font-mono">REAL PRECEDENT — </span>
              <strong className="text-foreground">Sony PS3 (2010)</strong>: fixed k exposed Sony's private signing key. &nbsp;
              <strong className="text-foreground">Android Bitcoin wallets (2013)</strong>: SecureRandom flaw caused k reuse, 1000+ BTC swept. Applies to every secp256k1 chain: Bitcoin, Ethereum, all EVM networks.
            </div>
          </div>
        )}
      </Card>

      {/* Chain selector */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" /> Select Blockchain
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Scannable chains */}
          <div>
            <p className="text-xs font-mono text-green-400 mb-2 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> SCANNABLE — secp256k1 ECDSA (nonce reuse attack applies)
            </p>
            <div className="flex flex-wrap gap-2">
              {scannableChains.map(c => (
                <button
                  key={c.chain}
                  onClick={() => { setSelectedChain(c.chain); setScanResult(null); setNotScannableInfo(null); setError(null); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold border transition-all ${selectedChain === c.chain
                    ? "bg-primary text-black border-primary"
                    : "border-primary/30 text-primary hover:bg-primary/10"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Non-scannable chains */}
          <div>
            <p className="text-xs font-mono text-muted-foreground mb-2 flex items-center gap-1">
              <Lock className="w-3 h-3" /> NOT VULNERABLE — different signature scheme (select to see why)
            </p>
            <div className="flex flex-wrap gap-2">
              {nonScannableChains.map(c => (
                <button
                  key={c.chain}
                  onClick={() => { setSelectedChain(c.chain); setScanResult(null); setNotScannableInfo(null); setError(null); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono border transition-all ${selectedChain === c.chain
                    ? "bg-muted border-border text-foreground"
                    : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Info box for selected chain */}
          {currentChainInfo && (
            <div className={`rounded p-3 border text-xs ${currentChainInfo.canScan ? "bg-green-500/5 border-green-500/30" : "bg-muted/30 border-border/50"}`}>
              <div className="flex items-center gap-2 mb-1">
                <Badge className={`text-[10px] font-mono ${currentChainInfo.canScan ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-muted text-muted-foreground"}`}>
                  {SCHEME_LABELS[currentChainInfo.sigScheme]}
                </Badge>
                <Badge className={`text-[10px] font-mono ${currentChainInfo.nonceReuseVulnerable ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}`}>
                  {currentChainInfo.nonceReuseVulnerable ? "NONCE REUSE POSSIBLE" : "IMMUNE BY DESIGN"}
                </Badge>
              </div>
              <p className="text-muted-foreground">{currentChainInfo.note}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan input */}
      {currentChainInfo?.canScan && (
        <Card className="border-primary/30 bg-card/80">
          <CardContent className="p-6 space-y-3">
            <label className="text-xs font-mono text-muted-foreground">{(currentChainInfo?.name ?? "WALLET").toUpperCase()} ADDRESS TO SCAN</label>
            <div className="flex gap-3">
              <Input
                placeholder={CHAIN_PLACEHOLDER[selectedChain] ?? "wallet address"}
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
                {scanning ? <><RefreshCw className="w-4 h-4 animate-spin" /> Scanning…</> : <><Search className="w-4 h-4" /> Scan</>}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Scans up to {["bitcoin","litecoin","dogecoin","bitcoincash"].includes(selectedChain) ? "30" : "50"} transactions · extracts (r, s, z) from each · groups by r to detect k reuse
            </p>
          </CardContent>
        </Card>
      )}

      {/* Not scannable explainer shown in place of input */}
      {currentChainInfo && !currentChainInfo.canScan && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-blue-400 font-mono">{currentChainInfo.name} is not vulnerable to nonce reuse attacks</p>
              <p className="text-sm text-muted-foreground mt-2">{currentChainInfo.note}</p>
              <div className="mt-3 bg-black/30 rounded p-3 text-xs font-mono space-y-1">
                <p className="text-muted-foreground">Signature scheme: <span className="text-foreground">{SCHEME_LABELS[currentChainInfo.sigScheme]}</span></p>
                {currentChainInfo.sigScheme === "ed25519" && (
                  <p className="text-muted-foreground">
                    Ed25519 computes the nonce as: <code className="text-blue-400">k = H(b || M)</code> where b is derived from the private key and M is the message.
                    The same message always gets the same nonce, different messages always get different nonces — making the Sony/Android attack impossible.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Results */}
      {scanResult && (
        <>
          {/* Summary */}
          <div className={`p-5 rounded-xl border-2 ${scanResult.hasVulnerability ? "border-red-500 bg-red-500/10 text-red-400" : "border-green-500 bg-green-500/10 text-green-400"}`}>
            <div className="flex items-center gap-3 mb-3">
              {scanResult.hasVulnerability ? <AlertTriangle className="w-7 h-7" /> : <CheckCircle className="w-7 h-7" />}
              <div>
                <p className="font-bold font-mono text-xl">
                  {scanResult.hasVulnerability
                    ? `⚠ NONCE REUSE DETECTED — ${scanResult.nonceReusePairs.length} vulnerable pair(s)`
                    : "✓ No Nonce Reuse Detected"}
                </p>
                <p className="text-sm opacity-80">{scanResult.signaturesExtracted} signatures · {scanResult.totalTransactions} transactions · {currentChainInfo?.name}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Transactions", value: scanResult.totalTransactions },
                { label: "Signatures", value: scanResult.signaturesExtracted },
                { label: "Vuln Pairs", value: scanResult.nonceReusePairs.length },
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
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono">PAIR {i + 1}</Badge>
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono text-xs">
                            {pair.riskLevel === "confirmed_reuse" ? "CONFIRMED NONCE REUSE" : "SAME K DETECTED"}
                          </Badge>
                        </div>
                        {!recovery && (
                          <Button onClick={() => runRecovery(pair, pairKey)} disabled={isRecovering}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2 text-sm">
                            {isRecovering ? <><RefreshCw className="w-3 h-3 animate-spin" /> Running…</> : <><Zap className="w-3 h-3" /> Run Private Key Recovery</>}
                          </Button>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Shared r */}
                      <div className="bg-black/40 rounded p-3">
                        <p className="text-xs font-mono text-red-400 mb-1">SHARED R VALUE (proves same nonce k)</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-orange-300 flex-1 break-all">{pair.sharedR}</code>
                          <button onClick={() => copy(pair.sharedR)}><Copy className="w-3 h-3 text-muted-foreground hover:text-primary" /></button>
                        </div>
                      </div>
                      {/* TX pair */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[{ tx: pair.tx1, label: "TX 1" }, { tx: pair.tx2, label: "TX 2" }].map(({ tx, label }) => (
                          <div key={label} className="bg-black/30 rounded p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono font-bold">{label}</span>
                              <a href={`${explorerBase}${tx.txHash}`} target="_blank" rel="noopener noreferrer"
                                className="text-xs font-mono text-primary hover:underline">View ↗</a>
                            </div>
                            <div className="space-y-1 text-xs font-mono">
                              <div className="flex justify-between"><span className="text-muted-foreground">Block:</span><span>{tx.blockNumber}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Value:</span><span className="text-primary">{tx.value}</span></div>
                              <div><span className="text-muted-foreground">s: </span><span className="text-yellow-400">{truncate(tx.s, 14)}</span></div>
                              <div><span className="text-muted-foreground">z: </span><span className="text-blue-400">{truncate(tx.z, 14)}</span></div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-center gap-3 text-xs font-mono text-muted-foreground">
                        <span className="text-yellow-400">s1, z1</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="text-red-400 font-bold">k = (z1−z2)·(s1−s2)⁻¹ mod n</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="text-green-400">private key d</span>
                      </div>
                      {/* Recovery result */}
                      {recovery && (
                        <div className={`rounded-lg border-2 p-4 space-y-3 ${recovery.success && recovery.addressMatches ? "border-red-500 bg-red-500/10" : recovery.success ? "border-orange-500 bg-orange-500/10" : "border-muted bg-muted/20"}`}>
                          <div className="flex items-center gap-2">
                            {recovery.success ? <AlertTriangle className="w-5 h-5 text-red-400" /> : <CheckCircle className="w-5 h-5 text-green-400" />}
                            <span className="font-bold font-mono text-sm">
                              {recovery.success && recovery.addressMatches ? "PRIVATE KEY RECOVERED — ADDRESS CONFIRMED"
                                : recovery.success ? "Key computed (verify address below)"
                                : "Recovery: " + recovery.error}
                            </span>
                          </div>
                          {recovery.success && (
                            <>
                              <div className="bg-black/40 rounded p-3 space-y-1.5">
                                <p className="text-xs font-mono text-primary mb-2">MATH STEPS</p>
                                {[
                                  { label: "(z1−z2) mod n", val: recovery.math.step1_numerator },
                                  { label: "(s1−s2) mod n", val: recovery.math.step1_denominator },
                                  { label: "k (nonce)", val: recovery.math.step2_k },
                                ].map(({ label, val }) => (
                                  <div key={label} className="flex items-start gap-2 text-xs font-mono">
                                    <span className="text-muted-foreground w-32 flex-shrink-0">{label}:</span>
                                    <code className="text-yellow-400 break-all flex-1">{truncate(val, 14)}</code>
                                    <button onClick={() => copy(val)}><Copy className="w-2.5 h-2.5 text-muted-foreground hover:text-primary" /></button>
                                  </div>
                                ))}
                              </div>
                              <div className="bg-black/60 border border-red-500/40 rounded p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-mono text-red-400 font-bold">RECOVERED PRIVATE KEY</p>
                                  <button onClick={() => setShowPrivKey(p => ({ ...p, [pairKey]: !p[pairKey] }))}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
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
                                    <span className="text-xs text-red-400/60 font-mono">{"█".repeat(64)}</span>
                                  </div>
                                )}
                                <div className="text-xs font-mono space-y-1">
                                  <div><span className="text-muted-foreground">Derived Address: </span>
                                    <code className={recovery.addressMatches ? "text-red-400" : "text-orange-400"}>{recovery.derivedAddress}</code>
                                    <span className="ml-2">{recovery.addressMatches ? "✓ MATCHES" : "⚠ different"}</span>
                                  </div>
                                </div>
                              </div>
                              <p className="text-xs font-mono text-muted-foreground">{recovery.math.verification}</p>
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

          {/* All signatures */}
          {scanResult.allSignatures.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <button onClick={() => setShowAllSigs(p => !p)} className="flex items-center justify-between w-full text-left">
                  <CardTitle className="font-mono text-sm flex items-center gap-2">
                    <Key className="w-4 h-4 text-primary" /> All Extracted Signatures ({scanResult.allSignatures.length})
                  </CardTitle>
                  {showAllSigs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </CardHeader>
              {showAllSigs && (
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground">
                          <th className="py-2 pr-3 text-left">Block</th>
                          <th className="py-2 pr-3 text-left">Value</th>
                          <th className="py-2 pr-3 text-left">r (first 18 chars)</th>
                          <th className="py-2 pr-3 text-left">s</th>
                          <th className="py-2 text-left">z / txhash</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scanResult.allSignatures.map((sig, i) => {
                          const isVuln = scanResult.nonceReusePairs.some(p => p.tx1.txHash === sig.txHash || p.tx2.txHash === sig.txHash);
                          return (
                            <tr key={i} className={`border-b border-border/20 ${isVuln ? "bg-red-500/10" : ""}`}>
                              <td className="py-1.5 pr-3">{sig.blockNumber}</td>
                              <td className="py-1.5 pr-3 text-primary">{sig.value}</td>
                              <td className="py-1.5 pr-3">
                                <code className={isVuln ? "text-red-400 font-bold" : "text-yellow-400"}>{sig.r.slice(0, 20)}…</code>
                                {isVuln && <Badge className="ml-1 bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">REUSE</Badge>}
                              </td>
                              <td className="py-1.5 pr-3"><code className="text-muted-foreground">{sig.s.slice(0, 14)}…</code></td>
                              <td className="py-1.5">
                                <a href={`${explorerBase}${sig.txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                  {sig.z.slice(0, 12)}… ↗
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

          {/* Clean result */}
          {!scanResult.hasVulnerability && scanResult.signaturesExtracted > 0 && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="p-5 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-green-400 font-mono">Nonce generation appears sound on {currentChainInfo?.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    All {scanResult.signaturesExtracted} signatures have unique r values — no k reuse detected.
                    This wallet's signing implementation used a unique random nonce for each transaction.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Only the most recent {scanResult.signaturesExtracted} transactions were analyzed.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
