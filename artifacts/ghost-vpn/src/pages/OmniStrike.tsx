import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Zap, Square, Trash2, ChevronDown, ChevronUp, Download,
  ShieldAlert, AlertTriangle, Info, RefreshCw, Copy, Terminal,
  Folder, File, FolderOpen, ChevronRight, Home, ArrowLeft,
  Mouse, Lock, Unlock, Search,
} from "lucide-react";

const API = "/api/omnistrike";

const CATEGORIES = [
  { id: "sqli",          label: "SQL Injection",          desc: "Boolean-blind, UNION, time-based, error-based, stacked queries" },
  { id: "xss",           label: "XSS",                    desc: "Reflected and DOM-based cross-site scripting" },
  { id: "lfi",           label: "LFI / Path Traversal",   desc: "File inclusion, directory traversal, PHP wrappers" },
  { id: "cmdi",          label: "Command Injection",       desc: "OS command chaining, reverse shell patterns, eval injection" },
  { id: "ssrf",          label: "SSRF",                    desc: "Internal IP, localhost, cloud metadata probing" },
  { id: "xxe",           label: "XXE",                     desc: "XML external entity with file:// and HTTP entities" },
  { id: "ssti",          label: "SSTI",                    desc: "Jinja2, Twig, Freemarker, Python/Ruby template injection" },
  { id: "headers",       label: "Header Injection",        desc: "Host, X-Forwarded, X-Original-URL auth bypass" },
  { id: "cors",          label: "CORS Misconfiguration",   desc: "Permissive ACAO header detection across origins" },
  { id: "auth",          label: "Auth Brute Force",        desc: "Default creds against login, admin, wp-login, api/auth" },
  { id: "nosql",         label: "NoSQL Injection",         desc: "MongoDB operator injection ($ne, $gt, $regex, $where)" },
  { id: "quantumbreach", label: "⚛ QuantumBreach",         desc: "Cache poisoning · GraphQL · CRLF · Mass assignment · JWT alg confusion · Timing side-channel · Open redirect chains · Quantum-weak crypto detection" },
];

type Finding = {
  category: string; technique: string; payload: string; url: string;
  baseUrl: string; param: string; statusCode: number; responseTime: number;
  evidence: string; severity: "critical"|"high"|"medium"|"low"; bypassed: boolean;
  canExec?: boolean; canRead?: boolean;
};

type Scan = {
  id: number; target: string; status: string; findings: Finding[];
  stats: any; successRate: number; log: string[];
  startedAt: string; completedAt?: string;
  session?: ExploitSession | null;
};

type ExploitSession = {
  scanId: number; target: string; vector: "rce"|"lfi"|"sqli";
  technique: string; baseUrl: string; param: string; workingPayload: string;
  os: string; user: string; hostname: string; cwd: string; confirmedAt: string;
};

type DirItem = { name: string; isDir: boolean; perms: string; size: string; modified: string };

const SEV_COLORS: Record<string,string> = {
  critical: "bg-red-600 text-white", high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black", low: "bg-blue-500 text-white",
};
const SEV_ICON: Record<string,JSX.Element> = {
  critical: <ShieldAlert className="h-4 w-4 text-red-400" />,
  high: <AlertTriangle className="h-4 w-4 text-orange-400" />,
  medium: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
  low: <Info className="h-4 w-4 text-blue-400" />,
};

