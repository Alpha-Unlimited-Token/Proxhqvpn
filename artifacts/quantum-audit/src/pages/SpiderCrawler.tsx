import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GitBranch, Play, Square, RefreshCw, RotateCcw,
  Key, Shield, ExternalLink, ChevronDown, ChevronRight,
  Network, Cpu, Activity, AlertTriangle, CheckCircle2,
  Layers, Search, TrendingUp, Database, Zap, Eye,
  Hash, Clock, Globe, ShieldAlert, ShieldX,
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn }       from "@/lib/utils";

// ── API helpers ───────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) {
    const text = await r.text().catch(() => r.statusText);
    throw new Error(text || r.statusText);
  }
  return r.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpiderStateSnapshot {
  wave:        number;
  maxWave:     number;
  visited:     number;
  queued:      number;
  signatures:  number;
  findings:    number;
  seedCount:   number;
  startedAt:   string;
  checkpoint:  string;
  publicKeys:  number;
}

interface ProgressEvent {
  phase:       string;
  wave:        number;
  visited:     number;
  queued:      number;
  signatures:  number;
  findings:    number;
  publicKeys:  number;
  lastAddress?: string;
  message:     string;
}

interface SpiderStatus {
  running:     boolean;
  error:       string | null;
  lastEvent:   ProgressEvent | null;
  log:         string[];
  configured:  boolean;
  state:       SpiderStateSnapshot;
}

interface SpiderFinding {
  type:       string;
  severity:   string;
  address:    string;
  detail:     string;
  txHashes?:  string[];
  extra?:     Record<string, unknown>;
  timestamp:  string;
}

interface AddressMeta {
  address:                  string;
  firstSeen:                string;
  timesSeenAsCounterparty:  number;
  txCount:                  number;
  sigCount:                 number;
  ensName?:                 string;
  publicKey?:               string;
  interactedWith:           string[];
  fromSeed:                 boolean;
  wave:                     number;
  notes:                    string[];
}

interface SpiderReport {
  state:            SpiderStateSnapshot;
  topAddresses:     AddressMeta[];
  findings:         SpiderFinding[];
  publicKeys:       Record<string, string>;
  nonceReuseCount:  number;
  rCollisionCount:  number;
  recoveredKeys:    string[];
}

// ── Config panel ──────────────────────────────────────────────────────────────

