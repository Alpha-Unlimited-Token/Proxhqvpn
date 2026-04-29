import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Link2, Play, RefreshCw, Upload, ExternalLink, ChevronDown, ChevronRight,
  ShieldX, ShieldAlert, ShieldCheck, CheckCircle2, Clock, Search,
  FileCode, GitBranch, Layers, Hash, AlertTriangle, Info, X,
  CircleDot, Network, Database
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn }       from "@/lib/utils";

// ── API ───────────────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch<T>(p: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${p}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return r.json() as Promise<T>;
}
async function apiUpload<T>(p: string, body: FormData): Promise<T> {
  const r = await fetch(`${BASE}${p}`, { method: "POST", body });
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return r.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type ProxyType =
  | "eip1967_transparent" | "eip1967_uups" | "eip1967_beacon"
  | "eip1822_uups" | "eip1167_minimal_clone" | "eip2535_diamond"
  | "oz_legacy" | "delegatecall_pattern" | "metamorphic" | "none";

interface ProxyFinding {
  severity:  "critical" | "high" | "medium" | "low" | "info";
  type:      string;
  title:     string;
  detail:    string;
  address?:  string;
  txHash?:   string;
}

interface ProxyInfo {
  address:           string;
  isProxy:           boolean;
  proxyType:         ProxyType;
  implementation:    string | null;
  admin:             string | null;
  beacon:            string | null;
  facets:            string[];
  chain:             string[];
  implIsKnownBad:    boolean;
  implBadLabel:      string | null;
  adminIsTargeted:   boolean;
  chainDepth:        number;
  bytecodeHash:      string | null;
  implBytecodeHash:  string | null;
  delegatecallTxCount: number;
  findings:          ProxyFinding[];
  scannedAt:         string;
}

interface ProxySummary {
  totalScanned:    number;
  proxiesFound:    number;
  maliciousImpls:  number;
  deepChains:      number;
  byType:          Record<ProxyType, number>;
  findings:        ProxyFinding[];
  proxyInfos:      ProxyInfo[];
  scannedAt:       string;
}

interface ProxyStatus {
  running:   boolean;
  progress:  { done: number; total: number };
  log:       string[];
  hasReport: boolean;
  summary:   {
    totalScanned: number; proxiesFound: number; maliciousImpls: number;
    deepChains: number; byType: Record<string, number>; findings: number;
  } | null;
}

interface ParseResult {
  parsed: number; skipped: number; byKind: Record<string, number>;
  errors: string[]; ethAddresses: string[]; allAddresses: { address: string; chain: string }[];
  preview: Array<{ kind: string; value: string }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PROXY_TYPE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  eip1967_transparent: { label: "EIP-1967 Transparent",  color: "text-blue-400",   icon: Layers      },
  eip1967_uups:        { label: "EIP-1967 UUPS",          color: "text-blue-400",   icon: Layers      },
  eip1967_beacon:      { label: "EIP-1967 Beacon",        color: "text-cyan-400",   icon: Network     },
  eip1822_uups:        { label: "UUPS (EIP-1822)",        color: "text-blue-400",   icon: Layers      },
  eip1167_minimal_clone:{ label: "Minimal Clone",         color: "text-purple-400", icon: GitBranch   },
  eip2535_diamond:     { label: "Diamond (EIP-2535)",     color: "text-yellow-400", icon: Hash        },
  oz_legacy:           { label: "OZ Legacy Proxy",        color: "text-gray-400",   icon: Layers      },
  delegatecall_pattern:{ label: "DELEGATECALL Pattern",   color: "text-orange-400", icon: Link2       },
  metamorphic:         { label: "Metamorphic Contract",   color: "text-red-400",    icon: ShieldX     },
  none:                { label: "Not a proxy",            color: "text-muted-foreground", icon: CircleDot },
};

const SEV = {
  critical: { color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30"       },
  high:     { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  medium:   { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  low:      { color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30"     },
  info:     { color: "text-gray-400",   bg: "bg-gray-500/10 border-gray-500/30"     },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ProxyCard({ p }: { p: ProxyInfo }) {
  const [open, setOpen] = useState(false);
  const meta = PROXY_TYPE_META[p.proxyType] ?? PROXY_TYPE_META.none;
  const Icon = meta.icon;

  return (
    <div className={cn("border rounded-lg overflow-hidden",
      p.implIsKnownBad ? "border-red-500/40 bg-red-500/5" :
      p.chainDepth >= 2 ? "border-orange-500/30 bg-orange-500/5" :
      p.adminIsTargeted ? "border-yellow-500/30 bg-yellow-500/5" :
      "border-border/40 bg-card/30")}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors">
        <Icon className={cn("w-4 h-4 shrink-0", meta.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-xs font-semibold", meta.color)}>{meta.label}</span>
            {p.implIsKnownBad    && <span className="text-xs font-bold text-red-400 px-1.5 py-0.5 rounded bg-red-500/20">MALICIOUS IMPL</span>}
            {p.adminIsTargeted   && <span className="text-xs font-bold text-yellow-400 px-1.5 py-0.5 rounded bg-yellow-500/20">TARGETED ADMIN</span>}
            {p.chainDepth >= 2   && <span className="text-xs text-orange-400 px-1.5 py-0.5 rounded bg-orange-500/20">depth {p.chainDepth}</span>}
          </div>
          <p className="font-mono text-xs text-primary mt-0.5">{p.address}</p>
        </div>
        <div className="shrink-0 text-xs text-muted-foreground">{p.findings.length} findings</div>
        {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-current/10 bg-black/20 space-y-3">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Address:</span>
            <a href={`https://etherscan.io/address/${p.address}`} target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1">
              {p.address}<ExternalLink className="w-3 h-3" />
            </a>
            {p.implementation && <>
              <span className="text-muted-foreground">Implementation:</span>
              <a href={`https://etherscan.io/address/${p.implementation}`} target="_blank" rel="noopener noreferrer"
                className={cn("hover:underline flex items-center gap-1", p.implIsKnownBad ? "text-red-400" : "text-primary")}>
                {p.implementation}{p.implIsKnownBad && ` — ${p.implBadLabel}`}<ExternalLink className="w-3 h-3" />
              </a>
            </>}
            {p.admin && <>
              <span className="text-muted-foreground">Admin:</span>
              <a href={`https://etherscan.io/address/${p.admin}`} target="_blank" rel="noopener noreferrer"
                className={cn("hover:underline flex items-center gap-1", p.adminIsTargeted ? "text-yellow-400" : "text-primary")}>
                {p.admin}<ExternalLink className="w-3 h-3" />
              </a>
            </>}
            {p.beacon && <>
              <span className="text-muted-foreground">Beacon:</span>
              <a href={`https://etherscan.io/address/${p.beacon}`} target="_blank" rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1">
                {p.beacon}<ExternalLink className="w-3 h-3" />
              </a>
            </>}
            {p.chainDepth > 0 && <>
              <span className="text-muted-foreground">Proxy chain:</span>
              <span className="text-foreground break-all">{p.chain.join(" → ")}</span>
            </>}
            {p.facets.length > 0 && <>
              <span className="text-muted-foreground">Facets ({p.facets.length}):</span>
              <div className="space-y-0.5">
                {p.facets.map((f, i) => (
                  <a key={i} href={`https://etherscan.io/address/${f}`} target="_blank" rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1">
                    {f}<ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </>}
          </div>
          {p.findings.length > 0 && (
            <div className="space-y-1.5">
              {p.findings.map((f, i) => {
                const s = SEV[f.severity] ?? SEV.info;
                return (
                  <div key={i} className={cn("p-2 rounded border text-xs", s.bg)}>
                    <span className={cn("font-bold uppercase mr-1.5", s.color)}>{f.severity}</span>
                    <span className="font-medium">{f.title}</span>
                    <p className="text-muted-foreground mt-0.5">{f.detail}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UploadZone({ onParsed }: { onParsed: (result: ParseResult) => void }) {
  const [dragging, setDragging]   = useState(false);
  const [loading,  setLoading]    = useState(false);
  const [text,     setText]       = useState("");
  const [mode,     setMode]       = useState<"file" | "paste">("file");
  const [error,    setError]      = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setLoading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await apiUpload<ParseResult>("/api/quantum-audit/targets/upload", fd);
      onParsed(result);
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  const handlePaste = async () => {
    if (!text.trim()) return;
    setLoading(true); setError("");
    try {
      const result = await apiFetch<ParseResult>("/api/quantum-audit/targets/parse-text", {
        method: "POST", body: JSON.stringify({ text }),
      });
      onParsed(result);
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["file", "paste"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={cn("text-xs px-3 py-1.5 rounded-md transition-all",
              mode === m ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground border border-border/30")}>
            {m === "file" ? "Upload File" : "Paste Text"}
          </button>
        ))}
      </div>

      {mode === "file" && (
        <div
          className={cn("border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
            dragging ? "border-primary bg-primary/5" : "border-border/40 hover:border-border")}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" className="hidden"
            accept=".txt,.csv,.json,.jsonl,.ndjson,.tsv,.log,.md"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {loading
            ? <RefreshCw className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
            : <Upload className="w-8 h-8 mx-auto text-muted-foreground" />}
          <p className="text-sm text-muted-foreground mt-2">
            Drag & drop or click to upload
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            .txt · .csv · .json · .jsonl · .tsv — ETH addresses, ENS names, BTC, Solana, Polkadot, Monero, TX hashes
          </p>
        </div>
      )}

      {mode === "paste" && (
        <div className="space-y-2">
          <textarea
            value={text} onChange={e => setText(e.target.value)}
            placeholder={"Paste addresses, ENS names, tx hashes — one per line, or comma/space separated\n0x1234...\nvitalik.eth\n1BvBMSE..."}
            rows={8}
            className="w-full font-mono text-xs bg-black/30 border border-border/40 rounded-lg p-3 text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-primary/50"
          />
          <Button onClick={handlePaste} disabled={!text.trim() || loading} size="sm" className="gap-2">
            {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            Parse Targets
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProxyScanner() {
  const [tab, setTab]       = useState<"proxies" | "findings" | "log">("proxies");
  const [page, setPage]     = useState(0);
  const [typeFilter, setTypeFilter] = useState("");
  const [customAddrs, setCustomAddrs] = useState<string[]>([]);
  const [parsed, setParsed]     = useState<ParseResult | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [limit, setLimit]     = useState(500);
  const logRef = useRef<HTMLDivElement>(null);
  const qc     = useQueryClient();

  const statusQ = useQuery<ProxyStatus>({
    queryKey: ["proxy-status"],
    queryFn:  () => apiFetch("/api/quantum-audit/proxy/status"),
    refetchInterval: 3000,
  });

  const reportQ = useQuery<{ total: number; page: number; limit: number; items: ProxyInfo[] }>({
    queryKey: ["proxy-proxies", page, typeFilter],
    queryFn:  () => apiFetch(`/api/quantum-audit/proxy/report/proxies?page=${page}&limit=25${typeFilter ? `&type=${typeFilter}` : ""}`),
    enabled:  !!statusQ.data?.hasReport,
  });

  const startMut = useMutation({
    mutationFn: () => apiFetch("/api/quantum-audit/proxy/scan", {
      method: "POST",
      body:   JSON.stringify({ addresses: customAddrs, limit }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proxy-status"] }); setTab("log"); },
  });

  const status  = statusQ.data;
  const running = status?.running ?? false;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [status?.log]);

  const onParsed = (r: ParseResult) => {
    setParsed(r);
    setCustomAddrs(r.ethAddresses);
    setShowUpload(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono flex items-center gap-2">
            <Link2 className="w-6 h-6 text-primary" />
            Proxy & Delegate Scanner
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Detects all on-chain proxy patterns — EIP-1967, UUPS, EIP-1167 clones, Diamond (EIP-2535). Identifies malicious implementations and deep delegation chains.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowUpload(v => !v)}
            className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-all",
              showUpload ? "border-primary/50 text-primary bg-primary/10" : "border-border/40 text-muted-foreground hover:text-foreground")}>
            <Upload className="w-3.5 h-3.5" />
            {parsed ? `${customAddrs.length} targets loaded` : "Load Targets"}
          </button>
          {parsed && (
            <button onClick={() => { setParsed(null); setCustomAddrs([]); }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded border border-border/40">
              <X className="w-3 h-3" />
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Limit:</span>
            <select value={limit} onChange={e => setLimit(Number(e.target.value))}
              className="bg-card border border-border rounded px-1 py-0.5 text-foreground">
              {[100, 250, 500, 1000, 2500].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <Button onClick={() => startMut.mutate()} disabled={running || startMut.isPending} className="gap-2">
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "Scanning…" : "Scan for Proxies"}
          </Button>
        </div>
      </div>

      {/* Upload zone */}
      {showUpload && (
        <div className="p-4 rounded-lg border border-border/40 bg-card/30">
          <h3 className="text-sm font-semibold mb-3">Load Scan Targets</h3>
          <UploadZone onParsed={onParsed} />
          {parsed && (
            <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-xs space-y-1">
              <div className="flex items-center gap-2 text-green-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                {parsed.parsed} targets loaded from file
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground font-mono">
                {Object.entries(parsed.byKind).map(([k, v]) => (
                  <span key={k}>{k.replace(/_/g, " ")}: <span className="text-foreground">{v}</span></span>
                ))}
              </div>
              <p className="text-muted-foreground/60 mt-1">Only Ethereum addresses are scanned for proxy patterns ({parsed.ethAddresses.length} available)</p>
            </div>
          )}
        </div>
      )}

      {/* Progress */}
      {running && (status?.progress?.total ?? 0) > 0 && (
        <div className="space-y-2 p-4 rounded-lg border border-border/40 bg-card/30">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-primary">
              <RefreshCw className="w-4 h-4 animate-spin" />Scanning proxy patterns…
            </span>
            <span className="text-muted-foreground font-mono">
              {status?.progress?.done ?? 0}/{status?.progress?.total ?? 0}
            </span>
          </div>
          <Progress value={((status?.progress?.done ?? 0) / Math.max(1, status?.progress?.total ?? 1)) * 100} className="h-1.5" />
        </div>
      )}

      {/* Summary bar */}
      {status?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Scanned",          value: status.summary.totalScanned,   color: "text-foreground"  },
            { label: "Proxies Found",    value: status.summary.proxiesFound,    color: "text-blue-400"    },
            { label: "Malicious Impls",  value: status.summary.maliciousImpls,  color: "text-red-400"     },
            { label: "Deep Chains (≥2)", value: status.summary.deepChains,      color: "text-orange-400"  },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-lg border border-border/40 bg-card/40">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={cn("text-2xl font-bold font-mono", color)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Proxy type breakdown */}
      {status?.summary?.byType && Object.keys(status.summary.byType).length > 0 && (
        <div className="p-4 rounded-lg border border-border/40 bg-card/30 space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">By Type</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(status.summary.byType).filter(([k]) => k !== "none").map(([type, count]) => {
              const m = PROXY_TYPE_META[type] ?? { label: type, color: "text-muted-foreground", icon: Layers };
              const MI = m.icon;
              return (
                <div key={type} className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border", m.color, "border-current/20 bg-current/5")}>
                  <MI className="w-3.5 h-3.5" />{m.label} <span className="font-mono font-bold ml-0.5">({count})</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!running && !status?.hasReport && (status?.progress?.total ?? 0) === 0 && (
        <div className="flex flex-col items-center py-16 text-center text-muted-foreground space-y-4">
          <Link2 className="w-14 h-14 opacity-10" />
          <p className="text-xl font-semibold">Ready to scan for proxy contracts</p>
          <p className="text-sm max-w-xl leading-relaxed">
            Scans every address for known proxy patterns. Proxy contracts use <code className="text-primary text-xs font-mono">DELEGATECALL</code> to forward execution to a separate implementation — the same concept as a network proxy, but in EVM bytecode.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs mt-2 max-w-2xl w-full">
            {[
              { type: "eip1967_transparent", desc: "OpenZeppelin standard; implementation + admin slots" },
              { type: "eip1822_uups",        desc: "Self-managed upgrade logic in the implementation" },
              { type: "eip1167_minimal_clone", desc: "Immutable clone — same logic, independent storage" },
              { type: "eip2535_diamond",     desc: "Multi-facet; routes selectors to different impls" },
              { type: "eip1967_beacon",      desc: "Many proxies share one beacon implementation" },
              { type: "metamorphic",         desc: "CREATE2 + selfdestruct — code can change at same address" },
            ].map(({ type, desc }) => {
              const m = PROXY_TYPE_META[type] ?? { label: type, color: "text-muted-foreground", icon: Layers };
              const MI = m.icon;
              return (
                <div key={type} className="p-3 rounded-lg border border-border/40 bg-card/30 space-y-1 text-left">
                  <div className={cn("flex items-center gap-1.5 font-semibold", m.color)}>
                    <MI className="w-3.5 h-3.5" />{m.label}
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      {status?.hasReport && (
        <>
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
            {(["proxies","findings","log"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {t === "proxies"  && `Proxies${reportQ.data ? ` (${reportQ.data.total})` : ""}`}
                {t === "findings" && `Findings${status.summary ? ` (${status.summary.findings})` : ""}`}
                {t === "log"      && "Scan Log"}
              </button>
            ))}
          </div>

          {/* Proxies tab */}
          {tab === "proxies" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
                  className="text-xs px-2 py-1.5 rounded border border-border bg-card text-foreground">
                  <option value="">All proxy types</option>
                  {Object.entries(PROXY_TYPE_META).filter(([k]) => k !== "none").map(([k, m]) => (
                    <option key={k} value={k}>{m.label}</option>
                  ))}
                </select>
                {typeFilter && (
                  <button onClick={() => setTypeFilter("")}
                    className="text-xs px-2 py-1.5 rounded border border-border/40 text-muted-foreground hover:text-foreground">
                    Clear
                  </button>
                )}
              </div>
              {(reportQ.data?.items ?? []).map((p, i) => <ProxyCard key={i} p={p} />)}
              {reportQ.data && reportQ.data.total > 25 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{page*25+1}–{Math.min((page+1)*25, reportQ.data.total)} of {reportQ.data.total}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0,p-1))} disabled={page===0}>Prev</Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(p=>p+1)} disabled={(page+1)*25>=reportQ.data!.total}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Findings tab */}
          {tab === "findings" && (
            <div className="space-y-2">
              {/* Fetch full report findings inline */}
              <FullFindings />
            </div>
          )}

          {/* Log tab */}
          {tab === "log" && (
            <div ref={logRef} className="font-mono text-xs bg-black/40 border border-border/40 rounded-lg p-4 max-h-[60vh] overflow-y-auto space-y-0.5">
              {(status?.log ?? []).map((line, i) => (
                <div key={i} className={cn(
                  line.includes("PROXY:")     ? "text-blue-300" :
                  line.includes("MALICIOUS")  ? "text-red-400 font-semibold" :
                  line.includes("complete")   ? "text-green-400" :
                  line.includes("FATAL")      ? "text-red-400" :
                  "text-muted-foreground",
                )}>{line}</div>
              ))}
              {(status?.log?.length ?? 0) === 0 && (
                <span className="text-muted-foreground">No log entries yet.</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Inline component: fetches the full findings list from report
function FullFindings() {
  const reportQ = useQuery({
    queryKey: ["proxy-full-report"],
    queryFn:  () => apiFetch<{ findings: Array<{ severity: string; type: string; title: string; detail: string; address?: string }> }>("/api/quantum-audit/proxy/report"),
  });
  const SEV_LOCAL: Record<string, { color: string; bg: string }> = {
    critical: { color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30"       },
    high:     { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
    medium:   { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
    low:      { color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30"     },
    info:     { color: "text-gray-400",   bg: "bg-gray-500/10 border-gray-500/30"     },
  };
  const findings = reportQ.data?.findings ?? [];
  if (findings.length === 0) return <p className="text-muted-foreground text-sm py-8 text-center">No findings.</p>;
  return (
    <div className="space-y-2">
      {findings.map((f, i) => {
        const s = SEV_LOCAL[f.severity] ?? SEV_LOCAL.info;
        return (
          <div key={i} className={cn("p-3 rounded-lg border text-sm", s.bg)}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className={cn("text-xs font-bold uppercase", s.color)}>{f.severity}</span>
              <span className="text-xs text-muted-foreground">{f.type.replace(/_/g, " ")}</span>
            </div>
            <p className="font-medium">{f.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{f.detail}</p>
            {f.address && (
              <a href={`https://etherscan.io/address/${f.address}`} target="_blank" rel="noopener noreferrer"
                className="font-mono text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                {f.address}<ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
