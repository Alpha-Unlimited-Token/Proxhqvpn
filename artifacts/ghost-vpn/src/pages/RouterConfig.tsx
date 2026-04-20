import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Router, Copy, CheckCheck, Download, RefreshCw } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Firmware { id: string; name: string; method: string; notes: string }
interface NodeOption { id: number; name: string; region: string; ipAddress: string; status: string }
interface GeneratedConfig {
  firmware: string; serverName: string; serverEndpoint: string;
  wgConf: string; commands: string; steps: string[]; notes: string;
}

export default function RouterConfig() {
  const { toast } = useToast();
  const [firmwares, setFirmwares] = useState<Firmware[]>([]);
  const [nodes, setNodes] = useState<NodeOption[]>([]);
  const [selectedFirmware, setSelectedFirmware] = useState("openwrt");
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [privKey, setPrivKey] = useState("");
  const [clientAddress, setClientAddress] = useState("10.8.0.2/24");
  const [dns, setDns] = useState("1.1.1.1");
  const [killSwitch, setKillSwitch] = useState(true);
  const [config, setConfig] = useState<GeneratedConfig | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"commands"|"conf"|"steps">("commands");

  useEffect(() => {
    fetch(`${BASE}/api/router-config/firmwares`).then(r => r.json()).then(setFirmwares).catch(() => null);
    fetch(`${BASE}/api/nodes`).then(r => r.json()).then((data) => {
      const list = Array.isArray(data) ? data : (data.nodes ?? []);
      setNodes(list.filter((n: NodeOption) => n.status === "active"));
    }).catch(() => null);
  }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await fetch(`${BASE}/api/router-config/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firmware: selectedFirmware,
          nodeId: selectedNode ?? undefined,
          clientPrivateKey: privKey || undefined,
          clientAddress,
          dns,
          killSwitch,
        }),
      });
      const data = await r.json();
      if (!r.ok) { toast({ title: data.error || "Generation failed", variant: "destructive" }); return; }
      setConfig(data);
      setActiveTab("commands");
    } catch { toast({ title: "Network error", variant: "destructive" }); }
    finally { setGenerating(false); }
  };

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadFile = (text: string, filename: string) => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const currentFirmware = firmwares.find(f => f.id === selectedFirmware);

  return (
    <div className="space-y-5 font-mono">
      <div>
        <h1 className="text-lg font-bold tracking-widest uppercase text-primary flex items-center gap-2">
          <Router className="w-5 h-5" /> Router Config Generator
        </h1>
        <p className="text-xs text-primary/40 mt-0.5">Generate ProxhqVPN WireGuard configs for your router — protects every device on your network</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-black border-primary/20">
          <CardContent className="p-4 space-y-4">
            <div className="text-[9px] tracking-widest text-primary/40 uppercase">Configuration</div>

            <div>
              <label className="text-[9px] text-primary/40 block mb-1">ROUTER FIRMWARE</label>
              <div className="grid grid-cols-2 gap-1">
                {firmwares.map(f => (
                  <button key={f.id} onClick={() => setSelectedFirmware(f.id)}
                    className={`text-left border px-2.5 py-2 transition-colors ${selectedFirmware === f.id ? "bg-primary/10 border-primary text-primary" : "border-primary/20 text-primary/50 hover:border-primary/40 hover:text-primary"}`}>
                    <div className="text-[10px] font-bold">{f.name}</div>
                    <div className="text-[8px] text-primary/30 mt-0.5">{f.notes}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[9px] text-primary/40 block mb-1">SERVER NODE</label>
              <select
                value={selectedNode ?? ""}
                onChange={e => setSelectedNode(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full bg-black border border-primary/30 text-primary font-mono text-xs px-2 py-1.5 focus:outline-none focus:border-primary"
              >
                <option value="">— Enter server IP manually —</option>
                {nodes.map(n => (
                  <option key={n.id} value={n.id}>{n.name} ({n.region}) — {n.ipAddress}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] text-primary/40 block mb-1">CLIENT IP / SUBNET</label>
                <input
                  value={clientAddress}
                  onChange={e => setClientAddress(e.target.value)}
                  className="w-full bg-black border border-primary/30 text-primary font-mono text-xs px-2 py-1.5 focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[9px] text-primary/40 block mb-1">DNS SERVER</label>
                <input
                  value={dns}
                  onChange={e => setDns(e.target.value)}
                  className="w-full bg-black border border-primary/30 text-primary font-mono text-xs px-2 py-1.5 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-[9px] text-primary/40 block mb-1">CLIENT PRIVATE KEY (optional — leave blank to fill later)</label>
              <input
                value={privKey}
                onChange={e => setPrivKey(e.target.value)}
                placeholder="Paste your WireGuard private key or leave blank"
                className="w-full bg-black border border-primary/30 text-primary font-mono text-xs px-2 py-1.5 focus:outline-none focus:border-primary"
              />
              <p className="text-[8px] text-primary/25 mt-1">On Linux/macOS generate one with: wg genkey</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-[9px] text-primary/40 block">KILL SWITCH</label>
                <p className="text-[8px] text-primary/25">Block all traffic if VPN drops</p>
              </div>
              <button onClick={() => setKillSwitch(!killSwitch)}
                className={`text-[9px] border px-2 py-1 transition-colors ${killSwitch ? "border-primary text-primary bg-primary/10" : "border-primary/20 text-primary/30"}`}>
                {killSwitch ? "ENABLED" : "DISABLED"}
              </button>
            </div>

            <button onClick={generate} disabled={generating}
              className="w-full flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-black bg-primary hover:bg-primary/80 py-2.5 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
              {generating ? "GENERATING..." : "GENERATE CONFIG"}
            </button>
          </CardContent>
        </Card>

        <Card className="bg-black border-primary/20">
          <CardContent className="p-4">
            {!config ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center min-h-64">
                <Router className="w-8 h-8 text-primary/20" />
                <p className="text-[10px] text-primary/30">Select firmware and server, then click Generate Config</p>
                {currentFirmware && (
                  <p className="text-[9px] text-primary/20 max-w-xs">{currentFirmware.name}: {currentFirmware.notes}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-primary">{currentFirmware?.name ?? config.firmware}</div>
                    <div className="text-[9px] text-primary/40">Server: {config.serverEndpoint}</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => downloadFile(config.commands, `proxhqvpn-${config.firmware}.sh`)}
                      className="flex items-center gap-1 text-[9px] text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/40 px-2 py-1 transition-colors">
                      <Download className="w-3 h-3" /> SCRIPT
                    </button>
                    <button onClick={() => downloadFile(config.wgConf, "proxhqvpn.conf")}
                      className="flex items-center gap-1 text-[9px] text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/40 px-2 py-1 transition-colors">
                      <Download className="w-3 h-3" /> .CONF
                    </button>
                  </div>
                </div>

                <div className="flex gap-1 border-b border-primary/10">
                  {(["commands","conf","steps"] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`text-[9px] uppercase tracking-wider px-3 py-1.5 transition-colors border-b-2 ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-primary/40 hover:text-primary"}`}>
                      {tab === "commands" ? "COMMANDS" : tab === "conf" ? "WG CONF" : "STEPS"}
                    </button>
                  ))}
                </div>

                {activeTab === "commands" && (
                  <div>
                    <div className="flex justify-end mb-1">
                      <button onClick={() => copy(config.commands, "cmds")}
                        className="flex items-center gap-1 text-[9px] text-primary/50 hover:text-primary">
                        {copied === "cmds" ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === "cmds" ? "COPIED" : "COPY"}
                      </button>
                    </div>
                    <pre className="bg-primary/5 border border-primary/10 p-2 text-[8px] text-primary/70 overflow-auto max-h-80 whitespace-pre font-mono leading-relaxed">
                      {config.commands}
                    </pre>
                  </div>
                )}

                {activeTab === "conf" && (
                  <div>
                    <div className="flex justify-end mb-1">
                      <button onClick={() => copy(config.wgConf, "conf")}
                        className="flex items-center gap-1 text-[9px] text-primary/50 hover:text-primary">
                        {copied === "conf" ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === "conf" ? "COPIED" : "COPY"}
                      </button>
                    </div>
                    <pre className="bg-primary/5 border border-primary/10 p-2 text-[9px] text-primary/70 overflow-auto max-h-80 whitespace-pre font-mono">
                      {config.wgConf}
                    </pre>
                  </div>
                )}

                {activeTab === "steps" && (
                  <ol className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {config.steps.map((step, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span className="text-[9px] text-primary/30 shrink-0 pt-0.5 w-4">{i + 1}.</span>
                        <p className="text-[9px] text-primary/70 leading-relaxed">{step}</p>
                      </li>
                    ))}
                    {config.notes && (
                      <li className="pt-2 border-t border-primary/10">
                        <p className="text-[9px] text-primary/40 italic leading-relaxed">{config.notes}</p>
                      </li>
                    )}
                  </ol>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
