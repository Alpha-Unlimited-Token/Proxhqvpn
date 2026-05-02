// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload, FileText, AlertTriangle, CheckCircle, Search,
  RefreshCw, Download, Copy, Layers, ChevronDown, ChevronUp,
  X, Eye, ShieldAlert, Filter, Zap, Trash2, BarChart3
} from "lucide-react";

const BASE = () => (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
const trunc = (s: string, n = 16) => !s ? "" : s.length > n * 2 + 3 ? s.slice(0, n) + "…" + s.slice(-n) : s;
const cp = (s: string) => navigator.clipboard?.writeText(s).catch(() => {});

// ── Types ────────────────────────────────────────────────────────────────────
type ChainInfo = {
  chain: string; displayName: string; schemeLabel: string; signatureScheme: string;
  confidence: number; explorerBase: string;
};

type DetectRow = {
  target: string;
  detected: ChainInfo | null;
  confidence: number;
};

type ScanRow = {
  target: string;
  detectedChain: ChainInfo | null;
  hasVulnerability: boolean;
  vulnerabilityCount: number;
  scanError: string | null;
  executionTimeMs: number;
  scanTimestamp: string;
  result?: Record<string, unknown>;
};

type ScanStatus = "idle" | "detecting" | "scanning" | "done";

type FilterMode = "all" | "vulnerable" | "clean" | "error" | "unknown";

// ── Scheme badge colors ──────────────────────────────────────────────────────
const SCHEME_BADGE: Record<string, string> = {
  "secp256k1-ecdsa": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "ed25519":         "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "sr25519-schnorr": "bg-pink-500/20 text-pink-400 border-pink-500/30",
  "clsag":           "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "p256-ecdsa":      "bg-teal-500/20 text-teal-400 border-teal-500/30",
};

// ── Parse a text blob into clean target list ─────────────────────────────────
function parseTargets(raw: string): string[] {
  return raw
    .split(/[\n\r,]+/)
    .map(l => l.replace(/#.*$/, "").replace(/\/\/.*$/, "").trim())
    .filter(l => l.length >= 10)
    .filter((v, i, a) => a.indexOf(v) === i); // deduplicate
}

// ── Progress bar component ───────────────────────────────────────────────────
function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono text-muted-foreground">
        <span>{done} / {total} scanned</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Summary stats bar ────────────────────────────────────────────────────────
function SummaryBar({ results }: { results: ScanRow[] }) {
  const total     = results.length;
  const vuln      = results.filter(r => r.hasVulnerability).length;
  const clean     = results.filter(r => !r.hasVulnerability && !r.scanError && r.detectedChain).length;
  const errored   = results.filter(r => !!r.scanError).length;
  const unknown   = results.filter(r => !r.detectedChain && !r.scanError).length;

  const stats = [
    { label: "Total",      value: total,   cls: "text-foreground border-border/50",                         bg: "bg-muted/20" },
    { label: "Vulnerable", value: vuln,    cls: "text-red-400 border-red-500/40",                           bg: "bg-red-500/10" },
    { label: "Clean",      value: clean,   cls: "text-green-400 border-green-500/40",                       bg: "bg-green-500/10" },
    { label: "Errored",    value: errored, cls: "text-yellow-400 border-yellow-500/40",                     bg: "bg-yellow-500/10" },
    { label: "Unknown",    value: unknown, cls: "text-muted-foreground border-border/40",                   bg: "bg-muted/10" },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {stats.map(s => (
        <div key={s.label} className={`p-3 rounded-lg border text-center ${s.bg} ${s.cls}`}>
          <p className="text-2xl font-bold font-mono">{s.value}</p>
          <p className="text-xs font-mono mt-0.5 opacity-80">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Export helpers ───────────────────────────────────────────────────────────
function exportCSV(results: ScanRow[]) {
  const headers = ["Target","Chain","Scheme","Confidence","Vulnerable","VulnCount","Error","ExecMs","Timestamp"];
  const rows = results.map(r => [
    r.target,
    r.detectedChain?.displayName ?? "Unknown",
    r.detectedChain?.schemeLabel ?? "",
    r.detectedChain?.confidence ?? 0,
    r.hasVulnerability ? "YES" : "NO",
    r.vulnerabilityCount,
    r.scanError ?? "",
    r.executionTimeMs ?? "",
    r.scanTimestamp ?? "",
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `quantum-batch-scan-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(results: ScanRow[]) {
  const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `quantum-batch-scan-${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
}

// ── Result row ───────────────────────────────────────────────────────────────
function ResultRow({ row, idx, expanded, onToggle }: {
  row: ScanRow; idx: number; expanded: boolean; onToggle: () => void;
}) {
  const chain = row.detectedChain;
  const schemeBadge = SCHEME_BADGE[chain?.signatureScheme ?? ""] ?? "bg-muted/20 text-muted-foreground border-border/30";

  const explorerUrl = chain?.explorerBase
    ? `${chain.explorerBase}/${row.target.startsWith("0x") ? "address" : "account"}/${row.target}`
    : null;

  return (
    <>
      <tr
        className={`border-b border-border/20 cursor-pointer hover:bg-muted/5 transition-colors ${row.hasVulnerability ? "bg-red-500/5" : ""}`}
        onClick={onToggle}
      >
        {/* # */}
        <td className="py-2 pl-3 pr-2 text-muted-foreground font-mono text-xs">{idx + 1}</td>
        {/* Target */}
        <td className="py-2 pr-3">
          <div className="flex items-center gap-1.5">
            <code className="font-mono text-xs text-foreground">{trunc(row.target, 14)}</code>
            <button onClick={e => { e.stopPropagation(); cp(row.target); }} className="opacity-40 hover:opacity-100 flex-shrink-0">
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </td>
        {/* Chain */}
        <td className="py-2 pr-3">
          {chain
            ? <span className="text-xs font-mono text-foreground">{chain.displayName.split("(")[0].trim()}</span>
            : <span className="text-xs text-muted-foreground">Unknown</span>}
        </td>
        {/* Scheme */}
        <td className="py-2 pr-3">
          {chain && <Badge className={`text-[10px] font-mono ${schemeBadge}`}>{chain.schemeLabel.split("/")[0].trim()}</Badge>}
        </td>
        {/* Status */}
        <td className="py-2 pr-3">
          {row.scanError
            ? <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">Error</Badge>
            : row.hasVulnerability
              ? <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] font-bold">⚠ VULNERABLE</Badge>
              : !chain
                ? <Badge className="bg-muted/20 text-muted-foreground border-border/30 text-[10px]">Unknown</Badge>
                : <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">Clean</Badge>}
        </td>
        {/* Vuln count */}
        <td className="py-2 pr-3 text-center">
          {row.hasVulnerability
            ? <span className="text-red-400 font-bold font-mono text-xs">{row.vulnerabilityCount}</span>
            : <span className="text-muted-foreground text-xs">—</span>}
        </td>
        {/* Exec time */}
        <td className="py-2 pr-3 text-xs font-mono text-muted-foreground text-right">
          {row.executionTimeMs ? `${row.executionTimeMs}ms` : "—"}
        </td>
        {/* Expand */}
        <td className="py-2 pr-3 text-muted-foreground">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </td>
      </tr>

      {/* Expanded detail */}
      {expanded && (
        <tr className="border-b border-border/20 bg-muted/5">
          <td colSpan={8} className="px-6 py-3">
            <div className="space-y-2 text-xs font-mono">
              {/* Full target */}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-24 flex-shrink-0">Full target:</span>
                <code className="text-foreground break-all flex-1">{row.target}</code>
                <button onClick={() => cp(row.target)}><Copy className="w-3 h-3 text-muted-foreground hover:text-primary" /></button>
              </div>
              {/* Chain details */}
              {chain && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-24 flex-shrink-0">Chain:</span>
                    <span>{chain.displayName}</span>
                    {explorerUrl && <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-2">View in explorer ↗</a>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-24 flex-shrink-0">Scheme:</span>
                    <Badge className={`text-[10px] ${schemeBadge}`}>{chain.schemeLabel}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-24 flex-shrink-0">Confidence:</span>
                    <span>{chain.confidence}%</span>
                  </div>
                </>
              )}
              {/* Error */}
              {row.scanError && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-24 flex-shrink-0 flex-shrink-0">Error:</span>
                  <span className="text-yellow-400 break-all">{row.scanError}</span>
                </div>
              )}
              {/* Vulnerability detail */}
              {row.hasVulnerability && row.result && (
                <div className="mt-2 bg-red-500/10 border border-red-500/30 rounded p-3 space-y-1">
                  <p className="font-bold text-red-400">⚠ {row.vulnerabilityCount} vulnerability instance(s) detected</p>
                  {(() => {
                    const r = row.result as Record<string, unknown>;
                    const pairs = (r.nonceReusePairs ?? r.reuseDetected ?? []) as Array<Record<string, unknown>>;
                    return pairs.slice(0, 3).map((pair, i) => (
                      <div key={i} className="text-muted-foreground">
                        <span className="text-red-400">Pair {i + 1}: </span>
                        Shared R/KeyImage: <code className="text-orange-300">{trunc(String(pair.sharedR ?? pair.keyImage ?? ""), 12)}</code>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Detection-only preview table ─────────────────────────────────────────────
function DetectTable({ rows }: { rows: DetectRow[] }) {
  return (
    <div className="overflow-x-auto rounded border border-border/30">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-border/50 bg-muted/20 text-muted-foreground">
            <th className="py-2 pl-3 pr-2 text-left w-8">#</th>
            <th className="py-2 pr-3 text-left">Target</th>
            <th className="py-2 pr-3 text-left">Detected Chain</th>
            <th className="py-2 pr-3 text-left">Scheme</th>
            <th className="py-2 pr-3 text-left">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const chain = row.detected;
            const schemeBadge = SCHEME_BADGE[chain?.signatureScheme ?? ""] ?? "bg-muted/20 text-muted-foreground border-border/30";
            return (
              <tr key={i} className="border-b border-border/20 hover:bg-muted/5">
                <td className="py-1.5 pl-3 pr-2 text-muted-foreground">{i + 1}</td>
                <td className="py-1.5 pr-3"><code className="text-foreground">{trunc(row.target, 14)}</code></td>
                <td className="py-1.5 pr-3">{chain ? <span>{chain.displayName.split("(")[0].trim()}</span> : <span className="text-muted-foreground italic">Unknown</span>}</td>
                <td className="py-1.5 pr-3">{chain && <Badge className={`text-[10px] ${schemeBadge}`}>{chain.schemeLabel.split("/")[0].trim()}</Badge>}</td>
                <td className="py-1.5 pr-3">
                  {chain
                    ? <div className="flex items-center gap-2"><div className="h-1.5 w-16 bg-muted/30 rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${chain.confidence}%` }} /></div><span className="text-muted-foreground">{chain.confidence}%</span></div>
                    : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BatchScan() {
  const [rawInput, setRawInput]       = useState("");
  const [targets, setTargets]         = useState<string[]>([]);
  const [status, setStatus]           = useState<ScanStatus>("idle");
  const [detectRows, setDetectRows]   = useState<DetectRow[]>([]);
  const [scanRows, setScanRows]       = useState<ScanRow[]>([]);
  const [progress, setProgress]       = useState({ done: 0, total: 0 });
  const [error, setError]             = useState<string | null>(null);
  const [filter, setFilter]           = useState<FilterMode>("all");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [showDetect, setShowDetect]   = useState(false);
  const fileRef                        = useRef<HTMLInputElement>(null);
  const abortRef                       = useRef(false);

  // ── File loading ────────────────────────────────────────────────────────────
  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = String(e.target?.result ?? "");
      setRawInput(text);
      const parsed = parseTargets(text);
      setTargets(parsed);
      setDetectRows([]);
      setScanRows([]);
      setStatus("idle");
      setError(null);
    };
    reader.readAsText(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, []);

  const onPasteApply = () => {
    const parsed = parseTargets(rawInput);
    setTargets(parsed);
    setDetectRows([]);
    setScanRows([]);
    setStatus("idle");
    setError(null);
  };

  // ── Batch detect (fast, chain ID only) ─────────────────────────────────────
  const runDetect = async () => {
    if (targets.length === 0) return;
    setStatus("detecting");
    setDetectRows([]);
    setError(null);
    try {
      const res = await fetch(`${BASE()}/api/quantum-audit/batch-detect`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setDetectRows(json.results as DetectRow[]);
      setShowDetect(true);
    } catch (e) { setError(String(e)); }
    setStatus("idle");
  };

  // ── Batch scan (full, chunked with progress) ────────────────────────────────
  const CHUNK_SIZE = 10;

  const runScan = async () => {
    if (targets.length === 0) return;
    abortRef.current = false;
    setStatus("scanning");
    setScanRows([]);
    setProgress({ done: 0, total: targets.length });
    setError(null);
    setFilter("all");
    setExpandedIdx(null);

    const allResults: ScanRow[] = [];

    try {
      for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
        if (abortRef.current) break;
        const chunk = targets.slice(i, i + CHUNK_SIZE);
        const res = await fetch(`${BASE()}/api/quantum-audit/batch-scan`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targets: chunk }),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? "Batch scan failed");
        }
        const json = await res.json();
        allResults.push(...(json.results as ScanRow[]));
        setScanRows([...allResults]);
        setProgress({ done: Math.min(i + CHUNK_SIZE, targets.length), total: targets.length });
      }
    } catch (e) { setError(String(e)); }
    finally { setStatus("done"); setProgress(p => ({ ...p, done: allResults.length })); }
  };

  const stopScan = () => { abortRef.current = true; };

  // ── Filter logic ────────────────────────────────────────────────────────────
  const filteredRows = scanRows.filter(r => {
    if (filter === "all")        return true;
    if (filter === "vulnerable") return r.hasVulnerability;
    if (filter === "clean")      return !r.hasVulnerability && !r.scanError && !!r.detectedChain;
    if (filter === "error")      return !!r.scanError;
    if (filter === "unknown")    return !r.detectedChain && !r.scanError;
    return true;
  });

  const hasResults = scanRows.length > 0;
  const vulnCount  = scanRows.filter(r => r.hasVulnerability).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-mono">Batch Scanner</h1>
          <p className="text-sm text-muted-foreground">
            Load a list of wallet addresses or transaction hashes from a text file (one per line). The scanner auto-detects each blockchain, applies the correct cryptographic equations, and runs the full audit across all targets simultaneously.
          </p>
        </div>
      </div>

      {/* ── Input Section ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* File drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all text-center min-h-40"
        >
          <Upload className="w-10 h-10 text-primary/60" />
          <div>
            <p className="font-mono font-bold text-sm">Drop .txt file here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">One address or tx hash per line · Comments with # ignored · Duplicates removed</p>
          </div>
          <input ref={fileRef} type="file" accept=".txt,.csv,.json,text/plain" className="hidden" onChange={onFileChange} />
        </div>

        {/* Paste area */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-muted-foreground">OR PASTE ADDRESSES / TX HASHES</label>
          <Textarea
            value={rawInput}
            onChange={e => setRawInput(e.target.value)}
            placeholder={"0xAbCd1234…\n1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf…\nbc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh…\n# lines starting with # are ignored"}
            className="font-mono text-xs h-36 resize-none"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-mono">
              {rawInput ? `~${parseTargets(rawInput).length} targets parsed` : "Paste addresses or tx hashes above"}
            </p>
            <Button onClick={onPasteApply} variant="outline" size="sm" disabled={!rawInput.trim()} className="text-xs font-mono gap-1.5">
              <FileText className="w-3 h-3" /> Apply
            </Button>
          </div>
        </div>
      </div>

      {/* Loaded targets summary */}
      {targets.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-primary" />
              <div>
                <p className="font-mono font-bold">{targets.length} targets loaded</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {targets.slice(0, 3).map(t => trunc(t, 12)).join("  ·  ")}
                  {targets.length > 3 ? `  ·  +${targets.length - 3} more` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => { setTargets([]); setRawInput(""); setScanRows([]); setDetectRows([]); setStatus("idle"); }} variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground">
                <Trash2 className="w-3 h-3" /> Clear
              </Button>
              <Button onClick={runDetect} disabled={status !== "idle"} variant="outline" size="sm" className="text-xs font-mono gap-1.5 border-primary/30 text-primary">
                <Search className="w-3 h-3" /> Detect Chains
              </Button>
              <Button onClick={runScan} disabled={status === "scanning" || status === "detecting"} className="bg-primary text-black hover:bg-primary/90 font-bold gap-2">
                {status === "scanning" ? <><RefreshCw className="w-4 h-4 animate-spin" />Scanning…</> : <><Zap className="w-4 h-4" />Full Scan All</>}
              </Button>
              {status === "scanning" && (
                <Button onClick={stopScan} variant="outline" size="sm" className="gap-1.5 border-destructive/50 text-destructive text-xs">
                  <X className="w-3 h-3" /> Stop
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Max limit warning */}
      {targets.length > 200 && (
        <div className="flex items-center gap-2 p-3 rounded border border-yellow-500/40 bg-yellow-500/10 text-yellow-400 text-xs font-mono">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p>Full scan is limited to 200 targets per batch. Only the first 200 will be scanned. Detection preview shows all {targets.length}.</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4 flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm font-mono">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Progress ──────────────────────────────────────────────────────── */}
      {status === "scanning" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
              <div className="flex-1">
                <p className="font-mono font-bold text-sm">Adaptive batch scan in progress…</p>
                <p className="text-xs text-muted-foreground mt-0.5">Auto-detecting chains and applying matching cryptographic equations</p>
              </div>
            </div>
            <ProgressBar done={progress.done} total={progress.total} />
            {scanRows.length > 0 && (
              <p className="text-xs font-mono text-muted-foreground">
                {scanRows.filter(r => r.hasVulnerability).length} vulnerabilities found so far
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Detection Preview ─────────────────────────────────────────────── */}
      {detectRows.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <button onClick={() => setShowDetect(p => !p)} className="flex items-center justify-between w-full">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Search className="w-4 h-4 text-primary" />
                Chain Detection Preview ({detectRows.length} targets)
              </CardTitle>
              {showDetect ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </CardHeader>
          {showDetect && (
            <CardContent>
              <DetectTable rows={detectRows} />
              {status === "idle" && (
                <Button onClick={runScan} className="mt-3 bg-primary text-black hover:bg-primary/90 font-bold gap-2">
                  <Zap className="w-4 h-4" /> Run Full Scan on All {targets.length} Targets
                </Button>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Scan Results ──────────────────────────────────────────────────── */}
      {hasResults && (
        <>
          {/* Summary */}
          <SummaryBar results={scanRows} />

          {/* Vulnerability alert */}
          {vulnCount > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-red-500 bg-red-500/10">
              <ShieldAlert className="w-7 h-7 text-red-400 flex-shrink-0" />
              <div>
                <p className="font-bold font-mono text-red-400">⚠ {vulnCount} TARGET{vulnCount > 1 ? "S" : ""} WITH CRYPTOGRAPHIC VULNERABILITIES</p>
                <p className="text-xs text-red-400/80 mt-0.5">
                  Nonce reuse or duplicate key images detected. Click on the highlighted rows to see full recovery math.
                </p>
              </div>
            </div>
          )}

          {/* Filter + export toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3 h-3 text-muted-foreground" />
              {(["all","vulnerable","clean","error","unknown"] as FilterMode[]).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold border capitalize transition-all ${filter === f
                    ? f === "vulnerable" ? "bg-red-500 text-white border-red-500"
                    : f === "clean" ? "bg-green-600 text-white border-green-600"
                    : f === "error" ? "bg-yellow-500 text-black border-yellow-500"
                    : "bg-primary text-black border-primary"
                    : "border-border/50 text-muted-foreground hover:border-border"}`}>
                  {f} {f !== "all" && <span className="opacity-70">({scanRows.filter(r =>
                    f === "vulnerable" ? r.hasVulnerability :
                    f === "clean" ? !r.hasVulnerability && !r.scanError && !!r.detectedChain :
                    f === "error" ? !!r.scanError :
                    f === "unknown" ? !r.detectedChain && !r.scanError : true
                  ).length})</span>}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => exportCSV(scanRows)} variant="outline" size="sm" className="gap-1.5 text-xs font-mono">
                <Download className="w-3 h-3" /> CSV
              </Button>
              <Button onClick={() => exportJSON(scanRows)} variant="outline" size="sm" className="gap-1.5 text-xs font-mono">
                <Download className="w-3 h-3" /> JSON
              </Button>
            </div>
          </div>

          {/* Results table */}
          <Card className="border-border/50">
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20 text-muted-foreground">
                    <th className="py-2 pl-3 pr-2 text-left w-8">#</th>
                    <th className="py-2 pr-3 text-left">Target</th>
                    <th className="py-2 pr-3 text-left">Chain</th>
                    <th className="py-2 pr-3 text-left">Scheme</th>
                    <th className="py-2 pr-3 text-left">Status</th>
                    <th className="py-2 pr-3 text-center">Vulns</th>
                    <th className="py-2 pr-3 text-right">Time</th>
                    <th className="py-2 pr-3 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, i) => (
                    <ResultRow
                      key={row.target + i}
                      row={row}
                      idx={scanRows.indexOf(row)}
                      expanded={expandedIdx === scanRows.indexOf(row)}
                      onToggle={() => setExpandedIdx(p => p === scanRows.indexOf(row) ? null : scanRows.indexOf(row))}
                    />
                  ))}
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={8} className="py-8 text-center text-muted-foreground font-mono text-xs">No results match the current filter</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Live rows coming in during scan */}
          {status === "scanning" && scanRows.length < targets.length && (
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <RefreshCw className="w-3 h-3 animate-spin text-primary" />
              Scanning remaining {targets.length - scanRows.length} target(s)…
            </div>
          )}
        </>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {targets.length === 0 && status === "idle" && (
        <div className="py-16 text-center space-y-3 text-muted-foreground">
          <Upload className="w-12 h-12 mx-auto opacity-30" />
          <div>
            <p className="font-mono font-bold text-foreground">No targets loaded</p>
            <p className="text-sm mt-1">Upload a .txt file or paste addresses above to get started</p>
            <p className="text-xs mt-3 opacity-70">Supports: Ethereum · Bitcoin · Solana · Polkadot · Monero · Cardano · Stellar · Algorand · Cosmos · Tezos · and more</p>
          </div>
        </div>
      )}
    </div>
  );
}
