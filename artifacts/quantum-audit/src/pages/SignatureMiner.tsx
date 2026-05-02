// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useCallback } from "react";
import {
  Play, Square, RefreshCw, ChevronDown, ChevronRight,
  Key, Eye, Globe, Search, GitBranch, Cpu, AlertTriangle,
  CheckCircle, Clock, Zap, Hash, Copy, ExternalLink,
  FlaskConical, BookOpen, XCircle, Loader2, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types (mirroring server) ─────────────────────────────────────────────────

type EngineType = "block_scanner" | "web_spider" | "osint" | "peel_chain" | "hybrid";

interface EngineStatus {
  running: boolean;
  engineType: string | null;
  startedAt: string | null;
  hasResult: boolean;
  error: string | null;
  chainedUrlCount?: number;  // URLs auto-fed from Engine 1 to Engine 2
}

interface DiscoveredUrl {
  url: string;
  txHash: string;
  fromAddress: string;
  blockNumber: number;
  source: "input_data" | "ipfs_cid" | "arweave_id" | "ens_name" | "memo_utf8";
}

interface Finding {
  source?: string;
  attackType?: string;
  kind?: string;
  address?: string;
  privateKey?: string;
  keyVerified?: boolean;
  value?: string;
  detail?: string;
  txHashes?: string[];
  url?: string;
  confidence?: number;
  severity?: string;
  r?: string;
  discoveredAt?: string;
}

interface EngineResult {
  // Block scanner
  scannedBlocks?: number;
  scannedTxCount?: number;
  signaturesFound?: number;
  uniqueAddresses?: number;
  // Engine 1 → Engine 2 URL chain
  discoveredUrls?: DiscoveredUrl[];
  chainedUrlCount?: number;
  chainedSpiderFinds?: Array<{ kind: string; value: string; url?: string }> ;
  // Web spider
  urlsVisited?: number;
  urlsQueued?: number;
  errors?: number;
  byKind?: Record<string, number>;
  // OSINT
  addressesSearched?: number;
  sourcesProbed?: string[];
  githubRateLimited?: boolean;
  bySource?: Record<string, number>;
  // Peel chain
  totalHops?: number;
  totalPeeledEth?: number;
  riskScore?: number;
  privateKeysFound?: string[];
  nonceReuseAddresses?: string[];
  hops?: Array<{
    hopNumber: number;
    address: string;
    balanceEth: number;
    sigCount: number;
    nonceReuseFound: boolean;
    privateKeyFound: string | null;
    pattern: string;
  }>;
  // Hybrid
  startedAt?: string;
  completedAt?: string;
  durationSecs?: number;
  totalWormRuns?: number;
  bySource2?: Record<string, number>;
  privateKeys?: string[];
  mnemonics?: string[];
  stats?: Record<string, { runs: number; findings: number; errors: number; hitRate: number }>;
  addressesFound?: string[];
  // Common
  findings?: Finding[];
  scannedAt?: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function useApi() {
  const call = useCallback(async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${BASE}/api/quantum-audit${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? res.statusText);
    }
    return res.json();
  }, []);
  return { call };
}

// ── Engine card component ─────────────────────────────────────────────────────

interface EngineCardProps {
  id:          EngineType;
  icon:        React.ElementType;
  title:       string;
  description: string;
  color:       string;
  configPanel: React.ReactNode;
  onRun:       () => void;
  disabled:    boolean;
  active:      boolean;
}

function EngineCard({ id, icon: Icon, title, description, color, configPanel, onRun, disabled, active }: EngineCardProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={cn(
      "rounded-xl border bg-gray-900/60 backdrop-blur overflow-hidden transition-all",
      active ? "border-emerald-500/70 shadow-lg shadow-emerald-500/10" : "border-gray-700/50",
    )}>
      <div className="p-4 flex items-start gap-3">
        <div className={cn("mt-0.5 p-2 rounded-lg", color)}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-white">{title}</h3>
            {active && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Running
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <button
            onClick={onRun}
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              disabled
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500 text-white",
            )}
          >
            <Play className="w-3 h-3" />
            Launch
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-700/50 p-4 bg-black/20">
          {configPanel}
        </div>
      )}
    </div>
  );
}

// ── Config panels ─────────────────────────────────────────────────────────────

