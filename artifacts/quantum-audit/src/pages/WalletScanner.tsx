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
  Shield, Key, RefreshCw, Network,
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
interface SigScanResult {
  address: string; chain: string; chainLabel: string; nonce: number;
  balanceEth: number; source: string; totalTxsFetched: number;
  sigsAnalyzed: number; rValueDuplicates: RDuplicate[]; sValueDuplicates: SDuplicate[];
  weakKCandidates: string[]; keyRecovered: string | null; summary: string; error: string | null;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function shortHash(h: string) {
  return h ? `${h.slice(0, 10)}…${h.slice(-8)}` : "";
}

export default function WalletScanner() {
  const { toast } = useToast();
  const [address, setAddress]       = useState("");
  const [chain, setChain]           = useState("ethereum");
  const [enrichSigs, setEnrichSigs] = useState(false);
  const [activeTab, setActiveTab]   = useState("multi-chain");
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

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

  // ── Signature scan (mutation — can take a while) ─────────────────────────────
  const sigScan = useMutation<SigScanResult>({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/wallet/signature-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chain, enrichLimit: 500 }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onError: (e) => toast({ title: "Scan failed", description: (e as Error).message, variant: "destructive" }),
  });

  function runAll() {
    if (!isValid) return;
    multiChain.refetch();
    outgoing.refetch();
  }

