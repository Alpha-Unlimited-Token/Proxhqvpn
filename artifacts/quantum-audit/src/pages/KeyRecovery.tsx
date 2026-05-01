import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Key, Search, AlertTriangle, CheckCircle, Copy, ShieldAlert,
  Eye, EyeOff, ChevronDown, ChevronRight, Loader2, Info,
  Unlock, Hash, Zap, Binary, Lock, RotateCcw, Upload,
  FileText, XCircle, PlayCircle, StopCircle, SkipForward,
  CheckCircle2, Clock, Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = () => (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
const trunc = (s: string, n = 16) =>
  s && s.length > n * 2 + 3 ? `${s.slice(0, n)}…${s.slice(-n)}` : s;

// ── Types ─────────────────────────────────────────────────────────────────────

type E5Finding = {
  attackType: string;
  severity: "critical" | "high" | "medium";
  address: string;
  privateKey: string | null;
  keyVerified: boolean;
  k0?: string;
  step?: string;
  ratio?: string;
  detail: string;
  txHashes: string[];
  nonces: number[];
  discoveredAt: string;
  math: { attack: string; formula: string; complexity: string; realWorldRisk: string };
};

type NonceReuseHit = { r: string; txs: string[]; recoveredKey?: string };

type SingleResult = {
  address: string;
  txsQueried: number;
  txsFetched: number;
  signaturesAnalyzed: number;
  findings: E5Finding[];
  nonceReuse: NonceReuseHit[];
  summary: { keyRecovered: boolean; criticalCount: number; highCount: number; attackTypes: string[] };
  message?: string;
  error?: string;
};

type WalletStatus = "pending" | "scanning" | "done" | "error" | "skipped";

type WalletResult = {
  address: string;
  status: WalletStatus;
  txsQueried: number;
  txsFetched: number;
  keyRecovered: boolean;
  privateKey: string | null;
  attackType: string | null;
  findings: E5Finding[];
  nonceReuseKeys: string[];
  error?: string;
  startedAt?: string;
  completedAt?: string;
};

type BatchJob = {
  jobId: string;
  status: "running" | "paused" | "done" | "cancelled";
  total: number;
  completed: number;
  pending: number;
  recovered: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  results: WalletResult[];
  summary: { skipped: number; errored: number; done: number; keyCount: number };
};

// ── Constants ─────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high:     "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium:   "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const ATTACK_LABEL: Record<string, string> = {
  sequential_nonce:  "Linear Counter-Nonce",
  geometric_nonce:   "Geometric Ratio Nonce",
  low_s_violation:   "High-S Violation (EIP-2)",
  s_entropy_bias:    "s-Value Entropy Bias",
  lattice_bias_deep: "Deep Lattice Bias (HNP)",
  nonce_reuse:       "Direct Nonce Reuse",
};

const STATUS_ICON: Record<WalletStatus, React.ReactNode> = {
  pending:  <Clock className="w-3.5 h-3.5 text-slate-400" />,
  scanning: <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />,
  done:     <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
  error:    <XCircle className="w-3.5 h-3.5 text-red-400" />,
  skipped:  <SkipForward className="w-3.5 h-3.5 text-slate-500" />,
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost" size="sm"
      className="h-7 px-2 text-xs shrink-0"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
    >
      {copied ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </Button>
  );
}

