// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Wallet, Search, AlertTriangle, CheckCircle, Activity,
  Globe, Copy, ExternalLink, ChevronDown, ChevronUp, Loader2,
  Shield, Key, RefreshCw, Network, Hash, Clock, Layers,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CHAINS = [
  { id: "ethereum", label: "Ethereum" },
  { id: "polygon",  label: "Polygon"  },
  { id: "arbitrum", label: "Arbitrum" },
  { id: "optimism", label: "Optimism" },
  { id: "base",     label: "Base"     },
  { id: "bsc",      label: "BNB Chain"},
];

interface ChainNonce {
  chain: string; label: string; nonce: number; balanceEth: number; active: boolean; error?: string;
}
interface MultiChainResult { address: string; chains: ChainNonce[]; activeChains: string[] }

interface OutgoingTx {
  hash: string; blockNumber: number; timestamp: string;
  to: string; valueEth: number; asset: string; category: string;
  nonce: number | null; r: string | null; s: string | null; v: number | null;
}
interface OutgoingResult {
  address: string; chain: string; chainLabel: string; nonce: number;
  balanceEth: number; totalFetched: number; source: string;
  error: string | null; outgoingTxs: OutgoingTx[];
}

interface RDuplicate { r: string; count: number; hashes: string[]; zValues: string[] }
interface SDuplicate { s: string; count: number; hashes: string[] }
interface NonceReusePair { nonce: number; hashes: string[] }
interface SigScanResult {
  address: string; chain: string; chainLabel: string; nonce: number;
  balanceEth: number; source: string;
  totalTxsFetched: number; sigsAnalyzed: number;
  nonceReuseFound: boolean; nonceReusePairs: NonceReusePair[];
  rValueDuplicates: RDuplicate[]; sValueDuplicates: SDuplicate[];
  weakKCandidates: string[]; keyRecovered: string | null;
  summary: string; durationMs: number; error: string | null;
}

