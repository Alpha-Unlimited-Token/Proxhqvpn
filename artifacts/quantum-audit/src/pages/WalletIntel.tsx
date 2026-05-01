import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle, Loader2,
  FileSignature, MapPin, Coins, ExternalLink, Copy, Clock,
  Flame, Info, ChevronDown, ChevronUp, Activity,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CHAINS = [
  { id: "ethereum", label: "Ethereum"  },
  { id: "polygon",  label: "Polygon"   },
  { id: "arbitrum", label: "Arbitrum"  },
  { id: "optimism", label: "Optimism"  },
  { id: "bsc",      label: "BNB Chain" },
];

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
  const [chain, setChain]     = useState("ethereum");
  const { toast } = useToast();

  const mutation = useMutation<PermitResult, Error, { address: string; chain: string }>({
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSignature className="w-5 h-5 text-orange-400" />
            Permit & Blind-Signature Exploit Scanner
          </CardTitle>
          <CardDescription>
            Detects EIP-2612 permit() abuse, setApprovalForAll drainer patterns, and unlimited token
            approvals — the #1 attack vector used by wallet drainers in 2026.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="0x… wallet address"
              value={address} onChange={e => setAddress(e.target.value)}
              className="flex-1 min-w-[260px] font-mono text-sm"
            />
            <Select value={chain} onValueChange={setChain}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHAINS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => mutation.mutate({ address: address.trim(), chain })}
              disabled={!address.trim() || mutation.isPending}>
              {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning…</> : "Run Scan"}
            </Button>
          </div>

          <Alert className="border-orange-500/30 bg-orange-500/5">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <AlertDescription className="text-xs text-muted-foreground">
              <strong>What attackers do:</strong> They trick you into signing EIP-2612 permit() calls that look
              like wallet connection approvals. One signature — no gas — and they can drain all your tokens.
              setApprovalForAll grants permanent full control over NFT collections.
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
  const [chain, setChain]     = useState("ethereum");
  const { toast } = useToast();

  const mutation = useMutation<PoisoningResult, Error, { address: string; chain: string }>({
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="w-5 h-5 text-purple-400" />
            Address Poisoning Detector
          </CardTitle>
          <CardDescription>
            Finds near-identical vanity addresses sent to your wallet history. Attackers create addresses
            matching your first/last chars so you accidentally paste theirs when sending funds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="0x… wallet address to audit"
              value={address} onChange={e => setAddress(e.target.value)}
              className="flex-1 min-w-[260px] font-mono text-sm"
            />
            <Select value={chain} onValueChange={setChain}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHAINS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => mutation.mutate({ address: address.trim(), chain })}
              disabled={!address.trim() || mutation.isPending}>
              {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning…</> : "Run Scan"}
            </Button>
          </div>

          <Alert className="border-purple-500/30 bg-purple-500/5">
            <Info className="w-4 h-4 text-purple-400" />
            <AlertDescription className="text-xs text-muted-foreground">
              <strong>How it works:</strong> Attackers use vanity address generators to create addresses like
              <code className="mx-1 bg-muted px-1 rounded">0x8e04…<strong>FAKE</strong>…5748</code> that match
              your address's start/end. They send tiny dust transfers to pollute your history.
              Victims copy the wrong address and send real funds to the attacker.
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
  const [chain, setChain]     = useState("ethereum");
  const { toast } = useToast();

  const mutation = useMutation<ApprovalResult, Error, { address: string; chain: string }>({
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="w-5 h-5 text-yellow-400" />
            Token Approval Risk Auditor
          </CardTitle>
          <CardDescription>
            Audits all ERC-20 / ERC-721 / ERC-1155 approvals for stale unlimited permissions.
            Unlimited allowances left open after DeFi interactions are the most exploited attack surface.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="0x… wallet address to audit"
              value={address} onChange={e => setAddress(e.target.value)}
              className="flex-1 min-w-[260px] font-mono text-sm"
            />
            <Select value={chain} onValueChange={setChain}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHAINS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => mutation.mutate({ address: address.trim(), chain })}
              disabled={!address.trim() || mutation.isPending}>
              {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning…</> : "Run Audit"}
            </Button>
          </div>

          <Alert className="border-yellow-500/30 bg-yellow-500/5">
            <Info className="w-4 h-4 text-yellow-400" />
            <AlertDescription className="text-xs text-muted-foreground">
              <strong>The risk:</strong> Every time you use a DeFi protocol you leave an approval behind.
              If that protocol is later hacked, the attacker can drain your tokens without any further
              action from you. Unlimited approvals are permanent until explicitly revoked.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
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
        </div>
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
          Uses the same techniques attackers use — so developers and users can find and fix exposures before they're exploited.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: FileSignature, color: "text-orange-400", label: "Permit / Blind Signing",   desc: "EIP-2612 permit() abuse & drainer approvals" },
          { icon: MapPin,        color: "text-purple-400", label: "Address Poisoning",          desc: "Vanity lookalike addresses in tx history" },
          { icon: Coins,         color: "text-yellow-400", label: "Approval Risk Audit",        desc: "Stale unlimited ERC-20/NFT approvals" },
        ].map(({ icon: Icon, color, label, desc }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="pt-5 flex items-start gap-3">
              <Icon className={`w-5 h-5 mt-0.5 ${color}`} />
              <div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="permit">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="permit"   className="flex items-center gap-1.5"><FileSignature className="w-3.5 h-3.5" /> Permit Scan</TabsTrigger>
          <TabsTrigger value="poison"  className="flex items-center gap-1.5"><MapPin        className="w-3.5 h-3.5" /> Poisoning</TabsTrigger>
          <TabsTrigger value="approve" className="flex items-center gap-1.5"><Coins          className="w-3.5 h-3.5" /> Approvals</TabsTrigger>
        </TabsList>
        <TabsContent value="permit"   className="mt-6"><PermitTab   /></TabsContent>
        <TabsContent value="poison"   className="mt-6"><PoisoningTab /></TabsContent>
        <TabsContent value="approve"  className="mt-6"><ApprovalTab  /></TabsContent>
      </Tabs>
    </div>
  );
}
