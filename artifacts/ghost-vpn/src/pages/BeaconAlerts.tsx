import { useState, useRef, useEffect } from "react";
import { useListBeaconAlerts, useDismissBeaconAlert, useTriggerBeacon, useListNodes, getListBeaconAlertsQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldOff, AlertOctagon, Target, Ban,
  ChevronDown, Copy, Search, Globe, Syringe,
  TerminalSquare, Loader2, XCircle, Download,
} from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function blockIpApi(ip: string, reason: string) {
  const r = await fetch(`${BASE}/api/firewall/blocked-ips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ip, reason }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

type AlertRow = {
  id: number;
  attackerIp: string;
  nodeName: string;
  probeType: string;
  severity: string;
  status: string;
  detectedAt: string;
};

type PanelTab = "portscan" | "sqlmap";

// ── IP action dropdown ────────────────────────────────────────────────────────
function IpActionDropdown({
  alert,
  onOpenPanel,
  onBlock,
  blocking,
}: {
  alert: AlertRow;
  onOpenPanel: (ip: string, tab: PanelTab) => void;
  onBlock: (ip: string) => void;
  blocking: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const copyIp = () => {
    navigator.clipboard.writeText(alert.attackerIp);
    toast({ title: "Copied", description: `${alert.attackerIp} copied to clipboard` });
    setOpen(false);
  };

  const actions = [
    {
      icon: <Search className="w-3.5 h-3.5" />,
      label: "Port Scan (nmap)",
      sub: "Discover open ports & running services",
      color: "text-primary",
      onClick: () => { onOpenPanel(alert.attackerIp, "portscan"); setOpen(false); },
    },
    {
      icon: <Syringe className="w-3.5 h-3.5" />,
      label: "SQL Injection (SQLmap)",
      sub: "Test for SQL vulnerabilities & extract data",
      color: "text-red-400",
      onClick: () => { onOpenPanel(alert.attackerIp, "sqlmap"); setOpen(false); },
    },
    {
      icon: <Globe className="w-3.5 h-3.5" />,
      label: "WHOIS / ARIN Lookup",
      sub: "Identify owner — evidence for law enforcement",
      color: "text-blue-400",
      onClick: () => {
        window.open(`https://search.arin.net/rdap/?query=${alert.attackerIp}`, "_blank");
        setOpen(false);
      },
    },
    {
      icon: <Ban className="w-3.5 h-3.5" />,
      label: "Block IP",
      sub: "Add to firewall blacklist immediately",
      color: "text-orange-400",
      onClick: () => { onBlock(alert.attackerIp); setOpen(false); },
    },
    {
      icon: <Copy className="w-3.5 h-3.5" />,
      label: "Copy IP Address",
      sub: alert.attackerIp,
      color: "text-primary/60",
      onClick: copyIp,
    },
  ];

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex items-center gap-1 text-destructive font-mono font-bold hover:text-red-300 transition-colors"
      >
        <span className="underline underline-offset-2 decoration-red-500/40">{alert.attackerIp}</span>
        <ChevronDown className={`w-3 h-3 text-red-400/60 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-72 border border-yellow-500/40 bg-[#070c08] shadow-2xl shadow-black/80 rounded overflow-hidden">
          <div className="px-3 py-2 border-b border-yellow-500/20 bg-yellow-500/5">
            <div className="flex items-center gap-2">
              <TerminalSquare className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[10px] font-mono text-yellow-400 uppercase tracking-widest font-bold">
                Actions — {alert.attackerIp}
              </span>
            </div>
            <div className="text-[9px] font-mono text-primary/30 mt-0.5">
              {alert.probeType} via {alert.nodeName} · {alert.severity.toUpperCase()}
            </div>
          </div>

          <div className="py-1">
            {actions.map((a, i) => (
              <button
                key={i}
                onClick={a.onClick}
                disabled={a.label === "Block IP" && blocking}
                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left disabled:opacity-40"
              >
                <span className={`${a.color} mt-0.5 shrink-0`}>{a.icon}</span>
                <div className="min-w-0">
                  <div className={`text-xs font-mono font-semibold ${a.color}`}>{a.label}</div>
                  <div className="text-[10px] text-primary/35 font-mono truncate">{a.sub}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="px-3 py-2 border-t border-yellow-500/10 bg-black/40">
            <div className="text-[9px] font-mono text-primary/25 leading-relaxed">
              Use WHOIS to obtain ISP info for law enforcement reporting.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Slide-in command panel ────────────────────────────────────────────────────
function IpCommandPanel({
  ip,
  initialTab,
  onClose,
}: {
  ip: string;
  initialTab: PanelTab;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<PanelTab>(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  // Port scan
  const [scanPorts, setScanPorts]   = useState("1-10000");
  const [scanFlags, setScanFlags]   = useState("-sV -T4");
  const [scanning, setScanning]     = useState(false);
  const [scanOutput, setScanOutput] = useState<string | null>(null);
  const [scanCmd, setScanCmd]       = useState<string | null>(null);

  // SQLmap
  const [sqlTarget, setSqlTarget]   = useState(`http://${ip}/`);
  const [sqlFlags, setSqlFlags]     = useState("--dbs --forms");
  const [sqlRunning, setSqlRunning] = useState(false);
  const [sqlOutput, setSqlOutput]   = useState<string | null>(null);
  const [sqlJobId, setSqlJobId]     = useState<string | null>(null);
  const [sqlStatus, setSqlStatus]   = useState("idle");

  // Reset when IP changes
  useEffect(() => {
    setSqlTarget(`http://${ip}/`);
    setScanOutput(null); setScanCmd(null);
    setSqlOutput(null); setSqlJobId(null); setSqlStatus("idle");
  }, [ip]);

  const runPortScan = async () => {
    setScanning(true); setScanOutput(null); setScanCmd(null);
    try {
      const res = await fetch(`${BASE}/api/silkweb/scan/portscan`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, ports: scanPorts, flags: scanFlags }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Port Scan Error", description: data.error, variant: "destructive" });
        setScanning(false); return;
      }
      setScanCmd(data.cmd);
      toast({ title: "Port Scan Launched", description: `Job ${data.jobId} — scanning ${ip}` });
      const poll = setInterval(async () => {
        try {
          const pr = await fetch(`${BASE}/api/silkweb/scan/portscan/${data.jobId}`, { credentials: "include" });
          const pd = await pr.json();
          if (pd.status !== "running") {
            setScanOutput(pd.results ?? "No output");
            setScanning(false); clearInterval(poll);
          }
        } catch { /* ignore */ }
      }, 4000);
    } catch (e: any) {
      setScanOutput("Error: " + e.message);
      setScanning(false);
    }
  };

  const runSqlmap = async () => {
    setSqlRunning(true); setSqlOutput(null); setSqlStatus("running");
    try {
      const res = await fetch(`${BASE}/api/silkweb/scan/sqlmap`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, targetUrl: sqlTarget, extraFlags: sqlFlags }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSqlStatus("error"); setSqlOutput(data.error ?? "Unknown error");
        toast({ title: "SQLmap Error", description: data.error, variant: "destructive" });
        setSqlRunning(false); return;
      }
      setSqlJobId(data.jobId);
      toast({ title: "SQLmap Launched", description: `Job ${data.jobId} — scanning ${ip}` });
      const poll = setInterval(async () => {
        try {
          const pr = await fetch(`${BASE}/api/silkweb/scan/sqlmap/${data.jobId}`, { credentials: "include" });
          const pd = await pr.json();
          if (pd.status !== "running") {
            setSqlStatus(pd.status ?? "complete"); setSqlOutput(pd.results ?? "No output");
            setSqlRunning(false); clearInterval(poll);
          }
        } catch { /* ignore */ }
      }, 4000);
    } catch (e: any) {
      setSqlStatus("error"); setSqlOutput("Error: " + e.message); setSqlRunning(false);
    }
  };

  const statusColor: Record<string, string> = {
    idle: "text-primary/40", running: "text-yellow-400 animate-pulse",
    complete: "text-primary", error: "text-red-400",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-yellow-500/30 bg-yellow-500/5 shrink-0">
        <TerminalSquare className="w-4 h-4 text-yellow-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-yellow-400 font-mono text-sm">{ip}</div>
          <div className="text-[10px] text-primary/40 font-mono">Attack Tools</div>
        </div>
        <a
          href={`https://search.arin.net/rdap/?query=${ip}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] font-mono text-blue-400/60 hover:text-blue-400 transition-colors border border-blue-500/20 px-2 py-1 rounded"
        >
          <Globe className="w-3 h-3" /> WHOIS
        </a>
        <button onClick={onClose} className="text-primary/30 hover:text-white transition-colors ml-1 shrink-0">
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-yellow-500/20 shrink-0">
        <button
          onClick={() => setTab("portscan")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-widest border-b-2 transition-colors ${tab === "portscan" ? "border-primary text-primary bg-primary/5" : "border-transparent text-primary/40 hover:text-primary/70"}`}
        >
          <Search className="w-3.5 h-3.5" /> Port Scan
        </button>
        <button
          onClick={() => setTab("sqlmap")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-widest border-b-2 transition-colors ${tab === "sqlmap" ? "border-red-500 text-red-400 bg-red-500/5" : "border-transparent text-primary/40 hover:text-red-400/60"}`}
        >
          <Syringe className="w-3.5 h-3.5" /> SQLmap
          {sqlStatus === "running" && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />}
          {sqlStatus === "complete" && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">

        {/* PORT SCAN */}
        {tab === "portscan" && (
          <div className="space-y-4">
            <div className="text-[10px] font-mono text-primary/40 border border-primary/10 rounded px-3 py-2 bg-primary/5">
              Runs <span className="text-primary">nmap</span> against <span className="text-primary">{ip}</span> to discover open ports, services, and software versions.
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] text-primary/50 font-mono uppercase block mb-1">Port Range</label>
                <input value={scanPorts} onChange={e => setScanPorts(e.target.value)}
                  className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary/50 rounded"
                  placeholder="1-65535" />
              </div>
              <div>
                <label className="text-[10px] text-primary/50 font-mono uppercase block mb-1">Nmap Flags</label>
                <input value={scanFlags} onChange={e => setScanFlags(e.target.value)}
                  className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary/50 rounded"
                  placeholder="-sV -T4" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Fast Top 1000", flags: "-F -T4" },
                { label: "Service Detect", flags: "-sV -T4 -p 1-10000" },
                { label: "OS Detect", flags: "-O -sV -T4" },
                { label: "Full Scan", flags: "-sV -O -T4 -p 1-65535" },
                { label: "UDP Top 100", flags: "-sU --top-ports 100" },
                { label: "Stealth SYN", flags: "-sS -T2 -p 1-10000" },
              ].map(({ label, flags }) => (
                <button key={label} onClick={() => setScanFlags(flags)}
                  className="px-2 py-1 border border-primary/20 text-primary/60 text-[10px] font-mono hover:border-primary/50 hover:text-primary transition-colors rounded">
                  {label}
                </button>
              ))}
            </div>
            <button onClick={runPortScan} disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 border border-primary/40 text-primary text-xs font-mono uppercase hover:bg-primary/10 hover:border-primary transition-colors disabled:opacity-40 rounded">
              {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              {scanning ? `Scanning ${ip}…` : `Run Port Scan — ${ip}`}
            </button>
            {scanCmd && (
              <div className="text-[10px] font-mono text-primary/30 bg-black border border-primary/10 px-2 py-1.5 rounded">$ {scanCmd}</div>
            )}
            {scanOutput && (
              <div className="bg-black border border-primary/15 p-3 text-[11px] font-mono text-primary/75 max-h-96 overflow-auto whitespace-pre-wrap rounded">{scanOutput}</div>
            )}
          </div>
        )}

        {/* SQLMAP */}
        {tab === "sqlmap" && (
          <div className="space-y-4">
            <div className="text-[10px] font-mono text-red-400/50 border border-red-500/15 rounded px-3 py-2 bg-red-500/5">
              Runs <span className="text-red-400">SQLmap</span> against <span className="text-red-400">{ip}</span>. Results can identify the attacker's database and help law enforcement.
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-primary/50 font-mono uppercase block mb-1">Target URL</label>
                <input value={sqlTarget} onChange={e => setSqlTarget(e.target.value)}
                  className="w-full bg-black border border-red-500/25 text-red-300 text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-red-500/60 rounded"
                  placeholder={`http://${ip}/`} />
              </div>
              <div>
                <label className="text-[10px] text-primary/50 font-mono uppercase block mb-1">SQLmap Flags</label>
                <input value={sqlFlags} onChange={e => setSqlFlags(e.target.value)}
                  className="w-full bg-black border border-red-500/25 text-red-300 text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-red-500/60 rounded"
                  placeholder="--dbs --forms --tables -D dbname" />
              </div>
            </div>
            <div>
              <div className="text-[10px] text-primary/40 font-mono uppercase mb-2">Quick Presets</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Enumerate DBs",  flags: "--dbs",                                       desc: "List all databases" },
                  { label: "Dump Tables",    flags: "--tables --dbs",                               desc: "List all tables" },
                  { label: "Blind SQLi",     flags: "--technique=B --level=3 --risk=2",             desc: "Boolean-based blind" },
                  { label: "Time-Based",     flags: "--technique=T --level=3",                      desc: "Time-delay blind" },
                  { label: "Error-Based",    flags: "--technique=E --dbs",                          desc: "Error extraction" },
                  { label: "Full Dump",      flags: "--level=5 --risk=3 --dbs --tables --dump-all", desc: "Maximum extraction" },
                  { label: "Get Users",      flags: "--users --passwords",                          desc: "Extract DB credentials" },
                  { label: "OS Shell",       flags: "--os-shell",                                   desc: "Attempt OS command shell" },
                ].map(({ label, flags, desc }) => (
                  <button key={label} onClick={() => setSqlFlags(flags)}
                    className="flex flex-col items-start px-2.5 py-2 border border-red-500/20 text-left hover:border-red-500/50 hover:bg-red-500/5 transition-colors rounded">
                    <span className="text-red-400/80 text-[10px] font-mono font-semibold">{label}</span>
                    <span className="text-primary/30 text-[9px] font-mono">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={runSqlmap} disabled={sqlRunning}
                className="flex items-center gap-2 px-4 py-2 border border-red-500/50 text-red-400 text-xs font-mono uppercase hover:bg-red-500/10 hover:border-red-500 transition-colors disabled:opacity-40 rounded">
                {sqlRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Syringe className="w-3.5 h-3.5" />}
                {sqlRunning ? `Running on ${ip}…` : `Launch SQLmap — ${ip}`}
              </button>
              <span className={`text-[10px] font-mono uppercase border px-1.5 py-0.5 rounded border-current ${statusColor[sqlStatus] ?? "text-primary/40"}`}>
                {sqlStatus}
              </span>
              {sqlJobId && <span className="text-[10px] text-primary/30 font-mono">JOB:{sqlJobId}</span>}
            </div>
            {sqlOutput && (
              <div className="bg-black border border-red-500/15 p-3 text-[11px] font-mono text-red-300/75 max-h-96 overflow-auto whitespace-pre-wrap rounded">{sqlOutput}</div>
            )}
            {sqlStatus === "running" && !sqlOutput && (
              <div className="flex items-center gap-2 text-yellow-400 text-xs font-mono border border-yellow-500/20 rounded px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                SQLmap scanning {ip} — polling every 4s…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BeaconAlerts() {
  const { data }        = useListBeaconAlerts(undefined, { query: { refetchInterval: 5000 } as any });
  const { data: nodesData } = useListNodes(undefined, { query: { refetchInterval: 30000 } as any });
  const queryClient     = useQueryClient();
  const { toast }       = useToast();
  const dismissAlert    = useDismissBeaconAlert();
  const triggerBeacon   = useTriggerBeacon();

  const [isTriggerOpen, setIsTriggerOpen] = useState(false);
  const [triggerForm, setTriggerForm]     = useState({ nodeId: "", probeType: "ping" });

  // Command panel state
  const [panelIp, setPanelIp]     = useState<string | null>(null);
  const [panelTab, setPanelTab]   = useState<PanelTab>("portscan");

  const openPanel = (ip: string, tab: PanelTab) => { setPanelIp(ip); setPanelTab(tab); };

  const blockIpMutation = useMutation({
    mutationFn: ({ ip, reason }: { ip: string; reason: string }) => blockIpApi(ip, reason),
    onSuccess: (_data, vars) => {
      toast({ title: "IP Blocked", description: `${vars.ip} added to firewall blacklist.` });
      queryClient.invalidateQueries({ queryKey: ["firewall-blocked-ips"] });
    },
    onError: (e: Error) => toast({ title: "Block failed", description: e.message, variant: "destructive" }),
  });

  const handleDismiss = (id: number) => {
    dismissAlert.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Alert Dismissed", description: `Alert ${id} dismissed.` });
        queryClient.invalidateQueries({ queryKey: getListBeaconAlertsQueryKey() });
      },
    });
  };

  const handleTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerForm.nodeId) return;
    triggerBeacon.mutate({ data: { nodeId: Number(triggerForm.nodeId), probeType: triggerForm.probeType as any } }, {
      onSuccess: () => {
        toast({ title: "Beacon Triggered", description: "Simulated probe executed." });
        setIsTriggerOpen(false);
        queryClient.invalidateQueries({ queryKey: getListBeaconAlertsQueryKey() });
      },
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "text-destructive border-destructive";
      case "high":     return "text-orange-500 border-orange-500";
      case "medium":   return "text-yellow-500 border-yellow-500";
      default:         return "text-primary border-primary/50";
    }
  };

  const alerts = (data?.alerts ?? []) as AlertRow[];

  function downloadCsv() {
    const rows = [["Time", "Node", "Attacker IP", "Probe Type", "Severity", "Status"]];
    alerts.forEach(a => rows.push([
      new Date(a.detectedAt).toISOString(),
      a.nodeName ?? "",
      a.attackerIp ?? "",
      a.probeType ?? "",
      a.severity ?? "",
      a.status ?? "",
    ]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `proxhqvpn-intrusion-alerts-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), alerts }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `proxhqvpn-intrusion-alerts-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
          <AlertOctagon className="w-6 h-6" />
          Intrusion Detection
        </h2>
        <div className="flex items-center gap-2">
          {alerts.length > 0 && (
            <>
              <Button variant="outline" onClick={downloadCsv} className="border-primary/30 text-primary/70 hover:bg-primary/10 text-xs">
                <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
              </Button>
              <Button variant="outline" onClick={downloadJson} className="border-primary/30 text-primary/70 hover:bg-primary/10 text-xs">
                <Download className="w-3.5 h-3.5 mr-1.5" /> JSON
              </Button>
            </>
          )}
          <Dialog open={isTriggerOpen} onOpenChange={setIsTriggerOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-primary text-primary hover:bg-primary/20">
                <Target className="w-4 h-4 mr-2" />
                SIMULATE PROBE
              </Button>
            </DialogTrigger>
          <DialogContent className="bg-black border border-primary/50 text-primary font-mono">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-widest text-primary/70">Trigger Beacon Test</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleTrigger} className="space-y-4 pt-4">
              <Select value={triggerForm.nodeId} onValueChange={v => setTriggerForm({ ...triggerForm, nodeId: v })}>
                <SelectTrigger className="border-primary/20 bg-black/50 text-primary">
                  <SelectValue placeholder="SELECT TARGET NODE" />
                </SelectTrigger>
                <SelectContent className="bg-black border-primary/50 text-primary">
                  {nodesData?.nodes?.map(n => (
                    <SelectItem key={n.id} value={n.id.toString()}>{n.name} ({n.ipAddress})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={triggerForm.probeType} onValueChange={v => setTriggerForm({ ...triggerForm, probeType: v })}>
                <SelectTrigger className="border-primary/20 bg-black/50 text-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black border-primary/50 text-primary">
                  <SelectItem value="ping">PING SWEEP</SelectItem>
                  <SelectItem value="port_scan">PORT SCAN</SelectItem>
                  <SelectItem value="tunnel_probe">TUNNEL PROBE</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={triggerBeacon.isPending} className="w-full bg-primary text-black hover:bg-primary/80">
                EXECUTE PROBE
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Main area: table + command panel */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden">

        {/* Alert table */}
        <div className={`flex flex-col min-h-0 overflow-hidden transition-all duration-300 ${panelIp ? "lg:w-[55%]" : "w-full"}`}>
          <div className="border border-primary/20 rounded bg-black overflow-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow className="border-primary/20 hover:bg-transparent">
                  <TableHead className="text-primary/70 text-xs">TIME</TableHead>
                  <TableHead className="text-primary/70 text-xs">NODE</TableHead>
                  <TableHead className="text-primary/70 text-xs">ATTACKER IP</TableHead>
                  <TableHead className="text-primary/70 text-xs">TYPE</TableHead>
                  <TableHead className="text-primary/70 text-xs">SEVERITY</TableHead>
                  <TableHead className="text-primary/70 text-xs">STATUS</TableHead>
                  <TableHead className="text-primary/70 text-xs">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow
                    key={alert.id}
                    className={`border-primary/20 hover:bg-primary/5 transition-colors ${panelIp === alert.attackerIp ? "bg-yellow-500/5 border-l-2 border-l-yellow-500" : ""}`}
                  >
                    <TableCell className="font-mono text-xs text-primary/70">
                      {format(new Date(alert.detectedAt), "HH:mm:ss.SSS")}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-primary/60">{alert.nodeName}</TableCell>

                    {/* Clickable IP with dropdown */}
                    <TableCell className="font-mono text-xs">
                      <IpActionDropdown
                        alert={alert}
                        onOpenPanel={openPanel}
                        onBlock={(ip) => blockIpMutation.mutate({ ip, reason: `Blocked from beacon: ${alert.probeType}` })}
                        blocking={blockIpMutation.isPending}
                      />
                    </TableCell>

                    <TableCell className="font-mono text-xs uppercase text-primary/80">{alert.probeType}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`uppercase text-xs ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-primary/30 text-primary/70 uppercase text-xs">
                        {alert.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {alert.status === "active" && (
                        <Button
                          size="sm" variant="outline"
                          className="border-primary/50 text-primary hover:bg-primary/20 h-6 px-2 text-xs"
                          onClick={() => handleDismiss(alert.id)}
                          disabled={dismissAlert.isPending}
                        >
                          <ShieldOff className="w-3 h-3 mr-1" />
                          DISMISS
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!alerts.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-primary/50 py-8 font-mono text-xs uppercase tracking-widest">
                      No active intrusions detected
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Slide-in command panel */}
        {panelIp && (
          <div className="lg:flex-1 border border-yellow-500/30 rounded bg-black flex flex-col min-h-0 overflow-hidden">
            <IpCommandPanel
              ip={panelIp}
              initialTab={panelTab}
              onClose={() => setPanelIp(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
