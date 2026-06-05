// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Bitcoin, Globe, Zap, AlertTriangle, CheckCircle, ShieldAlert,
  Download, Copy, ChevronDown, ChevronRight, Key, Link as LinkIcon,
  Database, Lock
} from "lucide-react";

const SEV: Record<string, string> = {
  critical: "text-red-400 border-red-500/50 bg-red-500/10",
  high: "text-orange-400 border-orange-500/50 bg-orange-500/10",
  medium: "text-yellow-400 border-yellow-500/50 bg-yellow-500/10",
  low: "text-blue-400 border-blue-500/50 bg-blue-500/10",
};

const RISK_COLOR: Record<string, string> = {
  critical: "text-red-400", high: "text-orange-400",
  medium: "text-yellow-400", low: "text-green-400",
};

const CHAINS = [
  { value: "bitcoin", label: "Bitcoin (BTC)", icon: "₿", needsAddress: true },
  { value: "ethereum", label: "Ethereum (ETH)", icon: "Ξ", needsAddress: true },
  { value: "solana", label: "Solana (SOL)", icon: "◎", needsAddress: true },
  { value: "monero", label: "Monero (XMR) — Network Scan", icon: "ɱ", needsAddress: false },
  { value: "polygon", label: "Polygon (MATIC)", icon: "⬡", needsAddress: true },
  { value: "bsc", label: "BNB Chain (BSC)", icon: "⬡", needsAddress: true },
  { value: "arbitrum", label: "Arbitrum (ARB)", icon: "⬡", needsAddress: true },
  { value: "avalanche", label: "Avalanche (AVAX)", icon: "⬡", needsAddress: true },
];

const SAMPLE_ADDRESSES: Record<string, string> = {
  bitcoin: "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf Na",   // Genesis block (P2PK)
  ethereum: "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe",  // Ethereum Foundation
  solana: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",   // Serum DEX
  polygon: "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe",
};