interface CrawlConfig {
  maxWave:        number;
  maxAddresses:   number;
  concurrency:    number;
  minFrequency:   number;
  reset:          boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASE_LABEL: Record<string, string> = {
  seeding:        "Seeding addresses",
  wave_start:     "Starting wave",
  crawling:       "Crawling — parallel workers active",
  processing:     "Processing node",
  wave_complete:  "Wave complete",
  nonce_analysis: "ECDSA nonce-reuse analysis",
  complete:       "Crawl complete",
  error:          "Error",
  idle:           "Idle",
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/30",
  high:     "text-orange-400 bg-orange-500/10 border-orange-500/30",
  medium:   "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  info:     "text-blue-400 bg-blue-500/10 border-blue-500/30",
};

const TYPE_ICON: Record<string, React.ElementType> = {
  nonce_reuse:  Key,
  r_collision:  Hash,
  public_key:   Shield,
  cluster:      Network,
  ens:          Globe,
  anomaly:      AlertTriangle,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color = "text-primary" }: {
  label: string; value: number | string; sub?: string;
  icon: React.ElementType; color?: string;
}) {
  return (
    <div className="p-4 rounded-lg border border-border/50 bg-card/50">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className={cn("w-3.5 h-3.5", color)} />
        {label}
      </div>
      <p className={cn("text-2xl font-bold font-mono", color)}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function FindingCard({ f }: { f: SpiderFinding }) {
  const [open, setOpen] = useState(false);
  const Icon = TYPE_ICON[f.type] ?? AlertTriangle;

  return (
    <div className={cn("border rounded-md overflow-hidden", SEVERITY_COLOR[f.severity] ?? SEVERITY_COLOR.info)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-white/5 transition-colors"
      >
        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{f.severity}</span>
            <span className="text-xs text-muted-foreground">{f.type.replace(/_/g, " ")}</span>
          </div>
          <p className="text-sm font-medium mt-0.5 truncate">{f.detail.slice(0, 100)}</p>
        </div>
        {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-current/10 space-y-2 text-sm bg-black/20">
          <p className="text-muted-foreground">{f.detail}</p>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Address:</span>
            <a href={`https://etherscan.io/address/${f.address}`} target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1">
              {f.address.slice(0, 14)}…{f.address.slice(-6)}
              <ExternalLink className="w-3 h-3" />
            </a>
            {f.txHashes?.map((h, i) => (
              <>
                <span key={`l${i}`} className="text-muted-foreground">TX {i+1}:</span>
                <a key={`v${i}`} href={`https://etherscan.io/tx/${h}`} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 truncate">
                  {h.slice(0, 14)}…<ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </>
            ))}
            {f.extra && Object.entries(f.extra).filter(([k]) => k !== "recoveredKey").slice(0, 4).map(([k, v]) => (
              <>
                <span key={`ek${k}`} className="text-muted-foreground">{k}:</span>
                <span key={`ev${k}`} className="truncate">{String(v).slice(0, 40)}{String(v).length > 40 ? "…" : ""}</span>
              </>
            ))}
            <span className="text-muted-foreground">Time:</span>
            <span>{new Date(f.timestamp).toLocaleString()}</span>
          </div>
          {(f.extra as any)?.recoveredKey && (
            <div className="mt-2 p-2 rounded bg-red-500/20 border border-red-500/40 font-mono text-xs break-all">
              <span className="text-red-300 font-bold">RECOVERED KEY: </span>
              <span className="text-red-200">{(f.extra as any).recoveredKey}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddressRow({ meta }: { meta: AddressMeta }) {
  const [open, setOpen] = useState(false);
  const hasKey = !!meta.publicKey;

  return (
    <div className="border border-border/40 rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent/30 transition-colors"
      >
        {hasKey
          ? <Key className="w-4 h-4 text-yellow-400 shrink-0" />
          : <Network className="w-4 h-4 text-muted-foreground shrink-0" />}
        <a
          href={`https://etherscan.io/address/${meta.address}`}
          target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
        >
          {meta.address.slice(0, 14)}…{meta.address.slice(-6)}
          <ExternalLink className="w-3 h-3" />
        </a>
        {meta.ensName && <span className="text-xs text-muted-foreground">{meta.ensName}</span>}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>{meta.timesSeenAsCounterparty}× freq</span>
          <span>{meta.txCount} txs</span>
          <span>{meta.sigCount} sigs</span>
          <span>wave {meta.wave}</span>
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 border-t border-border/30 bg-card/30 space-y-2 text-xs font-mono">
          {hasKey && (
            <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 break-all">
              Public key: {meta.publicKey}
            </div>
          )}
          {meta.notes.length > 0 && (
            <div className="space-y-0.5 text-muted-foreground">
              {meta.notes.map((n, i) => <div key={i}>• {n}</div>)}
            </div>
          )}
          {meta.interactedWith.length > 0 && (
            <div>
              <span className="text-muted-foreground">Interacted with:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {meta.interactedWith.slice(0, 8).map(a => (
                  <a key={a} href={`https://etherscan.io/address/${a}`} target="_blank" rel="noopener noreferrer"
                    className="text-primary hover:underline">
                    {a.slice(0,10)}…
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="text-muted-foreground">
            First seen: {new Date(meta.firstSeen).toLocaleString()} | From seed: {meta.fromSeed ? "yes" : "no"}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SpiderCrawler() {
  const [tab, setTab] = useState<"live" | "findings" | "addresses" | "keys" | "config">("live");
  const [config, setConfig] = useState<CrawlConfig>({
    maxWave: 2, maxAddresses: 50_000, concurrency: 8, minFrequency: 2, reset: false,
  });
  const logRef = useRef<HTMLDivElement>(null);
  const qc     = useQueryClient();

  const statusQ = useQuery<SpiderStatus>({
    queryKey:       ["spider-status"],
    queryFn:        () => apiFetch("/api/quantum-audit/spider/status"),
    refetchInterval: 3000,
  });

  const reportQ = useQuery<SpiderReport>({
    queryKey: ["spider-report"],
    queryFn:  () => apiFetch("/api/quantum-audit/spider/report"),
    enabled:  (statusQ.data?.state.visited ?? 0) > 0,
    refetchInterval: statusQ.data?.running ? 15_000 : false,
  });

  const startMut = useMutation({
    mutationFn: () => apiFetch("/api/quantum-audit/spider/start", {
      method: "POST",
      body:   JSON.stringify(config),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spider-status"] });
      setTab("live");
    },
  });

  const stopMut = useMutation({
    mutationFn: () => apiFetch("/api/quantum-audit/spider/stop", { method: "POST" }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["spider-status"] }),
  });

  const resetMut = useMutation({
    mutationFn: () => apiFetch("/api/quantum-audit/spider/reset", { method: "POST" }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["spider-status"] });
      qc.invalidateQueries({ queryKey: ["spider-report"] });
    },
  });

  const status  = statusQ.data;
  const report  = reportQ.data;
  const s       = status?.state;
  const isRunning = status?.running ?? false;

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [status?.log]);

  const waveProgress = s ? Math.round((s.wave / Math.max(s.maxWave, 1)) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-primary" />
            Adaptive Spider
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Graph-crawling signature harvester — learns, adapts, skips known nodes, extracts ECDSA keys
          </p>
        </div>
        <div className="flex gap-2">
          {isRunning
            ? <Button onClick={() => stopMut.mutate()} variant="destructive" className="gap-2" disabled={stopMut.isPending}>
                <Square className="w-4 h-4" /> Stop
              </Button>
            : <Button onClick={() => startMut.mutate()} className="gap-2"
                disabled={startMut.isPending || !status?.configured}>
                <Play className="w-4 h-4" />
                {s && s.visited > 0 && !config.reset ? "Resume Crawl" : "Start Crawl"}
              </Button>
          }
          {!isRunning && s && s.visited > 0 && (
            <Button onClick={() => resetMut.mutate()} variant="outline" size="icon" title="Reset all data">
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Not configured */}
      {status && !status.configured && (
        <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-sm text-yellow-300">
          BigQuery credentials required (GOOGLE_BIGQUERY_KEY).
        </div>
      )}

      {/* Start error */}
      {(startMut.error || status?.error) && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-300">
          {String(startMut.error ?? status?.error ?? "")}
        </div>
      )}

      {/* Live stats bar */}
      {s && (
        <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
          <StatCard label="Visited"    value={s.visited}    icon={Eye}       color="text-primary" />
          <StatCard label="Queued"     value={s.queued}     icon={Layers}    color="text-blue-400" />
          <StatCard label="Signatures" value={s.signatures} icon={Hash}      color="text-purple-400" />
          <StatCard label="Findings"   value={s.findings}   icon={ShieldAlert} color="text-orange-400" />
          <StatCard label="Pub Keys"   value={s.publicKeys} icon={Key}       color="text-yellow-400" />
          <StatCard label="Seeds"      value={s.seedCount}  icon={Database}  color="text-muted-foreground" />
          <StatCard
            label="Wave"
            value={`${s.wave} / ${s.maxWave}`}
            icon={TrendingUp}
            color={isRunning ? "text-green-400" : "text-muted-foreground"}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit flex-wrap">
        {(["live", "findings", "addresses", "keys", "config"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}>
            {t === "live"      && "Live Log"}
            {t === "findings"  && `Findings${report ? ` (${report.findings.length})` : ""}`}
            {t === "addresses" && `Top Nodes${report ? ` (${report.topAddresses.length})` : ""}`}
            {t === "keys"      && `Public Keys${report ? ` (${Object.keys(report.publicKeys).length})` : ""}`}
            {t === "config"    && "Configure"}
          </button>
        ))}
      </div>

      {/* Tab: Live log */}
      {tab === "live" && (
        <div className="space-y-4">
          {isRunning && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                <span className="font-medium">{PHASE_LABEL[status?.lastEvent?.phase ?? "idle"] ?? "Running…"}</span>
                {status?.lastEvent?.lastAddress && (
                  <span className="font-mono text-xs text-muted-foreground truncate">
                    {status.lastEvent.lastAddress.slice(0, 14)}…
                  </span>
                )}
              </div>
              <Progress value={waveProgress} className="h-1.5" />
            </div>
          )}

          {!isRunning && (!s || s.visited === 0) && (
            <div className="flex flex-col items-center py-16 text-center text-muted-foreground space-y-3">
              <GitBranch className="w-12 h-12 opacity-20" />
              <p className="text-lg font-medium">Spider hasn't run yet</p>
              <p className="text-sm max-w-md">
                Click "Start Crawl" to launch the adaptive graph crawler against the 2,089 micro-target addresses.
                The spider expands outward hop-by-hop, harvesting ECDSA signatures and building address clusters.
                It learns which nodes are high-frequency and prioritises them. Known noise contracts (Uniswap, USDC, etc.) are excluded automatically.
              </p>
            </div>
          )}

          {/* Log */}
          {status?.log && status.log.length > 0 && (
            <div
              ref={logRef}
              className="font-mono text-xs text-muted-foreground bg-black/40 border border-border/40 rounded-lg p-4 max-h-96 overflow-y-auto space-y-0.5"
            >
              {status.log.map((line, i) => (
                <div key={i} className={cn(
                  line.includes("ERROR") ? "text-red-400" :
                  line.includes("complete") || line.includes("DONE") ? "text-green-400" :
                  line.includes("critical") || line.includes("RECOVERED") ? "text-yellow-400" :
                  "text-muted-foreground",
                )}>{line}</div>
              ))}
            </div>
          )}

          {/* How it works */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {[
              { icon: Network, title: "Adaptive BFS",   text: "Starts from seeds, expands hop-by-hop. Addresses seen by multiple seeds get higher priority in the queue." },
              { icon: Cpu,     title: "8 Workers",      text: "Concurrent worker pool — while one batch waits on BigQuery, others are processing RPC calls. Zero I/O wait." },
              { icon: Key,     title: "Sig Harvest",    text: "Every outbound transaction's ECDSA (r, s, v, z) is extracted and stored. Nonce reuse detected in real-time." },
              { icon: Database, title: "Learns & Saves", text: "Visited set persisted to disk. Spider resumes from checkpoint — never re-scans addresses already processed." },
              { icon: Eye,     title: "Hidden Traces",  text: "Internal contract calls (traces) and token transfer logs reveal counterparties invisible in the main tx list." },
              { icon: Zap,     title: "Auto Filter",    text: "Common high-traffic contracts (DEX routers, stablecoins, CEX hot wallets) excluded — only interesting nodes crawled." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="p-3 rounded-lg border border-border/40 bg-card/30 space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <Icon className="w-4 h-4 text-primary" />
                  {title}
                </div>
                <p className="text-muted-foreground text-xs">{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Findings */}
      {tab === "findings" && (
        <div className="space-y-3">
          {report && report.findings.length === 0 && (
            <div className="flex items-center gap-2 p-6 text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              No findings yet — run the crawler first.
            </div>
          )}
          {report?.recoveredKeys.length ? (
            <div className="p-4 rounded-lg border border-red-500/40 bg-red-500/10 space-y-2">
              <div className="flex items-center gap-2 text-red-300 font-bold">
                <Key className="w-5 h-5" />
                {report.recoveredKeys.length} Private Key{report.recoveredKeys.length !== 1 ? "s" : ""} Recovered
              </div>
              {report.recoveredKeys.map((k, i) => (
                <div key={i} className="font-mono text-xs break-all text-red-200 bg-black/30 p-2 rounded">{k}</div>
              ))}
            </div>
          ) : null}
          {report?.findings.map((f, i) => <FindingCard key={i} f={f} />)}
        </div>
      )}

      {/* Tab: Top Nodes */}
      {tab === "addresses" && (
        <div className="space-y-2">
          {!report && <p className="text-muted-foreground text-sm">Run the spider to see address data.</p>}
          {report?.topAddresses.map(meta => <AddressRow key={meta.address} meta={meta} />)}
        </div>
      )}

      {/* Tab: Public Keys */}
      {tab === "keys" && (
        <div className="space-y-2">
          {!report || Object.keys(report.publicKeys).length === 0
            ? <p className="text-muted-foreground text-sm">No public keys extracted yet.</p>
            : Object.entries(report.publicKeys).map(([addr, key]) => (
              <div key={addr} className="p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 font-mono text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-yellow-400" />
                  <a href={`https://etherscan.io/address/${addr}`} target="_blank" rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1">
                    {addr}<ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="break-all text-muted-foreground">{key}</div>
              </div>
            ))
          }
        </div>
      )}

      {/* Tab: Configure */}
      {tab === "config" && (
        <div className="max-w-lg space-y-5">
          <p className="text-sm text-muted-foreground">
            Configure the crawl parameters. The spider will save state to disk after each checkpoint — you can resume a stopped crawl without re-scanning visited addresses.
          </p>
          {[
            { key: "maxWave",       label: "Max Hops (waves)",   min: 1, max: 5,       hint: "How many hops from seed addresses. Wave 0 = seeds only, wave 1 = their counterparties, wave 2 = counterparties of counterparties…" },
            { key: "maxAddresses",  label: "Max Addresses",       min: 100, max: 200_000, hint: "Hard cap on total unique addresses crawled. Prevents runaway expansion." },
            { key: "concurrency",   label: "Parallel Workers",    min: 1, max: 32,      hint: "Worker pool size. Higher = more BigQuery/RPC calls in parallel. The 'worm' that eliminates I/O latency." },
            { key: "minFrequency",  label: "Min Counterparty Frequency", min: 1, max: 20, hint: "In wave 2+, only follow addresses seen interacting with ≥ N seed addresses. Keeps the graph focused on relevant nodes." },
          ].map(({ key, label, min, max, hint }) => (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{label}</label>
                <span className="font-mono text-sm text-primary">
                  {(config as any)[key].toLocaleString()}
                </span>
              </div>
              <input
                type="range" min={min} max={max}
                value={(config as any)[key]}
                onChange={e => setConfig(c => ({ ...c, [key]: Number(e.target.value) }))}
                className="w-full accent-primary"
              />
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          ))}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.reset}
              onChange={e => setConfig(c => ({ ...c, reset: e.target.checked }))}
              className="mt-0.5 w-4 h-4 accent-primary"
            />
            <span className="text-sm">
              <span className="font-medium">Reset existing data</span>
              <span className="text-muted-foreground"> — clears all visited addresses, signatures, and findings before starting. Use this to restart from scratch.</span>
            </span>
          </label>
          <Button onClick={() => startMut.mutate()} disabled={isRunning || startMut.isPending || !status?.configured} className="gap-2">
            <Play className="w-4 h-4" />
            {config.reset ? "Reset & Start" : s && s.visited > 0 ? "Resume with New Config" : "Start Crawl"}
          </Button>
        </div>
      )}
    </div>
  );
}
