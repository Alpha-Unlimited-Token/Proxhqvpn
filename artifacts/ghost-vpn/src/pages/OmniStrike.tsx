import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Zap, Square, Trash2, ChevronDown, ChevronUp, Download,
  ShieldAlert, AlertTriangle, Info, CheckCircle, RefreshCw, Copy
} from "lucide-react";

const API = "/api/omnistrike";

const CATEGORIES = [
  { id: "sqli",    label: "SQL Injection",       desc: "Boolean, UNION, time-based blind, error-based, stacked queries (6 techniques)" },
  { id: "xss",     label: "XSS",                 desc: "Reflected and DOM-based cross-site scripting payloads" },
  { id: "lfi",     label: "LFI / Path Traversal", desc: "Local file inclusion, directory traversal, PHP wrapper abuse" },
  { id: "cmdi",    label: "Command Injection",    desc: "OS command chaining, reverse shell patterns, backtick substitution" },
  { id: "ssrf",    label: "SSRF",                 desc: "Internal IP, localhost, cloud metadata endpoint probing" },
  { id: "xxe",     label: "XXE",                  desc: "XML external entity injection with file:// and HTTP entities" },
  { id: "ssti",    label: "SSTI",                 desc: "Jinja2, Twig, Freemarker, Python class traversal payloads" },
  { id: "headers", label: "Header Injection",     desc: "Host header, X-Forwarded-For, X-Original-URL bypass" },
  { id: "cors",    label: "CORS Misconfiguration", desc: "Permissive ACAO header detection across multiple origins" },
  { id: "auth",    label: "Auth Brute Force",     desc: "Default credentials against /login, /admin, /wp-login, /api/auth" },
  { id: "nosql",   label: "NoSQL Injection",      desc: "MongoDB operator injection ($ne, $gt, $regex, $where)" },
];

type Finding = {
  category: string;
  technique: string;
  payload: string;
  url: string;
  parameter: string;
  statusCode: number;
  responseTime: number;
  evidence: string;
  severity: "critical" | "high" | "medium" | "low";
  bypassed: boolean;
};

type Scan = {
  id: number;
  target: string;
  status: string;
  findings: Finding[];
  stats: any;
  successRate: number;
  log: string[];
  startedAt: string;
  completedAt?: string;
};

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-blue-500 text-white",
};

const SEV_ICON: Record<string, JSX.Element> = {
  critical: <ShieldAlert className="h-4 w-4 text-red-400" />,
  high: <AlertTriangle className="h-4 w-4 text-orange-400" />,
  medium: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
  low: <Info className="h-4 w-4 text-blue-400" />,
};