function generateReport(chain: string, address: string | undefined, result: Record<string, unknown>): string {
  const now = new Date().toLocaleString();
  const data = result.data as Record<string, unknown> ?? result;

  let body = "";

  if (chain === "bitcoin" && data) {
    const keys = (data.publicKeys as string[]) ?? [];
    const findings = (data.exposedKeyFindings as Record<string, unknown>[]) ?? [];
    body = `
  CHAIN:            Bitcoin (BTC)
  ADDRESS:          ${address}
  BALANCE:          ${data.balanceBTC} BTC (${data.balanceSats} sats)
  TRANSACTION COUNT:  ${data.txCount}
  UTXO COUNT:       ${data.utxoCount}
  SCRIPT TYPE:      ${data.scriptType}
  ADDRESS REUSE:    ${data.hasReusedAddress ? "YES — PUBLIC KEY EXPOSED" : "No"}
  P2PK OUTPUT:      ${data.isP2PK ? "YES — RAW PUBLIC KEY ON-CHAIN" : "No"}

  QUANTUM RISK:     ${String(data.quantumRiskLevel ?? "").toUpperCase()}
  RISK REASON:      ${data.quantumRiskReason}

  ────────────────────────────────────────────────────────
  EXPOSED PUBLIC KEYS (${keys.length} found)
  ────────────────────────────────────────────────────────
${keys.map((k, i) => `  [${i + 1}] ${k}`).join("\n") || "  None detected"}

  ────────────────────────────────────────────────────────
  KEY EXPOSURE FINDINGS (${findings.length})
  ────────────────────────────────────────────────────────
${findings.map((f: Record<string, unknown>, i: number) => `
  [${i + 1}] TYPE: ${f.type}
       PUBKEY: ${f.pubkey}
       TXID:   ${f.txid}
       VALUE:  ${Number(f.valueSats ?? 0) / 1e8} BTC
       RISK:   ${f.quantumRisk}
       DESC:   ${f.description}
`).join("")}`;

  } else if (chain === "monero" && data) {
    const findings = (data.quantumFindings as Record<string, unknown>[]) ?? [];
    const prims = (data.networkSecurity as Record<string, unknown>)?.cryptoPrimitives as Record<string, unknown>[] ?? [];
    body = `
  CHAIN:            Monero (XMR)
  NODE URL:         ${data.nodeUrl}
  NODE REACHABLE:   ${data.nodeReachable ? "YES" : "NO (used public node fallback)"}
  DAEMON VERSION:   ${data.daemonVersion ?? "N/A"}
  NETWORK:          ${data.networkType ?? "N/A"}
  BLOCK HEIGHT:     ${data.height ?? "N/A"}
  DIFFICULTY:       ${data.difficulty ?? "N/A"}
  ESTIMATED HASHRATE: ${data.hashrate ?? "N/A"}
  TX POOL SIZE:     ${data.txPoolSize ?? "N/A"}
  CONNECTIONS:      ${data.connections ?? "N/A"}
  RING SIZE:        ${data.currentRingSize}
  CLSAG:            ${data.clsagEnabled ? "Enabled" : "Disabled"}
  BULLETPROOFS+:    ${data.bulletpoolsPlus ? "Enabled" : "Disabled"}

  OVERALL QUANTUM RISK: CRITICAL
  MITIGATION STATUS: ${(data.networkSecurity as Record<string, unknown>)?.mitigationStatus}

  ────────────────────────────────────────────────────────
  QUANTUM VULNERABILITY FINDINGS (${findings.length})
  ────────────────────────────────────────────────────────
${findings.map((f: Record<string, unknown>, i: number) => `
  [${i + 1}] ${String(f.severity ?? "").toUpperCase()} — ${f.title}
       ALGORITHM:  ${f.algorithm === "shors" ? "Shor's Algorithm" : "Grover's Algorithm"}
       BREAK YEAR: ${f.estimatedBreakYear}
       AFFECTS:    ${f.affectedAddresses}
       DESCRIPTION: ${f.description}
       RECOMMENDATION: ${f.recommendation}
`).join("")}

  ────────────────────────────────────────────────────────
  CRYPTOGRAPHIC PRIMITIVES ASSESSMENT
  ────────────────────────────────────────────────────────
${prims.map((p: Record<string, unknown>) => `
  ${p.name} — ${p.purpose}
    Quantum Vulnerable: ${p.quantumVulnerable ? "YES" : "No"}
    Break Algorithm:    ${p.breakAlgorithm}
    Break Year Est.:    ${p.estimatedBreakYear}
    Replacement:        ${p.replacement}
`).join("")}`;

  } else if ((chain === "ethereum" || chain === "polygon" || chain === "bsc" || chain === "arbitrum" || chain === "avalanche") && data) {
    const findings = (data.contractFindings as Record<string, unknown>[]) ?? [];
    const keys = (data.exposedPublicKeys as string[]) ?? [];
    body = `
  CHAIN:            ${chain.toUpperCase()}
  ADDRESS:          ${address}
  TYPE:             ${data.isContract ? "Smart Contract" : "EOA (Wallet)"}
  BALANCE:          ${data.balanceETH} ETH
  TX COUNT:         ${data.txCount}
  BYTECODE SIZE:    ${data.bytecodeSize} bytes
  SOURCE VERIFIED:  ${data.isVerified ? "YES" : "NO"}
  COMPILER:         ${data.compilerVersion ?? "N/A"}
  IS PROXY:         ${data.isProxy ? `YES → ${data.implementationAddress}` : "No"}
  IS UPGRADEABLE:   ${data.isUpgradeable ? "YES — CENTRALIZATION RISK" : "No"}

  QUANTUM RISK:     ${String(data.quantumRiskLevel ?? "").toUpperCase()}
  RISK REASON:      ${data.quantumRiskReason}

  ────────────────────────────────────────────────────────
  RECOVERED PUBLIC KEYS FROM ECDSA SIGNATURES (${keys.length})
  ────────────────────────────────────────────────────────
${keys.map((k: string, i: number) => `  [${i + 1}] ${k}`).join("\n") || "  None recovered from recent transactions"}

  ────────────────────────────────────────────────────────
  CONTRACT SECURITY FINDINGS (${findings.length})
  ────────────────────────────────────────────────────────
${findings.map((f: Record<string, unknown>, i: number) => `
  [${i + 1}] ${String(f.severity ?? "").toUpperCase()} — ${f.type}
       ${f.description}
       EVIDENCE: ${f.evidence}
       ${f.quantumContext ? "QUANTUM: " + f.quantumContext : ""}
`).join("")}`;

  } else if (chain === "solana" && data) {
    const findings = (data.findings as Record<string, unknown>[]) ?? [];
    body = `
  CHAIN:            Solana (SOL)
  ADDRESS:          ${address}
  TYPE:             ${data.isProgram ? "Program" : "Wallet Account"}
  BALANCE:          ${data.balanceSOL} SOL
  OWNER:            ${data.owner}
  EXECUTABLE:       ${data.executable}
  DATA SIZE:        ${data.dataSize} bytes
  UPGRADEABLE:      ${data.isUpgradeable ? `YES — Authority: ${data.upgradeAuthority}` : "No"}
  FROZEN:           ${data.isFrozen ? "YES (immutable)" : "No"}
  PROGRAM DATA:     ${data.programDataAccount ?? "N/A"}

  QUANTUM RISK:     ${String(data.quantumRiskLevel ?? "").toUpperCase()}
  RISK REASON:      ${data.quantumRiskReason}

  ────────────────────────────────────────────────────────
  SECURITY FINDINGS (${findings.length})
  ────────────────────────────────────────────────────────
${findings.map((f: Record<string, unknown>, i: number) => `
  [${i + 1}] ${String(f.severity ?? "").toUpperCase()} — ${f.type}
       ${f.description}
       EVIDENCE: ${f.evidence}
       ${f.quantumContext ? "QUANTUM: " + f.quantumContext : ""}
`).join("")}`;
  }

  return `
================================================================================
  QUANTUMAUDIT — LIVE BLOCKCHAIN SCAN REPORT
  Prepared by: ALPHA UNLIMITED TECHNOLOGIES LLC
================================================================================

  Scan Date:  ${now}
  Chain:      ${chain.toUpperCase()}
  Target:     ${address ?? "Network-level scan"}
${body}

================================================================================
  DISCLOSURE NOTE
================================================================================

  This report was generated by QuantumAudit for responsible security research
  and bug bounty disclosure purposes. All data was obtained from publicly
  available blockchain data (on-chain records, public RPC endpoints).

  No private keys were accessed or derived. Public key extraction is performed
  using standard ECDSA signature recovery from publicly broadcast transactions.

  ALPHA UNLIMITED TECHNOLOGIES LLC
  alphaunlimitedtechnologies@gmail.com
================================================================================
`;
}