function BlockScannerConfig({ config, onChange }: { config: Record<string,unknown>; onChange: (c: Record<string,unknown>) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Block Count</label>
          <input
            type="number" min={1} max={1000}
            value={String(config.blockCount ?? 200)}
            onChange={e => onChange({ ...config, blockCount: Number(e.target.value) })}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Max Tx Per Block (0=all)</label>
          <input
            type="number" min={0} max={500}
            value={String(config.maxTxPerBlock ?? 0)}
            onChange={e => onChange({ ...config, maxTxPerBlock: Number(e.target.value) })}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Target Addresses (one per line)</label>
        <textarea
          rows={3}
          placeholder="0x... (optional — leave empty to scan all)"
          value={String(config.addressesRaw ?? "")}
          onChange={e => onChange({ ...config, addressesRaw: e.target.value })}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white font-mono resize-none"
        />
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {(["detectWeakK", "detectBias", "detectPoly", "rCollision"] as const).map(key => (
          <label key={key} className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config[key] !== false}
              onChange={e => onChange({ ...config, [key]: e.target.checked })}
              className="accent-emerald-500"
            />
            {key === "detectWeakK" ? "Weak-K" : key === "detectBias" ? "MSB Bias" : key === "detectPoly" ? "Poly Nonce" : "R-Collision"}
          </label>
        ))}
      </div>
    </div>
  );
}

function WebSpiderConfig({ config, onChange }: { config: Record<string,unknown>; onChange: (c: Record<string,unknown>) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-400 block mb-1">Seed URLs (one per line)</label>
        <textarea
          rows={3}
          placeholder="https://pastebin.com/archive&#10;https://gist.github.com/discover"
          value={String(config.seedsRaw ?? "")}
          onChange={e => onChange({ ...config, seedsRaw: e.target.value })}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white font-mono resize-none"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Max Depth</label>
          <input type="number" min={1} max={6} value={String(config.maxDepth ?? 3)}
            onChange={e => onChange({ ...config, maxDepth: Number(e.target.value) })}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Max URLs</label>
          <input type="number" min={10} max={2000} value={String(config.maxUrls ?? 200)}
            onChange={e => onChange({ ...config, maxUrls: Number(e.target.value) })}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Concurrency</label>
          <input type="number" min={1} max={20} value={String(config.concurrency ?? 8)}
            onChange={e => onChange({ ...config, concurrency: Number(e.target.value) })}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white" />
        </div>
      </div>
    </div>
  );
}

function OsintConfig({ config, onChange }: { config: Record<string,unknown>; onChange: (c: Record<string,unknown>) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-400 block mb-1">Target Addresses (one per line)</label>
        <textarea rows={3} placeholder="0x..."
          value={String(config.addressesRaw ?? "")}
          onChange={e => onChange({ ...config, addressesRaw: e.target.value })}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white font-mono resize-none" />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Extra Keywords (one per line)</label>
        <textarea rows={2} placeholder="ethereum private key&#10;wallet seed"
          value={String(config.keywordsRaw ?? "")}
          onChange={e => onChange({ ...config, keywordsRaw: e.target.value })}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white font-mono resize-none" />
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {(["scanGithub","scanPastebin","scanInputData","scanEns"] as const).map(key => (
          <label key={key} className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
            <input type="checkbox" checked={config[key] !== false}
              onChange={e => onChange({ ...config, [key]: e.target.checked })}
              className="accent-emerald-500" />
            {key === "scanGithub" ? "GitHub" : key === "scanPastebin" ? "Pastebin" : key === "scanInputData" ? "TX Input Data" : "ENS Records"}
          </label>
        ))}
      </div>
    </div>
  );
}