  const isLoading = multiChain.isFetching || outgoing.isFetching;

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
            Multi-chain outgoing transaction discovery, ECDSA signature extraction, and nonce-reuse analysis.
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
          <TabsTrigger value="sig-scan">
            <Shield className="h-4 w-4 mr-2" /> Sig Scan
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
                          <span>Balance</span>
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
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enrichSigs}
                  onChange={e => setEnrichSigs(e.target.checked)}
                  className="rounded"
                />
                Enrich with r/s/v signatures (slower)
              </label>
            </div>
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
              {/* Summary bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Nonce (total sent)", value: outgoing.data.nonce.toLocaleString(), highlight: outgoing.data.nonce > 0 },
                  { label: "Txs retrieved", value: outgoing.data.totalFetched.toLocaleString(), highlight: false },
                  { label: "Balance (native)", value: outgoing.data.balanceEth.toFixed(4), highlight: false },
                  { label: "Data source", value: outgoing.data.source.toUpperCase(), highlight: false },
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

              {outgoing.data.nonce === 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    This wallet has <strong>never sent a transaction</strong> (nonce = 0). No outgoing signature data exists on-chain.
                  </AlertDescription>
                </Alert>
              )}

              {/* Transaction list */}
              {outgoing.data.outgoingTxs.length > 0 && (
                <Card className="bg-card/40 border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Outgoing Transactions ({outgoing.data.outgoingTxs.length})</CardTitle>
                    <CardDescription>Sorted oldest → newest. Click a row to expand signature details.</CardDescription>
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
                              <span className="font-mono text-muted-foreground text-[10px] w-6 shrink-0">
                                {tx.nonce ?? "—"}
                              </span>
                              <span className="font-mono text-xs text-primary flex-1">{shortHash(tx.hash)}</span>
                              <span className="text-xs">{tx.valueEth.toFixed(4)} {tx.asset}</span>
                              <span className="text-[10px] text-muted-foreground">{tx.category}</span>
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
                                  <button onClick={() => copyToClipboard(tx.hash)}>
                                    <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                  </button>
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
                                    <button onClick={() => copyToClipboard(tx.r!)}>
                                      <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                    </button>
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
              )}
            </div>
          )}

          {!outgoing.data && !outgoing.isFetching && (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Scan a wallet to fetch its complete outgoing transaction history.</p>
              <p className="text-xs mt-1">Uses Blockscout (free) or Alchemy if API key is configured. Full pagination — all transactions, not just recent ones.</p>
            </div>
          )}
        </TabsContent>

        {/* ── Sig scan tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="sig-scan" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Fetches all outgoing txs, pulls r/s/v from RPC, then checks for nonce-reuse (k collision), duplicate r-values, and weak-k candidates.
            </p>
            <Button
              onClick={() => sigScan.mutate()}
              disabled={!isValid || sigScan.isPending}
              variant="destructive"
              className="gap-2 shrink-0"
            >
              {sigScan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              Run Sig Analysis
            </Button>
          </div>

          {sigScan.isPending && (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              Running full ECDSA analysis — fetching all outgoing txs and enriching signatures…
            </div>
          )}

          {sigScan.data && (
            <div className="space-y-4">
              {/* Summary */}
              <Alert variant={sigScan.data.keyRecovered ? "destructive" : sigScan.data.rValueDuplicates.length > 0 ? "destructive" : "default"}>
                {sigScan.data.keyRecovered || sigScan.data.rValueDuplicates.length > 0
                  ? <AlertTriangle className="h-4 w-4" />
                  : <CheckCircle className="h-4 w-4" />}
                <AlertDescription className="font-medium">{sigScan.data.summary}</AlertDescription>
              </Alert>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Nonce", value: sigScan.data.nonce.toLocaleString() },
                  { label: "Txs Fetched", value: sigScan.data.totalTxsFetched.toLocaleString() },
                  { label: "Sigs Analyzed", value: sigScan.data.sigsAnalyzed.toLocaleString() },
                  { label: "Source", value: sigScan.data.source.toUpperCase() },
                ].map(s => (
                  <Card key={s.label} className="bg-card/40 border-border">
                    <CardContent className="pt-3 pb-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                      <div className="font-mono font-bold text-lg mt-0.5">{s.value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Key recovered */}
              {sigScan.data.keyRecovered && (
                <Alert variant="destructive">
                  <Key className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-bold mb-1">⚠️ PRIVATE KEY RECOVERED</div>
                    <code className="text-xs break-all font-mono">{sigScan.data.keyRecovered}</code>
                    <button onClick={() => copyToClipboard(sigScan.data.keyRecovered!)} className="ml-2 inline-flex">
                      <Copy className="h-3 w-3" />
                    </button>
                  </AlertDescription>
                </Alert>
              )}

              {/* R-value duplicates */}
              {sigScan.data.rValueDuplicates.length > 0 && (
                <Card className="bg-card/40 border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-destructive">
                      R-Value Collisions ({sigScan.data.rValueDuplicates.length})
                    </CardTitle>
                    <CardDescription>Same r used across multiple txs = same k nonce = private key extractable</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {sigScan.data.rValueDuplicates.map((d, i) => (
                        <div key={i} className="rounded bg-destructive/10 border border-destructive/30 p-3 text-xs font-mono">
                          <div className="text-destructive font-bold mb-1">r = {shortHash(d.r)} (×{d.count})</div>
                          {d.hashes.map(h => (
                            <div key={h} className="flex items-center gap-2 text-muted-foreground">
                              <span>{shortHash(h)}</span>
                              <button onClick={() => copyToClipboard(h)}><Copy className="h-3 w-3" /></button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Weak k */}
              {sigScan.data.weakKCandidates.length > 0 && (
                <Card className="bg-card/40 border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-yellow-500">
                      Weak-k Candidates ({sigScan.data.weakKCandidates.length})
                    </CardTitle>
                    <CardDescription>r value {"<"} 2^24 — nonce k may be brute-forceable</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {sigScan.data.weakKCandidates.slice(0, 20).map(h => (
                        <div key={h} className="font-mono text-xs text-yellow-400 flex items-center gap-2">
                          <span>{shortHash(h)}</span>
                          <button onClick={() => copyToClipboard(h)}><Copy className="h-3 w-3 opacity-60" /></button>
                        </div>
                      ))}
                      {sigScan.data.weakKCandidates.length > 20 && (
                        <p className="text-xs text-muted-foreground mt-1">…and {sigScan.data.weakKCandidates.length - 20} more</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Clean result */}
              {!sigScan.data.keyRecovered && sigScan.data.rValueDuplicates.length === 0 && sigScan.data.weakKCandidates.length === 0 && sigScan.data.sigsAnalyzed > 0 && (
                <Card className="bg-card/40 border-border">
                  <CardContent className="py-6 text-center">
                    <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
                    <p className="font-medium">No signature vulnerabilities detected</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {sigScan.data.sigsAnalyzed} signatures analyzed — all r-values and s-values are unique.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {!sigScan.data && !sigScan.isPending && (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Click "Run Sig Analysis" to perform a full ECDSA nonce-reuse audit.</p>
              <p className="text-xs mt-1">This is the deepest check — may take 30–120 seconds depending on tx count.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
