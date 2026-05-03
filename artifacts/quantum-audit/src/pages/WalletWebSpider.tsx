// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Globe, Wallet, ShieldAlert, ShieldCheck, Loader2, AlertTriangle,
  Copy, ExternalLink, ChevronDown, ChevronUp, Network, Search,
  Radio, Flame, Info, CheckCircle, Activity, Link2, MapPin,
  Bitcoin, Zap, Eye, TriangleAlert,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────

type VulnSeverity = "critical" | "high" | "medium" | "low" | "info";
type WalletFindKind =
  | "solana_address" | "evm_address" | "bitcoin_address"
  | "litecoin_address" | "dogecoin_address" | "bitcoincash_address";

interface WebWalletFind {
  kind:         WalletFindKind;
  address:      string;
  chain:        string;
  url:          string;
  context:      string;
  depth:        number;
  discoveredAt: string;
}

interface WalletVulnFinding {
  address:     string;
  chain:       string;
  scanType:    string;
  severity:    VulnSeverity;
  title:       string;
  detail:      string;
  remediation: string;
  riskScore:   number;
}

interface NodeLink {
  fromAddress:  string;
  toAddress:    string;
  chain:        string;
  txCount:      number;
  relation:     string;
}

interface WalletSpiderReport {
  urlsVisited:       number;
  walletsDiscovered: number;
  walletsScanned:    number;
  webFinds:          WebWalletFind[];
  byChain:           Record<string, number>;
  vulnFindings:      WalletVulnFinding[];
  vulnSummary:       Record<VulnSeverity, number>;
  nodeLinks:         NodeLink[];
  errors:            number;
  scannedAt:         string;
  durationMs:        number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CHAIN_COLORS: Record<string, string> = {
  solana:    "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ethereum:  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  evm:       "bg-blue-500/20 text-blue-400 border-blue-500/30",
  bitcoin:   "bg-orange-500/20 text-orange-400 border-orange-500/30",
  litecoin:  "bg-slate-500/20 text-slate-400 border-slate-500/30",
  dogecoin:  "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const SEV_COLORS: Record<VulnSeverity, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high:     "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium:   "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low:      "bg-blue-500/20 text-blue-400 border-blue-500/30",
  info:     "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

const KIND_ICONS: Record<WalletFindKind, React.ElementType> = {
  solana_address:      Radio,
  evm_address:         Zap,
  bitcoin_address:     Bitcoin,
  litecoin_address:    Bitcoin,
  dogecoin_address:    Bitcoin,
  bitcoincash_address: Bitcoin,
};

function shortAddr(a: string) {
  if (!a) return "";
  return a.length > 20 ? `${a.slice(0, 10)}…${a.slice(-8)}` : a;
}

function fmtDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function copy(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function explorerUrl(address: string, chain: string) {
  const map: Record<string, string> = {
    solana:   `https://solscan.io/account/${address}`,
    ethereum: `https://etherscan.io/address/${address}`,
    bitcoin:  `https://mempool.space/address/${address}`,
    litecoin: `https://litecoinblockexplorer.net/address/${address}`,
    dogecoin: `https://dogechain.info/address/${address}`,
  };
  return map[chain] ?? `https://solscan.io/account/${address}`;
}

function SeverityBadge({ sev }: { sev: VulnSeverity }) {
  return (
    <Badge variant="outline" className={`text-xs font-mono ${SEV_COLORS[sev]}`}>
      {sev.toUpperCase()}
    </Badge>
  );
}

function ChainBadge({ chain }: { chain: string }) {
  const cls = CHAIN_COLORS[chain] ?? "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  return (
    <Badge variant="outline" className={`text-xs font-mono ${cls}`}>
      {chain}
    </Badge>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 text-center">
        <p className={`text-2xl font-bold font-mono ${color ?? ""}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── VulnCard ──────────────────────────────────────────────────────────────────

function VulnCard({ f }: { f: WalletVulnFinding }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-lg border p-4 space-y-2 ${
      f.severity === "critical" ? "border-red-500/40 bg-red-500/5"
      : f.severity === "high"   ? "border-orange-500/40 bg-orange-500/5"
      : f.severity === "medium" ? "border-yellow-500/40 bg-yellow-500/5"
      : f.severity === "info"   ? "border-zinc-500/30 bg-zinc-500/5"
      : "border-blue-500/40 bg-blue-500/5"
    }`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {(f.severity === "critical" || f.severity === "high")
            ? <Flame className="w-4 h-4 text-red-400 shrink-0" />
            : f.severity === "info"
            ? <Info className="w-4 h-4 text-zinc-400 shrink-0" />
            : <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
          }
          <span className="font-semibold text-sm truncate">{f.title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ChainBadge chain={f.chain} />
          <SeverityBadge sev={f.severity} />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        <span className="font-mono">{shortAddr(f.address)}</span>
        <button onClick={() => copy(f.address)} className="hover:text-foreground transition-colors">
          <Copy className="w-3 h-3" />
        </button>
        <a href={explorerUrl(f.address, f.chain)} target="_blank" rel="noopener noreferrer"
           className="flex items-center gap-1 text-primary hover:underline">
          <ExternalLink className="w-3 h-3" /> Explorer
        </a>
        <Badge variant="outline" className="text-[10px] font-mono border-zinc-700 text-zinc-500">
          {f.scanType}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{f.detail}</p>

      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {open ? "Hide" : "Remediation"}
      </button>

      {open && (
        <div className="mt-1 p-3 rounded bg-muted/40 border border-border/50 text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground block mb-1">How to fix:</span>
          {f.remediation}
        </div>
      )}
    </div>
  );
}

// ── WalletFindRow ─────────────────────────────────────────────────────────────

function WalletFindRow({ f }: { f: WebWalletFind }) {
  const [showCtx, setShowCtx] = useState(false);
  const Icon = KIND_ICONS[f.kind] ?? Globe;
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="font-mono text-xs font-medium truncate flex-1 min-w-0">{f.address}</span>
        <ChainBadge chain={f.chain} />
        <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
          depth {f.depth}
        </Badge>
      </div>

      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
        <span className="truncate max-w-[240px]" title={f.url}>
          {f.url.startsWith("seed-input") ? "Seed address" : f.url.startsWith("on-chain:") ? "On-chain counterparty" : f.url}
        </span>
        <button onClick={() => copy(f.address)} className="hover:text-foreground transition-colors flex items-center gap-1">
          <Copy className="w-3 h-3" /> Copy
        </button>
        <a href={explorerUrl(f.address, f.chain)} target="_blank" rel="noopener noreferrer"
           className="flex items-center gap-1 text-primary hover:underline">
          <ExternalLink className="w-3 h-3" /> View
        </a>
        {f.context && (
          <button onClick={() => setShowCtx(v => !v)}
            className="hover:text-foreground transition-colors flex items-center gap-1">
            <Eye className="w-3 h-3" /> {showCtx ? "Hide" : "Context"}
          </button>
        )}
      </div>

      {showCtx && f.context && (
        <div className="text-[11px] font-mono bg-muted/50 rounded p-2 text-muted-foreground break-all leading-relaxed border border-border/40">
          {f.context}
        </div>
      )}
    </div>
  );
}

// ── NodeMapRow ────────────────────────────────────────────────────────────────

function NodeMapRow({ link }: { link: NodeLink }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3 text-xs flex-wrap">
      <span className="font-mono text-muted-foreground truncate max-w-[140px]" title={link.fromAddress}>
        {shortAddr(link.fromAddress)}
      </span>
      <div className="flex items-center gap-1 text-muted-foreground/60">
        <Link2 className="w-3 h-3" />
        <span>{link.txCount} tx{link.txCount !== 1 ? "s" : ""}</span>
      </div>
      <span className="font-mono text-foreground truncate max-w-[140px]" title={link.toAddress}>
        {shortAddr(link.toAddress)}
      </span>
      <ChainBadge chain={link.chain} />
      <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
        {link.relation}
      </Badge>
      <a href={explorerUrl(link.toAddress, link.chain)} target="_blank" rel="noopener noreferrer"
         className="ml-auto text-primary hover:underline flex items-center gap-1">
        <ExternalLink className="w-3 h-3" /> View node
      </a>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WalletWebSpider() {
  const { toast } = useToast();

  // Config state
  const [urlInput,     setUrlInput]     = useState("");
  const [addrInput,    setAddrInput]    = useState("");
  const [maxDepth,     setMaxDepth]     = useState(2);
  const [maxUrls,      setMaxUrls]      = useState(60);
  const [maxWallets,   setMaxWallets]   = useState(15);
  const [followNodes,  setFollowNodes]  = useState(true);
  const [domainFilter, setDomainFilter] = useState("");
  const [activeTab,    setActiveTab]    = useState("web-finds");

  const mutation = useMutation<WalletSpiderReport, Error, object>({
    mutationFn: async (body) => {
      const res = await fetch(`${BASE}/api/wallet-intel/wallet-web-spider`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string,unknown>;
        throw new Error(String(err.error ?? `HTTP ${res.status}`));
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Spider complete", description: "Wallet & node scan finished." });
      setActiveTab("web-finds");
    },
    onError: (e) => toast({ title: "Spider failed", description: e.message, variant: "destructive" }),
  });

  const data = mutation.data;

  function handleStart() {
    const seeds         = urlInput.split("\n").map(s => s.trim()).filter(Boolean);
    const seedAddresses = addrInput.split("\n").map(s => s.trim()).filter(Boolean);
    if (seeds.length === 0 && seedAddresses.length === 0) {
      toast({ title: "Nothing to scan", description: "Enter at least one URL or wallet address.", variant: "destructive" });
      return;
    }
    mutation.mutate({
      seeds,
      seedAddresses,
      maxDepth,
      maxUrls,
      maxWalletsToScan: maxWallets,
      followNodes,
      allowedDomains: domainFilter ? domainFilter.split(",").map(d => d.trim()).filter(Boolean) : [],
    });
  }

  const totalVulns       = data ? Object.values(data.vulnSummary).reduce((a, b) => a + b, 0) : 0;
  const criticalOrHigh   = data ? (data.vulnSummary.critical ?? 0) + (data.vulnSummary.high ?? 0) : 0;
  const hasIssues        = criticalOrHigh > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Globe className="w-7 h-7 text-primary" />
          Wallet & Node Web Spider
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Crawls websites and on-chain nodes for exposed wallet addresses, then runs full vulnerability
          scans — authority abuse, address poisoning, token-risk, signature patterns — on every address
          found. Supports Solana, EVM, Bitcoin, Litecoin, and Dogecoin automatically.
        </p>
      </div>

      {/* Config panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="w-5 h-5 text-primary" />
            Spider Configuration
          </CardTitle>
          <CardDescription>
            Provide seed URLs to crawl, direct wallet addresses to scan, or both. The spider
            extracts wallet addresses from every crawled page and runs chain-appropriate vulnerability
            scans on each one. Enable node-following to trace on-chain counterparties.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* URL seeds */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Seed URLs (one per line)
              </Label>
              <Textarea
                placeholder={"https://pastebin.com/archive\nhttps://gist.github.com/discover\nhttps://yoursite.com"}
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                className="font-mono text-xs h-28 resize-none"
              />
            </div>

            {/* Address seeds */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Seed Wallet Addresses (one per line)
              </Label>
              <Textarea
                placeholder={"3ec8R6jRaVDKVjMmrMcnoamoVCS3NHFp8ETuYMc3BBst\n0x742d35Cc6634C0532925a3b8...\n1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf..."}
                value={addrInput}
                onChange={e => setAddrInput(e.target.value)}
                className="font-mono text-xs h-28 resize-none"
              />
            </div>
          </div>

          {/* Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Crawl Depth — <span className="text-foreground font-medium">{maxDepth}</span>
              </Label>
              <Slider min={1} max={5} step={1} value={[maxDepth]}
                onValueChange={([v]) => setMaxDepth(v)} />
              <p className="text-[10px] text-muted-foreground">Hops from seed URLs</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Max URLs — <span className="text-foreground font-medium">{maxUrls}</span>
              </Label>
              <Slider min={10} max={300} step={10} value={[maxUrls]}
                onValueChange={([v]) => setMaxUrls(v)} />
              <p className="text-[10px] text-muted-foreground">Pages to crawl</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Max Wallet Scans — <span className="text-foreground font-medium">{maxWallets}</span>
              </Label>
              <Slider min={1} max={50} step={1} value={[maxWallets]}
                onValueChange={([v]) => setMaxWallets(v)} />
              <p className="text-[10px] text-muted-foreground">Vuln scans to run</p>
            </div>
          </div>

          {/* Options row */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch id="follow-nodes" checked={followNodes} onCheckedChange={setFollowNodes} />
              <Label htmlFor="follow-nodes" className="text-sm cursor-pointer">
                Follow on-chain nodes
              </Label>
              <span className="text-xs text-muted-foreground">(traces counterparty wallets)</span>
            </div>
          </div>

          {/* Domain filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Domain Filter (optional — comma-separated, empty = all domains)
            </Label>
            <Input
              placeholder="pastebin.com, github.com, gist.github.com"
              value={domainFilter}
              onChange={e => setDomainFilter(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <Alert className="border-primary/30 bg-primary/5">
            <Info className="w-4 h-4 text-primary" />
            <AlertDescription className="text-xs text-muted-foreground">
              <strong>How it works:</strong> The spider BFS-crawls the seed URLs, extracts all wallet
              addresses from page content using chain-aware pattern matching, then runs the full
              vulnerability scanner suite on each discovered address. If node-following is on, it also
              fetches recent on-chain transaction counterparties and maps the resulting address graph.
              All scans hit real RPC endpoints — no mocks.
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleStart}
            disabled={mutation.isPending}
            className="w-full sm:w-auto"
          >
            {mutation.isPending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Spider Running…</>
              : <><Globe className="w-4 h-4 mr-2" />Launch Spider</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {data && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <StatCard label="URLs Crawled"       value={data.urlsVisited}        />
            <StatCard label="Wallets Found"      value={data.walletsDiscovered}  color="text-primary" />
            <StatCard label="Wallets Scanned"    value={data.walletsScanned}     />
            <StatCard label="Vuln Findings"      value={totalVulns}
              color={criticalOrHigh > 0 ? "text-red-400" : totalVulns > 0 ? "text-yellow-400" : "text-green-400"} />
            <StatCard label="Node Links"         value={data.nodeLinks.length}   />
            <StatCard label="Duration"           value={fmtDuration(data.durationMs)} />
          </div>

          {/* Severity summary */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  {hasIssues
                    ? <ShieldAlert className="w-5 h-5 text-red-400" />
                    : <ShieldCheck className="w-5 h-5 text-green-400" />
                  }
                  <span className="font-semibold text-sm">
                    {hasIssues ? `${criticalOrHigh} critical/high issue(s) found` : "No critical issues found"}
                  </span>
                </div>
                {(["critical", "high", "medium", "low", "info"] as VulnSeverity[]).map(sev => (
                  data.vulnSummary[sev] > 0 && (
                    <Badge key={sev} variant="outline" className={`text-xs ${SEV_COLORS[sev]}`}>
                      {sev}: {data.vulnSummary[sev]}
                    </Badge>
                  )
                ))}
                <div className="ml-auto flex gap-2 flex-wrap text-xs text-muted-foreground">
                  {Object.entries(data.byChain).map(([chain, count]) => (
                    <span key={chain} className="flex items-center gap-1">
                      <ChainBadge chain={chain} />
                      <span>{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="web-finds" className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                Web Finds
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{data.webFinds.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="vulns" className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                Vulnerabilities
                <Badge variant="secondary" className={`ml-1 text-[10px] px-1.5 ${criticalOrHigh > 0 ? "bg-red-500/20 text-red-400" : ""}`}>
                  {totalVulns}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="nodes" className="flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5" />
                Node Map
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{data.nodeLinks.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* Web Finds tab */}
            <TabsContent value="web-finds" className="space-y-3 mt-4">
              {data.webFinds.length === 0 ? (
                <Card>
                  <CardContent className="pt-8 pb-8 text-center text-muted-foreground text-sm">
                    <CheckCircle className="w-8 h-8 mx-auto mb-3 text-green-400" />
                    No wallet addresses found in crawled pages.
                    {data.walletsDiscovered > 0 && " (Seed addresses are shown in Vulnerabilities tab.)"}
                  </CardContent>
                </Card>
              ) : (
                <ScrollArea className="h-[540px] pr-2">
                  <div className="space-y-2">
                    {data.webFinds.map((f, i) => <WalletFindRow key={i} f={f} />)}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            {/* Vulnerabilities tab */}
            <TabsContent value="vulns" className="space-y-3 mt-4">
              {data.vulnFindings.length === 0 ? (
                <Card>
                  <CardContent className="pt-8 pb-8 text-center text-muted-foreground text-sm">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-3 text-green-400" />
                    No vulnerability findings for any scanned wallet.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Activity className="w-3.5 h-3.5" />
                    {data.vulnFindings.length} finding(s) across {data.walletsScanned} wallet(s) —
                    sorted by severity
                  </div>
                  <ScrollArea className="h-[540px] pr-2">
                    <div className="space-y-3">
                      {[...data.vulnFindings]
                        .sort((a, b) => {
                          const order: Record<VulnSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
                          return (order[a.severity] ?? 5) - (order[b.severity] ?? 5);
                        })
                        .map((f, i) => <VulnCard key={i} f={f} />)
                      }
                    </div>
                  </ScrollArea>
                </>
              )}
            </TabsContent>

            {/* Node Map tab */}
            <TabsContent value="nodes" className="space-y-3 mt-4">
              {data.nodeLinks.length === 0 ? (
                <Card>
                  <CardContent className="pt-8 pb-8 text-center text-muted-foreground text-sm">
                    <Network className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                    No on-chain node links found.
                    {!data.config?.followNodes && " Enable 'Follow on-chain nodes' to trace counterparty addresses."}
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Alert className="border-blue-500/30 bg-blue-500/5">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <AlertDescription className="text-xs text-muted-foreground">
                      These are on-chain counterparty addresses extracted from recent transactions of
                      the scanned wallets. Each link shows the number of shared transactions (tx count).
                      Higher tx count = stronger relationship.
                    </AlertDescription>
                  </Alert>
                  <ScrollArea className="h-[480px] pr-2">
                    <div className="space-y-2">
                      {[...data.nodeLinks]
                        .sort((a, b) => b.txCount - a.txCount)
                        .map((link, i) => <NodeMapRow key={i} link={link} />)
                      }
                    </div>
                  </ScrollArea>
                </>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Loading skeleton */}
      {mutation.isPending && !data && (
        <Card>
          <CardContent className="pt-10 pb-10 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">
              Spider running — crawling pages, extracting wallet addresses,
              running chain vulnerability scans, following on-chain nodes…
            </p>
            <p className="text-xs text-muted-foreground/60">
              This may take 30–120 seconds depending on crawl depth and the number of wallets found.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
