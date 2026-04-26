import { useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wifi, WifiOff, AlertTriangle, CheckCircle2, Plus, Trash2,
  RefreshCw, Download, Layers, Cpu, ChevronDown, ChevronRight,
  Route, Shield, Zap, Lock, Unlock, ArrowUpFromLine, ArrowDownToLine,
  Wrench, Settings2, Copy, FileCode2, Terminal
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ── types ─────────────────────────────────────────────────────────────────
interface VpnProfile {
  id: string; name: string; processes: string[]; interfaces: string[];
  defaultPort: number; protocol: string; dnsServers: string[];
  serverCidrs: string[]; killSwitchIface: string; notes: string;
  coexistMethod: string;
}
interface ExceptionRule {
  id: string; cidr: string; description: string;
  action: "bypass-proxhq" | "force-proxhq" | "block"; source: string; addedAt: string;
}
interface DetectedVpn extends VpnProfile {
  active: boolean; detectedIface: string | null; pid: number | null;
}
interface ToolExceptionRule {
  id: string; tool: string; toolLabel: string;
  outboundBypass: boolean; inboundBypass: boolean;
  ports: string; protocols: string[]; cidr: string;
  enabled: boolean; note: string; addedAt: string;
}
interface GeneratedRules {
  iptables: string; nftables: string; wireguardKillSwitchException: string;
  pfRules: string; auditFwmark: string;
  enabledRules: number; outboundRules: number; inboundRules: number;
  generatedAt: string;
}

const MODE_LABELS: Record<string, { label: string; description: string; badge: string }> = {
  fwmark:        { label: "fwmark Routing",    description: "Packet marking routes ProxhqVPN traffic through its own table. Native VPN handles everything else. Zero conflicts.", badge: "RECOMMENDED" },
  "double-hop":  { label: "Double-Hop",        description: "Traffic flows Device → ProxhqVPN → Native VPN → Internet. Maximum anonymity. Neither provider sees plaintext traffic.", badge: "MAX PRIVACY" },
  namespace:     { label: "Namespace Isolation",description: "ProxhqVPN runs in its own Linux network namespace. Completely isolated — no routing conflicts possible.", badge: "ADVANCED" },
  "routing-table": { label: "Routing Table",   description: "Separate routing tables by interface metric. Simpler than fwmark — works on Windows and macOS without extra tools.", badge: "COMPATIBLE" },
};

const ACTION_COLORS: Record<string, string> = {
  "bypass-proxhq": "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
  "force-proxhq":  "text-primary border-primary/30 bg-primary/5",
  "block":           "text-red-400 border-red-400/30 bg-red-400/5",
};

export default function VpnCoexist() {
  const qc = useQueryClient();

  const [selectedProfile, setSelectedProfile] = useState("wireguard-generic");
  const [selectedMode, setSelectedMode] = useState("fwmark");
  const [targetOs, setTargetOs] = usePersistedState<"linux" | "macos" | "windows">("vpncoexist-os", "linux");
  const [detectedIface, setDetectedIface] = useState("tun0");
  const [proxhqIface, setProxhqIface] = useState("proxhq0");
  const [fwmark, setFwmark] = useState(100);
  const [generatedScript, setGeneratedScript] = useState("");
  const [disableScript, setDisableScript] = useState("");
  const [scriptNotes, setScriptNotes] = useState<string[]>([]);
  const [showScript, setShowScript] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [activeTab, setActiveTab] = usePersistedState<"overview" | "exceptions" | "mtu" | "scripts" | "security-tools">("vpncoexist-tab", "overview");

  // exception form
  const [newCidr, setNewCidr] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAction, setNewAction] = useState<"bypass-proxhq" | "force-proxhq" | "block">("bypass-proxhq");

  // security tools tab state
  const [generatedRules, setGeneratedRules] = useState<GeneratedRules | null>(null);
  const [rulesView, setRulesView] = useState<"iptables" | "nftables" | "wireguard" | "pf">("iptables");
  const [showRules, setShowRules] = useState(false);
  const [newToolForm, setNewToolForm] = useState(false);
  const [ntTool, setNtTool] = useState(""); const [ntLabel, setNtLabel] = useState("");
  const [ntPorts, setNtPorts] = useState("*"); const [ntCidr, setNtCidr] = useState("*");
  const [ntProtocols, setNtProtocols] = useState("tcp");
  const [ntOutbound, setNtOutbound] = useState(true); const [ntInbound, setNtInbound] = useState(true);
  const [ntNote, setNtNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPorts, setEditPorts] = useState(""); const [editCidr, setEditCidr] = useState("");

  // mtu calc
  const [baseMtu, setBaseMtu] = useState(1500);
  const [hopCount, setHopCount] = useState(1);
  const [mtuProtocol, setMtuProtocol] = useState<"wireguard" | "openvpn" | "custom">("wireguard");
  const [mtuResult, setMtuResult] = useState<any>(null);

  const { data: profiles } = useQuery<{ profiles: VpnProfile[] }>({
    queryKey: ["vpn-coexist-profiles"],
    queryFn: () => apiFetch("/vpn-coexist/profiles"),
  });

  const { data: detect, refetch: reDetect, isFetching: detecting } = useQuery<{
    platform: string; platformLabel: string;
    detectedVpns: DetectedVpn[]; detectedCount: number; note: string;
    recommendedGhostnetIface: string;
  }>({
    queryKey: ["vpn-coexist-detect"],
    queryFn: () => apiFetch("/vpn-coexist/detect"),
  });

  const { data: excData, refetch: refetchExc } = useQuery<{ exceptions: ExceptionRule[] }>({
    queryKey: ["vpn-coexist-exceptions"],
    queryFn: () => apiFetch("/vpn-coexist/exceptions"),
  });

  const { data: status } = useQuery({
    queryKey: ["vpn-coexist-status"],
    queryFn: () => apiFetch("/vpn-coexist/status"),
    refetchInterval: 10000,
  });

  const { data: toolExcData, refetch: refetchToolExc } = useQuery<{ rules: ToolExceptionRule[] }>({
    queryKey: ["vpn-coexist-tool-exceptions"],
    queryFn: () => apiFetch("/vpn-coexist/security-tool-exceptions"),
  });

  const toggleTool = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: string; value: boolean }) =>
      apiFetch(`/vpn-coexist/security-tool-exceptions/${id}`, {
        method: "PUT",
        body: JSON.stringify({ [field]: value }),
      }),
    onSuccess: () => refetchToolExc(),
  });

  const updateToolRule = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiFetch(`/vpn-coexist/security-tool-exceptions/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => { refetchToolExc(); setEditingId(null); },
  });

  const deleteToolRule = useMutation({
    mutationFn: (id: string) => apiFetch(`/vpn-coexist/security-tool-exceptions/${id}`, { method: "DELETE" }),
    onSuccess: () => refetchToolExc(),
  });

  const addToolRule = useMutation({
    mutationFn: () => apiFetch("/vpn-coexist/security-tool-exceptions", {
      method: "POST",
      body: JSON.stringify({
        tool: ntTool, toolLabel: ntLabel, ports: ntPorts, cidr: ntCidr,
        protocols: ntProtocols.split(",").map(p => p.trim()),
        outboundBypass: ntOutbound, inboundBypass: ntInbound, note: ntNote,
      }),
    }),
    onSuccess: () => {
      setNtTool(""); setNtLabel(""); setNtPorts("*"); setNtCidr("*");
      setNtProtocols("tcp"); setNtOutbound(true); setNtInbound(true); setNtNote("");
      setNewToolForm(false); refetchToolExc();
    },
  });

  const generateToolRules = useMutation({
    mutationFn: () => apiFetch("/vpn-coexist/security-tool-exceptions/generate-rules", {
      method: "POST",
      body: JSON.stringify({ proxhqIface: proxhqIface, fwmark: 0x5050 }),
    }),
    onSuccess: (d) => { setGeneratedRules(d); setShowRules(true); },
  });

  const addException = useMutation({
    mutationFn: () => apiFetch("/vpn-coexist/exceptions", {
      method: "POST",
      body: JSON.stringify({ cidr: newCidr, description: newDesc, action: newAction }),
    }),
    onSuccess: () => { setNewCidr(""); setNewDesc(""); refetchExc(); },
  });

  const delException = useMutation({
    mutationFn: (id: string) => apiFetch(`/vpn-coexist/exceptions/${id}`, { method: "DELETE" }),
    onSuccess: () => refetchExc(),
  });

  const generateRules = useMutation({
    mutationFn: () => apiFetch("/vpn-coexist/generate-rules", {
      method: "POST",
      body: JSON.stringify({
        vpnProfileId: selectedProfile, mode: selectedMode,
        detectedIface, proxhqIface, proxhqFwmark: fwmark, targetOs,
      }),
    }),
    onSuccess: (d) => {
      setGeneratedScript(d.enableScript);
      setDisableScript(d.disableScript);
      setScriptNotes(d.notes);
      setShowScript(true);
      setActiveTab("scripts");
    },
  });

  const calcMtu = useMutation({
    mutationFn: () => apiFetch("/vpn-coexist/mtu-optimize", {
      method: "POST",
      body: JSON.stringify({ baseMtu, hopCount, protocol: mtuProtocol }),
    }),
    onSuccess: setMtuResult,
  });

  const selectedProfileData = profiles?.profiles.find(p => p.id === selectedProfile);

  const downloadScript = (content: string, name: string) => {
    const ext = targetOs === "windows" ? ".bat" : ".sh";
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name + ext; a.click();
  };

  const tabs = [
    { id: "overview",       label: "OVERVIEW" },
    { id: "exceptions",     label: "EXCEPTION RULES" },
    { id: "security-tools", label: "SECURITY TOOLS" },
    { id: "mtu",            label: "MTU OPTIMIZER" },
    { id: "scripts",        label: "SCRIPTS" },
  ];

  return (
    <div className="space-y-4 font-mono">
      {/* Header */}
      <div className="border border-primary/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-lg font-bold tracking-wider text-primary">VPN COEXISTENCE</h1>
              <p className="text-xs text-primary/50 mt-0.5">
                Run ProxhqVPN alongside NordVPN, ExpressVPN, ProtonVPN, Mullvad, and others
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className={`flex items-center gap-1.5 px-2 py-1 border ${
              status?.coexistRulesActive
                ? "border-primary/40 text-primary bg-primary/5"
                : "border-primary/20 text-primary/40"
            }`}>
              <div className={`w-2 h-2 rounded-full ${status?.coexistRulesActive ? "bg-primary animate-pulse" : "bg-primary/30"}`} />
              {status?.coexistRulesActive ? "COEXIST ACTIVE" : "COEXIST INACTIVE"}
            </div>
            <div className="px-2 py-1 border border-primary/20 text-primary/50">
              {detect?.platformLabel ?? "DETECTING..."}
            </div>
          </div>
        </div>
      </div>

      {/* Detection Banner */}
      <div className="border border-primary/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-primary/50 tracking-widest">ACTIVE VPN DETECTION</span>
          <button
            onClick={() => reDetect()}
            className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/40 px-2 py-0.5 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${detecting ? "animate-spin" : ""}`} />
            SCAN
          </button>
        </div>
        {detect?.detectedVpns && detect.detectedVpns.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {detect.detectedVpns.map(vpn => (
              <div key={vpn.id} className="border border-primary/30 bg-primary/5 p-2">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-primary">{vpn.name}</span>
                  <span className="text-[9px] text-primary/50 border border-primary/20 px-1">RUNNING</span>
                </div>
                <div className="text-[10px] text-primary/60 space-y-0.5">
                  <div>Interface: <span className="text-primary">{vpn.detectedIface ?? "unknown"}</span></div>
                  <div>PID: <span className="text-primary">{vpn.pid ?? "unknown"}</span></div>
                  <div>Method: <span className="text-primary uppercase">{vpn.coexistMethod}</span></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-primary/50">
            <WifiOff className="w-3.5 h-3.5" />
            {detect?.note ?? "Scanning for active VPN processes..."}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-primary/20">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 text-[10px] font-bold tracking-wider border-b-2 transition-colors ${
              activeTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-primary/40 hover:text-primary/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: OVERVIEW ────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Mode selector */}
          <div className="border border-primary/20 p-4">
            <div className="text-[10px] text-primary/50 tracking-widest mb-3">COEXISTENCE MODE</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(MODE_LABELS).map(([modeId, meta]) => (
                <button
                  key={modeId}
                  onClick={() => setSelectedMode(modeId)}
                  className={`text-left p-3 border transition-colors ${
                    selectedMode === modeId
                      ? "border-primary bg-primary/10"
                      : "border-primary/20 hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-primary">{meta.label}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 border ${
                      selectedMode === modeId ? "border-primary text-primary" : "border-primary/30 text-primary/40"
                    }`}>{meta.badge}</span>
                  </div>
                  <p className="text-[10px] text-primary/50 leading-relaxed">{meta.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* VPN Profile selector */}
          <div className="border border-primary/20 p-4">
            <div className="text-[10px] text-primary/50 tracking-widest mb-3">SELECT YOUR COMMERCIAL VPN</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
              {profiles?.profiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProfile(p.id);
                    if (p.interfaces[0]) setDetectedIface(p.interfaces[0]);
                  }}
                  className={`p-2 border text-left transition-colors ${
                    selectedProfile === p.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-primary/20 text-primary/50 hover:border-primary/40 hover:text-primary/80"
                  }`}
                >
                  <div className="text-[10px] font-bold">{p.name}</div>
                  <div className="text-[9px] text-primary/40 mt-0.5">{p.protocol}</div>
                </button>
              ))}
            </div>
            {selectedProfileData && (
              <div className="border border-primary/10 bg-primary/3 p-3 space-y-2">
                <div className="text-[10px] text-primary/50 tracking-widest">PROFILE: {selectedProfileData.name.toUpperCase()}</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-[10px]">
                  <div><span className="text-primary/40">Protocol:</span> <span className="text-primary">{selectedProfileData.protocol}</span></div>
                  <div><span className="text-primary/40">Default Port:</span> <span className="text-primary">{selectedProfileData.defaultPort}</span></div>
                  <div><span className="text-primary/40">Coexist Method:</span> <span className="text-primary uppercase">{selectedProfileData.coexistMethod}</span></div>
                  <div><span className="text-primary/40">Interfaces:</span> <span className="text-primary">{selectedProfileData.interfaces.slice(0,3).join(", ")}</span></div>
                  <div><span className="text-primary/40">Kill Switch Iface:</span> <span className="text-primary">{selectedProfileData.killSwitchIface}</span></div>
                  <div><span className="text-primary/40">DNS:</span> <span className="text-primary">{selectedProfileData.dnsServers[0] ?? "auto"}</span></div>
                </div>
                <div className="border-t border-primary/10 pt-2 text-[10px] text-primary/50">
                  <AlertTriangle className="w-3 h-3 inline mr-1 text-yellow-400" />
                  {selectedProfileData.notes}
                </div>
              </div>
            )}
          </div>

          {/* Interface config */}
          <div className="border border-primary/20 p-4">
            <div className="text-[10px] text-primary/50 tracking-widest mb-3">INTERFACE CONFIGURATION</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[9px] text-primary/40 block mb-1">NATIVE VPN INTERFACE</label>
                <input
                  value={detectedIface}
                  onChange={e => setDetectedIface(e.target.value)}
                  className="w-full bg-black border border-primary/30 text-primary text-xs px-2 py-1.5 font-mono focus:outline-none focus:border-primary"
                  placeholder="tun0"
                />
              </div>
              <div>
                <label className="text-[9px] text-primary/40 block mb-1">ProxhqVPN INTERFACE</label>
                <input
                  value={proxhqIface}
                  onChange={e => setProxhqIface(e.target.value)}
                  className="w-full bg-black border border-primary/30 text-primary text-xs px-2 py-1.5 font-mono focus:outline-none focus:border-primary"
                  placeholder="proxhq0"
                />
              </div>
              <div>
                <label className="text-[9px] text-primary/40 block mb-1">FWMARK VALUE</label>
                <input
                  type="number"
                  value={fwmark}
                  onChange={e => setFwmark(parseInt(e.target.value) || 100)}
                  min={1} max={255}
                  className="w-full bg-black border border-primary/30 text-primary text-xs px-2 py-1.5 font-mono focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[9px] text-primary/40 block mb-1">TARGET OS</label>
                <select
                  value={targetOs}
                  onChange={e => setTargetOs(e.target.value as any)}
                  className="w-full bg-black border border-primary/30 text-primary text-xs px-2 py-1.5 font-mono focus:outline-none focus:border-primary"
                >
                  <option value="linux">Linux</option>
                  <option value="macos">macOS</option>
                  <option value="windows">Windows</option>
                </select>
              </div>
            </div>
            <button
              onClick={() => generateRules.mutate()}
              disabled={generateRules.isPending}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary text-primary text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              {generateRules.isPending ? "GENERATING..." : "GENERATE COEXISTENCE SCRIPTS"}
            </button>
          </div>

          {/* How it works */}
          <div className="border border-primary/20 p-4">
            <div className="text-[10px] text-primary/50 tracking-widest mb-3">HOW VPN COEXISTENCE WORKS</div>
            <div className="space-y-3 text-[11px] text-primary/60 leading-relaxed">
              <p>
                When two VPNs run simultaneously, they both try to capture all system traffic — causing
                routing conflicts, DNS leaks, or one VPN overriding the other's routes.
                ProxhqVPN avoids this with <span className="text-primary">policy-based routing</span>.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-primary/10 p-3">
                  <div className="text-primary text-[10px] font-bold mb-1">fwmark METHOD (Linux)</div>
                  <p className="text-[10px] text-primary/50">
                    Each packet that should go through ProxhqVPN is marked with an fwmark value.
                    A separate routing table handles only marked packets. The native VPN
                    continues to handle all unmarked traffic via the main table. No conflicts.
                  </p>
                </div>
                <div className="border border-primary/10 p-3">
                  <div className="text-primary text-[10px] font-bold mb-1">DOUBLE-HOP METHOD</div>
                  <p className="text-[10px] text-primary/50">
                    ProxhqVPN tunnel is established first. Its packets exit through the native
                    VPN as outer tunnel. Your ISP sees only native VPN traffic. The native VPN
                    provider sees only encrypted ProxhqVPN packets. Neither sees your data.
                  </p>
                </div>
                <div className="border border-primary/10 p-3">
                  <div className="text-primary text-[10px] font-bold mb-1">NAMESPACE METHOD (Linux)</div>
                  <p className="text-[10px] text-primary/50">
                    ProxhqVPN runs in a dedicated Linux network namespace — a completely
                    isolated networking stack. The native VPN owns the main namespace.
                    Completely impossible for either VPN to affect the other's routing.
                  </p>
                </div>
                <div className="border border-primary/10 p-3">
                  <div className="text-primary text-[10px] font-bold mb-1">ROUTING TABLE (Windows/macOS)</div>
                  <p className="text-[10px] text-primary/50">
                    Interface metrics and static routes direct specific traffic (ProxhqVPN
                    mesh CIDRs) through ProxhqVPN's interface, while the native VPN retains
                    default route ownership. MTU is adjusted to prevent fragmentation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: EXCEPTION RULES ──────────────────────────────────────── */}
      {activeTab === "exceptions" && (
        <div className="space-y-4">
          <div className="border border-primary/20 p-4">
            <div className="text-[10px] text-primary/50 tracking-widest mb-3">EXCEPTION RULES</div>
            <p className="text-[11px] text-primary/50 mb-4">
              Exception rules define which IP ranges bypass ProxhqVPN, are forced through ProxhqVPN,
              or are blocked entirely. These rules are automatically included in generated coexistence scripts.
            </p>

            {/* Add rule form */}
            <div className="border border-primary/20 p-3 mb-4">
              <div className="text-[9px] text-primary/40 mb-2 tracking-widest">ADD EXCEPTION RULE</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <input
                  value={newCidr}
                  onChange={e => setNewCidr(e.target.value)}
                  placeholder="IP or CIDR (e.g. 185.220.0.0/16)"
                  className="bg-black border border-primary/30 text-primary text-xs px-2 py-1.5 font-mono focus:outline-none focus:border-primary"
                />
                <input
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Description"
                  className="bg-black border border-primary/30 text-primary text-xs px-2 py-1.5 font-mono focus:outline-none focus:border-primary"
                />
                <select
                  value={newAction}
                  onChange={e => setNewAction(e.target.value as any)}
                  className="bg-black border border-primary/30 text-primary text-xs px-2 py-1.5 font-mono focus:outline-none focus:border-primary"
                >
                  <option value="bypass-proxhq">Bypass ProxhqVPN → Native VPN</option>
                  <option value="force-proxhq">Force through ProxhqVPN</option>
                  <option value="block">Block entirely</option>
                </select>
                <button
                  onClick={() => addException.mutate()}
                  disabled={!newCidr || addException.isPending}
                  className="flex items-center justify-center gap-1.5 bg-primary/10 border border-primary text-primary text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  ADD
                </button>
              </div>
            </div>

            {/* Rules table */}
            <div className="border border-primary/20">
              <div className="grid grid-cols-12 gap-2 p-2 border-b border-primary/20 text-[9px] text-primary/40 tracking-widest">
                <div className="col-span-3">CIDR / IP</div>
                <div className="col-span-3">DESCRIPTION</div>
                <div className="col-span-2">ACTION</div>
                <div className="col-span-2">SOURCE</div>
                <div className="col-span-1">ADDED</div>
                <div className="col-span-1"></div>
              </div>
              {excData?.exceptions.length === 0 && (
                <div className="p-4 text-center text-xs text-primary/30">No exception rules defined</div>
              )}
              {excData?.exceptions.map(rule => (
                <div key={rule.id} className="grid grid-cols-12 gap-2 p-2 border-b border-primary/10 hover:bg-primary/3 items-center">
                  <div className="col-span-3 text-xs text-primary font-mono">{rule.cidr}</div>
                  <div className="col-span-3 text-[10px] text-primary/60">{rule.description || "—"}</div>
                  <div className="col-span-2">
                    <span className={`text-[9px] px-1.5 py-0.5 border font-bold tracking-wider ${ACTION_COLORS[rule.action]}`}>
                      {rule.action === "bypass-proxhq" ? "BYPASS" : rule.action === "force-proxhq" ? "FORCE" : "BLOCK"}
                    </span>
                  </div>
                  <div className="col-span-2 text-[10px] text-primary/40 uppercase">{rule.source}</div>
                  <div className="col-span-1 text-[9px] text-primary/30">
                    {new Date(rule.addedAt).toLocaleDateString()}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {rule.source === "manual" && (
                      <button
                        onClick={() => delException.mutate(rule.id)}
                        className="text-red-400/60 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick-add from VPN profiles */}
          <div className="border border-primary/20 p-4">
            <div className="text-[10px] text-primary/50 tracking-widest mb-3">QUICK-ADD: VPN SERVER RANGES</div>
            <p className="text-[11px] text-primary/50 mb-3">
              Add known server IP ranges for a commercial VPN as bypass exceptions. This prevents
              ProxhqVPN from intercepting traffic to those VPN endpoints.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {profiles?.profiles.filter(p => p.serverCidrs.length > 0).map(p => (
                <div key={p.id} className="border border-primary/20 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-primary">{p.name}</span>
                    <button
                      onClick={async () => {
                        for (const cidr of p.serverCidrs) {
                          await apiFetch("/vpn-coexist/exceptions", {
                            method: "POST",
                            body: JSON.stringify({
                              cidr, description: `${p.name} server range`, action: "bypass-proxhq",
                            }),
                          });
                        }
                        refetchExc();
                      }}
                      className="text-[9px] px-2 py-0.5 border border-primary/30 text-primary/60 hover:text-primary hover:border-primary/60 transition-colors"
                    >
                      ADD ALL
                    </button>
                  </div>
                  <div className="text-[10px] text-primary/40">
                    {p.serverCidrs.join(", ")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: SECURITY TOOLS ──────────────────────────────────────── */}
      {activeTab === "security-tools" && (
        <div className="space-y-4">

          {/* Classification banner */}
          <div className="border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-primary tracking-widest">AUDIT VS. ATTACK CLASSIFICATION</div>
                <p className="text-[10px] text-primary/60 leading-relaxed">
                  All ProxhqVPN security tool traffic is tagged with a session header (<code className="text-primary bg-primary/10 px-1">X-Proxhq-Audit-Session: userId:sessionId</code>) and marked with fwmark <code className="text-primary bg-primary/10 px-1">0x5050</code> at the API layer.
                  The firewall and IDS engine check this tag — authenticated tool traffic is classified as <span className="text-primary font-bold">AUDIT</span> (logged, not blocked), while traffic without a valid tag is classified as an <span className="text-red-400 font-bold">ATTACK</span> and triggers full alerting.
                </p>
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-[9px] text-primary/70 border border-primary/20 px-2 py-1">
                    <CheckCircle2 className="w-3 h-3 text-primary" /> AUDIT — log only, no block
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] text-red-400/80 border border-red-400/20 px-2 py-1">
                    <AlertTriangle className="w-3 h-3 text-red-400" /> ATTACK — block + alert + honeypot
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-primary/50 tracking-widest">
              TOOL FIREWALL EXCEPTIONS — {toolExcData?.rules.length ?? 0} RULES
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setNewToolForm(!newToolForm)}
                className="flex items-center gap-1 text-[10px] px-3 py-1.5 border border-primary/40 text-primary/70 hover:text-primary hover:border-primary/70 transition-colors"
              >
                <Plus className="w-3 h-3" /> ADD CUSTOM
              </button>
              <button
                onClick={() => generateToolRules.mutate()}
                disabled={generateToolRules.isPending}
                className="flex items-center gap-1 text-[10px] px-3 py-1.5 border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                <FileCode2 className="w-3 h-3" />
                {generateToolRules.isPending ? "GENERATING..." : "GENERATE RULES"}
              </button>
            </div>
          </div>

          {/* Add custom rule form */}
          {newToolForm && (
            <div className="border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="text-[9px] text-primary/50 tracking-widest mb-1">NEW CUSTOM TOOL EXCEPTION</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[9px] text-primary/40 mb-1">TOOL ID (slug)</div>
                  <input value={ntTool} onChange={e => setNtTool(e.target.value)} placeholder="my-custom-tool"
                    className="w-full bg-black border border-primary/20 text-primary text-[10px] px-2 py-1.5 outline-none focus:border-primary/60 font-mono" />
                </div>
                <div>
                  <div className="text-[9px] text-primary/40 mb-1">DISPLAY NAME</div>
                  <input value={ntLabel} onChange={e => setNtLabel(e.target.value)} placeholder="My Custom Tool"
                    className="w-full bg-black border border-primary/20 text-primary text-[10px] px-2 py-1.5 outline-none focus:border-primary/60 font-mono" />
                </div>
                <div>
                  <div className="text-[9px] text-primary/40 mb-1">PORTS (comma-sep or *)</div>
                  <input value={ntPorts} onChange={e => setNtPorts(e.target.value)} placeholder="80,443,8080 or *"
                    className="w-full bg-black border border-primary/20 text-primary text-[10px] px-2 py-1.5 outline-none focus:border-primary/60 font-mono" />
                </div>
                <div>
                  <div className="text-[9px] text-primary/40 mb-1">TARGET CIDR (or *)</div>
                  <input value={ntCidr} onChange={e => setNtCidr(e.target.value)} placeholder="10.0.0.0/8 or *"
                    className="w-full bg-black border border-primary/20 text-primary text-[10px] px-2 py-1.5 outline-none focus:border-primary/60 font-mono" />
                </div>
                <div>
                  <div className="text-[9px] text-primary/40 mb-1">PROTOCOLS (comma-sep)</div>
                  <input value={ntProtocols} onChange={e => setNtProtocols(e.target.value)} placeholder="tcp,udp"
                    className="w-full bg-black border border-primary/20 text-primary text-[10px] px-2 py-1.5 outline-none focus:border-primary/60 font-mono" />
                </div>
                <div>
                  <div className="text-[9px] text-primary/40 mb-1">NOTE</div>
                  <input value={ntNote} onChange={e => setNtNote(e.target.value)} placeholder="Optional description"
                    className="w-full bg-black border border-primary/20 text-primary text-[10px] px-2 py-1.5 outline-none focus:border-primary/60 font-mono" />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <button type="button"
                    onClick={() => setNtOutbound(!ntOutbound)}
                    className={`w-8 h-4 border transition-colors relative ${ntOutbound ? "border-primary bg-primary/20" : "border-primary/20 bg-transparent"}`}
                  >
                    <span className={`absolute top-0.5 w-3 h-3 transition-all ${ntOutbound ? "left-4 bg-primary" : "left-0.5 bg-primary/30"}`} />
                  </button>
                  <ArrowUpFromLine className="w-3 h-3 text-primary/60" />
                  <span className="text-[10px] text-primary/60">Outbound bypass</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <button type="button"
                    onClick={() => setNtInbound(!ntInbound)}
                    className={`w-8 h-4 border transition-colors relative ${ntInbound ? "border-primary bg-primary/20" : "border-primary/20 bg-transparent"}`}
                  >
                    <span className={`absolute top-0.5 w-3 h-3 transition-all ${ntInbound ? "left-4 bg-primary" : "left-0.5 bg-primary/30"}`} />
                  </button>
                  <ArrowDownToLine className="w-3 h-3 text-primary/60" />
                  <span className="text-[10px] text-primary/60">Inbound bypass</span>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => addToolRule.mutate()}
                  disabled={!ntTool || !ntLabel || addToolRule.isPending}
                  className="text-[10px] px-3 py-1.5 border border-primary text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                >
                  {addToolRule.isPending ? "ADDING..." : "ADD EXCEPTION"}
                </button>
                <button
                  onClick={() => setNewToolForm(false)}
                  className="text-[10px] px-3 py-1.5 border border-primary/20 text-primary/40 hover:text-primary/60 transition-colors"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}

          {/* Tool exception list */}
          <div className="border border-primary/20">
            <div className="grid grid-cols-[1fr_80px_80px_110px_auto] gap-2 px-3 py-2 border-b border-primary/20 text-[9px] text-primary/40 tracking-widest">
              <div>TOOL</div>
              <div className="text-center">OUTBOUND</div>
              <div className="text-center">INBOUND</div>
              <div>PORTS / CIDR</div>
              <div></div>
            </div>
            {(toolExcData?.rules ?? []).map(rule => (
              <div key={rule.id} className={`border-b border-primary/10 last:border-0 ${!rule.enabled ? "opacity-50" : ""}`}>
                {editingId === rule.id ? (
                  <div className="px-3 py-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[9px] text-primary/40 mb-0.5">PORTS</div>
                        <input value={editPorts} onChange={e => setEditPorts(e.target.value)}
                          className="w-full bg-black border border-primary/30 text-primary text-[10px] px-2 py-1 font-mono outline-none focus:border-primary/60" />
                      </div>
                      <div>
                        <div className="text-[9px] text-primary/40 mb-0.5">TARGET CIDR</div>
                        <input value={editCidr} onChange={e => setEditCidr(e.target.value)}
                          className="w-full bg-black border border-primary/30 text-primary text-[10px] px-2 py-1 font-mono outline-none focus:border-primary/60" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateToolRule.mutate({ id: rule.id, data: { ports: editPorts, cidr: editCidr } })}
                        className="text-[10px] px-2 py-1 border border-primary text-primary hover:bg-primary/10 transition-colors"
                      >SAVE</button>
                      <button onClick={() => setEditingId(null)} className="text-[10px] px-2 py-1 border border-primary/20 text-primary/40 hover:text-primary/60 transition-colors">CANCEL</button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-[1fr_80px_80px_110px_auto] gap-2 px-3 py-2.5 items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <Wrench className="w-3 h-3 text-primary/40 shrink-0" />
                        <span className="text-[10px] text-primary font-bold">{rule.toolLabel}</span>
                        <span className="text-[9px] text-primary/30 border border-primary/15 px-1">{rule.tool}</span>
                      </div>
                      <div className="text-[9px] text-primary/40 mt-0.5 ml-5 leading-relaxed">{rule.note}</div>
                      <div className="flex gap-1 mt-0.5 ml-5">
                        {rule.protocols.map(p => (
                          <span key={p} className="text-[8px] border border-primary/15 text-primary/40 px-1">{p.toUpperCase()}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={() => toggleTool.mutate({ id: rule.id, field: "outboundBypass", value: !rule.outboundBypass })}
                        title="Toggle outbound bypass"
                        className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 border transition-colors ${rule.outboundBypass ? "border-primary/40 text-primary bg-primary/5" : "border-primary/15 text-primary/30"}`}
                      >
                        <ArrowUpFromLine className="w-3 h-3" />
                        {rule.outboundBypass ? "ON" : "OFF"}
                      </button>
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={() => toggleTool.mutate({ id: rule.id, field: "inboundBypass", value: !rule.inboundBypass })}
                        title="Toggle inbound bypass"
                        className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 border transition-colors ${rule.inboundBypass ? "border-primary/40 text-primary bg-primary/5" : "border-primary/15 text-primary/30"}`}
                      >
                        <ArrowDownToLine className="w-3 h-3" />
                        {rule.inboundBypass ? "ON" : "OFF"}
                      </button>
                    </div>
                    <div className="text-[9px] text-primary/50 font-mono space-y-0.5">
                      <div><span className="text-primary/30">ports:</span> {rule.ports}</div>
                      <div><span className="text-primary/30">cidr:</span> {rule.cidr}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleTool.mutate({ id: rule.id, field: "enabled", value: !rule.enabled })}
                        title={rule.enabled ? "Disable rule" : "Enable rule"}
                        className={`p-1 border transition-colors ${rule.enabled ? "border-primary/30 text-primary hover:border-red-400/40 hover:text-red-400" : "border-primary/15 text-primary/30 hover:border-primary/40 hover:text-primary"}`}
                      >
                        {rule.enabled ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => { setEditingId(rule.id); setEditPorts(rule.ports); setEditCidr(rule.cidr); }}
                        title="Edit ports / CIDR"
                        className="p-1 border border-primary/15 text-primary/30 hover:border-primary/40 hover:text-primary transition-colors"
                      >
                        <Settings2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteToolRule.mutate(rule.id)}
                        title="Remove exception"
                        className="p-1 border border-primary/15 text-primary/30 hover:border-red-400/40 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Generated rules panel */}
          {generatedRules && showRules && (
            <div className="border border-primary/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-bold text-primary tracking-widest">GENERATED FIREWALL RULES</span>
                  <span className="text-[9px] text-primary/40 border border-primary/20 px-1">fwmark {generatedRules.auditFwmark}</span>
                </div>
                <div className="flex gap-1">
                  {(["iptables","nftables","wireguard","pf"] as const).map(v => (
                    <button key={v} onClick={() => setRulesView(v)}
                      className={`text-[9px] px-2 py-0.5 border transition-colors uppercase ${rulesView === v ? "border-primary text-primary bg-primary/10" : "border-primary/20 text-primary/40 hover:text-primary/70"}`}
                    >{v === "wireguard" ? "WG PostUp" : v}</button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 text-[9px]">
                <span className="text-primary/40">ENABLED: <span className="text-primary">{generatedRules.enabledRules}</span></span>
                <span className="text-primary/40">OUTBOUND: <span className="text-primary">{generatedRules.outboundRules}</span></span>
                <span className="text-primary/40">INBOUND: <span className="text-primary">{generatedRules.inboundRules}</span></span>
                <span className="text-primary/40">AT: <span className="text-primary/60">{new Date(generatedRules.generatedAt).toLocaleTimeString()}</span></span>
              </div>

              <div className="relative">
                <pre className="text-[10px] text-primary/80 bg-black border border-primary/10 p-3 overflow-x-auto max-h-72 font-mono leading-relaxed whitespace-pre">
                  {rulesView === "iptables"  && generatedRules.iptables}
                  {rulesView === "nftables"  && generatedRules.nftables}
                  {rulesView === "wireguard" && generatedRules.wireguardKillSwitchException}
                  {rulesView === "pf"        && generatedRules.pfRules}
                </pre>
                <button
                  onClick={() => navigator.clipboard.writeText(
                    rulesView === "iptables"  ? generatedRules.iptables :
                    rulesView === "nftables"  ? generatedRules.nftables :
                    rulesView === "wireguard" ? generatedRules.wireguardKillSwitchException :
                    generatedRules.pfRules
                  )}
                  className="absolute top-2 right-2 flex items-center gap-1 text-[9px] px-2 py-0.5 border border-primary/30 text-primary/50 hover:text-primary hover:border-primary/60 bg-black transition-colors"
                >
                  <Copy className="w-3 h-3" /> COPY
                </button>
              </div>

              <div className="border border-primary/10 p-3 space-y-1.5">
                <div className="text-[9px] text-primary/40 tracking-widest mb-2">HOW IT WORKS</div>
                {[
                  ["1", "MANGLE chain",      "Outbound packets from ProxhqVPN tools are stamped with fwmark 0x5050 at the API layer before leaving."],
                  ["2", "FILTER bypass",     "The OUTPUT chain sees the mark and allows those packets to skip the kill-switch DROP rules entirely."],
                  ["3", "Inbound response",  "ESTABLISHED/RELATED conntrack state admits response packets back in without a separate inbound bypass rule."],
                  ["4", "Attack detection",  "Inbound packets with no established session and no audit header trigger Beacon alerts normally."],
                ].map(([n, title, desc]) => (
                  <div key={n} className="flex items-start gap-2 text-[9px]">
                    <span className="text-primary/30 border border-primary/20 w-4 h-4 flex items-center justify-center shrink-0 text-[8px]">{n}</span>
                    <span className="text-primary font-bold w-28 shrink-0">{title}</span>
                    <span className="text-primary/50 leading-relaxed">{desc}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  const content = [generatedRules.iptables, "\n\n---\n\n", generatedRules.wireguardKillSwitchException].join("");
                  const blob = new Blob([content], { type: "text/plain" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob); a.download = "proxhq-audit-exceptions.sh"; a.click();
                }}
                className="flex items-center gap-1 text-[10px] px-3 py-1.5 border border-primary/30 text-primary/60 hover:text-primary hover:border-primary/60 transition-colors"
              >
                <Download className="w-3 h-3" /> DOWNLOAD ALL RULES
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: MTU OPTIMIZER ────────────────────────────────────────── */}
      {activeTab === "mtu" && (
        <div className="space-y-4">
          <div className="border border-primary/20 p-4">
            <div className="text-[10px] text-primary/50 tracking-widest mb-2">MTU OPTIMIZER</div>
            <p className="text-[11px] text-primary/50 mb-4">
              When stacking multiple VPN tunnels, each tunnel adds overhead bytes per packet.
              If the MTU is too high, packets fragment silently — causing slowdowns, connection drops,
              and hard-to-debug network issues. Calculate the correct MTU here.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="text-[9px] text-primary/40 block mb-1">BASE MTU (ETHERNET)</label>
                <input type="number" value={baseMtu} onChange={e => setBaseMtu(+e.target.value)}
                  className="w-full bg-black border border-primary/30 text-primary text-xs px-2 py-1.5 font-mono focus:outline-none focus:border-primary"
                  min={576} max={9000} />
              </div>
              <div>
                <label className="text-[9px] text-primary/40 block mb-1">VPN HOP COUNT</label>
                <input type="number" value={hopCount} onChange={e => setHopCount(+e.target.value)}
                  className="w-full bg-black border border-primary/30 text-primary text-xs px-2 py-1.5 font-mono focus:outline-none focus:border-primary"
                  min={1} max={4} />
              </div>
              <div>
                <label className="text-[9px] text-primary/40 block mb-1">PROTOCOL</label>
                <select value={mtuProtocol} onChange={e => setMtuProtocol(e.target.value as any)}
                  className="w-full bg-black border border-primary/30 text-primary text-xs px-2 py-1.5 font-mono focus:outline-none focus:border-primary">
                  <option value="wireguard">WireGuard (60 B overhead)</option>
                  <option value="openvpn">OpenVPN (80 B overhead)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={() => calcMtu.mutate()} disabled={calcMtu.isPending}
                  className="w-full flex items-center justify-center gap-2 py-1.5 bg-primary/10 border border-primary text-primary text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-50">
                  <Cpu className="w-3.5 h-3.5" />
                  CALCULATE
                </button>
              </div>
            </div>

            {mtuResult && (
              <div className="border border-primary/30 p-4 space-y-3">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="border border-primary/20 p-3">
                    <div className="text-2xl font-bold text-primary">{mtuResult.recommendedMtu}</div>
                    <div className="text-[9px] text-primary/40 mt-1">RECOMMENDED MTU</div>
                  </div>
                  <div className="border border-primary/20 p-3">
                    <div className="text-2xl font-bold text-yellow-400">{mtuResult.safeMtu}</div>
                    <div className="text-[9px] text-primary/40 mt-1">CONSERVATIVE MTU</div>
                  </div>
                  <div className="border border-primary/20 p-3">
                    <div className="text-2xl font-bold text-primary/60">{mtuResult.perHopOverheadBytes}B</div>
                    <div className="text-[9px] text-primary/40 mt-1">OVERHEAD PER HOP</div>
                  </div>
                </div>
                {mtuResult.warning && (
                  <div className="flex items-center gap-2 text-xs text-yellow-400 border border-yellow-400/20 p-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {mtuResult.warning}
                  </div>
                )}
                <div className="space-y-1">
                  <div className="text-[9px] text-primary/40 tracking-widest">HOP BREAKDOWN</div>
                  {mtuResult.breakdown.map((hop: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      <div className="w-2 h-2 border border-primary/40 flex items-center justify-center text-[8px] text-primary/60">{hop.hop}</div>
                      <span className="text-primary/60 w-36">{hop.label}</span>
                      <div className="flex-1 bg-primary/10 h-1.5">
                        <div className="bg-primary h-full" style={{ width: `${(hop.mtu / mtuResult.baseMtu) * 100}%` }} />
                      </div>
                      <span className="text-primary font-bold">{hop.mtu}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="text-[9px] text-primary/40 tracking-widest mb-1">SET MTU COMMANDS</div>
                  {Object.entries(mtuResult.commands).map(([os, cmd]) => (
                    <div key={os} className="flex items-center gap-2 text-[10px]">
                      <span className="text-primary/40 w-12 uppercase">{os}:</span>
                      <code className="text-primary bg-primary/5 border border-primary/10 px-2 py-0.5 flex-1 font-mono">{cmd as string}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* MTU reference table */}
          <div className="border border-primary/20 p-4">
            <div className="text-[10px] text-primary/50 tracking-widest mb-3">MTU REFERENCE TABLE</div>
            <div className="border border-primary/20">
              <div className="grid grid-cols-4 gap-2 p-2 border-b border-primary/20 text-[9px] text-primary/40 tracking-widest">
                <div>SCENARIO</div><div>BASE</div><div>RECOMMENDED</div><div>NOTES</div>
              </div>
              {[
                ["Single VPN (WireGuard)", "1500", "1420", "Standard WireGuard MTU"],
                ["Single VPN (OpenVPN)", "1500", "1400", "OpenVPN adds ~100B header"],
                ["ProxhqVPN + Native VPN", "1500", "1380", "Double-hop: 2× overhead"],
                ["ProxhqVPN + Tor hidden svc", "1500", "1280", "Tor cells are 512B, limits MTU"],
                ["3-hop chain", "1500", "1280", "Maximum safe for triple VPN"],
              ].map(([s, b, r, n]) => (
                <div key={s} className="grid grid-cols-4 gap-2 p-2 border-b border-primary/10 text-[10px]">
                  <div className="text-primary">{s}</div>
                  <div className="text-primary/60">{b}</div>
                  <div className="text-primary font-bold">{r}</div>
                  <div className="text-primary/40">{n}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: SCRIPTS ──────────────────────────────────────────────── */}
      {activeTab === "scripts" && (
        <div className="space-y-4">
          {!generatedScript ? (
            <div className="border border-primary/20 p-8 text-center">
              <Route className="w-8 h-8 text-primary/20 mx-auto mb-3" />
              <p className="text-xs text-primary/40">No scripts generated yet.</p>
              <p className="text-[10px] text-primary/30 mt-1">
                Go to the Overview tab, configure your VPN profile and mode, then click Generate.
              </p>
            </div>
          ) : (
            <>
              {/* Notes */}
              {scriptNotes.length > 0 && (
                <div className="border border-yellow-400/20 bg-yellow-400/5 p-3">
                  <div className="text-[9px] text-yellow-400/60 tracking-widest mb-2">NOTES</div>
                  {scriptNotes.map((n, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10px] text-yellow-400/80 mb-1">
                      <span className="text-yellow-400/40 mt-0.5">•</span>
                      {n}
                    </div>
                  ))}
                </div>
              )}

              {/* Enable script */}
              <div className="border border-primary/20 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-bold text-primary tracking-widest">ENABLE SCRIPT</span>
                    <span className="text-[9px] text-primary/40 border border-primary/20 px-1">{targetOs.toUpperCase()}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => navigator.clipboard.writeText(generatedScript)}
                      className="text-[10px] px-2 py-0.5 border border-primary/30 text-primary/60 hover:text-primary hover:border-primary/60 transition-colors">
                      COPY
                    </button>
                    <button onClick={() => downloadScript(generatedScript, "proxhq-coexist-enable")}
                      className="flex items-center gap-1 text-[10px] px-2 py-0.5 border border-primary/30 text-primary/60 hover:text-primary hover:border-primary/60 transition-colors">
                      <Download className="w-3 h-3" /> DOWNLOAD
                    </button>
                    <button onClick={() => setShowScript(!showScript)}
                      className="text-[10px] px-2 py-0.5 border border-primary/20 text-primary/40 hover:text-primary/60 transition-colors">
                      {showScript ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                {showScript && (
                  <pre className="text-[10px] text-primary/80 bg-black border border-primary/10 p-3 overflow-x-auto max-h-64 font-mono leading-relaxed whitespace-pre">
                    {generatedScript}
                  </pre>
                )}
              </div>

              {/* Disable script */}
              <div className="border border-red-400/20 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-400" />
                    <span className="text-[10px] font-bold text-red-400 tracking-widest">DISABLE / REVERT SCRIPT</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => navigator.clipboard.writeText(disableScript)}
                      className="text-[10px] px-2 py-0.5 border border-red-400/30 text-red-400/60 hover:text-red-400 hover:border-red-400/60 transition-colors">
                      COPY
                    </button>
                    <button onClick={() => downloadScript(disableScript, "proxhq-coexist-disable")}
                      className="flex items-center gap-1 text-[10px] px-2 py-0.5 border border-red-400/30 text-red-400/60 hover:text-red-400 hover:border-red-400/60 transition-colors">
                      <Download className="w-3 h-3" /> DOWNLOAD
                    </button>
                    <button onClick={() => setShowDisable(!showDisable)}
                      className="text-[10px] px-2 py-0.5 border border-red-400/20 text-red-400/40 hover:text-red-400/60 transition-colors">
                      {showDisable ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                {showDisable && (
                  <pre className="text-[10px] text-red-400/70 bg-black border border-red-400/10 p-3 overflow-x-auto max-h-48 font-mono leading-relaxed whitespace-pre">
                    {disableScript}
                  </pre>
                )}
                <p className="text-[10px] text-red-400/50 mt-2">
                  Keep this script safe. Run it to cleanly remove all ProxhqVPN coexistence rules and restore your system to its original routing configuration.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
