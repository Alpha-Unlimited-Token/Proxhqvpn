import { useState, useRef, useEffect, useCallback } from "react";
import { Terminal as TerminalIcon, Wifi, Scan, FileText, Zap, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface HistoryItem { cmd: string; out: string; isError: boolean; ghostMode?: boolean; durationMs?: number }
interface AuditEntry { ts: string; cmd: string; exitCode: number; ip: string }

type TabType = "shell" | "http" | "portscan" | "auditlog";

const COMMON_PORTS = [21,22,23,25,53,80,110,143,443,445,993,995,1433,3306,3389,5432,5900,6379,8080,8443,27017];

export default function Terminal() {
  const { toast } = useToast();
  const [tab, setTab]             = useState<TabType>("shell");
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  // Exec shell command
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
      setHistory(h => {
        const n = [...h];
        n[n.length - 1] = { cmd, out, isError: data.exitCode !== 0, ghostMode, durationMs: Date.now() - t0 };
        return n;
      });
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
    setHttpRunning(true);
    setHttpResult(null);
    try {
      let parsedHeaders: Record<string, string> = {};
      try { parsedHeaders = JSON.parse(httpHeaders); } catch { }
      const r = await fetch(`${BASE}/api/terminal/http-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: httpUrl, method: httpMethod, headers: parsedHeaders, data: httpBody || undefined }),
      });
      setHttpResult(await r.json());
    } catch (e: any) { setHttpResult({ error: e.message }); }
    finally { setHttpRunning(false); }
  };

  const runScan = async () => {
    if (!scanHost.trim()) return;
    setScanRunning(true);
    setScanResult(null);
    try {
      const ports = scanPorts.split(",").map(p => parseInt(p.trim())).filter(p => p > 0 && p <= 65535);
      const r = await fetch(`${BASE}/api/terminal/port-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: scanHost.trim(), ports }),
      });
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

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: "shell",    label: "SHELL",      icon: TerminalIcon },
    { id: "http",     label: "HTTP CLIENT", icon: Globe },
    { id: "portscan", label: "PORT SCAN",   icon: Scan },
    { id: "auditlog", label: "AUDIT LOG",   icon: FileText },
  ];

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="border border-primary/10 bg-black/20 rounded-sm px-3 py-2 flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <TerminalIcon className="w-5 h-5" /> GhostNet Terminal
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

      <div className="flex border-b border-primary/20 shrink-0">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); if (t.id === "auditlog") loadAudit(); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono uppercase tracking-wider border-b-2 transition-colors ${tab === t.id ? "border-primary text-primary" : "border-transparent text-primary/40 hover:text-primary/70"}`}>
              <Icon className="w-3 h-3" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── SHELL TAB ── */}
      {tab === "shell" && (
        <div className="flex-1 bg-black border border-primary/20 rounded flex flex-col overflow-hidden font-mono text-sm min-h-0">
          <div className="flex-1 overflow-auto p-4 space-y-3">
            <div className="text-primary/40 text-xs">
              GhostNet OS v3.0.0 — Management Shell<br />
              <span className="text-primary/30">Try: curl https://httpbin.org/ip | nmap -p 80,443 example.com | dig google.com | openssl s_client -connect example.com:443</span>
            </div>
            {history.map((item, i) => (
              <div key={i} className="space-y-0.5">
                <div className="flex items-center gap-2 text-primary/60 text-xs">
                  <span className="text-red-400">root@ghostnet:~#</span>
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
            <span className="text-red-400 font-mono text-sm ml-2 shrink-0">root@ghostnet:~#</span>
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
            <div className="flex gap-2">
              <div className="flex border border-primary/20 text-[10px] font-mono shrink-0">
                {["GET","POST","PUT","DELETE","HEAD"].map(m => (
                  <button key={m} onClick={() => setHttpMethod(m)}
                    className={`px-2 py-1.5 ${httpMethod===m ? "bg-primary text-black" : "text-primary/60 hover:text-primary"}`}>{m}</button>
                ))}
              </div>
              <Input value={httpUrl} onChange={e => setHttpUrl(e.target.value)}
                className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8 flex-1" placeholder="https://..." />
              <Button onClick={runHttp} disabled={httpRunning} variant="outline"
                className="h-8 font-mono text-xs border-primary/30 text-primary hover:bg-primary/10">
                <Wifi className={`w-3 h-3 mr-1 ${httpRunning ? "animate-pulse" : ""}`} />
                {httpRunning ? "SENDING..." : "SEND"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] font-mono text-primary/40 mb-1">HEADERS (JSON)</p>
                <textarea value={httpHeaders} onChange={e => setHttpHeaders(e.target.value)}
                  className="w-full h-16 bg-black/50 border border-primary/20 text-primary font-mono text-[10px] p-2 resize-none focus:outline-none" />
              </div>
              <div>
                <p className="text-[9px] font-mono text-primary/40 mb-1">BODY (for POST/PUT)</p>
                <textarea value={httpBody} onChange={e => setHttpBody(e.target.value)}
                  className="w-full h-16 bg-black/50 border border-primary/20 text-primary font-mono text-[10px] p-2 resize-none focus:outline-none" />
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
              <pre className="text-xs font-mono text-primary/80 whitespace-pre-wrap max-h-96 overflow-auto">
                {httpResult.error ?? httpResult.body}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── PORT SCAN TAB ── */}
      {tab === "portscan" && (
        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-auto">
          <div className="bg-black border border-primary/20 rounded p-4 space-y-3 shrink-0">
            <p className="text-[10px] font-mono text-primary/40 uppercase tracking-widest pb-1 border-b border-primary/10">TCP Connect Port Scanner</p>
            <div className="flex gap-2">
              <Input value={scanHost} onChange={e => setScanHost(e.target.value)}
                placeholder="Host or IP (e.g. example.com)" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8 flex-1" />
              <Input value={scanPorts} onChange={e => setScanPorts(e.target.value)}
                placeholder="Ports: 22,80,443,8080" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8 w-48" />
              <Button onClick={runScan} disabled={scanRunning || !scanHost.trim()} variant="outline"
                className="h-8 font-mono text-xs border-primary/30 text-primary hover:bg-primary/10">
                <Scan className={`w-3 h-3 mr-1 ${scanRunning ? "animate-spin" : ""}`} />
                {scanRunning ? "SCANNING..." : "SCAN"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="text-[9px] font-mono text-primary/30">Quick:</span>
              {[["Web","80,443,8080,8443"],["DB","3306,5432,27017,6379,1433"],["SSH/RDP","22,3389"],["All Common", COMMON_PORTS.join(",")]].map(([label, ports]) => (
                <button key={label} onClick={() => setScanPorts(ports as string)}
                  className="text-[9px] font-mono px-1.5 py-0.5 border border-primary/20 text-primary/50 hover:text-primary hover:border-primary/40">{label}</button>
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