function RevealKey({ privKey }: { privKey: string }) {
  const [vis, setVis] = useState(false);
  return (
    <div className="flex items-center gap-2 mt-2">
      <code className="flex-1 font-mono text-sm text-red-100 bg-black/50 px-3 py-2 rounded border border-red-500/40 break-all select-all">
        {vis ? privKey : "0x" + "•".repeat(62)}
      </code>
      <Button variant="ghost" size="sm" onClick={() => setVis(!vis)} className="shrink-0">
        {vis ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </Button>
      {vis && <CopyButton text={privKey} />}
    </div>
  );
}

function FindingCard({ f }: { f: E5Finding }) {
  const [open, setOpen] = useState(f.keyVerified);
  return (
    <div className={cn("border rounded-lg overflow-hidden", f.severity === "critical" ? "border-red-500/40" : f.severity === "high" ? "border-orange-500/40" : "border-yellow-500/40")}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/40 transition-colors">
        {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
        <Badge className={cn("text-xs shrink-0", SEVERITY_COLOR[f.severity])}>{f.severity.toUpperCase()}</Badge>
        <span className="font-mono text-sm font-medium">{ATTACK_LABEL[f.attackType] ?? f.attackType}</span>
        {f.keyVerified && <Badge className="ml-auto bg-red-500/20 text-red-300 border-red-500/30 shrink-0"><Unlock className="w-3 h-3 mr-1" />KEY RECOVERED</Badge>}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/40">
          {f.keyVerified && f.privateKey && (
            <div className="mt-4 bg-red-950/40 border border-red-500/40 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Unlock className="w-4 h-4 text-red-400" />
                <span className="font-semibold text-red-300 text-sm">Private Key Recovered</span>
                <span className="ml-auto text-xs text-muted-foreground">cryptographically verified ✓</span>
              </div>
              <RevealKey privKey={f.privateKey} />
              {f.k0 && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div><span className="text-slate-400">k₀ seed:</span><br /><code>{trunc(f.k0, 12)}</code></div>
                  {f.step && <div><span className="text-slate-400">step c:</span><br /><code>{trunc(f.step, 12)}</code></div>}
                </div>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-2">{f.detail}</p>
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-cyan-400 mb-1"><Binary className="w-3 h-3" />Math</div>
            <div><span className="text-slate-400">Formula: </span><code className="text-cyan-300">{f.math.formula}</code></div>
            <div><span className="text-slate-400">Complexity: </span><span className="text-green-300">{f.math.complexity}</span></div>
          </div>
          {f.txHashes.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Transactions (nonces: {f.nonces.join(", ")})</p>
              {f.txHashes.map((h) => (
                <div key={h} className="flex items-center gap-1 mb-1">
                  <Hash className="w-3 h-3 text-slate-500 shrink-0" />
                  <code className="text-xs text-slate-300 font-mono">{trunc(h, 20)}</code>
                  <CopyButton text={h} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: Single wallet scan ────────────────────────────────────────────────────

function SingleTab() {
  const [address, setAddress] = useState("");
  const [manualHashes, setManualHashes] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [result, setResult] = useState<SingleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const validAddress = /^0x[0-9a-fA-F]{40}$/.test(address.trim());

  const runScan = async () => {
    if (!validAddress) return;
    setLoading(true); setResult(null); setError(null);
    setPhase("Fetching transaction history from Ethereum…");
    abortRef.current = new AbortController();
    try {
      const hashes = manualHashes.split(/[\s,\n]+/).map((s) => s.trim()).filter((s) => /^0x[0-9a-fA-F]{64}$/.test(s));
      if (hashes.length > 0) setPhase(`Resolving ${hashes.length} transactions across chains…`);
      const resp = await fetch(`${BASE()}/api/quantum-audit/key-recovery/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim(), ...(hashes.length > 0 ? { txHashes: hashes } : {}) }),
        signal: abortRef.current.signal,
      });
      setPhase("Running Engine 5 analysis…");
      const data = await resp.json() as SingleResult & { error?: string; hint?: string };
      if (!resp.ok) setError((data.error ?? "Scan failed") + (data.hint ? "\n\n" + data.hint : ""));
      else setResult(data);
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") setError("Network error — check the API server.");
    } finally { setLoading(false); setPhase(""); }
  };

  const allKeys = [
    ...(result?.findings.filter((f) => f.keyVerified && f.privateKey).map((f) => f.privateKey!) ?? []),
    ...(result?.nonceReuse.filter((r) => r.recoveredKey).map((r) => r.recoveredKey!) ?? []),
  ];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Search className="w-4 h-4" />Wallet Address</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="0x…" value={address} onChange={(e) => setAddress(e.target.value)} className="font-mono" disabled={loading} />
            <Button onClick={runScan} disabled={!validAddress || loading} className="shrink-0">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Scanning…</> : <><Zap className="w-4 h-4 mr-2" />Scan</>}
            </Button>
            {(loading || result) && <Button variant="outline" size="icon" onClick={() => { abortRef.current?.abort(); setResult(null); setError(null); setLoading(false); }} className="shrink-0"><RotateCcw className="w-4 h-4" /></Button>}
          </div>
          <button onClick={() => setShowManual(!showManual)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            {showManual ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Paste transaction hashes manually (if Etherscan is unavailable)
          </button>
          {showManual && <Textarea placeholder={"0xabc123…\n0xdef456…"} value={manualHashes} onChange={(e) => setManualHashes(e.target.value)} className="font-mono text-xs h-24" disabled={loading} />}
          {loading && phase && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />{phase}</div>}
        </CardContent>
      </Card>

      {error && <div className="flex gap-3 bg-red-950/40 border border-red-500/30 rounded-lg p-4"><AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /><pre className="text-sm text-red-300 whitespace-pre-wrap">{error}</pre></div>}

      {result && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[{ label: "Txs Queried", v: result.txsQueried }, { label: "Sigs Fetched", v: result.txsFetched }, { label: "Analyzed", v: result.signaturesAnalyzed }, { label: "Findings", v: result.findings.length + result.nonceReuse.length }].map(({ label, v }) => (
              <Card key={label} className="p-3 text-center"><div className="text-2xl font-bold font-mono">{v}</div><div className="text-xs text-muted-foreground">{label}</div></Card>
            ))}
          </div>

          {result.summary.keyRecovered && allKeys.length > 0 && (
            <div className="bg-red-950/50 border border-red-500/50 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2"><Unlock className="w-5 h-5 text-red-400" /><span className="font-bold text-red-300">Private key recovered</span><Badge className="bg-red-500/20 text-red-300 border-red-500/30">VERIFIED</Badge></div>
              <p className="text-sm text-red-200">Address <code className="font-mono text-xs bg-black/30 px-1 rounded">{result.address}</code> used predictable signing nonces. Recovered via Engine 5 linear nonce attack — pure algebra, zero brute force.</p>
              {allKeys.map((k) => <RevealKey key={k} privKey={k} />)}
            </div>
          )}

          {!result.summary.keyRecovered && result.findings.length === 0 && result.nonceReuse.length === 0 && (
            <div className="flex gap-3 bg-green-950/30 border border-green-500/30 rounded-lg p-4">
              <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-green-300 font-medium">No sequential nonce vulnerability found</p>
                <p className="text-xs text-muted-foreground mt-1">{result.txsFetched < 3 ? `Only ${result.txsFetched} transaction(s) found — need ≥3 for the attack. Try adding tx hashes manually.` : "Nonces appear cryptographically sound."}</p>
              </div>
            </div>
          )}

          {result.findings.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-red-400" />Engine 5 Findings ({result.findings.length})</h2>
              {result.findings.map((f, i) => <FindingCard key={i} f={f} />)}
            </div>
          )}

          {result.nonceReuse.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Lock className="w-4 h-4 text-orange-400" />Nonce Reuse ({result.nonceReuse.length})</h2>
              {result.nonceReuse.map((h, i) => (
                <div key={i} className="border border-red-500/40 rounded-lg p-4 bg-red-950/20">
                  <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-red-400" /><span className="text-sm font-semibold text-red-300">Nonce Reuse</span>{h.recoveredKey && <Badge className="ml-auto bg-red-500/20 text-red-300 border-red-500/30"><Unlock className="w-3 h-3 mr-1" />KEY RECOVERED</Badge>}</div>
                  <p className="text-xs text-muted-foreground mb-2">Shared r: <code className="text-yellow-300">{trunc(h.r, 20)}</code></p>
                  {h.txs.map((tx) => <div key={tx} className="flex items-center gap-1 mb-1"><Hash className="w-3 h-3 text-slate-500" /><code className="text-xs text-slate-300">{trunc(tx, 20)}</code><CopyButton text={tx} /></div>)}
                  {h.recoveredKey && <RevealKey privKey={h.recoveredKey} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: Batch autonomous scan ────────────────────────────────────────────────

function BatchTab() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<BatchJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedAddr, setExpandedAddr] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pollJob = useCallback(async (id: string) => {
    try {
      const r = await fetch(`${BASE()}/api/quantum-audit/key-recovery/batch/${id}`);
      if (r.ok) {
        const data = await r.json() as BatchJob;
        setJob(data);
        if (data.status === "done" || data.status === "cancelled") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (jobId) {
      pollJob(jobId);
      pollRef.current = setInterval(() => pollJob(jobId), 2_500);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId, pollJob]);

  const startBatchFromFile = async (f: File) => {
    setUploading(true); setError(null); setJob(null); setJobId(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`${BASE()}/api/quantum-audit/key-recovery/batch/upload`, { method: "POST", body: fd });
      const data = await r.json() as { jobId?: string; total?: number; message?: string; error?: string };
      if (!r.ok || !data.jobId) { setError(data.error ?? "Upload failed"); return; }
      setJobId(data.jobId);
    } catch (e) { setError(String(e)); }
    finally { setUploading(false); }
  };

  const startBatchFromPaste = async () => {
    const addresses = [...pasteText.matchAll(/0x[0-9a-fA-F]{40}/gi)].map((m) => m[0].toLowerCase());
    if (addresses.length === 0) { setError("No valid Ethereum addresses found in the pasted text."); return; }
    setUploading(true); setError(null); setJob(null); setJobId(null);
    try {
      const r = await fetch(`${BASE()}/api/quantum-audit/key-recovery/batch`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses }),
      });
      const data = await r.json() as { jobId?: string; error?: string };
      if (!r.ok || !data.jobId) { setError(data.error ?? "Failed"); return; }
      setJobId(data.jobId);
    } catch (e) { setError(String(e)); }
    finally { setUploading(false); }
  };

  const cancelJob = async () => {
    if (!jobId) return;
    await fetch(`${BASE()}/api/quantum-audit/key-recovery/batch/${jobId}`, { method: "DELETE" });
    if (pollRef.current) clearInterval(pollRef.current);
    setJob((j) => j ? { ...j, status: "cancelled" } : j);
  };

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setFile(null); setPasteText(""); setJob(null); setJobId(null); setError(null); setUploading(false);
  };

  const recoveredResults = job?.results.filter((r) => r.keyRecovered) ?? [];
  const pct = job ? Math.round((job.completed / Math.max(job.total, 1)) * 100) : 0;
  const currentlyScanning = job?.results.find((r) => r.status === "scanning");

  return (
    <div className="space-y-5">
      {/* Upload area */}
      {!jobId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4" />Upload Wallet List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop zone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30",
                uploading && "opacity-50 pointer-events-none",
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) { setFile(f); startBatchFromFile(f); }
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept=".txt,.csv,.json,.md,.log" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); startBatchFromFile(f); } }} />
              {uploading ? (
                <div className="flex flex-col items-center gap-2"><Loader2 className="w-8 h-8 text-primary animate-spin" /><p className="text-sm text-muted-foreground">Uploading and parsing addresses…</p></div>
              ) : file ? (
                <div className="flex flex-col items-center gap-2"><FileText className="w-8 h-8 text-primary" /><p className="font-medium">{file.name}</p><p className="text-xs text-muted-foreground">Starting scan…</p></div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Upload className="w-10 h-10" />
                  <div>
                    <p className="font-medium text-foreground">Drop your wallet list here</p>
                    <p className="text-sm mt-1">Or click to browse — .txt, .csv, .json supported</p>
                    <p className="text-xs mt-2">One address per line, or any format — it auto-extracts 0x… addresses</p>
                  </div>
                </div>
              )}
            </div>

            {/* Paste alternative */}
            <div>
              <button onClick={() => setShowPaste(!showPaste)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                {showPaste ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Or paste addresses directly
              </button>
              {showPaste && (
                <div className="mt-2 space-y-2">
                  <Textarea
                    placeholder={"0x1234abcd…\n0x5678efgh…\n(one per line)"}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    className="font-mono text-xs h-32"
                  />
                  <Button onClick={startBatchFromPaste} disabled={uploading || !pasteText.trim()} size="sm">
                    <PlayCircle className="w-4 h-4 mr-2" />Start Batch Scan
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="flex gap-3 bg-red-950/40 border border-red-500/30 rounded-lg p-4">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <pre className="text-sm text-red-300 whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {/* Active job display */}
      {job && (
        <div className="space-y-4">
          {/* Job header */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-2.5 h-2.5 rounded-full", job.status === "running" ? "bg-cyan-400 animate-pulse" : job.status === "done" ? "bg-green-400" : "bg-slate-400")} />
                  <span className="font-semibold capitalize">{job.status}</span>
                  <Badge variant="outline" className="text-xs font-mono">{job.jobId}</Badge>
                </div>
                <div className="flex gap-2">
                  {job.status === "running" && (
                    <Button variant="outline" size="sm" onClick={cancelJob} className="text-red-400 border-red-400/40 hover:bg-red-950/40">
                      <StopCircle className="w-4 h-4 mr-1.5" />Stop
                    </Button>
                  )}
                  {(job.status === "done" || job.status === "cancelled") && (
                    <Button variant="outline" size="sm" onClick={reset}>
                      <RotateCcw className="w-4 h-4 mr-1.5" />New Scan
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{job.completed} / {job.total} wallets scanned</span>
                  <span>{pct}%</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>

              {/* Current wallet */}
              {currentlyScanning && (
                <div className="flex items-center gap-2 text-xs text-cyan-400">
                  <Cpu className="w-3.5 h-3.5 animate-pulse" />
                  Scanning: <code className="font-mono">{currentlyScanning.address}</code>
                </div>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {[
                  { label: "Total", value: job.total, color: "" },
                  { label: "Keys Found", value: job.summary.keyCount, color: "text-red-400" },
                  { label: "Skipped", value: job.summary.skipped, color: "text-slate-400" },
                  { label: "Errors", value: job.summary.errored, color: "text-orange-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center bg-card/50 rounded-lg p-2">
                    <div className={cn("text-xl font-bold font-mono", color)}>{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recovered keys banner */}
          {recoveredResults.length > 0 && (
            <div className="bg-red-950/50 border border-red-500/50 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Unlock className="w-5 h-5 text-red-400" />
                <span className="font-bold text-red-300">{recoveredResults.length} private key{recoveredResults.length > 1 ? "s" : ""} recovered</span>
                <Badge className="bg-red-500/20 text-red-300 border-red-500/30">ENGINE 5</Badge>
              </div>
              <div className="space-y-3">
                {recoveredResults.map((r) => (
                  <div key={r.address} className="bg-black/30 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <code className="text-red-300 font-mono">{r.address}</code>
                      <Badge className="text-xs bg-orange-500/20 text-orange-300 border-orange-500/30">{ATTACK_LABEL[r.attackType ?? ""] ?? r.attackType}</Badge>
                    </div>
                    {r.privateKey && <RevealKey privKey={r.privateKey} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-wallet results list */}
          {job.results.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">Wallet Results ({job.results.length})</h2>
              <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
                {[...job.results].reverse().map((r) => (
                  <div key={r.address} className={cn("border rounded-lg overflow-hidden", r.keyRecovered ? "border-red-500/50 bg-red-950/10" : r.status === "error" ? "border-orange-500/30" : "border-border/40")}>
                    <button
                      onClick={() => setExpandedAddr(expandedAddr === r.address ? null : r.address)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/30 transition-colors"
                    >
                      {STATUS_ICON[r.status]}
                      <code className="text-xs font-mono text-slate-300 flex-1">{trunc(r.address, 14)}</code>
                      {r.keyRecovered && <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs shrink-0"><Unlock className="w-2.5 h-2.5 mr-1" />KEY</Badge>}
                      {r.status === "skipped" && <span className="text-xs text-slate-500">{r.error}</span>}
                      {r.status === "scanning" && <Loader2 className="w-3 h-3 animate-spin text-cyan-400 shrink-0" />}
                      {r.txsFetched > 0 && <span className="text-xs text-muted-foreground shrink-0">{r.txsFetched} sigs</span>}
                      {expandedAddr === r.address ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                    {expandedAddr === r.address && (
                      <div className="px-4 pb-4 border-t border-border/40 space-y-3 pt-3">
                        <div className="grid grid-cols-3 gap-2 text-xs text-center">
                          <div className="bg-card/50 rounded p-2"><div className="font-bold">{r.txsQueried}</div><div className="text-muted-foreground">Txs queried</div></div>
                          <div className="bg-card/50 rounded p-2"><div className="font-bold">{r.txsFetched}</div><div className="text-muted-foreground">Sigs fetched</div></div>
                          <div className="bg-card/50 rounded p-2"><div className={cn("font-bold", r.keyRecovered ? "text-red-400" : "")}>{r.keyRecovered ? "YES" : "NO"}</div><div className="text-muted-foreground">Key found</div></div>
                        </div>
                        {r.error && <p className="text-xs text-orange-300">{r.error}</p>}
                        {r.keyRecovered && r.privateKey && (
                          <div className="bg-red-950/40 border border-red-500/40 rounded-lg p-3">
                            <p className="text-xs text-red-300 mb-1 font-semibold">Private Key — <span className="font-normal">{ATTACK_LABEL[r.attackType ?? ""] ?? r.attackType}</span></p>
                            <RevealKey privKey={r.privateKey} />
                          </div>
                        )}
                        {r.findings.length > 0 && r.findings.map((f, i) => <FindingCard key={i} f={f} />)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KeyRecovery() {
  const [tab, setTab] = useState<"single" | "batch">("single");

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Key className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold font-mono">Key Recovery</h1>
          <Badge className="bg-primary/20 text-primary border-primary/30">Engine 5</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Recover private keys from old Android wallets (2012–2014) that used predictable nonce generation.
          Supports single address lookup or bulk file upload with autonomous scanning.
        </p>
      </div>

      {/* Info */}
      <div className="flex gap-3 bg-blue-950/40 border border-blue-500/30 rounded-lg p-4 text-sm">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-blue-200">
          This tool is for recovering your <strong>own</strong> wallets. It detects
          <strong> sequential nonce generation</strong> — a flaw in early Android
          wallets where <code className="bg-black/30 px-1 rounded mx-1">java.util.Random</code>
          derived signing nonces from the transaction counter. Three transactions is enough — no brute force, pure algebra.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card border border-border rounded-lg p-1 w-fit">
        {(["single", "batch"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "single" ? <><Search className="w-4 h-4 inline mr-1.5" />Single Wallet</> : <><Upload className="w-4 h-4 inline mr-1.5" />Batch / File Upload</>}
          </button>
        ))}
      </div>

      {tab === "single" ? <SingleTab /> : <BatchTab />}
    </div>
  );
}
