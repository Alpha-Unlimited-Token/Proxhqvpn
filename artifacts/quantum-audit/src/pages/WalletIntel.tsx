// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle, Loader2,
  FileSignature, MapPin, Coins, ExternalLink, Copy, Clock,
  Flame, Info, ChevronDown, ChevronUp, Activity,
  Lock, Eye, EyeOff, KeyRound, Zap, Wifi, Radio,
  Smartphone, Database, MessageSquare, ShieldOff, TriangleAlert,
  Fingerprint, Bitcoin, Globe,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function detectChainLabel(address: string): string | null {
  if (!address) return null;
  const a = address.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return "EVM (ETH / Polygon / BSC…)";
  if (/^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(a) || /^bc1[a-z0-9]{6,87}$/i.test(a)) return "Bitcoin";
  if (/^(L|M)[a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(a) || /^ltc1[a-z0-9]{6,87}$/i.test(a)) return "Litecoin";
  if (/^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/.test(a)) return "Dogecoin";
  if (/^bitcoincash:q[a-z0-9]{41}$/.test(a)) return "Bitcoin Cash";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return "Solana";
  return null;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface PermitFinding {
  type: string; severity: "critical" | "high" | "medium" | "low";
  txHash: string; blockNumber: number; timestamp: string;
  to: string; spender?: string; amountLabel: string;
  deadlineLabel?: string; expired?: boolean; detail: string; remediation: string;
}
interface PermitResult {
  address: string; chain: string; scannedTxs: number;
  findings: PermitFinding[]; summary: string; riskScore: number; durationMs: number;
}

interface PoisoningFinding {
  type: string; severity: "critical" | "high" | "medium" | "low";
  poisonAddress: string; realAddress: string; txHash: string;
  blockNumber: number; timestamp: string; valueEth: number;
  prefixMatch: number; suffixMatch: number; similarityPct: number;
  detail: string; remediation: string;
}
interface PoisoningResult {
  address: string; chain: string; scannedTxs: number;
  findings: PoisoningFinding[];
  clusters: { pattern: string; addresses: string[]; txCount: number }[];
  summary: string; riskScore: number; durationMs: number;
}

interface ApprovalRecord {
  token: string; tokenSymbol: string; tokenName: string; tokenType: string;
  spender: string; allowanceLabel: string; isUnlimited: boolean;
  txHash: string; blockNumber: number; timestamp: string; ageMonths: number;
  riskLevel: "critical" | "high" | "medium" | "low" | "safe";
  riskReason: string; remediation: string;
}
interface ApprovalResult {
  address: string; chain: string; totalFound: number; unlimited: number; stale: number;
  approvals: ApprovalRecord[]; summary: string; riskScore: number; durationMs: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function severityBadge(sev: string) {
  const map: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    high:     "bg-orange-500/20 text-orange-400 border-orange-500/30",
    medium:   "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low:      "bg-blue-500/20 text-blue-400 border-blue-500/30",
    safe:     "bg-green-500/20 text-green-400 border-green-500/30",
  };
  return (
    <Badge variant="outline" className={`text-xs font-mono ${map[sev] ?? ""}`}>
      {sev.toUpperCase()}
    </Badge>
  );
}

function riskBar(score: number) {
  const color = score >= 70 ? "bg-red-500" : score >= 40 ? "bg-orange-500" : score >= 20 ? "bg-yellow-500" : "bg-green-500";
  const label = score >= 70 ? "Critical" : score >= 40 ? "High" : score >= 20 ? "Medium" : "Low";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-semibold w-16">{score}/100 <span className="text-muted-foreground font-normal">({label})</span></span>
    </div>
  );
}

function shortAddr(a: string) { return a ? `${a.slice(0, 10)}…${a.slice(-8)}` : ""; }
function shortHash(h: string) { return h ? `${h.slice(0, 10)}…${h.slice(-6)}` : ""; }
function etherscanTx(hash: string, chain: string) {
  const bases: Record<string, string> = {
    ethereum: "https://etherscan.io",
    polygon:  "https://polygonscan.com",
    arbitrum: "https://arbiscan.io",
    optimism: "https://optimistic.etherscan.io",
    bsc:      "https://bscscan.com",
  };
  return `${bases[chain] ?? bases.ethereum}/tx/${hash}`;
}
function copy(text: string) { navigator.clipboard.writeText(text).catch(() => {}); }
function fmtDuration(ms: number) { return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`; }

// ── FindingCard ────────────────────────────────────────────────────────────────

function FindingCard({ title, sev, txHash, chain, detail, remediation, extra }: {
  title: string; sev: "critical" | "high" | "medium" | "low";
  txHash: string; chain: string; detail: string; remediation: string;
  extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-lg border p-4 space-y-2 ${sev === "critical" ? "border-red-500/40 bg-red-500/5" : sev === "high" ? "border-orange-500/40 bg-orange-500/5" : sev === "medium" ? "border-yellow-500/40 bg-yellow-500/5" : "border-blue-500/40 bg-blue-500/5"}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {sev === "critical" || sev === "high" ? <Flame className="w-4 h-4 text-red-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />}
          <span className="font-semibold text-sm truncate">{title}</span>
        </div>
        {severityBadge(sev)}
      </div>
      {extra}
      <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
      <div className="flex items-center gap-3 flex-wrap">
        {txHash && (
          <>
            <button onClick={() => copy(txHash)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Copy className="w-3 h-3" /> {shortHash(txHash)}
            </button>
            <a href={etherscanTx(txHash, chain)} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink className="w-3 h-3" /> View tx
            </a>
          </>
        )}
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-auto transition-colors">
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {open ? "Hide" : "Remediation"}
        </button>
      </div>
      {open && (
        <div className="mt-2 p-3 rounded bg-muted/40 border border-border/50 text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground block mb-1">How to fix:</span>
          {remediation}
        </div>
      )}
    </div>
  );
}

// ── Permit Tab ─────────────────────────────────────────────────────────────────

function PermitTab() {
  const [address, setAddress] = useState("");
  const { toast } = useToast();

  const mutation = useMutation<PermitResult, Error, { address: string }>({
    mutationFn: async (body) => {
      const res = await fetch(`${BASE}/api/wallet-intel/permit-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      return res.json();
    },
    onError: (e) => toast({ title: "Scan failed", description: e.message, variant: "destructive" }),
  });

  const result = mutation.data;
  const detectedChain = detectChainLabel(address);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSignature className="w-5 h-5 text-orange-400" />
            Script &amp; Blind-Signature Exploit Scanner
          </CardTitle>
          <CardDescription>
            EVM: EIP-2612 permit() abuse, setApprovalForAll drainer patterns, unlimited token approvals.
            Bitcoin / Litecoin / Dogecoin: OP_RETURN data, bare multisig, dust outputs, legacy script risks.
            Solana: SPL delegate and close-authority abuse. Chain is detected automatically from address format.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[260px] space-y-1.5">
              <Input
                placeholder="Any address — BTC, ETH, SOL, LTC, DOGE, BCH…"
                value={address} onChange={e => setAddress(e.target.value)}
                className="font-mono text-sm"
              />
              {detectedChain && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Detected: <span className="text-primary font-medium">{detectedChain}</span>
                </p>
              )}
            </div>
            <Button onClick={() => mutation.mutate({ address: address.trim() })}
              disabled={!address.trim() || mutation.isPending}>
              {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning…</> : "Run Scan"}
            </Button>
          </div>

          <Alert className="border-orange-500/30 bg-orange-500/5">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <AlertDescription className="text-xs text-muted-foreground">
              <strong>What attackers do:</strong> On EVM chains, they trick users into signing EIP-2612 permit() calls
              with no gas — draining all tokens. On Bitcoin/UTXO chains, they embed malicious scripts via OP_RETURN
              outputs and exploit bare P2PK outputs. On Solana, they abuse SPL token delegate authorities.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-mono text-muted-foreground">{result.address}</p>
                  <p className="text-xs text-muted-foreground mt-1">{result.scannedTxs} txs scanned · {fmtDuration(result.durationMs)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {result.findings.length === 0
                    ? <><CheckCircle className="w-5 h-5 text-green-400" /><span className="text-sm text-green-400">No issues found</span></>
                    : <><ShieldAlert className="w-5 h-5 text-red-400" /><span className="text-sm text-red-400">{result.findings.length} issue(s) found</span></>
                  }
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Risk Score</p>
                {riskBar(result.riskScore)}
              </div>
              <p className="text-sm">{result.summary}</p>
            </CardContent>
          </Card>

          {result.findings.length > 0 && (
            <ScrollArea className="h-[500px] pr-2">
              <div className="space-y-3">
                {result.findings.map((f, i) => (
                  <FindingCard key={i} sev={f.severity} chain={result.chain} txHash={f.txHash}
                    title={f.type === "permit_eip2612" ? "EIP-2612 Permit() Detected"
                         : f.type === "set_approval_all" ? "setApprovalForAll — NFT Drainer Pattern"
                         : f.type === "unlimited_approve" ? "Unlimited ERC-20 Approval"
                         : f.type === "stale_approval" ? "Stale Unlimited Approval"
                         : f.type}
                    detail={f.detail} remediation={f.remediation}
                    extra={
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {f.amountLabel && <span><span className="text-foreground">Amount:</span> {f.amountLabel}</span>}
                        {f.spender && <span><span className="text-foreground">Spender:</span> <span className="font-mono">{shortAddr(f.spender)}</span></span>}
                        {f.deadlineLabel && <span className={f.expired ? "text-red-400" : ""}><Clock className="w-3 h-3 inline mr-1" />{f.deadlineLabel}</span>}
                      </div>
                    }
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}

// ── Poisoning Tab ──────────────────────────────────────────────────────────────

function PoisoningTab() {
  const [address, setAddress] = useState("");
  const { toast } = useToast();

  const mutation = useMutation<PoisoningResult, Error, { address: string }>({
    mutationFn: async (body) => {
      const res = await fetch(`${BASE}/api/wallet-intel/poisoning-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      return res.json();
    },
    onError: (e) => toast({ title: "Scan failed", description: e.message, variant: "destructive" }),
  });

  const result = mutation.data;
  const lookalikes = result?.findings.filter(f => f.type === "address_lookalike") ?? [];
  const dustSpam   = result?.findings.filter(f => f.type === "dust_spam") ?? [];
  const detectedChain = detectChainLabel(address);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="w-5 h-5 text-purple-400" />
            Address Poisoning Detector
          </CardTitle>
          <CardDescription>
            Finds near-identical lookalike addresses in your transaction history across all chains.
            EVM: vanity 0x addresses matching prefix/suffix. Bitcoin/UTXO: dust UTXO spam campaigns.
            Solana: zero-balance airdrop tokens used as decoys. Chain auto-detected from address format.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[260px] space-y-1.5">
              <Input
                placeholder="Any address — BTC, ETH, SOL, LTC, DOGE, BCH…"
                value={address} onChange={e => setAddress(e.target.value)}
                className="font-mono text-sm"
              />
              {detectedChain && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Detected: <span className="text-primary font-medium">{detectedChain}</span>
                </p>
              )}
            </div>
            <Button onClick={() => mutation.mutate({ address: address.trim() })}
              disabled={!address.trim() || mutation.isPending}>
              {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning…</> : "Run Scan"}
            </Button>
          </div>

          <Alert className="border-purple-500/30 bg-purple-500/5">
            <Info className="w-4 h-4 text-purple-400" />
            <AlertDescription className="text-xs text-muted-foreground">
              <strong>How it works:</strong> Attackers use vanity generators to craft addresses matching
              your first/last characters, then send tiny dust to poison your history.
              Victims copy the fake address from their tx history and send real funds to the attacker.
              Works across EVM, Bitcoin, Litecoin, Dogecoin, BCH, and Solana.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Txs Scanned",    value: result.scannedTxs,       color: "" },
              { label: "Lookalikes",     value: lookalikes.length,        color: lookalikes.length > 0 ? "text-red-400" : "" },
              { label: "Dust Spam",      value: dustSpam.length,          color: dustSpam.length > 0 ? "text-orange-400" : "" },
              { label: "Clusters",       value: result.clusters.length,   color: result.clusters.length > 0 ? "text-yellow-400" : "" },
            ].map(({ label, value, color }) => (
              <Card key={label}><CardContent className="pt-4 pb-3 text-center">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </CardContent></Card>
            ))}
          </div>

          <Card><CardContent className="pt-4 space-y-2">
            <p className="text-sm">{result.summary}</p>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Risk Score</p>
              {riskBar(result.riskScore)}
            </div>
          </CardContent></Card>

          {lookalikes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-400" /> Lookalike Addresses ({lookalikes.length})
              </h3>
              <ScrollArea className="h-[400px] pr-2">
                <div className="space-y-3">
                  {lookalikes.map((f, i) => (
                    <FindingCard key={i} sev={f.severity} chain={result.chain} txHash={f.txHash}
                      title={`${f.prefixMatch} prefix + ${f.suffixMatch} suffix chars match (${f.similarityPct}% similar)`}
                      detail={f.detail} remediation={f.remediation}
                      extra={
                        <div className="font-mono text-xs space-y-1">
                          <div>
                            <span className="text-muted-foreground">Your address: </span>
                            <span className="text-green-400">{f.realAddress.slice(0, 2 + f.prefixMatch)}</span>
                            <span className="text-muted-foreground">{f.realAddress.slice(2 + f.prefixMatch, -f.suffixMatch || undefined)}</span>
                            {f.suffixMatch > 0 && <span className="text-green-400">{f.realAddress.slice(-f.suffixMatch)}</span>}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Poison address: </span>
                            <span className="text-red-400">{f.poisonAddress.slice(0, 2 + f.prefixMatch)}</span>
                            <span className="text-muted-foreground">{f.poisonAddress.slice(2 + f.prefixMatch, -f.suffixMatch || undefined)}</span>
                            {f.suffixMatch > 0 && <span className="text-red-400">{f.poisonAddress.slice(-f.suffixMatch)}</span>}
                          </div>
                        </div>
                      }
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {result.clusters.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Coordinated Poisoning Campaigns</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.clusters.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/40 border border-border/50 text-xs">
                    <span className="font-mono text-muted-foreground">{c.pattern}…</span>
                    <span>{c.addresses.length} addresses · {c.txCount} txs</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ── Approval Tab ───────────────────────────────────────────────────────────────

function ApprovalTab() {
  const [address, setAddress] = useState("");
  const { toast } = useToast();

  const mutation = useMutation<ApprovalResult, Error, { address: string }>({
    mutationFn: async (body) => {
      const res = await fetch(`${BASE}/api/wallet-intel/approval-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      return res.json();
    },
    onError: (e) => toast({ title: "Scan failed", description: e.message, variant: "destructive" }),
  });

  const result = mutation.data;
  const detectedChain = detectChainLabel(address);
  const isUtxo = result && (result as unknown as Record<string,unknown>).scanType === "utxo-risk-scan";
  const isSolana = result && (result as unknown as Record<string,unknown>).scanType === "solana-token-risk-scan";
  const utxoResult = isUtxo ? (result as unknown as { totalUtxos: number; dustUtxos: number; riskyUtxos: number; summary: string; riskScore: number; chain: string }) : null;
  const solanaResult = isSolana ? (result as unknown as { totalAccounts: number; flaggedAccounts: number; summary: string; riskScore: number; chain: string }) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="w-5 h-5 text-yellow-400" />
            Token Approval &amp; UTXO Risk Auditor
          </CardTitle>
          <CardDescription>
            EVM: audits all ERC-20/ERC-721/ERC-1155 approvals for stale unlimited permissions.
            Bitcoin / Litecoin / Dogecoin: scans UTXOs for dust spam, large stale outputs, and coin-control risks.
            Solana: audits SPL token accounts for delegations, close authorities, and dust airdrop accounts.
            Chain is detected automatically from address format.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[260px] space-y-1.5">
              <Input
                placeholder="Any address — BTC, ETH, SOL, LTC, DOGE, BCH…"
                value={address} onChange={e => setAddress(e.target.value)}
                className="font-mono text-sm"
              />
              {detectedChain && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Detected: <span className="text-primary font-medium">{detectedChain}</span>
                </p>
              )}
            </div>
            <Button onClick={() => mutation.mutate({ address: address.trim() })}
              disabled={!address.trim() || mutation.isPending}>
              {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning…</> : "Run Audit"}
            </Button>
          </div>

          <Alert className="border-yellow-500/30 bg-yellow-500/5">
            <Info className="w-4 h-4 text-yellow-400" />
            <AlertDescription className="text-xs text-muted-foreground">
              <strong>The risk:</strong> EVM — unlimited token approvals left open after DeFi interactions are drained
              when a protocol is hacked. Bitcoin/UTXO — dust spam UTXOs are used to track wallet activity
              and correlate identities. Solana — delegated SPL token authority lets attackers move your tokens
              without your private key.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          {utxoResult ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total UTXOs",  value: utxoResult.totalUtxos,  color: "" },
                  { label: "Dust UTXOs",   value: utxoResult.dustUtxos,   color: utxoResult.dustUtxos > 0 ? "text-orange-400" : "" },
                  { label: "Risky UTXOs",  value: utxoResult.riskyUtxos,  color: utxoResult.riskyUtxos > 0 ? "text-red-400" : "" },
                  { label: "Risk Score",   value: `${utxoResult.riskScore}`, color: utxoResult.riskScore >= 50 ? "text-red-400" : utxoResult.riskScore >= 25 ? "text-yellow-400" : "text-green-400" },
                ].map(({ label, value, color }) => (
                  <Card key={label}><CardContent className="pt-4 pb-3 text-center">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{label}</p>
                  </CardContent></Card>
                ))}
              </div>
              <Card><CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono capitalize">{utxoResult.chain}</Badge>
                  <span className="text-xs text-muted-foreground">UTXO Scan</span>
                </div>
                <p className="text-sm">{utxoResult.summary}</p>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">UTXO Risk Score</p>
                  {riskBar(utxoResult.riskScore)}
                </div>
              </CardContent></Card>
            </>
          ) : solanaResult ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Token Accounts", value: solanaResult.totalAccounts, color: "" },
                  { label: "Flagged",         value: solanaResult.flaggedAccounts ?? 0, color: (solanaResult.flaggedAccounts ?? 0) > 0 ? "text-red-400" : "" },
                  { label: "Risk Score",      value: `${solanaResult.riskScore}`, color: solanaResult.riskScore >= 50 ? "text-red-400" : solanaResult.riskScore >= 25 ? "text-yellow-400" : "text-green-400" },
                  { label: "Chain",           value: "Solana", color: "text-primary" },
                ].map(({ label, value, color }) => (
                  <Card key={label}><CardContent className="pt-4 pb-3 text-center">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{label}</p>
                  </CardContent></Card>
                ))}
              </div>
              <Card><CardContent className="pt-4 space-y-2">
                <p className="text-sm">{solanaResult.summary}</p>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">SPL Token Risk</p>
                  {riskBar(solanaResult.riskScore)}
                </div>
              </CardContent></Card>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Found",   value: result.totalFound, color: "" },
                  { label: "Unlimited",     value: result.unlimited,  color: result.unlimited > 0 ? "text-red-400" : "" },
                  { label: "Stale (6mo+)", value: result.stale,      color: result.stale > 0 ? "text-orange-400" : "" },
                  { label: "Risk Score",    value: `${result.riskScore}`, color: result.riskScore >= 50 ? "text-red-400" : result.riskScore >= 25 ? "text-yellow-400" : "text-green-400" },
                ].map(({ label, value, color }) => (
                  <Card key={label}><CardContent className="pt-4 pb-3 text-center">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{label}</p>
                  </CardContent></Card>
                ))}
              </div>

              <Card><CardContent className="pt-4 space-y-2">
                <p className="text-sm">{result.summary}</p>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Overall Approval Risk</p>
                  {riskBar(result.riskScore)}
                </div>
              </CardContent></Card>

              {result.approvals.length > 0 && (
                <ScrollArea className="h-[480px] pr-2">
                  <div className="space-y-3">
                    {result.approvals.map((a, i) => (
                      <div key={i} className={`rounded-lg border p-4 space-y-2
                        ${a.riskLevel === "critical" ? "border-red-500/40 bg-red-500/5"
                        : a.riskLevel === "high"     ? "border-orange-500/40 bg-orange-500/5"
                        : a.riskLevel === "medium"   ? "border-yellow-500/40 bg-yellow-500/5"
                        : a.riskLevel === "low"      ? "border-blue-500/40 bg-blue-500/5"
                        : "border-border/40 bg-muted/20"}`}>
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            {a.isUnlimited ? <Flame className="w-4 h-4 text-red-400" /> : <Coins className="w-4 h-4 text-muted-foreground" />}
                            <span className="font-semibold text-sm">{a.tokenSymbol || shortAddr(a.token)} <span className="text-muted-foreground font-normal text-xs">{a.tokenType}</span></span>
                          </div>
                          <div className="flex items-center gap-2">
                            {severityBadge(a.riskLevel)}
                            {a.isUnlimited && <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30">UNLIMITED</Badge>}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <div><span className="text-foreground">Spender:</span> <span className="font-mono">{shortAddr(a.spender)}</span></div>
                          <div><span className="text-foreground">Amount:</span> {a.allowanceLabel}</div>
                          <div><span className="text-foreground">Age:</span> {a.ageMonths} months</div>
                          <div><span className="text-foreground">Token:</span> <span className="font-mono">{shortAddr(a.token)}</span></div>
                        </div>
                        <p className="text-xs text-muted-foreground">{a.riskReason}</p>
                        <div className="flex items-center gap-3">
                          {a.txHash && (
                            <a href={etherscanTx(a.txHash, result.chain)} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-primary hover:underline">
                              <ExternalLink className="w-3 h-3" /> View approval tx
                            </a>
                          )}
                          <a href="https://revoke.cash" target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-orange-400 hover:underline ml-auto">
                            <ShieldCheck className="w-3 h-3" /> Revoke on Revoke.cash
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sig Scan Tab ───────────────────────────────────────────────────────────────

interface SigScanResult {
  chain: string; scanType: string; address: string;
  scannedTxs: number; sigsAnalyzed: number;
  rValueDuplicates: { r: string; txHashes: string[]; sigCount: number }[];
  weakKIndicators: number; schnorrCount: number; legacyCount: number;
  summary: string; riskScore?: number; durationMs?: number;
}

function SigScanTab() {
  const [address, setAddress] = useState("");
  const { toast } = useToast();

  const mutation = useMutation<SigScanResult, Error, { address: string }>({
    mutationFn: async (body) => {
      const res = await fetch(`${BASE}/api/wallet-intel/sig-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      return res.json();
    },
    onError: (e) => toast({ title: "Scan failed", description: e.message, variant: "destructive" }),
  });

  const result = mutation.data;
  const detectedChain = detectChainLabel(address);
  const isUtxoChain = detectedChain && !detectedChain.startsWith("EVM") && !detectedChain.startsWith("Solana");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Fingerprint className="w-5 h-5 text-cyan-400" />
            ECDSA / Signature Vulnerability Scanner
          </CardTitle>
          <CardDescription>
            Scans transaction signatures for ECDSA nonce reuse (r-value duplicates), weak-k indicators,
            and Schnorr vs. legacy key usage. R-value reuse directly exposes the private key — this scan
            detects exactly the pattern exploited in the 2012 Sony PS3 hack and 2013 Android Bitcoin wallet break.
            Supports Bitcoin, Litecoin, Dogecoin, and EVM chains. Solana uses Ed25519 with deterministic nonces (safe by design).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[260px] space-y-1.5">
              <Input
                placeholder="BTC, LTC, DOGE, or ETH address…"
                value={address} onChange={e => setAddress(e.target.value)}
                className="font-mono text-sm"
              />
              {detectedChain && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Detected: <span className="text-primary font-medium">{detectedChain}</span>
                  {!isUtxoChain && detectedChain.startsWith("EVM") && (
                    <span className="ml-1 text-muted-foreground/60">(deep scan queued — EVM sigs take longer)</span>
                  )}
                </p>
              )}
            </div>
            <Button onClick={() => mutation.mutate({ address: address.trim() })}
              disabled={!address.trim() || mutation.isPending}>
              {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing…</> : "Run Sig Scan"}
            </Button>
          </div>

          <Alert className="border-cyan-500/30 bg-cyan-500/5">
            <Fingerprint className="w-4 h-4 text-cyan-400" />
            <AlertDescription className="text-xs text-muted-foreground">
              <strong>Why r-value reuse is critical:</strong> ECDSA signatures contain a random nonce k.
              If k is reused across two signatures with the same r-value, the private key can be algebraically
              recovered — no brute force, just math. This has been used to steal millions in Bitcoin.
              One duplicate r-value = private key exposed.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Txs Scanned",      value: result.scannedTxs,                                                     color: "" },
              { label: "Sigs Analyzed",    value: result.sigsAnalyzed,                                                   color: "" },
              { label: "R-Value Dupes",    value: result.rValueDuplicates.length,                                         color: result.rValueDuplicates.length > 0 ? "text-red-400" : "text-green-400" },
              { label: "Weak-k Signals",   value: result.weakKIndicators,                                                 color: result.weakKIndicators > 0 ? "text-orange-400" : "text-green-400" },
            ].map(({ label, value, color }) => (
              <Card key={label}><CardContent className="pt-4 pb-3 text-center">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </CardContent></Card>
            ))}
          </div>

          <Card><CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs font-mono capitalize">{result.chain}</Badge>
              <Badge variant="outline" className="text-xs font-mono">{result.scanType}</Badge>
              {result.schnorrCount > 0 && <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">Schnorr: {result.schnorrCount} txs</Badge>}
              {result.legacyCount > 0 && <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">Legacy ECDSA: {result.legacyCount} txs</Badge>}
            </div>
            <p className="text-sm">{result.summary}</p>
            {result.rValueDuplicates.length === 0 && result.weakKIndicators === 0 && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" /> No signature vulnerabilities detected
              </div>
            )}
          </CardContent></Card>

          {result.rValueDuplicates.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-red-400">
                <Flame className="w-4 h-4" /> R-Value Duplicates Detected — Private Key At Risk
              </h3>
              <Alert className="border-red-500/50 bg-red-500/10">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <AlertDescription className="text-xs text-red-300">
                  <strong>CRITICAL:</strong> Duplicate r-values mean the same nonce k was used in multiple signatures.
                  The private key for this address can be mathematically recovered from these transactions.
                  Move all funds to a new wallet generated with a secure, non-deterministic source immediately.
                </AlertDescription>
              </Alert>
              <ScrollArea className="h-[300px] pr-2">
                <div className="space-y-3">
                  {result.rValueDuplicates.map((dup, i) => (
                    <div key={i} className="rounded-lg border border-red-500/40 bg-red-500/5 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-red-400 shrink-0" />
                        <span className="text-xs font-semibold text-red-400">Duplicate R-Value ({dup.sigCount} signatures share this nonce)</span>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground break-all">r = {dup.r}</p>
                      <div className="space-y-1">
                        {dup.txHashes.slice(0, 3).map((h, j) => (
                          <div key={j} className="flex items-center gap-2">
                            <button onClick={() => navigator.clipboard.writeText(h).catch(() => {})} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                              <Copy className="w-3 h-3" /> {shortHash(h)}
                            </button>
                            <a href={`https://mempool.space/tx/${h}`} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-primary hover:underline">
                              <ExternalLink className="w-3 h-3" /> mempool.space
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {result.weakKIndicators > 0 && result.rValueDuplicates.length === 0 && (
            <Alert className="border-orange-500/40 bg-orange-500/5">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <AlertDescription className="text-xs text-muted-foreground">
                <strong className="text-orange-400">{result.weakKIndicators} weak-k indicator(s) detected.</strong>{" "}
                These signatures show patterns consistent with low-entropy nonce generation.
                While no definitive r-value reuse was found, consider migrating to a wallet that uses
                RFC 6979 deterministic nonce generation (most modern wallets do).
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

// ── Passphrase & Seed Phrase Auditor ──────────────────────────────────────────

interface SeedResult {
  words: string[]; wordCount: number; wordCountValid: boolean; entropyBits: number;
  hasDuplicates: boolean; duplicateWords: string[]; isAlphabetical: boolean;
  allSameLetter: boolean; score: number; avgWordLen: number; maxConsecRepeat: number;
}
interface PassResult {
  length: number; hasUpper: boolean; hasLower: boolean; hasDigit: boolean; hasSpecial: boolean;
  entropyBits: number; commonPatterns: string[]; score: number; timeLabel: string;
  hibpCount: number; pool: number;
}

function strengthColor(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}
function strengthLabel(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Moderate";
  if (score >= 40) return "Weak";
  return "Very Weak";
}

async function sha1Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.toUpperCase());
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function PassphraseTab() {
  const [seedInput, setSeedInput]         = useState("");
  const [seedResult, setSeedResult]       = useState<SeedResult | null>(null);
  const [passInput, setPassInput]         = useState("");
  const [showPass, setShowPass]           = useState(false);
  const [passResult, setPassResult]       = useState<PassResult | null>(null);
  const [hibpLoading, setHibpLoading]     = useState(false);
  const [activeSection, setActiveSection] = useState<"seed" | "pass">("seed");

  const analyzeSeed = () => {
    const words = seedInput.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const VALID = new Set([12, 15, 18, 21, 24]);
    const wordCountValid = VALID.has(words.length);
    const entropyBits = ({ 12: 128, 15: 160, 18: 192, 21: 224, 24: 256 } as Record<number, number>)[words.length] ?? 0;
    const wordSet = new Set(words);
    const hasDuplicates = wordSet.size < words.length;
    const duplicateWords = [...new Set(words.filter((w, i) => words.indexOf(w) !== i))];
    const sorted = [...words].sort();
    const isAlphabetical = words.every((w, i) => w === sorted[i]);
    const firstChars = new Set(words.map(w => w[0]));
    const allSameLetter = firstChars.size === 1;
    const avgWordLen = words.reduce((s, w) => s + w.length, 0) / (words.length || 1);
    let maxRepeat = 1, cur = 1;
    for (let i = 1; i < words.length; i++) {
      cur = words[i] === words[i - 1] ? cur + 1 : 1;
      maxRepeat = Math.max(maxRepeat, cur);
    }
    const score = Math.min(100, Math.max(0,
      (wordCountValid ? 25 : 0) +
      (entropyBits >= 128 ? 25 : entropyBits >= 64 ? 10 : 0) +
      (!hasDuplicates ? 20 : 0) +
      (!isAlphabetical ? 15 : 0) +
      (!allSameLetter ? 15 : 0)
    ));
    setSeedResult({ words, wordCount: words.length, wordCountValid, entropyBits, hasDuplicates, duplicateWords, isAlphabetical, allSameLetter, score, avgWordLen, maxConsecRepeat: maxRepeat });
  };

  const analyzePassphrase = async () => {
    const p = passInput;
    const hasUpper = /[A-Z]/.test(p);
    const hasLower = /[a-z]/.test(p);
    const hasDigit = /[0-9]/.test(p);
    const hasSpecial = /[^A-Za-z0-9]/.test(p);
    let pool = 0;
    if (hasLower) pool += 26;
    if (hasUpper) pool += 26;
    if (hasDigit) pool += 10;
    if (hasSpecial) pool += 32;
    const entropyBits = p.length * Math.log2(pool || 1);
    const patterns: string[] = [];
    if (p.length < 8)              patterns.push("Too short — under 8 characters");
    if (p.length < 12)             patterns.push("Short — under 12 characters (recommended minimum)");
    if (/(.)\1{3,}/.test(p))       patterns.push("Repeated characters (e.g. aaaa)");
    if (/^[0-9]+$/.test(p))        patterns.push("Digits only — no letters or symbols");
    if (/^[a-zA-Z]+$/.test(p))     patterns.push("Letters only — no digits or symbols");
    if (/\b(19|20)\d{2}\b/.test(p))patterns.push("Year/date pattern detected");
    if (/qwerty|asdf|zxcv|1234|abcd/i.test(p)) patterns.push("Keyboard walk or sequential pattern");
    if (/password|passphrase|secret|crypto|bitcoin|wallet/i.test(p)) patterns.push("Common crypto/password keyword found");

    let score = 0;
    if (p.length >= 8)  score += 10;
    if (p.length >= 12) score += 10;
    if (p.length >= 16) score += 10;
    if (p.length >= 20) score += 10;
    if (hasUpper)       score += 15;
    if (hasLower)       score += 15;
    if (hasDigit)       score += 15;
    if (hasSpecial)     score += 15;
    score = Math.min(100, score);

    const gps = 1e12;
    const totalGuesses = Math.pow(pool || 1, p.length);
    const secs = totalGuesses / gps;
    let timeLabel = "< 1 second";
    if (secs >= 1)               timeLabel = `${secs.toFixed(0)}s`;
    if (secs >= 60)              timeLabel = `${(secs / 60).toFixed(0)} minutes`;
    if (secs >= 3600)            timeLabel = `${(secs / 3600).toFixed(0)} hours`;
    if (secs >= 86400)           timeLabel = `${(secs / 86400).toFixed(0)} days`;
    if (secs >= 86400 * 365)     timeLabel = `${(secs / (86400 * 365)).toFixed(0)} years`;
    if (secs >= 86400 * 365e6)   timeLabel = `${(secs / (86400 * 365e6)).toFixed(0)} million years`;
    if (secs >= 86400 * 365e9)   timeLabel = "Effectively uncrackable (billions of years)";

    setHibpLoading(true);
    let hibpCount = -1;
    try {
      const hash = await sha1Hex(p);
      const prefix = hash.slice(0, 5);
      const suffix = hash.slice(5);
      const resp = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { "Add-Padding": "true" } });
      if (resp.ok) {
        const text = await resp.text();
        const match = text.split("\n").find(l => l.startsWith(suffix));
        hibpCount = match ? parseInt(match.split(":")[1] ?? "0") : 0;
      }
    } catch { hibpCount = -1; }
    setHibpLoading(false);
    setPassResult({ length: p.length, hasUpper, hasLower, hasDigit, hasSpecial, entropyBits, commonPatterns: patterns, score, timeLabel, hibpCount, pool });
  };

  return (
    <div className="space-y-6">
      <Alert className="border-red-500/40 bg-red-500/8">
        <Lock className="w-4 h-4 text-red-400" />
        <AlertDescription className="text-xs">
          <strong className="text-red-400">Privacy guarantee:</strong> All analysis runs entirely in your browser.
          Seed phrases and passphrases are <strong>never sent to any server</strong>. The only external call is an
          anonymous Have I Been Pwned breach check using k-anonymity (only the first 5 chars of a SHA-1 hash are sent — your actual passphrase is never transmitted).
        </AlertDescription>
      </Alert>

      <div className="flex gap-2">
        <Button variant={activeSection === "seed" ? "default" : "outline"} size="sm" onClick={() => setActiveSection("seed")} className="flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> Seed Phrase Audit
        </Button>
        <Button variant={activeSection === "pass" ? "default" : "outline"} size="sm" onClick={() => setActiveSection("pass")} className="flex items-center gap-2">
          <Lock className="w-4 h-4" /> Passphrase Strength
        </Button>
      </div>

      {activeSection === "seed" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="w-5 h-5 text-green-400" />BIP39 Seed Phrase Security Auditor</CardTitle>
            <CardDescription>
              Analyzes your seed phrase for weak randomness patterns, duplicate words, low entropy, and structural vulnerabilities
              that attackers exploit when targeting poorly-generated wallets.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Paste your 12, 15, 18, 21, or 24 BIP39 seed words here (space-separated)…"
              value={seedInput} onChange={e => setSeedInput(e.target.value)}
              rows={4} className="font-mono text-sm resize-none"
            />
            <div className="flex gap-2">
              <Button onClick={analyzeSeed} disabled={!seedInput.trim()}>Analyze Seed Phrase</Button>
              <Button variant="outline" onClick={() => { setSeedInput(""); setSeedResult(null); }}>Clear</Button>
            </div>

            {seedResult && (
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Word Count",  value: seedResult.wordCount, sub: seedResult.wordCountValid ? "✓ Valid" : "✗ Invalid", color: seedResult.wordCountValid ? "text-green-400" : "text-red-400" },
                    { label: "Entropy",     value: `${seedResult.entropyBits}`, sub: "bits", color: seedResult.entropyBits >= 128 ? "text-green-400" : "text-red-400" },
                    { label: "Strength",    value: strengthLabel(seedResult.score), sub: `${seedResult.score}/100`, color: seedResult.score >= 60 ? "text-green-400" : seedResult.score >= 40 ? "text-yellow-400" : "text-red-400" },
                    { label: "Duplicates", value: seedResult.hasDuplicates ? "Found" : "None", sub: seedResult.hasDuplicates ? seedResult.duplicateWords.join(", ") : "Good", color: seedResult.hasDuplicates ? "text-red-400" : "text-green-400" },
                  ].map(({ label, value, sub, color }) => (
                    <Card key={label}><CardContent className="pt-4 pb-3">
                      <p className={`text-xl font-bold ${color}`}>{value}</p>
                      <p className="text-xs font-semibold text-muted-foreground mt-0.5">{label}</p>
                      <p className="text-xs text-muted-foreground">{sub}</p>
                    </CardContent></Card>
                  ))}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Overall Seed Quality</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${strengthColor(seedResult.score)}`} style={{ width: `${seedResult.score}%` }} />
                    </div>
                    <span className="text-sm font-semibold">{seedResult.score}/100</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { ok: seedResult.wordCountValid,    good: `${seedResult.wordCount} words — valid BIP39 length`, bad: `${seedResult.wordCount} words — INVALID. Must be 12/15/18/21/24.` },
                    { ok: seedResult.entropyBits >= 128, good: `${seedResult.entropyBits}-bit entropy — sufficient security`, bad: `${seedResult.entropyBits}-bit entropy — INSUFFICIENT. Minimum is 128 bits (12 words).` },
                    { ok: !seedResult.hasDuplicates,    good: "No duplicate words", bad: `Duplicate words found: ${seedResult.duplicateWords.join(", ")} — strongly indicates weak/non-random generation` },
                    { ok: !seedResult.isAlphabetical,   good: "Words not in alphabetical order", bad: "Words ARE in alphabetical order — indicates generated or crafted seed, not random" },
                    { ok: !seedResult.allSameLetter,    good: "Words start with varied letters", bad: "All words start with the same letter — very suspicious, likely crafted" },
                    { ok: seedResult.maxConsecRepeat < 3, good: "No repeated consecutive words", bad: `${seedResult.maxConsecRepeat} consecutive identical words — never occurs in secure random generation` },
                  ].map(({ ok, good, bad }, i) => (
                    <div key={i} className={`flex items-start gap-2 p-2.5 rounded text-xs ${ok ? "bg-green-500/8 border border-green-500/20" : "bg-red-500/8 border border-red-500/20"}`}>
                      {ok ? <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />}
                      <span className={ok ? "text-green-300" : "text-red-300"}>{ok ? good : bad}</span>
                    </div>
                  ))}
                </div>

                <Alert className="border-blue-500/30 bg-blue-500/5">
                  <Info className="w-4 h-4 text-blue-400" />
                  <AlertDescription className="text-xs text-muted-foreground">
                    <strong>How attackers exploit weak seeds:</strong> "Brain wallet" attacks try predictable phrases.
                    Malware pre-installed via supply chain attacks scans memory and clipboard for seed patterns.
                    Seeds generated by compromised RNG (random number generators in buggy wallet software) are often sequential or have low entropy.
                    Always generate seeds with a hardware wallet or verified offline tool.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === "pass" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Lock className="w-5 h-5 text-blue-400" />Passphrase Strength Analyzer</CardTitle>
            <CardDescription>
              Tests wallet passphrases and passwords against entropy analysis, common-pattern detection,
              and the Have I Been Pwned breach database (2 billion compromised passwords) using anonymous k-anonymity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                placeholder="Enter passphrase or wallet password to test…"
                value={passInput} onChange={e => setPassInput(e.target.value)}
                className="pr-10 font-mono"
              />
              <button onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex gap-2">
              <Button onClick={analyzePassphrase} disabled={!passInput || hibpLoading}>
                {hibpLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking breaches…</> : "Analyze Passphrase"}
              </Button>
              <Button variant="outline" onClick={() => { setPassInput(""); setPassResult(null); }}>Clear</Button>
            </div>

            {passResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Strength",   value: strengthLabel(passResult.score),         color: passResult.score >= 60 ? "text-green-400" : passResult.score >= 40 ? "text-yellow-400" : "text-red-400" },
                    { label: "Entropy",    value: `${passResult.entropyBits.toFixed(0)} bits`, color: passResult.entropyBits >= 60 ? "text-green-400" : passResult.entropyBits >= 40 ? "text-yellow-400" : "text-red-400" },
                    { label: "Crack Time", value: passResult.timeLabel,                    color: passResult.timeLabel.includes("second") || passResult.timeLabel.includes("minute") ? "text-red-400" : "text-green-400" },
                    { label: "Data Breaches", value: passResult.hibpCount < 0 ? "Unknown" : passResult.hibpCount === 0 ? "Clean" : `${passResult.hibpCount.toLocaleString()}×`, color: passResult.hibpCount > 0 ? "text-red-400" : passResult.hibpCount === 0 ? "text-green-400" : "text-muted-foreground" },
                  ].map(({ label, value, color }) => (
                    <Card key={label}><CardContent className="pt-4 pb-3">
                      <p className={`text-lg font-bold truncate ${color}`}>{value}</p>
                      <p className="text-xs font-semibold text-muted-foreground mt-0.5">{label}</p>
                    </CardContent></Card>
                  ))}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Strength Score</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${strengthColor(passResult.score)}`} style={{ width: `${passResult.score}%` }} />
                    </div>
                    <span className="text-sm font-semibold">{passResult.score}/100</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {[
                    { label: "Uppercase",  ok: passResult.hasUpper },
                    { label: "Lowercase",  ok: passResult.hasLower },
                    { label: "Digits",     ok: passResult.hasDigit },
                    { label: "Symbols",    ok: passResult.hasSpecial },
                  ].map(({ label, ok }) => (
                    <div key={label} className={`flex items-center gap-1.5 p-2 rounded border ${ok ? "border-green-500/30 bg-green-500/8 text-green-400" : "border-red-500/30 bg-red-500/8 text-red-400"}`}>
                      {ok ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />} {label}
                    </div>
                  ))}
                </div>

                {passResult.hibpCount > 0 && (
                  <Alert className="border-red-500/50 bg-red-500/10">
                    <Flame className="w-4 h-4 text-red-400" />
                    <AlertDescription className="text-xs">
                      <strong className="text-red-400">BREACHED: This passphrase appears {passResult.hibpCount.toLocaleString()} times in known data breaches.</strong>{" "}
                      Attackers use these exact passwords in credential-stuffing attacks against custodial wallets and exchange accounts.
                      Change this passphrase immediately.
                    </AlertDescription>
                  </Alert>
                )}

                {passResult.commonPatterns.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold">Detected Weaknesses:</p>
                    {passResult.commonPatterns.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-orange-300 bg-orange-500/8 border border-orange-500/20 rounded p-2">
                        <AlertTriangle className="w-3 h-3 shrink-0" /> {p}
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-3 rounded bg-muted/40 border border-border/50 text-xs space-y-1">
                  <p className="font-semibold">Crack time assumes 1 trillion guesses/second (GPU cluster attack)</p>
                  <p className="text-muted-foreground">Char pool size: {passResult.pool} · Length: {passResult.length} · Total combinations: ~{(Math.pow(passResult.pool, passResult.length)).toExponential(2)}</p>
                  <p className="text-muted-foreground">Recommended: 16+ chars, all 4 character types, no dictionary words → 90+ entropy bits</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Zero-Click & Stealth Threat Checklist ─────────────────────────────────────

interface CheckItem {
  id: string; question: string; risk: string; severity: "critical" | "high" | "medium";
  icon: React.ElementType; remediation: string;
}

const CHECKLIST: CheckItem[] = [
  {
    id: "sms2fa", icon: Smartphone,
    question: "Does your wallet app or exchange use SMS-based 2FA for account recovery?",
    severity: "critical",
    risk: "SS7 Interception: Attackers exploit the SS7 cellular signaling protocol to intercept SMS codes without touching your device. They reset passwords on custodial wallets and linked email accounts remotely.",
    remediation: "Replace SMS 2FA with hardware security keys (FIDO2/WebAuthn) or an authenticator app (TOTP). Remove SMS as a recovery option entirely on all crypto-linked accounts.",
  },
  {
    id: "seedStorage", icon: Database,
    question: "Is the wallet seed phrase stored unencrypted (notes app, screenshot, text file, cloud sync)?",
    severity: "critical",
    risk: "Silent Background Malware: Pre-installed malware 'sleeps' until crypto activity is detected, then silently scans the filesystem, clipboard, and memory for seed phrases stored in plaintext.",
    remediation: "Never store seed phrases digitally. Use physical metal backups in a fire-safe. If digital storage is required, use an air-gapped encrypted vault (VeraCrypt, BitWarden offline). Disable cloud sync for notes apps on crypto devices.",
  },
  {
    id: "autoPreview", icon: MessageSquare,
    question: "Does your development environment or device use messaging apps with auto-preview (iMessage, WhatsApp, Signal)?",
    severity: "high",
    risk: "Zero-Click Messaging Exploits: Hackers send malformed images or specially crafted messages that the OS automatically processes for preview/notification, triggering remote code execution with no user interaction required.",
    remediation: "Disable iMessage auto-preview and link previews in messaging apps on development machines. Use a separate hardened device for crypto operations. Keep all apps and OS updated — zero-clicks target known CVEs.",
  },
  {
    id: "providerApi", icon: Radio,
    question: "Does your wallet application expose Provider API state (window.ethereum-style) to any website?",
    severity: "high",
    risk: "Wallet Software API Exploit: Malicious websites can silently read wallet state through exposed provider APIs, including encrypted recovery phrase data, without any user approval — simply by the user visiting the page.",
    remediation: "Restrict provider API injection to trusted, explicitly allowlisted domains. Implement strict Content Security Policy headers. Audit what wallet state is accessible via the injected provider object.",
  },
  {
    id: "publicWifi", icon: Wifi,
    question: "Do you perform wallet operations or development on public Wi-Fi or with Bluetooth enabled?",
    severity: "high",
    risk: "Network Proximity Attack: Attackers on the same network can intercept unencrypted data packets and inject malware. Bluetooth proximity allows device fingerprinting and targeted exploit delivery.",
    remediation: "Never perform crypto operations on public Wi-Fi. Use a VPN with a hardware token. Disable Bluetooth on crypto devices when not actively needed.",
  },
  {
    id: "outdatedSoftware", icon: Zap,
    question: "Is any component of your wallet software, OS, or device firmware running on an outdated version?",
    severity: "high",
    risk: "Malicious Data Processing: Unpatched vulnerabilities in image I/O frameworks, networking stacks, and wallet app dependencies are the entry point for zero-click attacks. The 2025 Apple Image I/O CVE allowed full device takeover via a received image.",
    remediation: "Enable automatic security updates on all devices used for crypto. Subscribe to CVE alerts for your wallet's key dependencies. Implement a dependency audit process (npm audit, snyk scan) as part of your CI/CD pipeline.",
  },
  {
    id: "softwareWallet", icon: ShieldOff,
    question: "Are significant holdings (>$1,000 equivalent) secured only by a software wallet on a networked device?",
    severity: "critical",
    risk: "Software wallets are primary targets for stealer malware that scans device memory, browser extension storage, and application data directories for private keys and keystores.",
    remediation: "Move significant holdings to a hardware wallet (Ledger, Trezor, Coldcard). Hardware wallets keep private keys in a secure element that cannot be accessed by software, even if the host device is fully compromised.",
  },
  {
    id: "custodialEmail", icon: Lock,
    question: "Is a custodial wallet or exchange account recoverable via an email that resets through SMS?",
    severity: "critical",
    risk: "SS7 Chain Attack: An attacker uses SS7 to intercept your SMS → resets your email password → resets your custodial wallet/exchange password → drains your account. Zero physical contact, no malware required.",
    remediation: "Break the SMS dependency chain: secure your email with a hardware key (not SMS recovery), use a dedicated email address only for crypto that has no SMS recovery option, and use hardware 2FA on all exchange accounts.",
  },
  {
    id: "clipboardRisk", icon: TriangleAlert,
    question: "Do you copy/paste wallet addresses or private keys via the clipboard on devices that run other apps?",
    severity: "high",
    risk: "Clipboard Hijacker Malware: Malware monitors the clipboard in real-time. When it detects a wallet address being copied, it silently replaces it with the attacker's address. Private keys copied to clipboard are immediately stolen.",
    remediation: "Never copy private keys. For addresses, use QR codes or address book entries instead of clipboard. Consider a clipboard manager that auto-clears after 30 seconds. Use a dedicated, minimal-app device for crypto operations.",
  },
];

type Answer = "yes" | "no" | "unknown";

function ZeroThreatTab() {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const answered = Object.keys(answers).length;
  const yesCount = Object.values(answers).filter(a => a === "yes").length;
  const criticalYes = CHECKLIST.filter(c => c.severity === "critical" && answers[c.id] === "yes").length;
  const highYes = CHECKLIST.filter(c => c.severity === "high" && answers[c.id] === "yes").length;

  const riskScore = Math.min(100, criticalYes * 30 + highYes * 15 + yesCount * 5);
  const completion = Math.round((answered / CHECKLIST.length) * 100);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="w-5 h-5 text-yellow-400" /> Zero-Click &amp; Stealth Attack Exposure Assessment
          </CardTitle>
          <CardDescription>
            Answer each question to receive a personalized risk score for zero-click exploits, SS7 attacks,
            silent malware, and network proximity threats — the attack vectors that require no user interaction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className={`text-2xl font-bold ${riskScore >= 50 ? "text-red-400" : riskScore >= 25 ? "text-yellow-400" : "text-green-400"}`}>{riskScore}</p>
              <p className="text-xs text-muted-foreground">Risk Score /100</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${criticalYes > 0 ? "text-red-400" : "text-green-400"}`}>{criticalYes}</p>
              <p className="text-xs text-muted-foreground">Critical Exposures</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-muted-foreground">{completion}%</p>
              <p className="text-xs text-muted-foreground">Assessment Complete</p>
            </div>
          </div>
          {answered > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Exposure Risk</p>
              {riskBar(riskScore)}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {CHECKLIST.map((item) => {
          const ans = answers[item.id];
          const isExp = expanded[item.id];
          const Icon = item.icon;
          return (
            <div key={item.id} className={`rounded-lg border p-4 space-y-3 transition-colors ${
              ans === "yes" ? (item.severity === "critical" ? "border-red-500/40 bg-red-500/5" : "border-orange-500/40 bg-orange-500/5") :
              ans === "no" ? "border-green-500/30 bg-green-500/5" : "border-border/50"
            }`}>
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${
                  ans === "yes" ? (item.severity === "critical" ? "text-red-400" : "text-orange-400") :
                  ans === "no" ? "text-green-400" : "text-muted-foreground"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium leading-relaxed">{item.question}</p>
                    {severityBadge(item.severity)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-8">
                {(["yes", "no", "unknown"] as Answer[]).map(opt => (
                  <button key={opt}
                    onClick={() => setAnswers(prev => ({ ...prev, [item.id]: opt }))}
                    className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                      ans === opt
                        ? opt === "yes" ? "bg-red-500/20 border-red-500/50 text-red-300"
                        : opt === "no" ? "bg-green-500/20 border-green-500/50 text-green-300"
                        : "bg-muted border-border text-muted-foreground"
                        : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {opt === "yes" ? "Yes" : opt === "no" ? "No" : "Not sure"}
                  </button>
                ))}
                <button
                  onClick={() => setExpanded(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {isExp ? "Less" : "Risk detail"}
                </button>
              </div>

              {(isExp || ans === "yes") && (
                <div className="ml-8 space-y-2">
                  <div className="p-3 rounded bg-muted/40 border border-border/50 text-xs text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground block mb-1">Attack vector:</span>
                    {item.risk}
                  </div>
                  {ans === "yes" && (
                    <div className="p-3 rounded bg-blue-500/8 border border-blue-500/20 text-xs text-blue-300 leading-relaxed">
                      <span className="font-semibold text-blue-200 block mb-1">Remediation:</span>
                      {item.remediation}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {answered === CHECKLIST.length && riskScore === 0 && (
        <Alert className="border-green-500/40 bg-green-500/5">
          <ShieldCheck className="w-4 h-4 text-green-400" />
          <AlertDescription className="text-sm text-green-300">
            Excellent security posture — no critical exposures detected. Continue regular audits as the threat landscape evolves.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function WalletIntel() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          Wallet Intelligence &amp; Attack Vector Audit
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Scan any wallet for the 2026 attack vectors currently being used to steal private keys and drain crypto.
          Supports EVM (ETH, Polygon, BSC…), Bitcoin, Litecoin, Dogecoin, Bitcoin Cash, and Solana — chain is
          detected automatically from the address format you paste.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: FileSignature, color: "text-orange-400", label: "Script / Permit",   desc: "EIP-2612, OP_RETURN, SPL delegates" },
          { icon: MapPin,        color: "text-purple-400", label: "Addr Poisoning",    desc: "Lookalike & dust spam — all chains" },
          { icon: Coins,         color: "text-yellow-400", label: "Approvals / UTXOs", desc: "ERC approvals · UTXO dust · SPL risk" },
          { icon: Fingerprint,   color: "text-cyan-400",   label: "Sig Vulnerability", desc: "ECDSA r-reuse, weak-k, Schnorr audit" },
          { icon: KeyRound,      color: "text-green-400",  label: "Seed & Passphrase", desc: "Entropy & breach check (offline)" },
          { icon: Zap,           color: "text-blue-400",   label: "Zero-Click Risks",  desc: "SS7 / stealth / no-touch checklist" },
        ].map(({ icon: Icon, color, label, desc }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="pt-4 pb-3 flex items-start gap-2">
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
              <div>
                <p className="text-xs font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground bg-muted/30 border border-border/50 rounded-lg px-4 py-2.5">
        <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
        <span><span className="text-foreground font-medium">Auto chain detection:</span></span>
        <span className="font-mono text-primary/80">0x…</span><span>EVM ·</span>
        <span className="font-mono text-primary/80">1… / bc1…</span><span>Bitcoin ·</span>
        <span className="font-mono text-primary/80">L… / ltc1…</span><span>Litecoin ·</span>
        <span className="font-mono text-primary/80">D…</span><span>Dogecoin ·</span>
        <span className="font-mono text-primary/80">bitcoincash:q…</span><span>BCH ·</span>
        <span className="font-mono text-primary/80">base58</span><span>Solana</span>
        <Bitcoin className="w-3.5 h-3.5 text-orange-400 ml-1" />
      </div>

      <Tabs defaultValue="permit">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="permit"     className="flex items-center gap-1 text-xs"><FileSignature className="w-3 h-3" /> Script</TabsTrigger>
          <TabsTrigger value="poison"     className="flex items-center gap-1 text-xs"><MapPin        className="w-3 h-3" /> Poison</TabsTrigger>
          <TabsTrigger value="approve"    className="flex items-center gap-1 text-xs"><Coins          className="w-3 h-3" /> Approvals</TabsTrigger>
          <TabsTrigger value="sigscan"    className="flex items-center gap-1 text-xs"><Fingerprint   className="w-3 h-3" /> Sig Scan</TabsTrigger>
          <TabsTrigger value="passphrase" className="flex items-center gap-1 text-xs"><KeyRound       className="w-3 h-3" /> Passphrase</TabsTrigger>
          <TabsTrigger value="zeroclk"    className="flex items-center gap-1 text-xs"><Zap            className="w-3 h-3" /> Zero-Click</TabsTrigger>
        </TabsList>
        <TabsContent value="permit"     className="mt-6"><PermitTab      /></TabsContent>
        <TabsContent value="poison"     className="mt-6"><PoisoningTab   /></TabsContent>
        <TabsContent value="approve"    className="mt-6"><ApprovalTab    /></TabsContent>
        <TabsContent value="sigscan"    className="mt-6"><SigScanTab     /></TabsContent>
        <TabsContent value="passphrase" className="mt-6"><PassphraseTab  /></TabsContent>
        <TabsContent value="zeroclk"    className="mt-6"><ZeroThreatTab  /></TabsContent>
      </Tabs>
    </div>
  );
}