function PeelChainConfig({ config, onChange }: { config: Record<string,unknown>; onChange: (c: Record<string,unknown>) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-400 block mb-1">Start Address *</label>
        <input type="text" placeholder="0x..."
          value={String(config.startAddress ?? "")}
          onChange={e => onChange({ ...config, startAddress: e.target.value })}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white font-mono" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Max Hops</label>
          <input type="number" min={1} max={30} value={String(config.maxHops ?? 10)}
            onChange={e => onChange({ ...config, maxHops: Number(e.target.value) })}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Chain</label>
          <select value={String(config.chain ?? "ethereum")}
            onChange={e => onChange({ ...config, chain: e.target.value })}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white">
            {["ethereum","arbitrum","optimism","base","polygon","bsc"].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
        <input type="checkbox" checked={config.scanSigs !== false}
          onChange={e => onChange({ ...config, scanSigs: e.target.checked })}
          className="accent-emerald-500" />
        Collect signatures &amp; check nonce reuse at each hop
      </label>
    </div>
  );
}

function HybridConfig({ config, onChange }: { config: Record<string,unknown>; onChange: (c: Record<string,unknown>) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-400 block mb-1">Seed Addresses (one per line)</label>
        <textarea rows={3} placeholder="0x..."
          value={String(config.seedAddressesRaw ?? "")}
          onChange={e => onChange({ ...config, seedAddressesRaw: e.target.value })}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white font-mono resize-none" />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Seed URLs (one per line)</label>
        <textarea rows={2} placeholder="https://..."
          value={String(config.seedUrlsRaw ?? "")}
          onChange={e => onChange({ ...config, seedUrlsRaw: e.target.value })}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white font-mono resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Total Blocks (scanner)</label>
          <input type="number" min={50} max={5000} value={String(config.totalBlockRange ?? 500)}
            onChange={e => onChange({ ...config, totalBlockRange: Number(e.target.value) })}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Max Run Time (seconds)</label>
          <input type="number" min={30} max={3600} value={String(Number(config.maxRunTimeMs ?? 300000) / 1000)}
            onChange={e => onChange({ ...config, maxRunTimeMs: Number(e.target.value) * 1000 })}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white" />
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {(["enableBlockScanner","enableWebSpider","enableOsint","enablePeelChain"] as const).map(key => (
          <label key={key} className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
            <input type="checkbox" checked={config[key] !== false}
              onChange={e => onChange({ ...config, [key]: e.target.checked })}
              className="accent-emerald-500" />
            {key === "enableBlockScanner" ? "Block Scanner" : key === "enableWebSpider" ? "Web Spider" : key === "enableOsint" ? "OSINT" : "Peel Chain"}
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Result panels ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-gray-400 hover:text-white transition-colors">
      {copied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function SeverityBadge({ severity }: { severity?: string }) {
  const s = severity?.toLowerCase() ?? "";
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", {
      "bg-red-500/20 text-red-400":    s === "critical",
      "bg-orange-500/20 text-orange-400": s === "high",
      "bg-yellow-500/20 text-yellow-400": s === "medium",
      "bg-blue-500/20 text-blue-400":  s === "low",
      "bg-gray-500/20 text-gray-400":  !s || s === "info",
    })}>
      {s.toUpperCase() || "INFO"}
    </span>
  );
}

function FindingRow({ f, idx }: { f: Finding; idx: number }) {
  const [open, setOpen] = useState(false);
  const kind = f.kind ?? f.attackType ?? "finding";
  const isKey = kind === "private_key" || kind === "nonce_reuse" || kind === "weak_k";
  const value = f.privateKey ?? f.value ?? "";
  return (
    <div className={cn(
      "border rounded-lg overflow-hidden",
      isKey && (f.keyVerified || f.privateKey) ? "border-red-500/50 bg-red-950/20" : "border-gray-700/50 bg-gray-900/40",
    )}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full text-left p-3 flex items-center gap-3 hover:bg-white/5 transition-colors">
        <span className="text-xs text-gray-500 w-6 shrink-0">{idx + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-xs font-mono font-semibold", isKey ? "text-red-400" : "text-emerald-400")}>
              {kind.replace(/_/g, " ").toUpperCase()}
            </span>
            {f.keyVerified && <span className="text-xs bg-red-500/20 text-red-400 px-1.5 rounded">KEY VERIFIED</span>}
            <SeverityBadge severity={f.severity} />
            {f.source && <span className="text-xs text-gray-500">[{f.source}]</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{f.detail ?? f.context ?? ""}</p>
        </div>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-700/50 p-3 space-y-2 text-xs">
          {value && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20 shrink-0">Value:</span>
              <span className="font-mono text-amber-300 break-all flex-1">{value.slice(0, 80)}{value.length > 80 ? "…" : ""}</span>
              <CopyButton text={value} />
            </div>
          )}
          {f.address && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20 shrink-0">Address:</span>
              <span className="font-mono text-blue-300">{f.address}</span>
              <a href={`https://etherscan.io/address/${f.address}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 text-gray-400 hover:text-white" />
              </a>
            </div>
          )}
          {f.r && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20 shrink-0">r value:</span>
              <span className="font-mono text-purple-300 break-all">{f.r.slice(0, 42)}…</span>
            </div>
          )}
          {f.txHashes && f.txHashes.length > 0 && (
            <div>
              <span className="text-gray-500">TX Hashes:</span>
              <div className="mt-1 space-y-1">
                {f.txHashes.slice(0, 3).map(h => (
                  <div key={h} className="flex items-center gap-2">
                    <span className="font-mono text-gray-300 truncate flex-1">{h}</span>
                    <a href={`https://etherscan.io/tx/${h}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3 text-gray-400 hover:text-white" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
          {f.url && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20 shrink-0">URL:</span>
              <a href={f.url} target="_blank" rel="noopener noreferrer"
                className="text-blue-400 hover:underline truncate flex-1">{f.url}</a>
            </div>
          )}
          {f.confidence !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20 shrink-0">Confidence:</span>
              <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(f.confidence * 100).toFixed(0)}%` }} />
              </div>
              <span className="text-gray-400">{(f.confidence * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultPanel({ result, engineType }: { result: EngineResult | null; engineType: string | null }) {
  if (!result) return null;

  const findings = result.findings ?? [];
  const keys = result.privateKeys ?? result.privateKeysFound ?? [];

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {engineType === "block_scanner" && <>
          <StatCard label="Blocks Scanned" value={result.scannedBlocks ?? 0} />
          <StatCard label="Transactions" value={result.scannedTxCount ?? 0} />
          <StatCard label="Signatures Found" value={result.signaturesFound ?? 0} />
          <StatCard label="Unique Addresses" value={result.uniqueAddresses ?? 0} accent />
        </>}
        {engineType === "web_spider" && <>
          <StatCard label="URLs Visited" value={result.urlsVisited ?? 0} />
          <StatCard label="Finds" value={findings.length} />
          <StatCard label="Errors" value={result.errors ?? 0} />
          <StatCard label="In Queue" value={result.urlsQueued ?? 0} accent />
        </>}
        {engineType === "osint" && <>
          <StatCard label="Addresses Searched" value={result.addressesSearched ?? 0} />
          <StatCard label="Sources Probed" value={result.sourcesProbed?.length ?? 0} />
          <StatCard label="Findings" value={findings.length} />
          <StatCard label="Rate Limited" value={result.githubRateLimited ? "Yes" : "No"} accent />
        </>}
        {engineType === "peel_chain" && <>
          <StatCard label="Hops Traced" value={result.totalHops ?? 0} />
          <StatCard label="ETH Peeled" value={`${(result.totalPeeledEth ?? 0).toFixed(4)}`} />
          <StatCard label="Risk Score" value={`${result.riskScore ?? 0}/100`} />
          <StatCard label="Keys Found" value={keys.length} accent />
        </>}
        {engineType === "hybrid" && <>
          <StatCard label="Duration" value={`${(result.durationSecs ?? 0).toFixed(1)}s`} />
          <StatCard label="Worm Runs" value={result.totalWormRuns ?? 0} />
          <StatCard label="Total Findings" value={findings.length} />
          <StatCard label="Keys Found" value={keys.length} accent />
        </>}
      </div>

      {/* Engine 1 → Engine 2 URL Chain section */}
      {engineType === "block_scanner" && result.discoveredUrls && result.discoveredUrls.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-px h-4 bg-violet-500/60" />
            <Globe className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-sm font-medium text-violet-300">
              {result.discoveredUrls.length} URL{result.discoveredUrls.length !== 1 ? "s" : ""} discovered in transaction data
              — automatically fed to Engine 2
            </span>
          </div>
          <div className="rounded-lg border border-violet-500/30 bg-violet-950/10 divide-y divide-violet-800/20 max-h-64 overflow-y-auto">
            {(result.discoveredUrls as DiscoveredUrl[]).map((du, i) => (
              <div key={i} className="px-3 py-2 flex items-start gap-2 text-xs">
                <span className={cn("shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide",
                  du.source === "input_data" ? "bg-violet-800/60 text-violet-300" :
                  du.source === "ipfs_cid"   ? "bg-blue-800/60 text-blue-300" :
                  du.source === "arweave_id" ? "bg-amber-800/60 text-amber-300" :
                  "bg-gray-800 text-gray-400",
                )}>
                  {du.source.replace("_", " ")}
                </span>
                <div className="flex-1 min-w-0">
                  <a href={du.url} target="_blank" rel="noopener noreferrer"
                    className="text-violet-300 hover:text-violet-100 break-all truncate block">
                    {du.url}
                  </a>
                  <div className="text-gray-500 mt-0.5">
                    from <span className="font-mono text-gray-400">{du.fromAddress.slice(0, 10)}…</span>
                    {" "}· block {du.blockNumber}
                    {du.txHash && <> · <a href={`https://etherscan.io/tx/${du.txHash}`} target="_blank" rel="noopener noreferrer"
                      className="text-gray-500 hover:text-gray-300">tx ↗</a></>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {result.chainedSpiderFinds && result.chainedSpiderFinds.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-300">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              Engine 2 found{" "}
              <span className="font-semibold">{result.chainedSpiderFinds.length}</span>{" "}
              item{result.chainedSpiderFinds.length !== 1 ? "s" : ""} by crawling those URLs
            </div>
          )}
        </div>
      )}

      {/* Hybrid worm stats */}
      {engineType === "hybrid" && result.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(result.stats).map(([type, s]) => (
            <div key={type} className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50">
              <div className="text-xs text-gray-500 capitalize">{type.replace(/_/g, " ")}</div>
              <div className="text-sm text-white font-medium mt-1">{s.runs} runs · {s.findings} hits</div>
              <div className="text-xs text-gray-400">{(s.hitRate * 100).toFixed(0)}% hit rate</div>
            </div>
          ))}
        </div>
      )}

      {/* Peel chain hops */}
      {engineType === "peel_chain" && result.hops && result.hops.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Hop Chain</h4>
          <div className="space-y-1">
            {result.hops.map(hop => (
              <div key={hop.hopNumber} className={cn(
                "flex items-center gap-2 p-2 rounded-lg text-xs border",
                hop.nonceReuseFound ? "border-red-500/40 bg-red-950/20" : "border-gray-700/40 bg-gray-900/40",
              )}>
                <span className="text-gray-500 w-6">#{hop.hopNumber}</span>
                <span className="font-mono text-blue-300 truncate flex-1">{hop.address}</span>
                <span className="text-gray-400">{hop.balanceEth.toFixed(4)} ETH</span>
                <span className="text-gray-500">{hop.sigCount} sigs</span>
                <span className={cn("px-1.5 rounded text-xs", {
                  "bg-purple-500/20 text-purple-400": hop.pattern === "fan_out",
                  "bg-blue-500/20 text-blue-400":     hop.pattern === "linear_peel",
                  "bg-orange-500/20 text-orange-400": hop.pattern === "consolidation",
                  "bg-gray-500/20 text-gray-400":     hop.pattern === "direct",
                })}>{hop.pattern}</span>
                {hop.nonceReuseFound && <span className="text-red-400 font-semibold">⚠ NONCE REUSE</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Findings */}
      {findings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            {findings.length} Finding{findings.length !== 1 ? "s" : ""}
          </h4>
          <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
            {findings.map((f, i) => <FindingRow key={i} f={f} idx={i} />)}
          </div>
        </div>
      )}

      {/* Private keys */}
      {keys.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wide flex items-center gap-2">
            <Key className="w-3.5 h-3.5" />
            {keys.length} Private Key{keys.length !== 1 ? "s" : ""} Recovered
          </h4>
          <div className="space-y-1">
            {keys.map((k, i) => (
              <div key={i} className="flex items-center gap-2 bg-red-950/30 border border-red-500/40 rounded-lg p-2">
                <span className="font-mono text-xs text-red-300 break-all flex-1">{k}</span>
                <CopyButton text={k} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent = false }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={cn("text-lg font-bold mt-0.5", accent ? "text-emerald-400" : "text-white")}>{value}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const ENGINES: Array<{
  id: EngineType; icon: React.ElementType; title: string; description: string; color: string;
}> = [
  {
    id: "block_scanner",
    icon: Hash,
    title: "Engine 1 — Block Scanner",
    description: "Mines raw ECDSA (r,s,z) from on-chain txs. Detects nonce reuse, weak-k, r-collisions, bias, and polynomial nonce progressions.",
    color: "bg-blue-600/80",
  },
  {
    id: "web_spider",
    icon: Globe,
    title: "Engine 2 — Web Signature Spider",
    description: "BFS crawls paste sites, GitHub Gists, and public pages for exposed private keys, mnemonics, keystore JSON, and raw ECDSA signatures.",
    color: "bg-purple-600/80",
  },
  {
    id: "osint",
    icon: Search,
    title: "Engine 3 — OSINT Spider",
    description: "Searches GitHub code, Pastebin archives, ENS text records, OP_RETURN Bitcoin data, and Ethereum tx input data for leaked key material.",
    color: "bg-amber-600/80",
  },
  {
    id: "peel_chain",
    icon: GitBranch,
    title: "Engine 4 — Peel Chain Tracer",
    description: "Follows fund-flow transaction chains hop-by-hop. At each traced address, collects signatures and runs full nonce-reuse key recovery.",
    color: "bg-rose-600/80",
  },
  {
    id: "hybrid",
    icon: Cpu,
    title: "Hybrid Worm Engine",
    description: "Deploys all 4 engines simultaneously as coordinated worm swarms. Adaptive load balancing, cross-worm dedup, and unified findings aggregation.",
    color: "bg-emerald-600/80",
  },
];

export default function SignatureMiner() {
  const { call } = useApi();
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [result, setResult] = useState<EngineResult | null>(null);
  const [configs, setConfigs] = useState<Record<EngineType, Record<string,unknown>>>({
    block_scanner: { blockCount: 200, maxTxPerBlock: 0, detectWeakK: true, detectBias: true, detectPoly: true, rCollision: true },
    web_spider:    { maxDepth: 3, maxUrls: 200, concurrency: 8 },
    osint:         { scanGithub: true, scanPastebin: true, scanInputData: true, scanEns: true, maxTxInputBlocks: 20 },
    peel_chain:    { chain: "ethereum", maxHops: 10, scanSigs: true },
    hybrid:        { totalBlockRange: 500, maxRunTimeMs: 300000, enableBlockScanner: true, enableWebSpider: true, enableOsint: true, enablePeelChain: true },
  });
  const [error, setError] = useState<string | null>(null);
  const [pollActive, setPollActive] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const s: EngineStatus = await call("GET", "/sig-engine/status");
      setStatus(s);
      if (s.hasResult && !s.running) {
        const r: EngineResult = await call("GET", "/sig-engine/result");
        setResult(r);
      }
    } catch {}
  }, [call]);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const parseConfig = (type: EngineType, raw: Record<string,unknown>) => {
    const c = { ...raw };
    if ("addressesRaw" in c) {
      c.addresses = String(c.addressesRaw).split("\n").map(s => s.trim()).filter(Boolean);
      delete c.addressesRaw;
    }
    if ("seedsRaw" in c) {
      c.seeds = String(c.seedsRaw).split("\n").map(s => s.trim()).filter(Boolean);
      delete c.seedsRaw;
    }
    if ("keywordsRaw" in c) {
      c.keywords = String(c.keywordsRaw).split("\n").map(s => s.trim()).filter(Boolean);
      delete c.keywordsRaw;
    }
    if ("seedAddressesRaw" in c) {
      c.seedAddresses = String(c.seedAddressesRaw).split("\n").map(s => s.trim()).filter(Boolean);
      delete c.seedAddressesRaw;
    }
    if ("seedUrlsRaw" in c) {
      c.seedUrls = String(c.seedUrlsRaw).split("\n").map(s => s.trim()).filter(Boolean);
      delete c.seedUrlsRaw;
    }
    return c;
  };

  const launchEngine = async (type: EngineType) => {
    setError(null);
    setResult(null);
    try {
      const endpoint = {
        block_scanner: "/sig-engine/block-scanner",
        web_spider:    "/sig-engine/web-spider",
        osint:         "/sig-engine/osint",
        peel_chain:    "/sig-engine/peel-chain",
        hybrid:        "/sig-engine/hybrid",
      }[type];
      await call("POST", endpoint, parseConfig(type, configs[type]));
      await fetchStatus();
      setPollActive(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const stopEngine = async () => {
    try {
      await call("POST", "/sig-engine/stop");
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const configPanels: Record<EngineType, React.ReactNode> = {
    block_scanner: <BlockScannerConfig config={configs.block_scanner} onChange={c => setConfigs(p => ({ ...p, block_scanner: c }))} />,
    web_spider:    <WebSpiderConfig    config={configs.web_spider}    onChange={c => setConfigs(p => ({ ...p, web_spider: c }))} />,
    osint:         <OsintConfig        config={configs.osint}         onChange={c => setConfigs(p => ({ ...p, osint: c }))} />,
    peel_chain:    <PeelChainConfig    config={configs.peel_chain}    onChange={c => setConfigs(p => ({ ...p, peel_chain: c }))} />,
    hybrid:        <HybridConfig       config={configs.hybrid}        onChange={c => setConfigs(p => ({ ...p, hybrid: c }))} />,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-white">Signature Mining Engine Suite</h1>
          </div>
          <p className="text-sm text-gray-400">
            5-engine hybrid mining system for ECDSA private key recovery — on-chain, web, OSINT, peel-chain, and coordinated worm swarm.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status?.running && (
            <button onClick={stopEngine}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors">
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          )}
          <button onClick={fetchStatus}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Global status bar */}
      {status && (
        <div className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm",
          status.running
            ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
            : status.error
            ? "border-red-500/40 bg-red-950/20 text-red-300"
            : status.hasResult
            ? "border-blue-500/40 bg-blue-950/20 text-blue-300"
            : "border-gray-700/50 bg-gray-900/40 text-gray-400",
        )}>
          {status.running ? (
            <><RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Running <span className="font-semibold">{status.engineType}</span> engine since {new Date(status.startedAt!).toLocaleTimeString()}</>
          ) : status.error ? (
            <><AlertTriangle className="w-3.5 h-3.5" /> {status.error}</>
          ) : status.hasResult ? (
            <><CheckCircle className="w-3.5 h-3.5" /> {status.engineType} engine completed — results loaded below</>
          ) : (
            <><Clock className="w-3.5 h-3.5" /> No engine running</>
          )}
        </div>
      )}

      {/* Engine 1 → Engine 2 auto-chain indicator */}
      {status && (status.chainedUrlCount ?? 0) > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-violet-500/40 bg-violet-950/20 text-sm">
          <div className="flex flex-col items-center gap-1 pt-0.5">
            <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center text-white">
              <Hash className="w-2.5 h-2.5" />
            </div>
            <div className="w-px h-4 bg-violet-500/50" />
            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white">
              <Globe className="w-2.5 h-2.5" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-violet-300 mb-0.5">
              Engine 1 → Engine 2 Auto-Chain Active
            </div>
            <div className="text-violet-400/80 text-xs">
              Block scanner found{" "}
              <span className="font-mono text-violet-200 font-semibold">
                {status.chainedUrlCount}
              </span>{" "}
              URL{(status.chainedUrlCount ?? 0) !== 1 ? "s" : ""} embedded in transaction input data.
              Engine 2 (Web Signature Spider) is automatically crawling these URLs to mine any key material
              that was published on-chain alongside those transactions.
            </div>
            {status.running && status.engineType === "web_spider" && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-blue-300">
                <Loader2 className="w-3 h-3 animate-spin" />
                Engine 2 crawling chained URLs now…
              </div>
            )}
          </div>
          <ShieldCheck className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-500/40 bg-red-950/20 text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Engine cards */}
      <div className="space-y-3">
        {ENGINES.map(e => (
          <EngineCard
            key={e.id}
            {...e}
            configPanel={configPanels[e.id]}
            onRun={() => launchEngine(e.id)}
            disabled={!!status?.running}
            active={status?.running === true && status?.engineType === e.id}
          />
        ))}
      </div>

      {/* Results */}
      {(result || status?.running) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-white">
              Results — {status?.engineType ?? "unknown"} engine
            </h2>
          </div>
          <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-4">
            {result
              ? <ResultPanel result={result} engineType={status?.engineType ?? null} />
              : (
                <div className="flex items-center gap-3 text-sm text-gray-400 py-8 justify-center">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Engine running — results will appear when complete…
                </div>
              )
            }
          </div>
        </div>
      )}
    </div>
  );
}
