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
  CheckCircle2, ShieldAlert, ShieldCheck, EyeOff,
  ChevronRight, ListFilter, Plus, Trash2, Shield,
} from "lucide-react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...opts,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function blockIpApi(ip: string, reason: string) {
  return apiFetch("/firewall/blocked-ips", {
    method: "POST", body: JSON.stringify({ ip, reason }),
  });
}

interface WhitelistEntry {
  ip: string; reason: string; addedAt: string;
  probeTypes: string[]; addedBy: string;
}

type AlertRow = {
  id: number;
  attackerIp: string;
  attackerFingerprint: string;
  nodeName: string;
  probeType: string;
  severity: string;
  status: string;
  detectedAt: string;
  classification?: "audit" | "attack";
  whitelisted?: boolean;
  rawParsed?: Record<string, unknown>;
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
  const [statusFilter, setStatusFilter]   = useState<"all" | "active" | "dismissed">("all");
  const [expandedId, setExpandedId]       = useState<number | null>(null);
  const [showWhitelist, setShowWhitelist] = useState(false);
  const [wlIp, setWlIp]                   = useState("");
  const [wlReason, setWlReason]           = useState("");

  // Command panel state
  const [panelIp, setPanelIp]   = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>("portscan");
  const openPanel = (ip: string, tab: PanelTab) => { setPanelIp(ip); setPanelTab(tab); };

  // Whitelist query
  const { data: wlData, refetch: refetchWl } = useQuery<{ whitelist: WhitelistEntry[] }>({
    queryKey: ["beacon-whitelist"],
    queryFn: () => apiFetch("/beacons/whitelist"),
  });

  const invalidateAlerts = () => queryClient.invalidateQueries({ queryKey: getListBeaconAlertsQueryKey() });

  const blockIpMutation = useMutation({
    mutationFn: ({ ip, reason }: { ip: string; reason: string }) => blockIpApi(ip, reason),
    onSuccess: (_data, vars) => {
      toast({ title: "IP Blocked", description: `${vars.ip} added to firewall blacklist.` });
      queryClient.invalidateQueries({ queryKey: ["firewall-blocked-ips"] });
    },
    onError: (e: Error) => toast({ title: "Block failed", description: e.message, variant: "destructive" }),
  });

  const ignoreMutation = useMutation({
    mutationFn: ({ id, allProbeTypes }: { id: number; allProbeTypes: boolean }) =>
      apiFetch(`/beacons/${id}/ignore`, { method: "POST", body: JSON.stringify({ allProbeTypes }) }),
    onSuccess: (_d, vars) => {
      toast({ title: "Marked as False Positive", description: vars.allProbeTypes ? "This IP is now suppressed for all probe types." : "This IP+probe type suppressed." });
      invalidateAlerts(); refetchWl();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const allowMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiFetch(`/beacons/${id}/allow`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      toast({ title: "Trusted Source Added", description: "IP added to developer whitelist. Future probes from this source won't trigger alerts." });
      invalidateAlerts(); refetchWl();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addWlMutation = useMutation({
    mutationFn: () => apiFetch("/beacons/whitelist", { method: "POST", body: JSON.stringify({ ip: wlIp, reason: wlReason || "Manually whitelisted", probeTypes: ["*"] }) }),
    onSuccess: () => { toast({ title: "IP Whitelisted" }); setWlIp(""); setWlReason(""); refetchWl(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeWlMutation = useMutation({
    mutationFn: (ip: string) => apiFetch(`/beacons/whitelist/${encodeURIComponent(ip)}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Removed from whitelist" }); refetchWl(); invalidateAlerts(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleDismiss = (id: number) => {
    dismissAlert.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Alert Dismissed", description: `Alert ${id} dismissed.` });
        invalidateAlerts();
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
        invalidateAlerts();
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

  const allAlerts = (data?.alerts ?? []) as AlertRow[];
  const alerts = statusFilter === "all" ? allAlerts : allAlerts.filter(a => a.status === statusFilter);

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

  const wl = wlData?.whitelist ?? [];
  const activeCount  = allAlerts.filter(a => a.status === "active").length;
  const auditCount   = allAlerts.filter(a => a.classification === "audit").length;

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 flex-wrap gap-2">
        <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
          <AlertOctagon className="w-6 h-6" />
          Intrusion Detection
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status counts */}
          <div className="flex gap-2 text-[10px] font-mono">
            <span className="border border-red-500/40 text-red-400 px-2 py-1">{activeCount} ACTIVE</span>
            <span className="border border-primary/20 text-primary/50 px-2 py-1">{auditCount} AUDIT</span>
            <span className="border border-primary/20 text-primary/50 px-2 py-1">{wl.length} TRUSTED</span>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 border border-primary/20 text-[10px] font-mono">
            {(["all","active","dismissed"] as const).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`px-2 py-1 transition-colors uppercase ${statusFilter === f ? "bg-primary/20 text-primary" : "text-primary/40 hover:text-primary/70"}`}>
                {f}
              </button>
            ))}
          </div>

          {/* Trusted sources toggle */}
          <Button variant="outline" size="sm" onClick={() => setShowWhitelist(v => !v)}
            className={`border-primary/30 text-primary/70 hover:bg-primary/10 text-xs ${showWhitelist ? "bg-primary/10 border-primary/60" : ""}`}>
            <Shield className="w-3.5 h-3.5 mr-1.5" /> TRUSTED SOURCES
          </Button>

          {allAlerts.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={downloadCsv} className="border-primary/30 text-primary/70 hover:bg-primary/10 text-xs">
                <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={downloadJson} className="border-primary/30 text-primary/70 hover:bg-primary/10 text-xs">
                <Download className="w-3.5 h-3.5 mr-1.5" /> JSON
              </Button>
            </>
          )}
          <Dialog open={isTriggerOpen} onOpenChange={setIsTriggerOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/20 text-xs">
                <Target className="w-3.5 h-3.5 mr-1.5" /> SIMULATE PROBE
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

      {/* ── Trusted Sources Panel ────────────────────────────────────────── */}
      {showWhitelist && (
        <div className="border border-primary/30 bg-primary/5 p-4 space-y-3 shrink-0 font-mono">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-bold text-primary tracking-widest">TRUSTED SOURCES — DEVELOPER WHITELIST</span>
            </div>
            <span className="text-[9px] text-primary/40">{wl.length} entries</span>
          </div>
          <p className="text-[10px] text-primary/50 leading-relaxed">
            IPs in this list will have future beacon alerts auto-dismissed and classified as <span className="text-primary">AUDIT</span> traffic instead of attacks. Use this when your own tools, pen-test clients, or monitoring systems trigger false positives.
          </p>

          {/* Whitelist table */}
          {wl.length > 0 && (
            <div className="border border-primary/20">
              <div className="grid grid-cols-[120px_1fr_100px_80px_32px] gap-2 px-3 py-1.5 border-b border-primary/20 text-[9px] text-primary/40 tracking-widest">
                <div>IP ADDRESS</div><div>REASON</div><div>PROBE TYPES</div><div>ADDED</div><div />
              </div>
              {wl.map(e => (
                <div key={e.ip} className="grid grid-cols-[120px_1fr_100px_80px_32px] gap-2 px-3 py-2 border-b border-primary/10 last:border-0 items-center">
                  <code className="text-[10px] text-primary">{e.ip}</code>
                  <span className="text-[10px] text-primary/50 truncate">{e.reason}</span>
                  <span className="text-[9px] text-primary/40">{e.probeTypes.join(", ")}</span>
                  <span className="text-[9px] text-primary/30">{format(new Date(e.addedAt), "MM/dd HH:mm")}</span>
                  <button onClick={() => removeWlMutation.mutate(e.ip)} title="Remove from whitelist"
                    className="p-1 text-primary/20 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Manual add form */}
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <div className="text-[9px] text-primary/40 mb-1">IP ADDRESS</div>
              <input value={wlIp} onChange={e => setWlIp(e.target.value)} placeholder="192.168.1.100"
                className="bg-black border border-primary/20 text-primary text-[10px] px-2 py-1.5 outline-none focus:border-primary/60 font-mono w-40" />
            </div>
            <div className="flex-1 min-w-32">
              <div className="text-[9px] text-primary/40 mb-1">REASON (optional)</div>
              <input value={wlReason} onChange={e => setWlReason(e.target.value)} placeholder="Dev machine, pen-test client..."
                className="bg-black border border-primary/20 text-primary text-[10px] px-2 py-1.5 outline-none focus:border-primary/60 font-mono w-full" />
            </div>
            <button onClick={() => addWlMutation.mutate()} disabled={!wlIp || addWlMutation.isPending}
              className="flex items-center gap-1 text-[10px] px-3 py-1.5 border border-primary/40 text-primary/70 hover:text-primary hover:border-primary/70 transition-colors disabled:opacity-40">
              <Plus className="w-3 h-3" /> ADD IP
            </button>
          </div>
        </div>
      )}

      {/* Main area: table + command panel */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden">

        {/* Alert table */}
        <div className={`flex flex-col min-h-0 overflow-hidden transition-all duration-300 ${panelIp ? "lg:w-[52%]" : "w-full"}`}>
          <div className="border border-primary/20 rounded bg-black overflow-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow className="border-primary/20 hover:bg-transparent">
                  <TableHead className="text-primary/70 text-xs w-6" />
                  <TableHead className="text-primary/70 text-xs">TIME</TableHead>
                  <TableHead className="text-primary/70 text-xs">NODE</TableHead>
                  <TableHead className="text-primary/70 text-xs">SOURCE IP</TableHead>
                  <TableHead className="text-primary/70 text-xs">TYPE</TableHead>
                  <TableHead className="text-primary/70 text-xs">CLASS</TableHead>
                  <TableHead className="text-primary/70 text-xs">SEVERITY</TableHead>
                  <TableHead className="text-primary/70 text-xs">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => {
                  const isExpanded = expandedId === alert.id;
                  const isAudit = alert.classification === "audit";
                  const isWl = alert.whitelisted;
                  return (
                    <>
                      <TableRow
                        key={alert.id}
                        onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                        className={`border-primary/20 hover:bg-primary/5 transition-colors cursor-pointer
                          ${panelIp === alert.attackerIp ? "bg-yellow-500/5 border-l-2 border-l-yellow-500" : ""}
                          ${isAudit || isWl ? "opacity-60" : ""}
                          ${isExpanded ? "bg-primary/5" : ""}
                        `}
                      >
                        {/* Expand chevron */}
                        <TableCell className="w-6 px-2">
                          <ChevronRight className={`w-3 h-3 text-primary/30 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-primary/70">
                          {format(new Date(alert.detectedAt), "HH:mm:ss")}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-primary/60">{alert.nodeName}</TableCell>

                        {/* Clickable IP with dropdown */}
                        <TableCell className="font-mono text-xs" onClick={e => e.stopPropagation()}>
                          <IpActionDropdown
                            alert={alert}
                            onOpenPanel={openPanel}
                            onBlock={(ip) => blockIpMutation.mutate({ ip, reason: `Blocked from beacon: ${alert.probeType}` })}
                            blocking={blockIpMutation.isPending}
                          />
                        </TableCell>

                        <TableCell className="font-mono text-xs uppercase text-primary/80">{alert.probeType.replace("_"," ")}</TableCell>

                        {/* Classification badge */}
                        <TableCell onClick={e => e.stopPropagation()}>
                          {isWl || isAudit ? (
                            <Badge variant="outline" className="border-primary/40 text-primary/70 uppercase text-[9px] gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> AUDIT
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-red-500/50 text-red-400 uppercase text-[9px] gap-1">
                              <ShieldAlert className="w-2.5 h-2.5" /> ATTACK
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className={`uppercase text-xs ${getSeverityColor(alert.severity)}`}>
                            {alert.severity}
                          </Badge>
                        </TableCell>

                        {/* Action buttons */}
                        <TableCell onClick={e => e.stopPropagation()}>
                          {alert.status === "active" ? (
                            <div className="flex items-center gap-1">
                              {/* Dismiss */}
                              <button onClick={() => handleDismiss(alert.id)} disabled={dismissAlert.isPending}
                                title="Dismiss — one-time, still alerts next time from this IP"
                                className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 border border-primary/30 text-primary/60 hover:text-primary hover:border-primary/60 transition-colors disabled:opacity-40">
                                <ShieldOff className="w-3 h-3" /> DISMISS
                              </button>
                              {/* Ignore / False Positive */}
                              <button
                                onClick={() => ignoreMutation.mutate({ id: alert.id, allProbeTypes: false })}
                                disabled={ignoreMutation.isPending}
                                title="False positive — suppress future alerts from this IP for this probe type"
                                className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 border border-yellow-500/30 text-yellow-500/60 hover:text-yellow-400 hover:border-yellow-500/60 transition-colors disabled:opacity-40">
                                <EyeOff className="w-3 h-3" /> IGNORE
                              </button>
                              {/* Allow / Trust */}
                              <button
                                onClick={() => allowMutation.mutate({ id: alert.id, reason: "Developer / audit source" })}
                                disabled={allowMutation.isPending}
                                title="Trusted source — add to whitelist, future probes auto-dismissed"
                                className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 border border-primary/40 text-primary/60 hover:text-primary hover:border-primary/60 transition-colors disabled:opacity-40">
                                <ShieldCheck className="w-3 h-3" /> ALLOW
                              </button>
                              {/* Block */}
                              <button
                                onClick={() => blockIpMutation.mutate({ ip: alert.attackerIp, reason: `Blocked from beacon: ${alert.probeType}` })}
                                disabled={blockIpMutation.isPending}
                                title="Block — add to firewall blacklist immediately"
                                className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 border border-red-500/40 text-red-500/60 hover:text-red-400 hover:border-red-500/60 transition-colors disabled:opacity-40">
                                <Ban className="w-3 h-3" /> BLOCK
                              </button>
                            </div>
                          ) : (
                            <span className="text-[9px] font-mono text-primary/30 uppercase">{alert.status}</span>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* ── Expanded detail row ─────────────────────────────── */}
                      {isExpanded && (
                        <TableRow key={`${alert.id}-detail`} className="border-primary/10 bg-primary/3 hover:bg-primary/5">
                          <TableCell colSpan={8} className="px-4 py-3 font-mono">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px]">

                              {/* Left: fingerprint + classification */}
                              <div className="space-y-2">
                                <div className="text-[9px] text-primary/40 tracking-widest">FINGERPRINT</div>
                                <div className="bg-black border border-primary/10 p-2 text-primary/70 break-all leading-relaxed">
                                  {alert.attackerFingerprint || "—"}
                                </div>
                                <div className="flex gap-3">
                                  <div>
                                    <span className="text-primary/30">Classification: </span>
                                    <span className={isAudit || isWl ? "text-primary" : "text-red-400"}>
                                      {isWl ? "WHITELISTED" : isAudit ? "AUDIT" : "ATTACK"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-primary/30">Status: </span>
                                    <span className="text-primary/60 uppercase">{alert.status}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Right: raw data + quick actions */}
                              <div className="space-y-2">
                                <div className="text-[9px] text-primary/40 tracking-widest">RAW DATA</div>
                                <div className="bg-black border border-primary/10 p-2 text-primary/50 max-h-24 overflow-auto">
                                  {alert.rawParsed ? (
                                    Object.entries(alert.rawParsed).map(([k, v]) => (
                                      <div key={k}><span className="text-primary/30">{k}:</span> {String(v)}</div>
                                    ))
                                  ) : "—"}
                                </div>

                                {/* Quick-action strip in detail row */}
                                {alert.status === "active" && (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    <button onClick={() => ignoreMutation.mutate({ id: alert.id, allProbeTypes: true })}
                                      disabled={ignoreMutation.isPending}
                                      className="text-[9px] px-2 py-1 border border-yellow-500/30 text-yellow-400/70 hover:text-yellow-400 hover:border-yellow-500/60 transition-colors">
                                      IGNORE ALL PROBES FROM THIS IP
                                    </button>
                                    <button onClick={() => allowMutation.mutate({ id: alert.id, reason: "Manually allowed from alert detail" })}
                                      disabled={allowMutation.isPending}
                                      className="text-[9px] px-2 py-1 border border-primary/30 text-primary/60 hover:text-primary hover:border-primary/60 transition-colors">
                                      WHITELIST THIS IP (ALL PROBES)
                                    </button>
                                    <button onClick={() => { openPanel(alert.attackerIp, "portscan"); }}
                                      className="text-[9px] px-2 py-1 border border-primary/20 text-primary/40 hover:text-primary/70 hover:border-primary/40 transition-colors">
                                      INVESTIGATE IP
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
                {!alerts.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-primary/50 py-8 font-mono text-xs uppercase tracking-widest">
                      {statusFilter === "all" ? "No intrusions detected" : `No ${statusFilter} alerts`}
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
