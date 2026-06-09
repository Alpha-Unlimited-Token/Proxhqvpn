// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useRef, useEffect, useCallback } from "react";
import { useSearch } from "wouter";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Terminal as TerminalIcon, Wifi, Scan, FileText, Zap, Globe, Server, FolderOpen, Folder, FileCode, Trash2, RefreshCw, ChevronRight, PlugZap, LogOut, Monitor, MousePointer, Keyboard, ZoomIn, ZoomOut, Pause, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface HistoryItem { cmd: string; out: string; isError: boolean; ghostMode?: boolean; durationMs?: number }
interface AuditEntry { ts: string; cmd: string; exitCode: number; ip: string }

type TabType = "shell" | "http" | "portscan" | "auditlog" | "ssh";

const COMMON_PORTS = [21,22,23,25,53,80,110,143,443,445,993,995,1433,3306,3389,5432,5900,6379,8080,8443,27017];

// ── SSH types ──
interface SshSessionMeta { id: string; host: string; port: number; username: string; label: string; connectedAt: string }
interface SshHistoryItem { cmd: string; out: string; isError: boolean; ts: string }
interface FsEntry { name: string; isDir: boolean; isSymlink: boolean; size: number; mode: string; mtime: number }

export default function Terminal() {
  const { toast } = useToast();
  const searchString = useSearch();
  const [tab, setTab]             = usePersistedState<TabType>("terminal-tab", "shell");
  const [history, setHistory]     = useState<HistoryItem[]>([]);
  const [input, setInput]         = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [ghostMode, setGhostMode] = useState(false);
  const [running, setRunning]     = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // HTTP request state
  const [httpUrl, setHttpUrl]     = useState("https://httpbin.org/get");
  const [httpMethod, setHttpMethod] = useState("GET");
  const [httpHeaders, setHttpHeaders] = useState('{"Accept": "application/json"}');
  const [httpBody, setHttpBody]   = useState("");
  const [httpResult, setHttpResult] = useState<any>(null);
  const [httpRunning, setHttpRunning] = useState(false);

  // Port scan state
  const [scanHost, setScanHost]   = useState("");
  const [scanPorts, setScanPorts] = useState("22,80,443,3306,5432,8080");
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanRunning, setScanRunning] = useState(false);

  // Audit log
  const [auditLog, setAuditLog]   = useState<AuditEntry[]>([]);

  // ── SSH state ──
  const [sshSessions, setSshSessions]       = useState<SshSessionMeta[]>([]);
  const [activeSession, setActiveSession]   = useState<SshSessionMeta | null>(null);
  const [sshHistory, setSshHistory]         = useState<SshHistoryItem[]>([]);
  const [sshInput, setSshInput]             = useState("");
  const [sshCmdHistory, setSshCmdHistory]   = useState<string[]>([]);
  const [sshHistoryIdx, setSshHistoryIdx]   = useState(-1);
  const [sshRunning, setSshRunning]         = useState(false);
  const [sshPanel, setSshPanel]             = useState<"shell" | "files" | "screen">("shell");
  // Connection form
  const [connHost, setConnHost]       = useState("");
  const [connPort, setConnPort]       = useState("22");
  const [connUser, setConnUser]       = useState("root");
  const [connAuthMode, setConnAuthMode] = useState<"password" | "key">("password");
  const [connPassword, setConnPassword] = useState("");
  const [connKey, setConnKey]         = useState("");
  const [connPassphrase, setConnPassphrase] = useState("");
  const [connLabel, setConnLabel]     = useState("");
  const [connConnecting, setConnConnecting] = useState(false);
  // File browser
  const [fbPath, setFbPath]           = useState("/");
  const [fbEntries, setFbEntries]     = useState<FsEntry[]>([]);
  const [fbLoading, setFbLoading]     = useState(false);
  const [fbFileContent, setFbFileContent] = useState<{ path: string; content: string; truncated: boolean } | null>(null);

  // Remote desktop / screen control
  const [screenImage, setScreenImage]       = useState<string | null>(null);
  const [screenError, setScreenError]       = useState<string | null>(null);
  const [screenLoading, setScreenLoading]   = useState(false);
  const [screenStreaming, setScreenStreaming] = useState(false);
  const [screenFps, setScreenFps]           = useState(2);
  const [screenQuality, setScreenQuality]   = useState(55);
  const [screenDisplay, setScreenDisplay]   = useState(":0");
  const [screenRemoteW, setScreenRemoteW]   = useState(1920);
  const [screenRemoteH, setScreenRemoteH]   = useState(1080);
  const [mouseControl, setMouseControl]     = useState(true);
  const [keyboardControl, setKeyboardControl] = useState(true);
  const [screenZoom, setScreenZoom]         = useState(1.0);
  const screenRef = useRef<HTMLDivElement>(null);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sshBottomRef = useRef<HTMLDivElement>(null);

  // Pre-fill SSH form when navigated here via ?ssh=<ip> (e.g. from SilkWeb)
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const sshIp = params.get("ssh");
    if (sshIp) {
      setTab("ssh");
      setConnHost(sshIp);
      setConnLabel(`SilkWeb — ${sshIp}`);
      // Clear the param from the URL without a re-render
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);
  useEffect(() => { sshBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [sshHistory]);

  // Exec local shell command
  const execCmd = useCallback(async (cmd: string) => {
    const t0 = Date.now();
    setRunning(true);
    try {
      const r = await fetch(`${BASE}/api/terminal/exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd, shell: "bash", ghostMode, timeout: 20000 }),
      });
      const data = await r.json();
      const out  = data.stdout || data.stderr || "[NO OUTPUT]";
      setHistory(h => { const n = [...h]; n[n.length - 1] = { cmd, out, isError: data.exitCode !== 0, ghostMode, durationMs: Date.now() - t0 }; return n; });
    } catch (e: any) {
      setHistory(h => { const n = [...h]; n[n.length - 1] = { cmd, out: e.message, isError: true }; return n; });
    } finally { setRunning(false); }
  }, [ghostMode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const ni = Math.min(historyIndex + 1, cmdHistory.length - 1);
      setHistoryIndex(ni);
      if (cmdHistory.length > 0) setInput(cmdHistory[cmdHistory.length - 1 - ni] ?? "");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const ni = Math.max(historyIndex - 1, -1);
      setHistoryIndex(ni);
      setInput(ni === -1 ? "" : (cmdHistory[cmdHistory.length - 1 - ni] ?? ""));
      return;
    }
    if (e.key === "Enter" && input.trim()) {
      const cmd = input.trim();
      setCmdHistory(h => [...h.filter(c => c !== cmd), cmd].slice(-200));
      setHistoryIndex(-1);
      setInput("");
      setHistory(h => [...h, { cmd, out: "executing...", isError: false }]);
      execCmd(cmd);
    }
  };

  const runHttp = async () => {
    setHttpRunning(true); setHttpResult(null);
    try {
      let parsedHeaders: Record<string, string> = {};
      try { parsedHeaders = JSON.parse(httpHeaders); } catch { }
      const r = await fetch(`${BASE}/api/terminal/http-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: httpUrl, method: httpMethod, headers: parsedHeaders, data: httpBody || undefined }) });
      setHttpResult(await r.json());
    } catch (e: any) { setHttpResult({ error: e.message }); }
    finally { setHttpRunning(false); }
  };

  const runScan = async () => {
    if (!scanHost.trim()) return;
    setScanRunning(true); setScanResult(null);
    try {
      const ports = scanPorts.split(",").map(p => parseInt(p.trim())).filter(p => p > 0 && p <= 65535);
      const r = await fetch(`${BASE}/api/terminal/port-scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host: scanHost.trim(), ports }) });
      setScanResult(await r.json());
    } catch (e: any) { setScanResult({ error: e.message }); }
    finally { setScanRunning(false); }
  };

  const loadAudit = async () => {
    const r = await fetch(`${BASE}/api/terminal/audit-log`);
    const d = await r.json();
    setAuditLog(d.log ?? []);
  };

  const clearTerminal = () => setHistory([]);

  // ── SSH helpers ──
  const loadSessions = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/terminal/ssh/sessions`);
      const d = await r.json();
      setSshSessions(d.sessions ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (tab === "ssh") loadSessions();
  }, [tab, loadSessions]);

  const sshConnect = async () => {
    if (!connHost.trim() || !connUser.trim()) return;
    if (connAuthMode === "password" && !connPassword) { toast({ title: "Password required", variant: "destructive" }); return; }
    if (connAuthMode === "key" && !connKey.trim()) { toast({ title: "Private key required", variant: "destructive" }); return; }
    setConnConnecting(true);
    try {
      const body: any = { host: connHost.trim(), port: parseInt(connPort) || 22, username: connUser.trim(), label: connLabel.trim() || undefined };
      if (connAuthMode === "password") body.password = connPassword;
      else { body.privateKey = connKey.trim(); if (connPassphrase) body.passphrase = connPassphrase; }
      const r = await fetch(`${BASE}/api/terminal/ssh/connect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Connection failed");
      toast({ title: "SSH Connected", description: d.label ?? `${connUser}@${connHost}` });
      setSshHistory([]);
      await loadSessions();
      const sessions = await fetch(`${BASE}/api/terminal/ssh/sessions`).then(x => x.json());
      const newSession = (sessions.sessions ?? []).find((s: SshSessionMeta) => s.id === d.sessionId);
      if (newSession) setActiveSession(newSession);
    } catch (e: any) {
      toast({ title: "Connection failed", description: e.message, variant: "destructive" });
    } finally { setConnConnecting(false); }
  };

  const sshDisconnect = async (id: string) => {
    await fetch(`${BASE}/api/terminal/ssh/sessions/${id}`, { method: "DELETE" });
    if (activeSession?.id === id) { setActiveSession(null); setSshHistory([]); }
    await loadSessions();
    toast({ title: "Session closed" });
  };

  const sshExec = useCallback(async (cmd: string) => {
    if (!activeSession) return;
    setSshRunning(true);
    const ts = new Date().toLocaleTimeString();
    setSshHistory(h => [...h, { cmd, out: "executing...", isError: false, ts }]);
    try {
      const r = await fetch(`${BASE}/api/terminal/ssh/exec`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: activeSession.id, command: cmd }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Exec failed");
      const out = d.stdout || d.stderr || "[no output]";
      setSshHistory(h => { const n = [...h]; n[n.length - 1] = { cmd, out, isError: d.exitCode !== 0, ts }; return n; });
    } catch (e: any) {
      setSshHistory(h => { const n = [...h]; n[n.length - 1] = { cmd, out: e.message, isError: true, ts }; return n; });
      if (e.message?.includes("not found") || e.message?.includes("disconnected")) {
        await loadSessions();
      }
    } finally { setSshRunning(false); }
  }, [activeSession, loadSessions]);

  const sshKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const ni = Math.min(sshHistoryIdx + 1, sshCmdHistory.length - 1);
      setSshHistoryIdx(ni);
      if (sshCmdHistory.length > 0) setSshInput(sshCmdHistory[sshCmdHistory.length - 1 - ni] ?? "");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const ni = Math.max(sshHistoryIdx - 1, -1);
      setSshHistoryIdx(ni);
      setSshInput(ni === -1 ? "" : (sshCmdHistory[sshCmdHistory.length - 1 - ni] ?? ""));
      return;
    }
    if (e.key === "Enter" && sshInput.trim()) {
      const cmd = sshInput.trim();
      setSshCmdHistory(h => [...h.filter(c => c !== cmd), cmd].slice(-200));
      setSshHistoryIdx(-1);
      setSshInput("");
      sshExec(cmd);
    }
  };

  const fbLoad = useCallback(async (path: string) => {
    if (!activeSession) return;
    setFbLoading(true); setFbFileContent(null);
    try {
      const r = await fetch(`${BASE}/api/terminal/ssh/sftp/ls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: activeSession.id, path }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "SFTP error");
      setFbPath(path);
      setFbEntries(d.entries ?? []);
    } catch (e: any) {
      toast({ title: "SFTP error", description: e.message, variant: "destructive" });
    } finally { setFbLoading(false); }
  }, [activeSession, toast]);

  const fbReadFile = async (path: string) => {
    if (!activeSession) return;
    setFbLoading(true);
    try {
      const r = await fetch(`${BASE}/api/terminal/ssh/sftp/read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: activeSession.id, path }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "SFTP read error");
      setFbFileContent({ path, content: d.content, truncated: d.truncated });
    } catch (e: any) {
      toast({ title: "Read error", description: e.message, variant: "destructive" });
    } finally { setFbLoading(false); }
  };

  const fbNavigate = (entry: FsEntry) => {
    if (entry.isDir) {
      const next = fbPath === "/" ? `/${entry.name}` : `${fbPath}/${entry.name}`;
      fbLoad(next);
    } else {
      const filePath = fbPath === "/" ? `/${entry.name}` : `${fbPath}/${entry.name}`;
      fbReadFile(filePath);
    }
  };

  const fbUp = () => {
    if (fbPath === "/") return;
    const parts = fbPath.split("/").filter(Boolean);
    parts.pop();
    fbLoad(parts.length === 0 ? "/" : "/" + parts.join("/"));
  };

  useEffect(() => {
    if (sshPanel === "files" && activeSession) fbLoad(fbPath);
  }, [sshPanel, activeSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Screen / Remote Desktop helpers ──
  const captureScreen = useCallback(async () => {
    if (!activeSession) return;
    setScreenLoading(true);
    setScreenError(null);
    try {
      const r = await fetch(`${BASE}/api/terminal/ssh/screen/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSession.id, quality: screenQuality, display: screenDisplay }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Capture failed");
      setScreenImage(d.image);
    } catch (e: any) {
      setScreenError(e.message);
    } finally { setScreenLoading(false); }
  }, [activeSession, screenQuality, screenDisplay]);

  const fetchScreenInfo = useCallback(async () => {
    if (!activeSession) return;
    try {
      const r = await fetch(`${BASE}/api/terminal/ssh/screen/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSession.id, display: screenDisplay }),
      });
      const d = await r.json();
      if (r.ok) { setScreenRemoteW(d.width); setScreenRemoteH(d.height); }
    } catch { /* ignore */ }
  }, [activeSession, screenDisplay]);

  const startStreaming = useCallback(() => {
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    setScreenStreaming(true);
    captureScreen();
    streamIntervalRef.current = setInterval(() => captureScreen(), Math.round(1000 / screenFps));
  }, [captureScreen, screenFps]);

  const stopStreaming = useCallback(() => {
    if (streamIntervalRef.current) { clearInterval(streamIntervalRef.current); streamIntervalRef.current = null; }
    setScreenStreaming(false);
  }, []);

  // Restart stream when fps changes
  useEffect(() => {
    if (screenStreaming) startStreaming();
  }, [screenFps]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop stream when session changes or component unmounts
  useEffect(() => { return () => { if (streamIntervalRef.current) clearInterval(streamIntervalRef.current); }; }, []);
  useEffect(() => {
    if (!activeSession) stopStreaming();
    else if (sshPanel === "screen") fetchScreenInfo();
  }, [activeSession, sshPanel]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendInput = useCallback(async (event: object) => {
    if (!activeSession) return;
    await fetch(`${BASE}/api/terminal/ssh/screen/input`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: activeSession.id, event, display: screenDisplay }),
    });
  }, [activeSession, screenDisplay]);

  // Translate click coords from displayed image to remote screen coords
  const handleScreenClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!mouseControl || !activeSession) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = Math.round(((e.clientX - rect.left) / rect.width) * screenRemoteW);
    const ry = Math.round(((e.clientY - rect.top) / rect.height) * screenRemoteH);
    const type = e.detail === 2 ? "dblclick" : "click";
    sendInput({ type, x: rx, y: ry, button: e.button === 2 ? 3 : 1 });
  }, [mouseControl, activeSession, screenRemoteW, screenRemoteH, sendInput]);

  const handleScreenMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!mouseControl || !activeSession || !e.buttons) return; // only send while button held (drag)
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = Math.round(((e.clientX - rect.left) / rect.width) * screenRemoteW);
    const ry = Math.round(((e.clientY - rect.top) / rect.height) * screenRemoteH);
    sendInput({ type: "mousemove", x: rx, y: ry });
  }, [mouseControl, activeSession, screenRemoteW, screenRemoteH, sendInput]);

  const handleScreenScroll = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!mouseControl || !activeSession) return;
    e.preventDefault();
    sendInput({ type: "scroll", x: 0, y: 0, delta: e.deltaY });
  }, [mouseControl, activeSession, sendInput]);

  const handleScreenKey = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!keyboardControl || !activeSession) return;
    e.preventDefault();
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      sendInput({ type: "type", text: e.key });
    } else {
      sendInput({ type: "keydown", key: e.key });
    }
  }, [keyboardControl, activeSession, sendInput]);

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: "shell",    label: "SHELL",      icon: TerminalIcon },
    { id: "http",     label: "HTTP CLIENT", icon: Globe },
    { id: "portscan", label: "PORT SCAN",   icon: Scan },
    { id: "ssh",      label: "SSH SESSION", icon: Server },
    { id: "auditlog", label: "AUDIT LOG",   icon: FileText },
  ];

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="border border-primary/10 bg-black/20 rounded-sm px-3 py-2 flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <TerminalIcon className="w-5 h-5" /> ProxhqVPN Terminal
          </h2>
          <Badge variant="outline" className={`font-mono text-xs ${ghostMode ? "text-yellow-400 border-yellow-400/50" : "text-primary/50 border-primary/20"}`}>
            {ghostMode ? "GHOST MODE" : "RESTRICTED"}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-primary/50">GHOST MODE</span>
            <Switch checked={ghostMode} onCheckedChange={setGhostMode} />
          </div>
          <Button onClick={clearTerminal} variant="outline" className="h-7 text-[10px] font-mono border-primary/20 text-primary/50 hover:text-primary">
            CLEAR
          </Button>
        </div>
      </div>

      {ghostMode && (
        <div className="border border-yellow-500/30 bg-yellow-900/10 rounded-sm px-3 py-2 text-[10px] font-mono text-yellow-400 flex items-center gap-2 shrink-0">
          <Zap className="w-3 h-3" />
          GHOST MODE ACTIVE — Full shell access. All outbound connections permitted. Use responsibly.
        </div>
      )}

      <div className="flex border-b border-primary/20 shrink-0 overflow-x-auto scrollbar-green">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); if (t.id === "auditlog") loadAudit(); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap shrink-0 ${tab === t.id ? "border-primary text-primary" : "border-transparent text-primary/40 hover:text-primary/70"}`}>
              <Icon className="w-3 h-3" /> <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── SHELL TAB ── */}
      {tab === "shell" && (
        <div className="flex-1 bg-black border border-primary/20 rounded flex flex-col overflow-hidden font-mono text-sm min-h-0">
          <div className="flex-1 overflow-auto p-4 space-y-3">
            <div className="text-primary/40 text-xs">
              ProxhqVPN OS v3.0.0 — Management Shell<br />
              <span className="text-primary/30">Try: curl https://httpbin.org/ip | nmap -p 80,443 example.com | dig google.com | openssl s_client -connect example.com:443</span>
            </div>
            {history.map((item, i) => (
              <div key={i} className="space-y-0.5">
                <div className="flex items-center gap-2 text-primary/60 text-xs">
                  <span className="text-red-400">root@proxhq:~#</span>
                  <span>{item.cmd}</span>
                  {item.ghostMode && <Badge variant="outline" className="text-[8px] text-yellow-400 border-yellow-400/30 px-1">GHOST</Badge>}
                  {item.durationMs && <span className="text-primary/30">{item.durationMs}ms</span>}
                </div>
                <div className={`whitespace-pre-wrap text-xs leading-relaxed ${item.out === "executing..." ? "text-primary/30 animate-pulse" : item.isError ? "text-red-400/80" : "text-primary/90"}`}>
                  {item.out}
                </div>
              </div>
            ))}
            {running && <div className="text-primary/30 text-xs animate-pulse">executing...</div>}
            <div ref={bottomRef} />
          </div>
          <div className="p-2 border-t border-primary/20 bg-black/50 flex items-center gap-2 shrink-0">
            <span className="text-red-400 font-mono text-sm ml-2 shrink-0">root@proxhq:~#</span>
            <Input
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-primary font-mono text-sm rounded-none h-8 px-2"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command and press Enter..."
              autoFocus
              disabled={running}
            />
          </div>
        </div>
      )}

      {/* ── HTTP CLIENT TAB ── */}
      {tab === "http" && (
        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-auto">
          <div className="bg-black border border-primary/20 rounded p-4 space-y-3 shrink-0">
            <p className="text-[10px] font-mono text-primary/40 uppercase tracking-widest pb-1 border-b border-primary/10">Direct HTTP Request (outbound from server)</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex flex-wrap border border-primary/20 text-[10px] font-mono shrink-0 self-start">
                {["GET","POST","PUT","DELETE","HEAD"].map(m => (
                  <button key={m} onClick={() => setHttpMethod(m)}
                    className={`px-2 py-1.5 ${httpMethod===m ? "bg-primary text-black" : "text-primary/60 hover:text-primary"}`}>{m}</button>
                ))}
              </div>
              <div className="flex gap-2 flex-1 min-w-0">
                <Input value={httpUrl} onChange={e => setHttpUrl(e.target.value)} className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8 flex-1 min-w-0" placeholder="https://..." />
                <Button onClick={runHttp} disabled={httpRunning} variant="outline" className="h-8 font-mono text-xs border-primary/30 text-primary hover:bg-primary/10 shrink-0">
                  <Wifi className={`w-3 h-3 mr-1 ${httpRunning ? "animate-pulse" : ""}`} />
                  {httpRunning ? "..." : "SEND"}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] font-mono text-primary/40 mb-1">HEADERS (JSON)</p>
                <textarea value={httpHeaders} onChange={e => setHttpHeaders(e.target.value)} className="w-full h-16 bg-black/50 border border-primary/20 text-primary font-mono text-[10px] p-2 resize-none focus:outline-none" />
              </div>
              <div>
                <p className="text-[9px] font-mono text-primary/40 mb-1">BODY (for POST/PUT)</p>
                <textarea value={httpBody} onChange={e => setHttpBody(e.target.value)} className="w-full h-16 bg-black/50 border border-primary/20 text-primary font-mono text-[10px] p-2 resize-none focus:outline-none" />
              </div>
            </div>
          </div>
          {httpResult && (
            <div className="bg-black border border-primary/20 rounded p-4 flex-1 min-h-0 overflow-auto">
              <div className="flex items-center gap-3 mb-3">
                <Badge variant="outline" className={`font-mono text-xs ${httpResult.status >= 200 && httpResult.status < 300 ? "text-green-400 border-green-400/50" : httpResult.status >= 400 ? "text-red-400 border-red-400/50" : "text-yellow-400 border-yellow-400/50"}`}>
                  {httpResult.status} {httpResult.statusText}
                </Badge>
                <span className="text-[10px] font-mono text-primary/40">{httpResult.durationMs}ms · {httpResult.bodySize?.toLocaleString() ?? 0} bytes</span>
                {httpResult.redirected && <Badge variant="outline" className="text-xs font-mono text-primary/50">REDIRECTED → {httpResult.finalUrl}</Badge>}
              </div>
              {httpResult.headers && (
                <div className="mb-3">
                  <p className="text-[9px] font-mono text-primary/40 mb-1 uppercase">Response Headers</p>
                  <div className="text-[10px] font-mono text-primary/60 space-y-0.5 max-h-24 overflow-auto">
                    {Object.entries(httpResult.headers).map(([k, v]) => (
                      <div key={k}><span className="text-primary/40">{k}: </span>{String(v)}</div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[9px] font-mono text-primary/40 mb-1 uppercase">Body</p>
              <pre className="text-xs font-mono text-primary/80 whitespace-pre-wrap max-h-96 overflow-auto">{httpResult.error ?? httpResult.body}</pre>
            </div>
          )}
        </div>
      )}

      {/* ── PORT SCAN TAB ── */}
      {tab === "portscan" && (
        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-auto">
          <div className="bg-black border border-primary/20 rounded p-4 space-y-3 shrink-0">
            <p className="text-[10px] font-mono text-primary/40 uppercase tracking-widest pb-1 border-b border-primary/10">TCP Connect Port Scanner</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={scanHost} onChange={e => setScanHost(e.target.value)} placeholder="Host or IP (e.g. example.com)" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8 flex-1" />
              <div className="flex gap-2">
                <Input value={scanPorts} onChange={e => setScanPorts(e.target.value)} placeholder="Ports: 22,80,443" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8 flex-1 sm:w-40 sm:flex-none" />
                <Button onClick={runScan} disabled={scanRunning || !scanHost.trim()} variant="outline" className="h-8 font-mono text-xs border-primary/30 text-primary hover:bg-primary/10 shrink-0">
                  <Scan className={`w-3 h-3 mr-1 ${scanRunning ? "animate-spin" : ""}`} />
                  {scanRunning ? "..." : "SCAN"}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="text-[9px] font-mono text-primary/30">Quick:</span>
              {[["Web","80,443,8080,8443"],["DB","3306,5432,27017,6379,1433"],["SSH/RDP","22,3389"],["All Common", COMMON_PORTS.join(",")]].map(([label, ports]) => (
                <button key={label} onClick={() => setScanPorts(ports as string)} className="text-[9px] font-mono px-1.5 py-0.5 border border-primary/20 text-primary/50 hover:text-primary hover:border-primary/40">{label}</button>
              ))}
            </div>
          </div>
          {scanResult && (
            <div className="bg-black border border-primary/20 rounded p-4 flex-1 min-h-0 overflow-auto">
              {scanResult.error ? (
                <p className="text-red-400 font-mono text-xs">{scanResult.error}</p>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-mono text-primary">{scanResult.host}</span>
                    <Badge variant="outline" className="text-green-400 border-green-400/50 font-mono text-xs">{scanResult.openPorts} OPEN</Badge>
                    <span className="text-[10px] font-mono text-primary/40">{scanResult.scannedAt}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                    {scanResult.results?.map((r: any) => (
                      <div key={r.port} className={`px-2 py-1.5 border rounded-sm text-[10px] font-mono ${r.open ? "border-green-500/40 bg-green-900/10 text-green-400" : "border-primary/10 text-primary/30"}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-bold">{r.port}</span>
                          <span>{r.open ? "OPEN" : "closed"}</span>
                        </div>
                        {r.banner && <div className="text-[9px] truncate text-primary/50 mt-0.5">{r.banner}</div>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── SSH SESSION TAB ── */}
      {tab === "ssh" && (
        <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">

          {/* Left sidebar — sessions + connect form */}
          <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto">

            {/* Connect form */}
            <div className="bg-black border border-primary/20 rounded p-3 space-y-2 shrink-0">
              <p className="text-[10px] font-mono text-primary/50 uppercase tracking-widest border-b border-primary/10 pb-1.5 flex items-center gap-1.5">
                <PlugZap className="w-3 h-3" /> New Connection
              </p>
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  <Input value={connHost} onChange={e => setConnHost(e.target.value)} placeholder="Host / IP" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-7 flex-1 min-w-0" />
                  <Input value={connPort} onChange={e => setConnPort(e.target.value)} placeholder="22" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-7 w-14 shrink-0" />
                </div>
                <Input value={connUser} onChange={e => setConnUser(e.target.value)} placeholder="Username" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-7" />
                <Input value={connLabel} onChange={e => setConnLabel(e.target.value)} placeholder="Label (optional)" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-7" />
                {/* Auth mode toggle */}
                <div className="flex border border-primary/20 text-[9px] font-mono">
                  {(["password","key"] as const).map(m => (
                    <button key={m} onClick={() => setConnAuthMode(m)} className={`flex-1 py-1 uppercase ${connAuthMode === m ? "bg-primary text-black" : "text-primary/50 hover:text-primary"}`}>{m === "password" ? "Password" : "Private Key"}</button>
                  ))}
                </div>
                {connAuthMode === "password" ? (
                  <Input type="password" value={connPassword} onChange={e => setConnPassword(e.target.value)} placeholder="Password" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-7" />
                ) : (
                  <>
                    <textarea value={connKey} onChange={e => setConnKey(e.target.value)} placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n..."} className="w-full h-24 bg-black/50 border border-primary/20 text-primary font-mono text-[9px] p-2 resize-none focus:outline-none rounded-sm" />
                    <Input type="password" value={connPassphrase} onChange={e => setConnPassphrase(e.target.value)} placeholder="Passphrase (if encrypted)" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-7" />
                  </>
                )}
                <Button onClick={sshConnect} disabled={connConnecting || !connHost.trim() || !connUser.trim()} className="w-full h-7 font-mono text-xs bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30">
                  {connConnecting ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Connecting...</> : <><PlugZap className="w-3 h-3 mr-1" />Connect</>}
                </Button>
              </div>
            </div>

            {/* Active sessions */}
            {sshSessions.length > 0 && (
              <div className="bg-black border border-primary/20 rounded p-3 space-y-1.5 shrink-0">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono text-primary/50 uppercase tracking-widest">Sessions ({sshSessions.length})</p>
                  <button onClick={loadSessions} className="text-primary/30 hover:text-primary"><RefreshCw className="w-3 h-3" /></button>
                </div>
                {sshSessions.map(s => (
                  <div key={s.id} onClick={() => { setActiveSession(s); setSshHistory([]); setSshPanel("shell"); }}
                    className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer border transition-colors ${activeSession?.id === s.id ? "border-primary/40 bg-primary/10 text-primary" : "border-primary/10 text-primary/60 hover:border-primary/30 hover:text-primary/80"}`}>
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono font-bold truncate">{s.label}</div>
                      <div className="text-[9px] font-mono text-primary/30">{new Date(s.connectedAt).toLocaleTimeString()}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); sshDisconnect(s.id); }} className="text-red-400/50 hover:text-red-400 ml-2 shrink-0">
                      <LogOut className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {sshSessions.length === 0 && (
              <div className="text-center py-6 text-primary/20 font-mono text-xs">No active sessions</div>
            )}
          </div>

          {/* Right panel — shell or file browser */}
          <div className="flex-1 min-w-0 flex flex-col gap-2 overflow-hidden">
            {!activeSession ? (
              <div className="flex-1 bg-black border border-primary/20 rounded flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Server className="w-10 h-10 text-primary/20 mx-auto" />
                  <p className="text-primary/30 font-mono text-xs">Connect to an SSH host to start a session</p>
                </div>
              </div>
            ) : (
              <>
                {/* Session header */}
                <div className="bg-black border border-primary/20 rounded px-3 py-2 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs font-mono text-primary font-bold">{activeSession.label}</span>
                    <span className="text-[10px] font-mono text-primary/40">{activeSession.host}:{activeSession.port}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Sub-panel toggle */}
                    <div className="flex border border-primary/20 text-[9px] font-mono mr-2">
                      <button onClick={() => setSshPanel("shell")} className={`px-2 py-1 flex items-center gap-1 ${sshPanel === "shell" ? "bg-primary text-black" : "text-primary/50 hover:text-primary"}`}><TerminalIcon className="w-2.5 h-2.5" />SHELL</button>
                      <button onClick={() => { setSshPanel("files"); fbLoad("/"); }} className={`px-2 py-1 flex items-center gap-1 ${sshPanel === "files" ? "bg-primary text-black" : "text-primary/50 hover:text-primary"}`}><FolderOpen className="w-2.5 h-2.5" />FILES</button>
                      <button onClick={() => { setSshPanel("screen"); fetchScreenInfo(); }} className={`px-2 py-1 flex items-center gap-1 ${sshPanel === "screen" ? "bg-primary text-black" : "text-primary/50 hover:text-primary"}`}><Monitor className="w-2.5 h-2.5" />SCREEN</button>
                    </div>
                    <button onClick={() => sshDisconnect(activeSession.id)} className="text-red-400/50 hover:text-red-400 p-1" title="Disconnect">
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* ── SHELL PANEL ── */}
                {sshPanel === "shell" && (
                  <div className="flex-1 bg-black border border-primary/20 rounded flex flex-col overflow-hidden min-h-0 font-mono text-xs">
                    <div className="flex-1 overflow-auto p-3 space-y-2">
                      {sshHistory.length === 0 && (
                        <div className="text-primary/30 text-xs">
                          Connected to <span className="text-primary/60">{activeSession.label}</span> — type commands below.<br />
                          <span className="text-primary/20">Tip: try  ls -la  |  uname -a  |  cat /etc/os-release  |  ps aux  |  netstat -tlnp</span>
                        </div>
                      )}
                      {sshHistory.map((item, i) => (
                        <div key={i} className="space-y-0.5">
                          <div className="flex items-center gap-2 text-primary/60">
                            <span className="text-green-400">{activeSession.username}@{activeSession.host}:~$</span>
                            <span>{item.cmd}</span>
                            <span className="text-primary/20">{item.ts}</span>
                          </div>
                          <div className={`whitespace-pre-wrap text-xs leading-relaxed ${item.out === "executing..." ? "text-primary/30 animate-pulse" : item.isError ? "text-red-400/80" : "text-primary/80"}`}>
                            {item.out}
                          </div>
                        </div>
                      ))}
                      {sshRunning && <div className="text-primary/30 animate-pulse">executing...</div>}
                      <div ref={sshBottomRef} />
                    </div>
                    <div className="p-2 border-t border-primary/20 bg-black/60 flex items-center gap-2 shrink-0">
                      <span className="text-green-400 font-mono text-xs shrink-0">{activeSession.username}@{activeSession.host}:~$</span>
                      <Input
                        className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-primary font-mono text-xs rounded-none h-7 px-1"
                        value={sshInput}
                        onChange={e => setSshInput(e.target.value)}
                        onKeyDown={sshKeyDown}
                        placeholder="Type a command..."
                        disabled={sshRunning}
                        autoFocus
                      />
                      <button onClick={() => { setSshHistory([]); }} className="text-primary/20 hover:text-primary/60 shrink-0" title="Clear">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── SCREEN PANEL ── */}
                {sshPanel === "screen" && (
                  <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
                    {/* Toolbar */}
                    <div className="bg-black border border-primary/20 rounded px-3 py-1.5 flex items-center gap-3 flex-wrap shrink-0">
                      {/* Stream controls */}
                      <button
                        onClick={screenStreaming ? stopStreaming : startStreaming}
                        className={`flex items-center gap-1 text-[10px] font-mono px-2 py-1 border rounded transition-colors ${screenStreaming ? "border-red-500/50 text-red-400 hover:bg-red-900/20" : "border-green-500/50 text-green-400 hover:bg-green-900/20"}`}>
                        {screenStreaming ? <><Pause className="w-3 h-3" />STOP</> : <><Play className="w-3 h-3" />STREAM</>}
                      </button>
                      <button onClick={captureScreen} disabled={screenLoading}
                        className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 border border-primary/30 text-primary/60 hover:text-primary rounded">
                        <RefreshCw className={`w-3 h-3 ${screenLoading ? "animate-spin" : ""}`} />SNAP
                      </button>

                      <div className="h-4 w-px bg-primary/20 shrink-0" />

                      {/* FPS */}
                      <div className="flex items-center gap-1.5 text-[9px] font-mono text-primary/40">
                        <span>FPS</span>
                        {[1, 2, 3, 5].map(f => (
                          <button key={f} onClick={() => setScreenFps(f)}
                            className={`px-1.5 py-0.5 border rounded text-[9px] ${screenFps === f ? "border-primary/60 text-primary bg-primary/10" : "border-primary/20 text-primary/40 hover:text-primary"}`}>{f}</button>
                        ))}
                      </div>

                      <div className="h-4 w-px bg-primary/20 shrink-0" />

                      {/* Quality */}
                      <div className="flex items-center gap-1.5 text-[9px] font-mono text-primary/40">
                        <span>Q</span>
                        {[30, 55, 75].map(q => (
                          <button key={q} onClick={() => setScreenQuality(q)}
                            className={`px-1.5 py-0.5 border rounded text-[9px] ${screenQuality === q ? "border-primary/60 text-primary bg-primary/10" : "border-primary/20 text-primary/40 hover:text-primary"}`}>{q === 30 ? "Lo" : q === 55 ? "Med" : "Hi"}</button>
                        ))}
                      </div>

                      <div className="h-4 w-px bg-primary/20 shrink-0" />

                      {/* Zoom */}
                      <div className="flex items-center gap-1 text-[9px] font-mono text-primary/40">
                        <button onClick={() => setScreenZoom(z => Math.max(0.3, z - 0.1))} className="hover:text-primary"><ZoomOut className="w-3 h-3" /></button>
                        <span className="w-8 text-center text-primary/60">{Math.round(screenZoom * 100)}%</span>
                        <button onClick={() => setScreenZoom(z => Math.min(2.0, z + 0.1))} className="hover:text-primary"><ZoomIn className="w-3 h-3" /></button>
                        <button onClick={() => setScreenZoom(1.0)} className="text-primary/30 hover:text-primary text-[8px] border border-primary/20 px-1 rounded ml-1">FIT</button>
                      </div>

                      <div className="h-4 w-px bg-primary/20 shrink-0" />

                      {/* Mouse/keyboard toggles */}
                      <button onClick={() => setMouseControl(v => !v)}
                        className={`flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 border rounded ${mouseControl ? "border-primary/50 text-primary" : "border-primary/20 text-primary/30"}`}>
                        <MousePointer className="w-3 h-3" />{mouseControl ? "MOUSE ON" : "MOUSE OFF"}
                      </button>
                      <button onClick={() => setKeyboardControl(v => !v)}
                        className={`flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 border rounded ${keyboardControl ? "border-primary/50 text-primary" : "border-primary/20 text-primary/30"}`}>
                        <Keyboard className="w-3 h-3" />{keyboardControl ? "KEYS ON" : "KEYS OFF"}
                      </button>

                      {/* Display selector */}
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-[9px] font-mono text-primary/30">DISPLAY</span>
                        <Input value={screenDisplay} onChange={e => setScreenDisplay(e.target.value)}
                          className="border-primary/20 bg-black/50 text-primary font-mono text-[9px] h-6 w-14 px-1" />
                        <span className="text-[9px] font-mono text-primary/30">{screenRemoteW}×{screenRemoteH}</span>
                      </div>
                    </div>

                    {/* Screen viewer */}
                    <div className="flex-1 bg-black border border-primary/20 rounded overflow-auto min-h-0 flex items-center justify-center">
                      {screenError && !screenImage && (
                        <div className="text-center space-y-3 p-6">
                          <Monitor className="w-10 h-10 text-primary/20 mx-auto" />
                          <p className="text-red-400/80 font-mono text-xs max-w-sm">{screenError}</p>
                          <div className="text-primary/30 font-mono text-[10px] text-left bg-black/50 border border-primary/10 rounded p-3 max-w-sm">
                            <p className="text-primary/50 mb-1 uppercase text-[9px] tracking-widest">Install on target machine:</p>
                            <code className="text-green-400">sudo apt install scrot xdotool</code><br />
                            <code className="text-green-400">sudo yum install scrot xdotool</code>
                          </div>
                          <Button onClick={captureScreen} variant="outline" className="font-mono text-xs border-primary/30 text-primary hover:bg-primary/10">
                            Try Again
                          </Button>
                        </div>
                      )}
                      {!screenImage && !screenError && (
                        <div className="text-center space-y-2">
                          <Monitor className="w-10 h-10 text-primary/20 mx-auto" />
                          <p className="text-primary/30 font-mono text-xs">Click STREAM to start live view, or SNAP for a single screenshot</p>
                          <p className="text-primary/20 font-mono text-[10px]">Requires: scrot + xdotool on target · X11 display</p>
                        </div>
                      )}
                      {screenImage && (
                        <div
                          ref={screenRef}
                          className="relative cursor-crosshair outline-none"
                          style={{ transform: `scale(${screenZoom})`, transformOrigin: "top left" }}
                          tabIndex={0}
                          onClick={handleScreenClick}
                          onMouseMove={handleScreenMouseMove}
                          onWheel={handleScreenScroll}
                          onKeyDown={handleScreenKey}
                          onContextMenu={e => { e.preventDefault(); handleScreenClick(e as any); }}
                        >
                          <img
                            src={screenImage}
                            alt="Remote desktop"
                            className="block max-w-full"
                            draggable={false}
                            style={{ imageRendering: "pixelated" }}
                          />
                          {screenLoading && (
                            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400 animate-ping" />
                          )}
                          {screenError && (
                            <div className="absolute top-1 left-1 text-[9px] font-mono text-red-400 bg-black/80 px-1 rounded">{screenError}</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status bar */}
                    <div className="flex items-center gap-3 px-2 shrink-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${screenStreaming ? "bg-green-400 animate-pulse" : "bg-primary/20"}`} />
                      <span className="text-[9px] font-mono text-primary/30">
                        {screenStreaming ? `LIVE · ${screenFps}fps · Q${screenQuality}` : "PAUSED"}
                        {screenImage ? ` · ${mouseControl ? "mouse" : ""} ${keyboardControl ? "keyboard" : ""}` : ""}
                      </span>
                      {mouseControl && <span className="text-[9px] font-mono text-yellow-400/50">Click on screen to control · Right-click = right mouse button · Scroll wheel supported</span>}
                    </div>
                  </div>
                )}

                {/* ── FILE BROWSER PANEL ── */}
                {sshPanel === "files" && (
                  <div className="flex-1 flex gap-2 min-h-0 overflow-hidden">
                    {/* Directory tree */}
                    <div className="w-64 shrink-0 bg-black border border-primary/20 rounded flex flex-col min-h-0 overflow-hidden">
                      <div className="px-2 py-1.5 border-b border-primary/10 flex items-center gap-1.5 shrink-0">
                        <button onClick={fbUp} disabled={fbPath === "/"} className="text-primary/40 hover:text-primary disabled:opacity-20 shrink-0"><ChevronRight className="w-3 h-3 rotate-180" /></button>
                        <span className="text-[10px] font-mono text-primary/60 truncate flex-1">{fbPath}</span>
                        <button onClick={() => fbLoad(fbPath)} className="text-primary/40 hover:text-primary shrink-0"><RefreshCw className={`w-3 h-3 ${fbLoading ? "animate-spin" : ""}`} /></button>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {fbLoading && fbEntries.length === 0 && (
                          <div className="text-primary/30 text-[10px] font-mono text-center py-4 animate-pulse">Loading...</div>
                        )}
                        {[...fbEntries].sort((a, b) => {
                          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
                          return a.name.localeCompare(b.name);
                        }).map(entry => (
                          <button key={entry.name} onClick={() => fbNavigate(entry)}
                            className="w-full flex items-center gap-1.5 px-2 py-1 hover:bg-primary/5 text-left group">
                            {entry.isDir
                              ? <Folder className="w-3 h-3 text-yellow-400/70 shrink-0" />
                              : <FileCode className="w-3 h-3 text-primary/40 shrink-0" />
                            }
                            <span className={`text-[10px] font-mono truncate ${entry.isDir ? "text-yellow-400/80" : "text-primary/70"} ${entry.isSymlink ? "italic" : ""}`}>
                              {entry.name}{entry.isDir ? "/" : ""}
                            </span>
                            {!entry.isDir && entry.size > 0 && (
                              <span className="text-[9px] font-mono text-primary/20 ml-auto shrink-0">{entry.size < 1024 ? `${entry.size}B` : `${(entry.size / 1024).toFixed(0)}K`}</span>
                            )}
                          </button>
                        ))}
                        {!fbLoading && fbEntries.length === 0 && (
                          <div className="text-primary/20 text-[10px] font-mono text-center py-4">Empty directory</div>
                        )}
                      </div>
                    </div>

                    {/* File content viewer */}
                    <div className="flex-1 bg-black border border-primary/20 rounded flex flex-col min-h-0 overflow-hidden">
                      {!fbFileContent ? (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-primary/20 font-mono text-xs">Click a file to view its contents</p>
                        </div>
                      ) : (
                        <>
                          <div className="px-3 py-1.5 border-b border-primary/10 flex items-center justify-between shrink-0">
                            <span className="text-[10px] font-mono text-primary/60 truncate">{fbFileContent.path}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              {fbFileContent.truncated && <Badge variant="outline" className="text-[9px] font-mono text-yellow-400 border-yellow-400/30">TRUNCATED (512KB)</Badge>}
                              <button onClick={() => navigator.clipboard.writeText(fbFileContent.content).then(() => toast({ title: "Copied" }))}
                                className="text-primary/30 hover:text-primary text-[9px] font-mono">COPY</button>
                            </div>
                          </div>
                          <pre className="flex-1 overflow-auto p-3 text-[10px] font-mono text-primary/80 leading-relaxed whitespace-pre-wrap">
                            {fbFileContent.content || "[empty file]"}
                          </pre>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── AUDIT LOG TAB ── */}
      {tab === "auditlog" && (
        <div className="flex-1 bg-black border border-primary/20 rounded overflow-auto min-h-0">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono text-primary/50 uppercase tracking-widest">Command Audit Log ({auditLog.length})</span>
              <Button onClick={loadAudit} variant="outline" className="h-7 text-[10px] font-mono border-primary/20 text-primary/50 hover:text-primary">REFRESH</Button>
            </div>
            {auditLog.length === 0 ? (
              <div className="text-center py-8 text-primary/30 font-mono text-xs">No commands logged yet. Execute commands to see the audit trail.</div>
            ) : (
              <div className="space-y-1">
                {[...auditLog].reverse().map((entry, i) => (
                  <div key={i} className={`flex items-start gap-3 px-2 py-1.5 border rounded-sm text-[10px] font-mono ${entry.exitCode === 0 ? "border-primary/10" : "border-red-500/20 bg-red-900/5"}`}>
                    <span className="text-primary/30 flex-shrink-0 w-20">{new Date(entry.ts).toLocaleTimeString()}</span>
                    <span className={`flex-shrink-0 w-10 ${entry.exitCode === 0 ? "text-green-400" : "text-red-400"}`}>[{entry.exitCode}]</span>
                    <span className="text-primary/70 truncate flex-1">{entry.cmd}</span>
                    <span className="text-primary/30 flex-shrink-0">{entry.ip}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