export default function LiveScan() {
  const [chain, setChain] = useState("bitcoin");
  const [address, setAddress] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const selectedChain = CHAINS.find(c => c.value === chain);
  const needsAddress = selectedChain?.needsAddress ?? true;

  const runScan = async () => {
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/api/quantum-audit/live-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain, address: needsAddress ? address : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? json.error ?? "Scan failed");
      setResult(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    const text = generateReport(chain, needsAddress ? address : undefined, result);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blockchain-scan-${chain}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyKey = (key: string) => navigator.clipboard?.writeText(key);
  const toggle = (k: string) => setExpanded(p => ({ ...p, [k]: !p[k] }));

  const data = result?.data as Record<string, unknown> ?? null;

  // Determine what to render based on chain
  const riskLevel = data?.quantumRiskLevel as string
    ?? (data?.networkSecurity as Record<string, unknown>)?.overallRisk as string
    ?? "unknown";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-mono">Live Blockchain Scanner</h1>
            <p className="text-sm text-muted-foreground">Real on-chain quantum vulnerability analysis — Bitcoin · Ethereum · Solana · Monero</p>
          </div>
        </div>
        {result && (
          <Button onClick={downloadReport} variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
            <Download className="w-4 h-4" /> Download Full Report
          </Button>
        )}
      </div>

      {/* Scan form */}
      <Card className="border-primary/30 bg-card/80">
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-mono text-muted-foreground">BLOCKCHAIN</label>
              <Select value={chain} onValueChange={v => { setChain(v); setAddress(""); setResult(null); }}>
                <SelectTrigger className="font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHAINS.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="font-mono">{c.icon} {c.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsAddress && (
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-mono text-muted-foreground">
                  ADDRESS / CONTRACT
                  {SAMPLE_ADDRESSES[chain] && (
                    <button
                      onClick={() => setAddress(SAMPLE_ADDRESSES[chain])}
                      className="ml-2 text-primary hover:underline"
                    >(use sample)</button>
                  )}
                </label>
                <Input
                  placeholder={
                    chain === "bitcoin" ? "1... or bc1... address" :
                    chain === "solana" ? "Base58 address or program ID" :
                    "0x... address or contract"
                  }
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            )}

            {!needsAddress && (
              <div className="md:col-span-2 flex items-end">
                <div className="w-full p-3 rounded border border-border/50 bg-accent/20 text-sm text-muted-foreground font-mono">
                  ɱ Monero network scan — connects to your monerod node at{" "}
                  <span className="text-primary">{import.meta.env.VITE_MONERO_RPC_URL ?? "127.0.0.1:18081"}</span>{" "}
                  or public fallback nodes
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={runScan}
            disabled={scanning || (needsAddress && !address.trim())}
            className="bg-primary text-black hover:bg-primary/90 font-bold gap-2"
          >
            {scanning ? <><Zap className="w-4 h-4 animate-pulse" /> Scanning Blockchain…</> : <><Zap className="w-4 h-4" /> Run Live Scan</>}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-destructive">Scan Error</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              {error.includes("node") || error.includes("MONERO") ? (
                <p className="text-xs text-muted-foreground mt-2">
                  For Monero: ensure monerod is running and set MONERO_RPC_URL in your environment, or a public fallback node will be used.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {data && (
        <>
          {/* Risk banner */}
          <div className={`p-4 rounded-lg border-2 ${SEV[riskLevel] ?? "border-border"}`}>
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 flex-shrink-0" />
              <div>
                <p className="font-bold font-mono text-lg">QUANTUM RISK: {riskLevel.toUpperCase()}</p>
                <p className="text-sm mt-0.5">
                  {data.quantumRiskReason as string
                    ?? (data.networkSecurity as Record<string, unknown>)?.mitigationStatus as string
                    ?? ""}
                </p>
              </div>
            </div>
          </div>

          {/* Bitcoin results */}
          {chain === "bitcoin" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Balance", value: `${data.balanceBTC} BTC` },
                  { label: "Transactions", value: String(data.txCount) },
                  { label: "UTXOs", value: String(data.utxoCount) },
                  { label: "Script Type", value: String(data.scriptType) },
                ].map(({ label, value }) => (
                  <Card key={label} className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground font-mono">{label}</p>
                      <p className="font-bold text-sm mt-1 font-mono truncate">{value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Exposed public keys */}
              {(data.publicKeys as string[] ?? []).length > 0 && (
                <Card className="border-red-500/30 bg-red-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-red-400 font-mono text-sm">
                      <Key className="w-4 h-4" />
                      Exposed Public Keys ({(data.publicKeys as string[]).length}) — Quantum Vulnerable
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(data.publicKeys as string[]).map((k, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-black/40 rounded border border-red-500/20">
                        <span className="text-red-400 font-mono text-xs font-bold">[{i + 1}]</span>
                        <code className="text-xs font-mono text-orange-300 flex-1 truncate">{k}</code>
                        <button onClick={() => copyKey(k)} className="text-muted-foreground hover:text-primary flex-shrink-0">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-red-400/70 font-mono mt-2">
                      ⚠ These secp256k1 public keys are permanently on-chain. Shor's Algorithm (est. 2030–2035) can derive the private key from any of them.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Key findings */}
              {(data.exposedKeyFindings as Record<string, unknown>[] ?? []).map((f, i) => (
                <div key={i} className={`border rounded-lg overflow-hidden ${SEV[f.severity as string] ?? ""}`}>
                  <button onClick={() => toggle(`btc-f-${i}`)} className="w-full flex items-center justify-between p-3 hover:bg-white/5 text-left">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs font-mono ${SEV[f.type === "p2pk_pubkey" ? "critical" : "high"]}`}>
                        {String(f.type).replace(/_/g, " ").toUpperCase()}
                      </Badge>
                      <span className="text-sm font-mono">{String(f.description)}</span>
                    </div>
                    {expanded[`btc-f-${i}`] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {expanded[`btc-f-${i}`] && (
                    <div className="p-3 border-t border-current/20 bg-background/50 space-y-2">
                      <div className="bg-black/40 rounded p-2">
                        <p className="text-xs font-mono text-muted-foreground mb-1">PUBLIC KEY</p>
                        <code className="text-xs font-mono text-orange-300 break-all">{f.pubkey as string}</code>
                      </div>
                      <div className="bg-black/40 rounded p-2">
                        <p className="text-xs font-mono text-muted-foreground mb-1">TXID</p>
                        <a href={`https://mempool.space/tx/${f.txid}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-mono text-primary hover:underline flex items-center gap-1">
                          {String(f.txid).slice(0, 32)}… <LinkIcon className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="bg-red-500/5 border border-red-500/20 rounded p-2">
                        <p className="text-xs font-mono text-red-400 mb-1">QUANTUM RISK</p>
                        <p className="text-xs text-muted-foreground">{f.quantumRisk as string}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* UTXOs */}
              {(data.utxos as Record<string, unknown>[] ?? []).length > 0 && (
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-mono text-sm flex items-center gap-2">
                      <Database className="w-4 h-4 text-primary" />
                      UTXOs ({(data.utxos as unknown[]).length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(data.utxos as Record<string, unknown>[]).map((u, i) => (
                        <div key={i} className={`flex items-center gap-3 p-2 rounded border text-xs font-mono ${u.isP2PK ? "border-red-500/30 bg-red-500/5" : "border-border/30 bg-card/30"}`}>
                          {u.isP2PK ? <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" /> : <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />}
                          <span className="text-muted-foreground truncate flex-1">{String(u.txid).slice(0, 20)}…</span>
                          <span className="text-primary">{String(u.valueBTC)} BTC</span>
                          <span className="text-muted-foreground">{String(u.scriptType)}</span>
                          {!!u.isP2PK && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">P2PK</Badge>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Monero results */}
          {chain === "monero" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Node", value: data.nodeReachable ? "Connected" : "Public Fallback" },
                  { label: "Block Height", value: String(data.height ?? "N/A") },
                  { label: "Hashrate", value: String(data.hashrate ?? "N/A") },
                  { label: "Ring Size", value: String(data.currentRingSize) },
                ].map(({ label, value }) => (
                  <Card key={label} className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground font-mono">{label}</p>
                      <p className="font-bold text-sm mt-1 font-mono">{value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-border/50">
                <CardContent className="p-4 text-xs font-mono space-y-1 text-muted-foreground">
                  <div className="grid grid-cols-2 gap-2">
                    <div>Node: <span className="text-foreground">{String(data.nodeUrl)}</span></div>
                    <div>Daemon: <span className="text-foreground">{String(data.daemonVersion ?? "N/A")}</span></div>
                    <div>Network: <span className="text-foreground">{String(data.networkType ?? "N/A")}</span></div>
                    <div>TX Pool: <span className="text-foreground">{String(data.txPoolSize ?? "N/A")} txs</span></div>
                    <div>Connections: <span className="text-foreground">{String(data.connections ?? "N/A")}</span></div>
                    <div>CLSAG: <span className="text-green-400">Active</span></div>
                    <div>Bulletproofs+: <span className="text-green-400">Active</span></div>
                    <div>RingCT: <span className="text-green-400">Active</span></div>
                  </div>
                </CardContent>
              </Card>

              {/* Quantum findings */}
              {(data.quantumFindings as Record<string, unknown>[] ?? []).map((f, i) => (
                <div key={i} className={`border rounded-lg overflow-hidden ${SEV[f.severity as string] ?? ""}`}>
                  <button onClick={() => toggle(`xmr-${i}`)} className="w-full flex items-center justify-between p-3 hover:bg-white/5 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-xs font-mono ${SEV[f.severity as string]}`}>{String(f.severity).toUpperCase()}</Badge>
                      <span className="text-sm font-bold">{f.title as string}</span>
                    </div>
                    {expanded[`xmr-${i}`] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {expanded[`xmr-${i}`] && (
                    <div className="p-4 border-t border-current/20 bg-background/50 space-y-3">
                      <p className="text-sm">{String(f.description)}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                        <div className="bg-black/40 rounded p-2">
                          <p className="text-muted-foreground mb-1">AFFECTS</p>
                          <p className="text-orange-300">{f.affectedAddresses as string}</p>
                        </div>
                        <div className="bg-black/40 rounded p-2">
                          <p className="text-muted-foreground mb-1">BREAK ALGORITHM / YEAR</p>
                          <p className="text-red-400">{f.algorithm === "shors" ? "Shor's Algorithm" : "Grover's Algorithm"} / {f.estimatedBreakYear as string}</p>
                        </div>
                      </div>
                      <div className="bg-primary/5 border border-primary/20 rounded p-3">
                        <p className="text-xs font-mono text-primary mb-1">RECOMMENDATION</p>
                        <p className="text-sm">{f.recommendation as string}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Crypto primitives table */}
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="font-mono text-sm flex items-center gap-2">
                    <Lock className="w-4 h-4 text-primary" /> Cryptographic Primitives Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground">
                          <th className="text-left py-2 pr-3">Primitive</th>
                          <th className="text-left py-2 pr-3">Purpose</th>
                          <th className="text-left py-2 pr-3">Quantum Risk</th>
                          <th className="text-left py-2 pr-3">Break Year</th>
                          <th className="text-left py-2">Replacement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {((data.networkSecurity as Record<string, unknown>)?.cryptoPrimitives as Record<string, unknown>[] ?? []).map((p, i) => (
                          <tr key={i} className="border-b border-border/20">
                            <td className="py-2 pr-3 text-foreground font-bold">{p.name as string}</td>
                            <td className="py-2 pr-3 text-muted-foreground">{p.purpose as string}</td>
                            <td className="py-2 pr-3">
                              <span className={p.quantumVulnerable ? "text-red-400" : "text-green-400"}>
                                {p.quantumVulnerable ? "VULNERABLE" : "Safe"}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-orange-400">{p.estimatedBreakYear as string}</td>
                            <td className="py-2 text-primary">{p.replacement as string}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Ethereum / EVM results */}
          {["ethereum", "polygon", "bsc", "arbitrum", "avalanche"].includes(chain) && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Type", value: data.isContract ? "Smart Contract" : "EOA Wallet" },
                  { label: "Balance", value: `${data.balanceETH} ETH` },
                  { label: "Transactions", value: String(data.txCount) },
                  { label: "Source", value: data.isVerified ? "✓ Verified" : "✗ Unverified" },
                ].map(({ label, value }) => (
                  <Card key={label} className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground font-mono">{label}</p>
                      <p className="font-bold text-sm mt-1 font-mono">{value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {(data.exposedPublicKeys as string[] ?? []).length > 0 && (
                <Card className="border-red-500/30 bg-red-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-red-400 font-mono text-sm flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Recovered Public Keys from ECDSA Signatures ({(data.exposedPublicKeys as string[]).length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(data.exposedPublicKeys as string[]).map((k, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-black/40 rounded border border-red-500/20">
                        <span className="text-red-400 font-mono text-xs">[{i + 1}]</span>
                        <code className="text-xs font-mono text-orange-300 flex-1 truncate">{k}</code>
                        <button onClick={() => copyKey(k)}><Copy className="w-3 h-3 text-muted-foreground hover:text-primary" /></button>
                      </div>
                    ))}
                    <p className="text-xs text-red-400/70 font-mono">
                      ⚠ Recovered from on-chain ECDSA signatures. Shor's Algorithm (est. 2030–2035) can derive the private key from secp256k1 public keys.
                    </p>
                  </CardContent>
                </Card>
              )}

              {(data.contractFindings as Record<string, unknown>[] ?? []).map((f, i) => (
                <div key={i} className={`border rounded-lg overflow-hidden ${SEV[f.severity as string] ?? ""}`}>
                  <button onClick={() => toggle(`eth-f-${i}`)} className="w-full flex items-center justify-between p-3 hover:bg-white/5 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-xs ${SEV[f.severity as string]}`}>{String(f.severity).toUpperCase()}</Badge>
                      <span className="text-sm font-mono">{String(f.type).replace(/_/g, " ").toUpperCase()}</span>
                    </div>
                    {expanded[`eth-f-${i}`] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {expanded[`eth-f-${i}`] && (
                    <div className="p-4 border-t border-current/20 bg-background/50 space-y-2">
                      <p className="text-sm">{String(f.description)}</p>
                      <div className="bg-black/40 rounded p-2 text-xs font-mono">
                        <p className="text-muted-foreground mb-1">EVIDENCE</p>
                        <p className="text-orange-300">{String(f.evidence)}</p>
                      </div>
                      {!!f.quantumContext && (
                        <div className="bg-red-500/5 border border-red-500/20 rounded p-2 text-xs">
                          <p className="text-red-400 font-mono mb-1">QUANTUM CONTEXT</p>
                          <p className="text-muted-foreground">{String(f.quantumContext)}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Solana results */}
          {chain === "solana" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Type", value: data.isProgram ? "Program" : "Account" },
                  { label: "Balance", value: `${data.balanceSOL} SOL` },
                  { label: "Data Size", value: `${data.dataSize} bytes` },
                  { label: "Upgradeable", value: data.isUpgradeable ? "YES ⚠" : data.isFrozen ? "Frozen ✓" : "Unknown" },
                ].map(({ label, value }) => (
                  <Card key={label} className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground font-mono">{label}</p>
                      <p className="font-bold text-sm mt-1 font-mono">{value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {!!data.upgradeAuthority && (
                <Card className="border-orange-500/30 bg-orange-500/5">
                  <CardContent className="p-4">
                    <p className="text-xs font-mono text-orange-400 mb-1">UPGRADE AUTHORITY KEY</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-orange-300 flex-1">{data.upgradeAuthority as string}</code>
                      <button onClick={() => copyKey(data.upgradeAuthority as string)}><Copy className="w-4 h-4 text-muted-foreground hover:text-primary" /></button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">This Ed25519 key controls all program upgrades. Quantum recovery of this key = complete program takeover.</p>
                  </CardContent>
                </Card>
              )}

              {(data.findings as Record<string, unknown>[] ?? []).map((f, i) => (
                <div key={i} className={`border rounded-lg overflow-hidden ${SEV[f.severity as string] ?? ""}`}>
                  <button onClick={() => toggle(`sol-f-${i}`)} className="w-full flex items-center justify-between p-3 hover:bg-white/5 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-xs ${SEV[f.severity as string]}`}>{String(f.severity).toUpperCase()}</Badge>
                      <span className="text-sm font-mono">{String(f.type).replace(/_/g, " ")}</span>
                    </div>
                    {expanded[`sol-f-${i}`] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {expanded[`sol-f-${i}`] && (
                    <div className="p-4 border-t border-current/20 bg-background/50 space-y-2">
                      <p className="text-sm">{String(f.description)}</p>
                      <div className="bg-black/40 rounded p-2 text-xs font-mono">
                        <p className="text-muted-foreground mb-1">EVIDENCE</p>
                        <p className="text-orange-300">{String(f.evidence)}</p>
                      </div>
                      {!!f.quantumContext && (
                        <div className="bg-red-500/5 border border-red-500/20 rounded p-2 text-xs">
                          <p className="text-red-400 font-mono mb-1">QUANTUM CONTEXT</p>
                          <p className="text-muted-foreground">{String(f.quantumContext)}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