type JobStatus = "pending" | "running" | "done" | "error";
interface ScanJob {
  jobId: string; address: string; chain: string; status: JobStatus;
  phase: string; progress: { enriched: number; total: number };
  startedAt: number; finishedAt?: number; durationMs?: number; elapsedMs: number;
  result: SigScanResult | null; error: string | null; recentLog: string[];
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function shortHash(h: string) {
  return h ? `${h.slice(0, 10)}…${h.slice(-8)}` : "";
}

function fmtDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function WalletScanner() {
  const { toast } = useToast();
  const [address, setAddress]       = useState("");
  const [chain, setChain]           = useState("ethereum");
  const [enrichSigs, setEnrichSigs] = useState(false);
  const [activeTab, setActiveTab]   = useState("multi-chain");
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [jobId, setJobId]           = useState<string | null>(null);

  const isValid = /^0x[0-9a-fA-F]{40}$/.test(address);

  // ── Multi-chain quick check ──────────────────────────────────────────────────
  const multiChain = useQuery<MultiChainResult>({
    queryKey: ["wallet-multi-chain", address],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/wallet/multi-chain?address=${address}`);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    enabled: false,
  });

  // ── Outgoing transactions ────────────────────────────────────────────────────
  const outgoing = useQuery<OutgoingResult>({
    queryKey: ["wallet-outgoing", address, chain, enrichSigs],
    queryFn: async () => {
      const r = await fetch(
        `${BASE}/api/wallet/outgoing?address=${address}&chain=${chain}&enrichSigs=${enrichSigs}`,
      );
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    enabled: false,
  });

  // ── Background signature scan job ────────────────────────────────────────────
  // Step 1: POST /api/wallet/scan-job — fires instantly, returns jobId
  const startJob = useMutation<{ jobId: string }>({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/wallet/scan-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chain }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (d) => { setJobId(d.jobId); setActiveTab("ecdsa-scan"); },
    onError: (e) => toast({ title: "Could not start scan", description: (e as Error).message, variant: "destructive" }),
  });

  // Step 2: Poll GET /api/wallet/scan-job/:id every 3 seconds until done
  const jobPoll = useQuery<ScanJob>({
    queryKey: ["wallet-scan-job", jobId],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/wallet/scan-job/${jobId}`);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    enabled: !!jobId,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === "done" || status === "error" ? false : 3000;
    },
  });

  function runAll() {
    if (!isValid) return;
    multiChain.refetch();
    outgoing.refetch();
  }

  const isLoading = multiChain.isFetching || outgoing.isFetching;
  const job       = jobPoll.data;
  const scanData  = job?.result ?? null;
  // sigScan compat shim so existing render code still works
  const sigScan   = {
    data:      scanData,
    isPending: startJob.isPending || (!!jobId && job?.status === "running") || (!!jobId && job?.status === "pending"),
    mutate:    () => startJob.mutate(),
    reset:     () => { startJob.reset(); setJobId(null); },
  };

  const hasCritical = !!(scanData?.keyRecovered || scanData?.nonceReuseFound || (scanData?.rValueDuplicates?.length ?? 0) > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wallet Scanner</h1>
          <p className="text-muted-foreground mt-1">
            Multi-chain outgoing transaction discovery, batch ECDSA signature extraction, and nonce / r-value reuse analysis.
          </p>
        </div>
      </div>

      {/* Search bar */}
      <Card className="bg-card/40 border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="0x… EVM wallet address"
                value={address}
                onChange={e => setAddress(e.target.value.trim())}
                className="font-mono text-sm"
              />
              {address && !isValid && (
                <p className="text-destructive text-xs mt-1">Must be a valid 0x EVM address (42 chars)</p>
              )}
            </div>
            <Select value={chain} onValueChange={setChain}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Chain" />
              </SelectTrigger>
              <SelectContent>
                {CHAINS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              onClick={runAll}
              disabled={!isValid || isLoading}
              className="gap-2 shrink-0"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Scan Wallet
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="multi-chain">
            <Network className="h-4 w-4 mr-2" /> Multi-Chain
          </TabsTrigger>
          <TabsTrigger value="outgoing">
            <Activity className="h-4 w-4 mr-2" /> Outgoing Txs
          </TabsTrigger>
          <TabsTrigger value="ecdsa-scan" className="relative">
            <Shield className="h-4 w-4 mr-2" /> ECDSA Scan
            {sigScan.isPending && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
            )}
            {hasCritical && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Multi-chain tab ─────────────────────────────────────────────────── */}
        <TabsContent value="multi-chain" className="space-y-4 mt-4">
          {multiChain.isFetching && (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Checking all chains…
            </div>
          )}
          {multiChain.data && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="h-4 w-4" />
                Active on {multiChain.data.activeChains.length} of {CHAINS.length} chains
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {multiChain.data.chains.map(c => (
                  <Card key={c.chain} className={`bg-card/40 border-border ${c.active ? "border-primary/40" : ""}`}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">{c.label}</span>
                        <Badge variant={c.active ? "default" : "secondary"} className="text-xs">
                          {c.active ? "Active" : "No txs"}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground font-mono">
                        <div className="flex justify-between">
                          <span>Nonce (outgoing txs)</span>
                          <span className={c.nonce > 0 ? "text-primary font-bold" : ""}>{c.nonce.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Balance (native)</span>
                          <span>{c.balanceEth.toFixed(6)}</span>
                        </div>
                      </div>
                      {c.error && <p className="text-destructive text-[10px] mt-1">{c.error}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {!multiChain.data && !multiChain.isFetching && (
            <div className="text-center py-12 text-muted-foreground">
              <Network className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Enter a wallet address and click Scan Wallet to check all 6 chains at once.</p>
            </div>
          )}
        </TabsContent>

        {/* ── Outgoing txs tab ────────────────────────────────────────────────── */}
        <TabsContent value="outgoing" className="space-y-4 mt-4">
          <div className="flex items-center gap-2 justify-between">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enrichSigs}
                onChange={e => setEnrichSigs(e.target.checked)}
                className="rounded"
              />
              Enrich with r/s/v signatures (slower)
            </label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => outgoing.refetch()}
              disabled={!isValid || outgoing.isFetching}
              className="gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${outgoing.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {outgoing.isFetching && (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Fetching all outgoing transactions (paginated)…
            </div>
          )}

          {outgoing.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Nonce (total sent)", value: outgoing.data.nonce.toLocaleString(), highlight: outgoing.data.nonce > 0 },
                  { label: "Txs retrieved",      value: outgoing.data.totalFetched.toLocaleString(), highlight: false },
                  { label: "Balance (native)",   value: outgoing.data.balanceEth.toFixed(4), highlight: false },
                  { label: "Data source",        value: outgoing.data.source.toUpperCase(), highlight: false },
                ].map(s => (
                  <Card key={s.label} className="bg-card/40 border-border">
                    <CardContent className="pt-3 pb-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                      <div className={`font-mono font-bold text-lg mt-0.5 ${s.highlight ? "text-primary" : ""}`}>{s.value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {outgoing.data.error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{outgoing.data.error}</AlertDescription>
                </Alert>
              )}

              {outgoing.data.outgoingTxs.length > 0 ? (
                <Card className="bg-card/40 border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Outgoing Transactions ({outgoing.data.outgoingTxs.length})</CardTitle>
                    <CardDescription>Sorted newest → oldest. Click a row to expand signature detail.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[420px] pr-2">
                      <div className="space-y-1">
                        {outgoing.data.outgoingTxs.map((tx) => (
                          <div key={tx.hash} className="border border-border/50 rounded-md overflow-hidden">
                            <button
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/30 transition-colors text-left"
                              onClick={() => setExpandedTx(expandedTx === tx.hash ? null : tx.hash)}
                            >
                              <span className="font-mono text-muted-foreground text-[10px] w-8 shrink-0 text-right">
                                {tx.nonce ?? "—"}
                              </span>
                              <span className="font-mono text-xs text-primary flex-1">{shortHash(tx.hash)}</span>
                              <span className="text-xs">{tx.valueEth.toFixed(4)} {tx.asset}</span>
                              <span className="text-[10px] text-muted-foreground hidden sm:block">
                                {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : "—"}
                              </span>
                              {tx.r ? (
                                <Badge variant="outline" className="text-[9px] text-green-500 border-green-500/30">r/s ✓</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px]">no sig</Badge>
                              )}
                              {expandedTx === tx.hash ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                            {expandedTx === tx.hash && (
                              <div className="px-3 pb-3 pt-1 bg-muted/10 space-y-1.5 text-[11px] font-mono">
                                <div className="flex gap-2 items-center">
                                  <span className="text-muted-foreground w-12">hash</span>
                                  <span className="text-primary break-all">{tx.hash}</span>
                                  <button onClick={() => copyToClipboard(tx.hash)}><Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" /></button>
                                </div>
                                <div className="flex gap-2">
                                  <span className="text-muted-foreground w-12">to</span>
                                  <span className="break-all">{tx.to}</span>
                                </div>
                                <div className="flex gap-2">
                                  <span className="text-muted-foreground w-12">block</span>
                                  <span>{tx.blockNumber?.toLocaleString()}</span>
                                </div>
                                {tx.r && <>
                                  <Separator className="my-1" />
                                  <div className="flex gap-2">
                                    <span className="text-muted-foreground w-12">r</span>
                                    <span className="break-all text-yellow-400">{tx.r}</span>
                                    <button onClick={() => copyToClipboard(tx.r!)}><Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" /></button>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className="text-muted-foreground w-12">s</span>
                                    <span className="break-all text-orange-400">{tx.s}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className="text-muted-foreground w-12">v</span>
                                    <span>{tx.v}</span>
                                  </div>
                                </>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              ) : outgoing.data.nonce === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    Nonce = 0 — this wallet has <strong>never sent a transaction</strong>. No outgoing signature data exists on-chain.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>No outgoing transactions returned by Blockscout for this chain.</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {!outgoing.data && !outgoing.isFetching && (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Scan a wallet to fetch its complete outgoing transaction history.</p>
              <p className="text-xs mt-1">Uses Blockscout (free, fully paginated) as primary source.</p>
            </div>
          )}
        </TabsContent>

        {/* ── ECDSA scan tab ───────────────────────────────────────────────────── */}
        <TabsContent value="ecdsa-scan" className="space-y-4 mt-4">
          {/* Controls */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Layers className="h-4 w-4" />
              Scans run inside the server — navigate away freely, come back and results will be here.
            </div>
            <div className="flex gap-2">
              {jobId && (
                <Button variant="outline" size="sm" onClick={() => sigScan.reset()} disabled={sigScan.isPending} className="gap-2">
                  <RefreshCw className="h-3 w-3" /> New scan
                </Button>
              )}
              <Button
                onClick={() => startJob.mutate()}
                disabled={!isValid || sigScan.isPending}
                variant="destructive"
                className="gap-2"
              >
                {sigScan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                {jobId ? "Re-run ECDSA Scan" : "Run ECDSA Scan"}
              </Button>
            </div>
          </div>

          {/* Live job progress card */}
          {job && (job.status === "running" || job.status === "pending") && (
            <Card className="bg-card/40 border-primary/30">
              <CardContent className="py-6">
                <div className="flex flex-col items-center gap-4 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      {job.status === "pending" ? "Queued…" : `Running — ${job.phase}`}
                    </p>
                    {job.progress.total > 0 && (
                      <div className="w-64 mx-auto">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{job.progress.enriched.toLocaleString()} enriched</span>
                          <span>{job.progress.total.toLocaleString()} total</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (job.progress.enriched / job.progress.total) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Elapsed: {fmtDuration(job.elapsedMs)} · polling every 3s · job runs in the background server, not here
                    </p>
                  </div>
                  {job.recentLog.length > 0 && (
                    <div className="w-full max-w-md text-left">
                      <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Recent activity</p>
                      <div className="font-mono text-[9px] space-y-0.5 text-muted-foreground">
                        {job.recentLog.slice(-5).map((l, i) => (
                          <div key={i} className="truncate">{l}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Job error */}
          {job?.status === "error" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Scan failed: {job.error}</AlertDescription>
            </Alert>
          )}

          {/* Empty state — no job yet */}
          {!jobId && !startJob.isPending && (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">ECDSA Nonce-Reuse &amp; Key Recovery Scanner</p>
              <p className="text-xs mt-2 max-w-sm mx-auto">
                Pages all {(33590).toLocaleString()} outgoing txs, batch-fetches r/s/v via JSON-RPC,
                then checks for r-value collisions, weak-k, and nonce reuse. The scan runs
                entirely inside the persistent API server — you can navigate away and come back.
              </p>
            </div>
          )}

          {scanData && (
            <div className="space-y-4">
              {/* Summary banner */}
              <Alert variant={hasCritical ? "destructive" : "default"} className="border-2">
                {hasCritical ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                <AlertDescription className="font-semibold text-base">{scanData.summary}</AlertDescription>
              </Alert>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {[
                  { label: "Nonce",        value: scanData.nonce.toLocaleString(),          hi: scanData.nonce > 0 },
                  { label: "Txs fetched",  value: scanData.totalTxsFetched.toLocaleString(), hi: false },
                  { label: "Sigs analyzed",value: scanData.sigsAnalyzed.toLocaleString(),   hi: false },
                  { label: "R-collisions", value: scanData.rValueDuplicates.length.toString(), hi: scanData.rValueDuplicates.length > 0 },
                  { label: "Nonce reuse",  value: scanData.nonceReusePairs?.length?.toString() ?? "0", hi: scanData.nonceReuseFound },
                  { label: "Duration",     value: fmtDuration(scanData.durationMs),         hi: false },
                ].map(s => (
                  <Card key={s.label} className={`bg-card/40 border-border ${s.hi ? "border-destructive/50" : ""}`}>
                    <CardContent className="pt-3 pb-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                      <div className={`font-mono font-bold text-lg mt-0.5 ${s.hi ? "text-destructive" : ""}`}>{s.value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Key recovered */}
              {scanData.keyRecovered && (
                <Alert variant="destructive" className="border-2 border-destructive">
                  <Key className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-bold text-lg mb-2">🔑 PRIVATE KEY RECOVERED</div>
                    <code className="text-sm break-all font-mono bg-destructive/20 px-2 py-1 rounded">{scanData.keyRecovered}</code>
                    <button onClick={() => copyToClipboard(scanData.keyRecovered!)} className="ml-2 inline-flex items-center gap-1 text-xs opacity-70 hover:opacity-100">
                      <Copy className="h-3 w-3" /> copy
                    </button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Nonce reuse */}
              {scanData.nonceReuseFound && (scanData.nonceReusePairs?.length ?? 0) > 0 && (
                <Card className="bg-card/40 border-destructive/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-destructive flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Nonce Reuse Detected ({scanData.nonceReusePairs.length} nonce{scanData.nonceReusePairs.length > 1 ? "s" : ""})
                    </CardTitle>
                    <CardDescription>
                      Multiple transactions share the same nonce. This is a critical ECDSA vulnerability — if both signed with the same k, the private key is directly computable.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[220px]">
                      <div className="space-y-2">
                        {scanData.nonceReusePairs.map(p => (
                          <div key={p.nonce} className="rounded bg-destructive/10 border border-destructive/30 p-3 text-xs font-mono">
                            <div className="text-destructive font-bold mb-1">nonce = {p.nonce} — {p.hashes.length} transactions</div>
                            {p.hashes.map(h => (
                              <div key={h} className="flex items-center gap-2 text-muted-foreground mt-0.5">
                                <span className="text-foreground">{shortHash(h)}</span>
                                <button onClick={() => copyToClipboard(h)}><Copy className="h-3 w-3" /></button>
                                <a href={`https://etherscan.io/tx/${h}`} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* R-value duplicates */}
              {scanData.rValueDuplicates.length > 0 && (
                <Card className="bg-card/40 border-destructive/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-destructive flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      r-Value Collisions ({scanData.rValueDuplicates.length})
                    </CardTitle>
                    <CardDescription>
                      Same r-value across multiple transactions = same ECDSA k nonce reused = private key extractable via arithmetic.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[260px]">
                      <div className="space-y-3">
                        {scanData.rValueDuplicates.map((d, i) => (
                          <div key={i} className="rounded bg-destructive/10 border border-destructive/30 p-3 text-xs font-mono">
                            <div className="text-destructive font-bold mb-1 break-all">
                              r = {shortHash(d.r)} &nbsp;(×{d.count})
                            </div>
                            {d.hashes.map(h => (
                              <div key={h} className="flex items-center gap-2 text-muted-foreground mt-0.5">
                                <span className="text-foreground">{shortHash(h)}</span>
                                <button onClick={() => copyToClipboard(h)}><Copy className="h-3 w-3" /></button>
                                <a href={`https://etherscan.io/tx/${h}`} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* s-value duplicates */}
              {scanData.sValueDuplicates.length > 0 && (
                <Card className="bg-card/40 border-yellow-500/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-yellow-500 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      s-Value Duplicates ({scanData.sValueDuplicates.length})
                    </CardTitle>
                    <CardDescription>Same s-value reuse (unusual but may indicate deterministic signing or library bug).</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {scanData.sValueDuplicates.slice(0, 10).map((d, i) => (
                        <div key={i} className="rounded bg-yellow-500/10 border border-yellow-500/30 p-2 text-xs font-mono">
                          <span className="text-yellow-400">{shortHash(d.s)}</span>
                          <span className="text-muted-foreground ml-2">×{d.count} txs</span>
                        </div>
                      ))}
                      {scanData.sValueDuplicates.length > 10 && (
                        <p className="text-xs text-muted-foreground">…and {scanData.sValueDuplicates.length - 10} more</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Weak k */}
              {scanData.weakKCandidates.length > 0 && (
                <Card className="bg-card/40 border-yellow-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-yellow-400 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Weak-k Candidates ({scanData.weakKCandidates.length})
                    </CardTitle>
                    <CardDescription>r value {"<"} 0x1000000 — the k nonce may be brute-forceable in ~2²⁴ operations.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {scanData.weakKCandidates.slice(0, 20).map(h => (
                        <div key={h} className="font-mono text-xs text-yellow-400 flex items-center gap-2">
                          <span>{shortHash(h)}</span>
                          <button onClick={() => copyToClipboard(h)}><Copy className="h-3 w-3 opacity-60" /></button>
                          <a href={`https://etherscan.io/tx/${h}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        </div>
                      ))}
                      {scanData.weakKCandidates.length > 20 && (
                        <p className="text-xs text-muted-foreground">…and {scanData.weakKCandidates.length - 20} more</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Clean result */}
              {!scanData.keyRecovered && !scanData.nonceReuseFound && scanData.rValueDuplicates.length === 0 && scanData.weakKCandidates.length === 0 && scanData.sigsAnalyzed > 0 && (
                <Card className="bg-card/40 border-border">
                  <CardContent className="py-8 text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <p className="font-semibold text-lg">No signature vulnerabilities detected</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {scanData.sigsAnalyzed.toLocaleString()} signatures analyzed across {scanData.totalTxsFetched.toLocaleString()} outgoing transactions — all r-values and nonces are unique.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3" /> Completed in {fmtDuration(scanData.durationMs)}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* No sigs but txs listed */}
              {scanData.sigsAnalyzed === 0 && scanData.totalTxsFetched > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Listed {scanData.totalTxsFetched.toLocaleString()} outgoing txs but could not enrich any with r/s/v. The RPC endpoints may be rate-limiting. Try again or reduce scan depth to Sample.
                  </AlertDescription>
                </Alert>
              )}

              {scanData.error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{scanData.error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {!scanData && !sigScan.isPending && (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Click "Run ECDSA Analysis" to perform a full signature audit.</p>
              <p className="text-xs mt-2 max-w-sm mx-auto">
                <strong>Sample</strong> = first 1,000 txs, fast (~30s). <strong>Full scan</strong> = all transactions, comprehensive (2–5 min for 33k+ tx wallets). Uses batch JSON-RPC for efficiency.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