export default function OmniStrike() {
  const { toast } = useToast();
  const [target, setTarget] = useState("");
  const [categories, setCategories] = useState<string[]>(CATEGORIES.map(c => c.id));
  const [tamperLevel, setTamperLevel] = useState(3);
  const [stealthMode, setStealthMode] = useState(false);
  const [activeScan, setActiveScan] = useState<Scan | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set());
  const [showLog, setShowLog] = useState(true);
  const [tab, setTab] = useState<"run" | "history">("run");
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { loadScans(); }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [activeScan?.log]);

  const loadScans = async () => {
    try {
      const r = await fetch(`${API}/scans`);
      const d = await r.json();
      setScans(d.scans ?? []);
    } catch {}
  };

  const startPoll = (id: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API}/scan/${id}`);
        const scan = await r.json();
        setActiveScan(scan);
        if (scan.status !== "running") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          loadScans();
        }
      } catch {}
    }, 1500);
  };

  const startScan = async () => {
    if (!target.trim()) return toast({ title: "Enter a target URL", variant: "destructive" });
    if (categories.length === 0) return toast({ title: "Select at least one attack category", variant: "destructive" });
    let url = target.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try {
      const r = await fetch(`${API}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: url, categories, tamperLevel, stealthMode }),
      });
      if (!r.ok) {
        const e = await r.json();
        return toast({ title: "Launch failed", description: e.error, variant: "destructive" });
      }
      const { scanId } = await r.json();
      const scanR = await fetch(`${API}/scan/${scanId}`);
      const scan = await scanR.json();
      setActiveScan(scan);
      setTab("run");
      startPoll(scanId);
      toast({ title: "OmniStrike launched", description: `Targeting ${url}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const stopScan = async () => {
    if (!activeScan) return;
    await fetch(`${API}/scan/${activeScan.id}/stop`, { method: "POST" });
    if (pollRef.current) clearInterval(pollRef.current);
    toast({ title: "Scan stopped" });
  };

  const deleteScan = async (id: number) => {
    await fetch(`${API}/scan/${id}`, { method: "DELETE" });
    if (activeScan?.id === id) setActiveScan(null);
    loadScans();
  };

  const loadScan = async (id: number) => {
    const r = await fetch(`${API}/scan/${id}`);
    const scan = await r.json();
    setActiveScan(scan);
    setTab("run");
    if (scan.status === "running") startPoll(id);
  };

  const toggleCategory = (id: string) => {
    setCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const toggleFinding = (i: number) => {
    setExpandedFindings(prev => {
      const s = new Set(prev);
      s.has(i) ? s.delete(i) : s.add(i);
      return s;
    });
  };

  const exportReport = () => {
    if (!activeScan) return;
    const lines = [
      `# OmniStrike Penetration Test Report`,
      `Target: ${activeScan.target}`,
      `Date: ${new Date(activeScan.startedAt).toLocaleString()}`,
      `Status: ${activeScan.status}`,
      `Findings: ${activeScan.findings?.length ?? 0}`,
      `Success Rate: ${activeScan.successRate ?? 0}%`,
      ``,
      `## Findings`,
      ...(activeScan.findings ?? []).map((f, i) =>
        `\n### ${i + 1}. [${f.severity?.toUpperCase()}] ${f.category} — ${f.technique}\n` +
        `URL: ${f.url}\n` +
        `Parameter: ${f.parameter}\n` +
        `Payload: ${f.payload}\n` +
        `HTTP Status: ${f.statusCode} | Response Time: ${f.responseTime}ms\n` +
        `Evidence: ${f.evidence}`
      ),
      ``,
      `## Scan Log`,
      ...(activeScan.log ?? []),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `omnistrike-report-${activeScan.id}.md`;
    a.click();
  };

  const isRunning = activeScan?.status === "running";
  const findings: Finding[] = activeScan?.findings ?? [];
  const stats = activeScan?.stats;

  const countBySev = (s: string) => findings.filter(f => f.severity === s).length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Zap className="h-7 w-7 text-red-400" />
          <h1 className="text-2xl font-bold text-white">OmniStrike</h1>
          <Badge className="bg-red-900 text-red-300 border-red-700">Automated Attack Engine</Badge>
        </div>
        <p className="text-gray-400 text-sm">
          Multi-vector penetration testing engine — sends real attack payloads against live targets. Use only on systems you own or have written authorization to test.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-800">
        {[["run", "Run / Results"], ["history", "Scan History"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === id ? "border-red-500 text-red-400" : "border-transparent text-gray-400 hover:text-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "run" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Config Panel */}
          <div className="space-y-5">
            {/* Target */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Target</h2>
              <Input
                value={target}
                onChange={e => setTarget(e.target.value)}
                placeholder="https://target.com"
                className="bg-gray-800 border-gray-700 text-white font-mono text-sm mb-3"
                onKeyDown={e => e.key === "Enter" && !isRunning && startScan()}
              />
              <div className="flex gap-2">
                <Button onClick={startScan} disabled={isRunning} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                  <Zap className="h-4 w-4 mr-2" />
                  {isRunning ? "Running..." : "Launch OmniStrike"}
                </Button>
                {isRunning && (
                  <Button onClick={stopScan} variant="outline" className="border-gray-600 text-gray-300">
                    <Square className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Tamper / Stealth */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Evasion Options</h2>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-gray-400">Tamper Level</label>
                  <span className="text-sm font-mono text-red-400">{tamperLevel} / 7</span>
                </div>
                <input type="range" min={0} max={7} value={tamperLevel} onChange={e => setTamperLevel(+e.target.value)}
                  className="w-full accent-red-500" />
                <p className="text-xs text-gray-500 mt-1">
                  {tamperLevel === 0 ? "Raw payloads — no obfuscation" :
                   tamperLevel <= 2 ? "Light: space2comment, randomcase" :
                   tamperLevel <= 4 ? "Medium: URL encode + SQL tampers" :
                   tamperLevel <= 6 ? "Heavy: chained tampers + hex encoding" :
                   "Max: all tampers chained — WAF evasion mode"}
                </p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-10 h-5 rounded-full transition-colors ${stealthMode ? "bg-red-600" : "bg-gray-700"} relative`}
                  onClick={() => setStealthMode(p => !p)}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${stealthMode ? "left-5" : "left-0.5"}`} />
                </div>
                <span className="text-sm text-gray-300">Stealth Mode</span>
                <span className="text-xs text-gray-500">(delays between requests, mimics browser UA)</span>
              </label>
            </div>

            {/* Categories */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Attack Categories</h2>
                <div className="flex gap-2">
                  <button className="text-xs text-red-400 hover:text-red-300" onClick={() => setCategories(CATEGORIES.map(c => c.id))}>All</button>
                  <button className="text-xs text-gray-400 hover:text-gray-300" onClick={() => setCategories([])}>None</button>
                </div>
              </div>
              <div className="space-y-2">
                {CATEGORIES.map(cat => (
                  <label key={cat.id} className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox" checked={categories.includes(cat.id)} onChange={() => toggleCategory(cat.id)}
                      className="mt-0.5 accent-red-500" />
                    <div>
                      <div className="text-sm text-gray-200 group-hover:text-white">{cat.label}</div>
                      <div className="text-xs text-gray-500">{cat.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="xl:col-span-2 space-y-4">
            {/* Stats bar */}
            {activeScan && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex flex-wrap items-center gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Target:</span>
                    <span className="text-sm font-mono text-white truncate max-w-[200px]">{activeScan.target}</span>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-xs font-medium ${
                    activeScan.status === "running" ? "bg-yellow-900 text-yellow-300" :
                    activeScan.status === "completed" ? "bg-green-900 text-green-300" :
                    "bg-gray-700 text-gray-300"
                  }`}>
                    {activeScan.status === "running" && <RefreshCw className="h-3 w-3 inline mr-1 animate-spin" />}
                    {activeScan.status}
                  </div>
                  {activeScan.status !== "running" && (
                    <Button onClick={exportReport} size="sm" variant="outline" className="border-gray-600 text-gray-300 text-xs ml-auto">
                      <Download className="h-3 w-3 mr-1" /> Export Report
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Critical", value: countBySev("critical"), color: "text-red-400" },
                    { label: "High", value: countBySev("high"), color: "text-orange-400" },
                    { label: "Medium", value: countBySev("medium"), color: "text-yellow-400" },
                    { label: "Low", value: countBySev("low"), color: "text-blue-400" },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-800 rounded p-2 text-center">
                      <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-gray-400">{s.label}</div>
                    </div>
                  ))}
                </div>
                {stats && (
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-400">
                    <span>Tests: <span className="text-white">{stats.tested}</span></span>
                    <span>Findings: <span className="text-white">{stats.findings}</span></span>
                    <span>Bypass rate: <span className={stats.successRate >= 50 ? "text-red-400" : "text-green-400"}>{stats.successRate}%</span></span>
                  </div>
                )}
              </div>
            )}

            {/* Findings List */}
            {findings.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                  Findings ({findings.length})
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {findings.map((f, i) => (
                    <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                      <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-750"
                        onClick={() => toggleFinding(i)}>
                        {SEV_ICON[f.severity]}
                        <Badge className={`text-xs shrink-0 ${SEV_COLORS[f.severity]}`}>{f.severity}</Badge>
                        <span className="text-sm font-medium text-white flex-1 truncate">{f.category} — {f.technique}</span>
                        <span className="text-xs text-gray-400 shrink-0">?{f.parameter}</span>
                        {expandedFindings.has(i) ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
                      </button>
                      {expandedFindings.has(i) && (
                        <div className="border-t border-gray-700 p-3 space-y-2 text-xs">
                          <div className="flex gap-2 flex-wrap">
                            <span className="text-gray-400">URL:</span>
                            <span className="font-mono text-blue-300 break-all">{f.url}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-gray-400">HTTP:</span>
                            <span className={`font-mono ${f.statusCode >= 500 ? "text-red-400" : "text-green-400"}`}>{f.statusCode}</span>
                            <span className="text-gray-400 ml-2">Time:</span>
                            <span className="font-mono text-yellow-400">{f.responseTime}ms</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Payload: </span>
                            <span className="font-mono text-red-300 break-all">{f.payload}</span>
                            <button onClick={() => navigator.clipboard.writeText(f.payload)}
                              className="ml-2 text-gray-500 hover:text-gray-300"><Copy className="h-3 w-3 inline" /></button>
                          </div>
                          <div>
                            <span className="text-gray-400">Evidence: </span>
                            <span className="text-gray-200 break-all">{f.evidence}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Log */}
            {activeScan && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <button className="flex items-center gap-2 text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 w-full text-left"
                  onClick={() => setShowLog(p => !p)}>
                  {showLog ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Live Log ({activeScan.log?.length ?? 0} lines)
                </button>
                {showLog && (
                  <div ref={logRef} className="bg-black rounded p-3 font-mono text-xs text-green-400 max-h-[300px] overflow-y-auto whitespace-pre-wrap">
                    {(activeScan.log ?? []).length === 0 ? (
                      <span className="text-gray-600">Waiting for scan to produce output...</span>
                    ) : (
                      activeScan.log.map((line, i) => (
                        <div key={i} className={
                          line.includes("🔴") ? "text-red-400" :
                          line.includes("🟡") ? "text-yellow-400" :
                          line.includes("✅") ? "text-green-400" :
                          line.includes("🚀") || line.includes("🏁") ? "text-blue-400" :
                          "text-green-400"
                        }>{line}</div>
                      ))
                    )}
                    {isRunning && <span className="animate-pulse">█</span>}
                  </div>
                )}
              </div>
            )}

            {!activeScan && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center">
                <Zap className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400">Configure your target and attack categories, then launch OmniStrike</p>
                <p className="text-gray-600 text-sm mt-2">Only test systems you own or have written authorization to test</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          {scans.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center text-gray-400">
              No scans yet — run your first OmniStrike scan above
            </div>
          ) : (
            scans.map(scan => (
              <div key={scan.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-white truncate">{scan.target}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex gap-3">
                    <span>{new Date(scan.startedAt).toLocaleString()}</span>
                    <span>{(scan.findings as any[])?.length ?? 0} findings</span>
                    {scan.successRate != null && <span className={scan.successRate >= 50 ? "text-red-400" : "text-green-400"}>{scan.successRate}% bypass</span>}
                  </div>
                </div>
                <div className={`px-2 py-0.5 rounded text-xs font-medium ${
                  scan.status === "running" ? "bg-yellow-900 text-yellow-300" :
                  scan.status === "completed" ? "bg-green-900 text-green-300" :
                  scan.status === "stopped" ? "bg-gray-700 text-gray-300" :
                  "bg-red-900 text-red-300"
                }`}>{scan.status}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 text-xs" onClick={() => loadScan(scan.id)}>
                    View
                  </Button>
                  <Button size="sm" variant="ghost" className="text-gray-500 hover:text-red-400 px-2" onClick={() => deleteScan(scan.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