// ── Post-Exploitation Desktop Panel ─────────────────────────────────────────
function ExploitDesktop({ scanId, session }: { scanId: number; session: ExploitSession }) {
  const [tab, setTab] = useState<"files"|"terminal">("files");
  const [captured, setCaptured] = useState(false);
  const [currentPath, setCurrentPath] = useState("/");
  const [dirItems, setDirItems] = useState<DirItem[]>([]);
  const [fileContent, setFileContent] = useState<string|null>(null);
  const [openFile, setOpenFile] = useState<string|null>(null);
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [loadingDir, setLoadingDir] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Terminal
  const [cmdHistory, setCmdHistory] = useState<Array<{cmd:string;out:string;url:string}>>([]);
  const [cmdInput, setCmdInput] = useState("");
  const [execing, setExecing] = useState(false);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const termRef = useRef<HTMLDivElement>(null);
  const cmdRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => { loadDir("/"); }, []);
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [cmdHistory]);
  useEffect(() => {
    if (captured && tab === "terminal" && cmdRef.current) cmdRef.current.focus();
  }, [captured, tab]);

  const loadDir = async (path: string) => {
    setLoadingDir(true);
    setFileContent(null); setOpenFile(null);
    try {
      const r = await fetch(`${API}/console/${scanId}/ls`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dirPath: path }),
      });
      const d = await r.json();
      setDirItems(d.items ?? []);
      setCurrentPath(path);
    } catch { toast({ title: "Directory load failed", variant: "destructive" }); }
    setLoadingDir(false);
  };

  const navigateTo = (item: DirItem) => {
    if (!captured) return;
    if (item.isDir) {
      setPathHistory(p => [...p, currentPath]);
      const newPath = currentPath === "/" ? `/${item.name}` : `${currentPath}/${item.name}`;
      loadDir(newPath);
    } else {
      readFile(currentPath === "/" ? `/${item.name}` : `${currentPath}/${item.name}`);
    }
  };

  const readFile = async (filePath: string) => {
    setLoadingFile(true);
    try {
      const r = await fetch(`${API}/console/${scanId}/read`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath }),
      });
      const d = await r.json();
      setFileContent(d.content ?? "(empty)");
      setOpenFile(filePath);
    } catch { toast({ title: "File read failed", variant: "destructive" }); }
    setLoadingFile(false);
  };

  const goBack = () => {
    if (!captured) return;
    if (openFile) { setFileContent(null); setOpenFile(null); return; }
    if (pathHistory.length > 0) {
      const prev = pathHistory[pathHistory.length - 1];
      setPathHistory(p => p.slice(0,-1));
      loadDir(prev);
    }
  };

  const goHome = () => {
    if (!captured) return;
    setPathHistory([]);
    setFileContent(null); setOpenFile(null);
    loadDir("/");
  };

  const execCmd = async () => {
    if (!cmdInput.trim() || execing) return;
    const cmd = cmdInput.trim();
    setCmdInput(""); setHistoryIdx(-1); setExecing(true);
    try {
      const r = await fetch(`${API}/console/${scanId}/exec`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      const d = await r.json();
      setCmdHistory(p => [...p, { cmd, out: d.output ?? "(no output)", url: d.exploitUrl ?? "" }]);
    } catch (e: any) {
      setCmdHistory(p => [...p, { cmd, out: `Error: ${e.message}`, url: "" }]);
    }
    setExecing(false);
    setTimeout(() => cmdRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { execCmd(); return; }
    if (e.key === "ArrowUp") {
      const cmds = cmdHistory.map(c => c.cmd);
      const newIdx = Math.min(historyIdx + 1, cmds.length - 1);
      setHistoryIdx(newIdx);
      setCmdInput(cmds[cmds.length - 1 - newIdx] ?? "");
    }
    if (e.key === "ArrowDown") {
      const cmds = cmdHistory.map(c => c.cmd);
      const newIdx = Math.max(historyIdx - 1, -1);
      setHistoryIdx(newIdx);
      setCmdInput(newIdx === -1 ? "" : (cmds[cmds.length - 1 - newIdx] ?? ""));
    }
  };

  const filteredItems = dirItems.filter(i => !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const isRce = session.vector === "rce";

  return (
    <div className="bg-gray-950 border-2 border-red-700 rounded-lg overflow-hidden shadow-2xl shadow-red-900/30">
      {/* Title bar */}
      <div className="bg-red-900/80 px-4 py-2 flex items-center gap-3 border-b border-red-700">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="text-red-300 text-xs font-mono flex-1">
          COMPROMISED: {session.target} │ {session.technique} │ via ?{session.param}
        </span>
        <Badge className={`text-xs ${isRce ? "bg-red-700 text-white" : "bg-orange-800 text-orange-200"}`}>
          {isRce ? "RCE" : "LFI"}
        </Badge>
        <div className="flex items-center gap-2">
          {captured
            ? <><Lock className="h-3 w-3 text-red-400" /><span className="text-red-400 text-xs font-mono">CAPTURED</span></>
            : <><Unlock className="h-3 w-3 text-gray-400" /><span className="text-gray-400 text-xs">hover to capture</span></>
          }
        </div>
      </div>

      {/* Session info bar */}
      <div className="bg-gray-900 px-4 py-1.5 flex flex-wrap gap-4 text-xs font-mono border-b border-gray-800">
        <span className="text-gray-400">user: <span className="text-green-400">{session.user}</span></span>
        <span className="text-gray-400">host: <span className="text-cyan-400">{session.hostname}</span></span>
        <span className="text-gray-400">vector: <span className="text-red-400">{session.technique}</span></span>
        <span className="text-gray-400">confirmed: <span className="text-yellow-400">{new Date(session.confirmedAt).toLocaleTimeString()}</span></span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {[["files", "File Browser", Folder], ["terminal", isRce ? "Command Shell" : "Read Files", Terminal]].map(([id, label, Icon]) => (
          <button key={id as string} onClick={() => setTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 text-sm border-r border-gray-800 transition-colors ${tab === id ? "bg-gray-800 text-white" : "text-gray-400 hover:bg-gray-900 hover:text-gray-200"}`}>
            <Icon className="h-4 w-4" />{label as string}
          </button>
        ))}
        <div className="flex-1" />
        <div className="px-3 py-2 text-xs text-gray-600 font-mono self-center">
          Move mouse INTO this area to enable navigation
        </div>
      </div>

      {/* Main desktop area — mouse capture zone */}
      <div
        ref={panelRef}
        onMouseEnter={() => setCaptured(true)}
        onMouseLeave={() => setCaptured(false)}
        className={`relative min-h-[420px] ${captured ? "cursor-default ring-2 ring-red-500 ring-inset" : "cursor-pointer"}`}
        style={{ userSelect: captured ? "text" : "none" }}
      >
        {/* Capture indicator overlay */}
        {!captured && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 pointer-events-none">
            <div className="text-center">
              <Mouse className="h-10 w-10 text-red-400 mx-auto mb-2" />
              <p className="text-red-300 text-sm font-medium">Move mouse here to navigate target system</p>
              <p className="text-gray-500 text-xs mt-1">Mouse outside this area = your controls | Mouse inside = target navigation</p>
            </div>
          </div>
        )}

        {/* ── FILE BROWSER TAB ─────────────────────────────────────────────── */}
        {tab === "files" && (
          <div className="flex h-[420px] bg-gray-950">
            {/* Sidebar */}
            <div className="w-48 border-r border-gray-800 bg-gray-900 flex flex-col">
              <div className="px-3 py-2 text-xs text-gray-500 font-mono border-b border-gray-800">QUICK ACCESS</div>
              {[
                ["/", "/ Root"],
                ["/etc", "/etc"],
                ["/etc/nginx", "nginx config"],
                ["/var/www/html", "web root"],
                ["/var/log", "logs"],
                ["/home", "/home"],
                ["/root", "/root"],
                ["/proc", "/proc"],
                ["/tmp", "/tmp"],
              ].map(([path, label]) => (
                <button key={path} onClick={() => captured && loadDir(path)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${captured ? "hover:bg-gray-800 cursor-pointer" : "cursor-not-allowed"} ${currentPath === path ? "bg-gray-800 text-white" : "text-gray-400"}`}>
                  <Folder className="h-3 w-3 text-yellow-500 shrink-0" />
                  <span className="font-mono truncate">{label}</span>
                </button>
              ))}
            </div>

            {/* Main area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-gray-900">
                <button onClick={goBack} disabled={!captured || (pathHistory.length === 0 && !openFile)}
                  className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button onClick={goHome} disabled={!captured} className="text-gray-400 hover:text-white disabled:opacity-30">
                  <Home className="h-4 w-4" />
                </button>
                <div className="flex-1 bg-gray-800 rounded px-3 py-1 text-xs font-mono text-gray-200 border border-gray-700 truncate">
                  {openFile ?? currentPath}
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1.5 h-3 w-3 text-gray-500" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="filter..."
                    disabled={!captured}
                    className="bg-gray-800 border border-gray-700 rounded pl-6 pr-2 py-1 text-xs text-gray-200 w-28 font-mono" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-2">
                {loadingDir || loadingFile ? (
                  <div className="flex items-center gap-2 p-4 text-xs text-green-400 font-mono">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Fetching via {session.vector.toUpperCase()} exploit...
                  </div>
                ) : openFile && fileContent !== null ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <File className="h-4 w-4 text-blue-400" />
                      <span className="text-xs text-blue-300 font-mono">{openFile}</span>
                      <button onClick={() => { navigator.clipboard.writeText(fileContent ?? ""); }}
                        className="ml-auto text-gray-500 hover:text-gray-300">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <pre className="bg-black rounded p-3 text-xs text-green-400 font-mono whitespace-pre-wrap break-all max-h-[320px] overflow-auto">
                      {fileContent || "(empty file)"}
                    </pre>
                  </div>
                ) : (
                  <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 ${!captured ? "pointer-events-none" : ""}`}>
                    {filteredItems.length === 0 ? (
                      <div className="col-span-6 text-center text-gray-600 text-xs py-8 font-mono">
                        {captured ? "Empty or inaccessible directory" : "Move mouse here to browse files"}
                      </div>
                    ) : filteredItems.map((item, i) => (
                      <button key={i} onDoubleClick={() => navigateTo(item)} onClick={() => navigateTo(item)}
                        title={`${item.name}\n${item.perms} ${item.size}`}
                        className={`flex flex-col items-center gap-1 p-2 rounded text-center group transition-colors ${captured ? "hover:bg-gray-800 cursor-pointer" : "cursor-not-allowed"}`}>
                        {item.isDir
                          ? <FolderOpen className="h-8 w-8 text-yellow-400 group-hover:text-yellow-300" />
                          : <File className="h-8 w-8 text-blue-400 group-hover:text-blue-300" />}
                        <span className="text-xs text-gray-300 font-mono break-all leading-tight">{item.name}</span>
                        {item.size && <span className="text-[10px] text-gray-600">{item.size}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TERMINAL TAB ──────────────────────────────────────────────────── */}
        {tab === "terminal" && (
          <div className="flex flex-col h-[420px] bg-black">
            {/* Output */}
            <div ref={termRef} className="flex-1 overflow-auto p-3 font-mono text-xs">
              <div className="text-green-500 mb-3">
                {'OmniStrike Post-Exploitation Shell'}<br />
                {`Connected: ${session.target}`}<br />
                {`Vector: ${session.technique} (?${session.param})`}<br />
                {isRce ? `Mode: FULL COMMAND EXECUTION` : `Mode: FILE READ ONLY (LFI)`}<br />
                {'─'.repeat(50)}
              </div>
              {cmdHistory.length === 0 && (
                <div className="text-gray-600">
                  {isRce
                    ? `Type commands below. They are sent live through the confirmed exploit.\nTry: id, whoami, uname -a, ls -la /, cat /etc/passwd, ps aux`
                    : `LFI mode — use the file browser tab to navigate.\nOr type: /etc/passwd, /etc/hosts, /proc/version`}
                </div>
              )}
              {cmdHistory.map((entry, i) => (
                <div key={i} className="mb-3">
                  <div className="text-green-400">
                    <span className="text-cyan-500">{session.user}@{session.hostname}</span>
                    <span className="text-white">:</span>
                    <span className="text-blue-400">{session.cwd}</span>
                    <span className="text-white">$ </span>
                    <span className="text-yellow-300">{entry.cmd}</span>
                  </div>
                  <div className="text-green-300 whitespace-pre-wrap mt-0.5 pl-2">{entry.out}</div>
                  {entry.url && (
                    <div className="text-gray-700 text-[10px] mt-0.5 pl-2 break-all">
                      exploit: {entry.url.substring(0, 100)}{entry.url.length > 100 ? "..." : ""}
                    </div>
                  )}
                </div>
              ))}
              {execing && (
                <div className="text-green-400 flex items-center gap-2">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Executing via exploit...</span>
                </div>
              )}
            </div>

            {/* Input line */}
            <div className={`flex items-center gap-2 px-3 py-2 border-t border-gray-800 bg-gray-950 ${!captured ? "opacity-50" : ""}`}>
              <span className="text-cyan-500 font-mono text-xs shrink-0">{session.user}@{session.hostname}:{session.cwd}$</span>
              <input
                ref={cmdRef}
                value={cmdInput}
                onChange={e => setCmdInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!captured || execing || !isRce}
                placeholder={!captured ? "move mouse here to type commands" : !isRce ? "switch to File Browser for LFI mode" : "enter command..."}
                className="flex-1 bg-transparent text-yellow-300 font-mono text-xs outline-none placeholder:text-gray-700"
              />
              {execing && <RefreshCw className="h-3 w-3 animate-spin text-green-400 shrink-0" />}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-900 border-t border-gray-800 px-4 py-2 flex items-center gap-4 text-xs text-gray-500 font-mono">
        <span>Working payload: <span className="text-red-400">{session.workingPayload.substring(0,50)}{session.workingPayload.length > 50 ? "..." : ""}</span></span>
        <span className="ml-auto">param: <span className="text-cyan-400">?{session.param}</span></span>
      </div>
    </div>
  );
}

// ── Main OmniStrike Page ─────────────────────────────────────────────────────
export default function OmniStrike() {
  const { toast } = useToast();
  const [target, setTarget] = useState("");
  const [categories, setCategories] = useState<string[]>(CATEGORIES.map(c => c.id));
  const [tamperLevel, setTamperLevel] = useState(4);
  const [stealthMode, setStealthMode] = useState(false);
  const [activeScan, setActiveScan] = useState<Scan | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set());
  const [showLog, setShowLog] = useState(true);
  const [mainTab, setMainTab] = useState<"run"|"history">("run");
  const [sessionData, setSessionData] = useState<ExploitSession | null>(null);
  const [showDesktop, setShowDesktop] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { loadScans(); }, []);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [activeScan?.log]);

  const loadScans = async () => {
    try { const r = await fetch(`${API}/scans`); const d = await r.json(); setScans(d.scans ?? []); } catch {}
  };

  const startPoll = (id: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API}/scan/${id}`);
        const scan = await r.json();
        setActiveScan(scan);
        if (scan.session) setSessionData(scan.session);
        if (scan.status !== "running") { clearInterval(pollRef.current!); pollRef.current = null; loadScans(); }
      } catch {}
    }, 1500);
  };

  const startScan = async () => {
    if (!target.trim()) return toast({ title: "Enter a target URL", variant: "destructive" });
    if (categories.length === 0) return toast({ title: "Select at least one category", variant: "destructive" });
    let url = target.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try {
      const r = await fetch(`${API}/scan`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: url, categories, tamperLevel, stealthMode }),
      });
      if (!r.ok) { const e = await r.json(); return toast({ title: "Launch failed", description: e.error, variant: "destructive" }); }
      const { scanId } = await r.json();
      const sr = await fetch(`${API}/scan/${scanId}`);
      const scan = await sr.json();
      setActiveScan(scan); setSessionData(null); setShowDesktop(false);
      setMainTab("run"); startPoll(scanId);
      toast({ title: "OmniStrike launched", description: `Targeting ${url}` });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const stopScan = async () => {
    if (!activeScan) return;
    await fetch(`${API}/scan/${activeScan.id}/stop`, { method: "POST" });
    if (pollRef.current) clearInterval(pollRef.current);
    toast({ title: "Scan stopped" });
  };

  const deleteScan = async (id: number) => {
    await fetch(`${API}/scan/${id}`, { method: "DELETE" });
    if (activeScan?.id === id) { setActiveScan(null); setSessionData(null); setShowDesktop(false); }
    loadScans();
  };

  const loadScan = async (id: number) => {
    const r = await fetch(`${API}/scan/${id}`);
    const scan = await r.json();
    setActiveScan(scan);
    if (scan.session) setSessionData(scan.session);
    setMainTab("run");
    if (scan.status === "running") startPoll(id);
  };

  const loadSession = async (id: number) => {
    try {
      const r = await fetch(`${API}/console/${id}/session`);
      if (!r.ok) { const e = await r.json(); return toast({ title: "No session available", description: e.error, variant: "destructive" }); }
      const sess = await r.json();
      setSessionData(sess); setShowDesktop(true);
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const exportReport = useCallback(() => {
    if (!activeScan) return;
    const findings: Finding[] = activeScan.findings ?? [];
    const stats = activeScan.stats ?? {};
    const lines = [
      `# OmniStrike Penetration Test Report`,
      `## Target: ${activeScan.target}`,
      `**Date:** ${new Date(activeScan.startedAt).toLocaleString()}`,
      `**Status:** ${activeScan.status}`,
      `**Total Tests:** ${stats.tested ?? "N/A"}`,
      `**Total Findings:** ${findings.length}`,
      `**Bypass Rate:** ${activeScan.successRate ?? 0}%`,
      `**Critical:** ${stats.critical ?? 0} | **High:** ${stats.high ?? 0} | **Medium:** ${stats.medium ?? 0}`,
      ``,
      `---`,
      `## Summary`,
      `OmniStrike performed ${stats.tested ?? 0} individual attack tests against ${activeScan.target} across ${(activeScan.categories ?? []).join(", ")}.`,
      `A total of **${findings.filter(f=>f.bypassed).length} vulnerabilities were confirmed exploitable** with a **${activeScan.successRate ?? 0}% bypass rate**.`,
      ``,
      `---`,
      `## Confirmed Findings`,
      ...findings.filter(f => f.bypassed).map((f, i) => [
        ``,
        `### ${i + 1}. [${f.severity.toUpperCase()}] ${f.category} — ${f.technique}`,
        `| Field | Value |`,
        `|-------|-------|`,
        `| URL | \`${f.url}\` |`,
        `| Parameter | \`${f.param}\` |`,
        `| Method | ${f.statusCode >= 500 ? "Error triggered" : "Successful bypass"} |`,
        `| HTTP Status | ${f.statusCode} |`,
        `| Response Time | ${f.responseTime}ms |`,
        `| Severity | **${f.severity.toUpperCase()}** |`,
        ``,
        `**Exact payload that broke through:**`,
        `\`\`\``,
        f.payload,
        `\`\`\``,
        ``,
        `**Evidence:**`,
        `\`\`\``,
        f.evidence,
        `\`\`\``,
        ``,
        `**Exploit URL:**`,
        `\`\`\``,
        f.url,
        `\`\`\``,
        ``,
        `**Recommended Fix:** ${
          f.category.includes("SQL") ? "Use parameterized queries / prepared statements. NEVER concatenate user input into SQL strings." :
          f.category.includes("XSS") ? "HTML-encode all user output. Implement a strict Content-Security-Policy." :
          f.category.includes("LFI") ? "Use an allowlist for file paths. Never pass user input to file functions." :
          f.category.includes("Command") ? "NEVER pass user input to shell commands. Use language-native APIs." :
          f.category.includes("SSRF") ? "Validate and whitelist all URL targets. Block RFC1918 ranges at the network level." :
          f.category.includes("JWT") ? "Verify algorithm explicitly. Never accept 'none'. Validate signature server-side." :
          f.category.includes("Cache") ? "Mark all user-controlled headers as cache keys or strip them." :
          "See OWASP Top 10 for remediation guidance."
        }`,
      ].join("\n")),
      ``,
      `---`,
      `## Informational Findings`,
      ...findings.filter(f => !f.bypassed).map((f, i) => [
        `${i + 1}. **${f.category}** — ${f.evidence}`,
      ].join("")),
      ``,
      `---`,
      `## Full Scan Log`,
      `\`\`\``,
      ...(activeScan.log ?? []),
      `\`\`\``,
      ``,
      `---`,
      `*Report generated by OmniStrike — ProxhqVPN Command Center Pro*`,
      `*Target: ${activeScan.target} | Scan ID: ${activeScan.id}*`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `omnistrike-report-${activeScan.id}-${activeScan.target.replace(/[^a-z0-9]/gi,"_").substring(0,30)}.md`;
    a.click();
    toast({ title: "Report downloaded", description: "Full payload list, exact exploit URLs, and evidence included" });
  }, [activeScan]);

  const isRunning = activeScan?.status === "running";
  const findings: Finding[] = activeScan?.findings ?? [];
  const stats = activeScan?.stats;
  const confirmedFindings = findings.filter(f => f.bypassed);
  const hasSession = !!(activeScan?.session || sessionData);
  const canGetSession = !isRunning && findings.some(f => f.bypassed && (f.canExec || f.canRead));

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Zap className="h-7 w-7 text-red-400" />
          <h1 className="text-2xl font-bold text-white">OmniStrike</h1>
          <Badge className="bg-red-900 text-red-300 border-red-700">Automated Attack Engine</Badge>
          <Badge className="bg-purple-900 text-purple-300 border-purple-700">⚛ QuantumBreach</Badge>
        </div>
        <p className="text-gray-400 text-sm">
          Multi-vector penetration testing engine — real HTTP attacks against live targets with post-exploitation file browser and command shell. Authorized testing only.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-800">
        {[["run","Run / Results"], ["history","Scan History"]].map(([id, label]) => (
          <button key={id} onClick={() => setMainTab(id as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${mainTab === id ? "border-red-500 text-red-400" : "border-transparent text-gray-400 hover:text-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {mainTab === "run" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Config */}
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Target</h2>
                <Input value={target} onChange={e => setTarget(e.target.value)} placeholder="https://target.com"
                  className="bg-gray-800 border-gray-700 text-white font-mono text-sm mb-3"
                  onKeyDown={e => e.key === "Enter" && !isRunning && startScan()} />
                <div className="flex gap-2">
                  <Button onClick={startScan} disabled={isRunning} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                    <Zap className="h-4 w-4 mr-2" />{isRunning ? "Attacking..." : "Launch"}
                  </Button>
                  {isRunning && <Button onClick={stopScan} variant="outline" className="border-gray-600 text-gray-300"><Square className="h-4 w-4" /></Button>}
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Evasion</h2>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm text-gray-400">Tamper Level</label>
                    <span className="text-sm font-mono text-red-400">{tamperLevel}/7</span>
                  </div>
                  <input type="range" min={0} max={7} value={tamperLevel} onChange={e => setTamperLevel(+e.target.value)}
                    className="w-full accent-red-500" />
                  <p className="text-xs text-gray-500 mt-1">
                    {tamperLevel <= 1 ? "Raw payloads" : tamperLevel <= 3 ? "Comment + case obfuscation" : tamperLevel <= 5 ? "URL encode + SQL tampers" : "Max: all tampers chained"}
                  </p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`w-10 h-5 rounded-full transition-colors relative ${stealthMode ? "bg-red-600" : "bg-gray-700"}`}
                    onClick={() => setStealthMode(p => !p)}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${stealthMode ? "left-5" : "left-0.5"}`} />
                  </div>
                  <span className="text-sm text-gray-300">Stealth Mode</span>
                </label>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Attack Categories</h2>
                  <div className="flex gap-2">
                    <button className="text-xs text-red-400" onClick={() => setCategories(CATEGORIES.map(c => c.id))}>All</button>
                    <button className="text-xs text-gray-400" onClick={() => setCategories([])}>None</button>
                  </div>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {CATEGORIES.map(cat => (
                    <label key={cat.id} className="flex items-start gap-3 cursor-pointer group">
                      <input type="checkbox" checked={categories.includes(cat.id)}
                        onChange={() => setCategories(prev => prev.includes(cat.id) ? prev.filter(c => c !== cat.id) : [...prev, cat.id])}
                        className="mt-0.5 accent-red-500" />
                      <div>
                        <div className={`text-sm group-hover:text-white ${cat.id === "quantumbreach" ? "text-purple-300" : "text-gray-200"}`}>{cat.label}</div>
                        <div className="text-xs text-gray-500">{cat.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="xl:col-span-2 space-y-4">
              {/* Stats */}
              {activeScan && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span className="text-sm font-mono text-white truncate max-w-[250px]">{activeScan.target}</span>
                    <div className={`px-2 py-0.5 rounded text-xs font-medium ${isRunning ? "bg-yellow-900 text-yellow-300" : activeScan.status === "completed" ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-300"}`}>
                      {isRunning && <RefreshCw className="h-3 w-3 inline mr-1 animate-spin" />}{activeScan.status}
                    </div>
                    <div className="ml-auto flex gap-2">
                      {canGetSession && !showDesktop && (
                        <Button onClick={() => loadSession(activeScan.id)} size="sm" className="bg-red-800 hover:bg-red-700 text-sm">
                          <Terminal className="h-3 w-3 mr-1" /> Open Console
                        </Button>
                      )}
                      {showDesktop && (
                        <Button onClick={() => setShowDesktop(false)} size="sm" variant="outline" className="border-gray-600 text-gray-300 text-xs">
                          Hide Console
                        </Button>
                      )}
                      {!isRunning && (
                        <Button onClick={exportReport} size="sm" variant="outline" className="border-gray-600 text-gray-300 text-xs">
                          <Download className="h-3 w-3 mr-1" /> Report
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "Critical", value: stats?.critical ?? 0, color: "text-red-400" },
                      { label: "High", value: stats?.high ?? 0, color: "text-orange-400" },
                      { label: "Medium", value: stats?.medium ?? 0, color: "text-yellow-400" },
                      { label: "Bypass%", value: `${activeScan.successRate ?? 0}%`, color: (activeScan.successRate ?? 0) >= 50 ? "text-red-400" : "text-green-400" },
                    ].map(s => (
                      <div key={s.label} className="bg-gray-800 rounded p-2 text-center">
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-xs text-gray-400">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {stats && <div className="mt-2 text-xs text-gray-400">Tests: {stats.tested} | Findings: {findings.length} | Confirmed: {confirmedFindings.length}</div>}
                </div>
              )}

              {/* Findings */}
              {findings.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                    Findings ({findings.length}) — {confirmedFindings.length} exploitable
                  </h3>
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {findings.map((f, i) => (
                      <div key={i} className={`bg-gray-800 border rounded-lg overflow-hidden ${f.bypassed ? "border-red-900/50" : "border-gray-700"}`}>
                        <button className="w-full flex items-center gap-2 p-3 text-left hover:bg-gray-750"
                          onClick={() => setExpandedFindings(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; })}>
                          {SEV_ICON[f.severity]}
                          <Badge className={`text-xs shrink-0 ${SEV_COLORS[f.severity]}`}>{f.severity}</Badge>
                          <span className="text-sm font-medium text-white flex-1 truncate">{f.category} — {f.technique}</span>
                          {f.canExec && <Badge className="text-xs bg-red-800 text-red-200 shrink-0">RCE</Badge>}
                          {f.canRead && !f.canExec && <Badge className="text-xs bg-orange-800 text-orange-200 shrink-0">READ</Badge>}
                          {f.bypassed ? <span className="text-xs text-red-400 shrink-0">CONFIRMED</span> : <span className="text-xs text-gray-500 shrink-0">info</span>}
                          {expandedFindings.has(i) ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
                        </button>
                        {expandedFindings.has(i) && (
                          <div className="border-t border-gray-700 p-3 space-y-2 text-xs bg-gray-850">
                            <div><span className="text-gray-400">URL: </span><span className="font-mono text-blue-300 break-all">{f.url}</span></div>
                            <div><span className="text-gray-400">Param: </span><span className="font-mono text-cyan-300">?{f.param}</span></div>
                            <div className="bg-black rounded p-2">
                              <span className="text-gray-500">Payload: </span>
                              <span className="font-mono text-red-300 break-all">{f.payload}</span>
                              <button onClick={() => navigator.clipboard.writeText(f.payload)} className="ml-2 text-gray-600 hover:text-gray-400">
                                <Copy className="h-3 w-3 inline" />
                              </button>
                            </div>
                            <div><span className="text-gray-400">Evidence: </span><span className="text-gray-200 break-all whitespace-pre-wrap">{f.evidence.substring(0, 300)}</span></div>
                            <div className="flex gap-3">
                              <span className="text-gray-500">HTTP {f.statusCode}</span>
                              <span className="text-gray-500">{f.responseTime}ms</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live log */}
              {activeScan && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <button className="flex items-center gap-2 text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 w-full text-left"
                    onClick={() => setShowLog(p => !p)}>
                    {showLog ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Live Attack Log ({activeScan.log?.length ?? 0} lines)
                  </button>
                  {showLog && (
                    <div ref={logRef} className="bg-black rounded p-3 font-mono text-xs max-h-[280px] overflow-y-auto whitespace-pre-wrap">
                      {(activeScan.log ?? []).length === 0 ? <span className="text-gray-600">Initializing...</span> :
                        activeScan.log.map((line, i) => (
                          <div key={i} className={
                            line.includes("🔴") ? "text-red-400" :
                            line.includes("🟡") ? "text-yellow-400" :
                            line.includes("✅") ? "text-green-400" :
                            line.includes("🚀") || line.includes("🏁") || line.includes("═") ? "text-blue-400" :
                            line.includes("⚛") ? "text-purple-400" :
                            "text-green-400"
                          }>{line}</div>
                        ))
                      }
                      {isRunning && <span className="animate-pulse text-green-400">█</span>}
                    </div>
                  )}
                </div>
              )}

              {!activeScan && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center">
                  <Zap className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-400">Configure target and attack categories, then launch OmniStrike</p>
                  <p className="text-gray-600 text-sm mt-2">Only test systems you own or have written authorization to test</p>
                </div>
              )}
            </div>
          </div>

          {/* Post-Exploitation Desktop */}
          {showDesktop && sessionData && activeScan && (
            <div>
              <h2 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
                <Terminal className="h-5 w-5" /> Post-Exploitation Console
                <span className="text-sm text-gray-400 font-normal ml-2">— Live access via confirmed exploit</span>
              </h2>
              <ExploitDesktop scanId={activeScan.id} session={sessionData} />
            </div>
          )}
        </div>
      )}

      {mainTab === "history" && (
        <div className="space-y-3">
          {scans.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center text-gray-400">No scans yet</div>
          ) : scans.map(scan => (
            <div key={scan.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm text-white truncate">{scan.target}</div>
                <div className="text-xs text-gray-400 mt-0.5 flex gap-3">
                  <span>{new Date(scan.startedAt).toLocaleString()}</span>
                  <span>{(scan.findings as any[])?.length ?? 0} findings</span>
                  {scan.successRate != null && <span className={scan.successRate >= 50 ? "text-red-400" : "text-green-400"}>{scan.successRate}% bypass</span>}
                </div>
              </div>
              <div className={`px-2 py-0.5 rounded text-xs font-medium ${scan.status === "running" ? "bg-yellow-900 text-yellow-300" : scan.status === "completed" ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-300"}`}>
                {scan.status}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 text-xs" onClick={() => loadScan(scan.id)}>View</Button>
                <Button size="sm" variant="ghost" className="text-gray-500 hover:text-red-400 px-2" onClick={() => deleteScan(scan.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
