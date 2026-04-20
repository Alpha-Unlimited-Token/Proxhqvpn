import { useState } from "react";
import { useNodeLifecycle } from "@/hooks/useNodeLifecycle";
import { NodeCard } from "@/components/nodes/NodeCard";
import { useCreateNode, getListNodesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Network, Plus, RefreshCw, Radio, Activity, Globe, Download } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface VpnGateServer {
  ip: string;
  score: number;
  ping: number;
  speedMbps: number;
  country: string;
  countryCode: string;
  sessions: number;
  logType: string;
  operator: string;
  hasOvpn: boolean;
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  try { return String.fromCodePoint(...code.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0))); }
  catch { return "🌐"; }
}

function pingColor(ms: number) {
  if (ms <= 30) return "text-primary";
  if (ms <= 80) return "text-cyan-400";
  if (ms <= 150) return "text-yellow-400";
  return "text-red-400/70";
}

function speedColor(mbps: number) {
  if (mbps >= 100) return "text-primary";
  if (mbps >= 30) return "text-cyan-400";
  if (mbps >= 5) return "text-yellow-400";
  return "text-red-400/70";
}

function VpnGateSwarmCard({ server, onDownload }: { server: VpnGateServer; onDownload: (s: VpnGateServer) => void }) {
  return (
    <div className="relative bg-black border border-cyan-400/15 hover:border-cyan-400/40 rounded-none p-3 flex flex-col gap-2 overflow-hidden transition-all duration-200 group">
      <div className="node-scan-bar opacity-0 group-hover:opacity-100" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[9px] border border-cyan-400/30 px-1 py-0.5 uppercase tracking-wider shrink-0 text-cyan-400">VPG</span>
          <span className="text-[11px]">{countryFlag(server.countryCode)}</span>
          <span className="font-mono text-[10px] text-primary/80 truncate">{server.countryCode}</span>
        </div>
        <span className={`text-[9px] font-mono ${pingColor(server.ping)}`}>{server.ping}ms</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-primary">{server.ip}</span>
        <span className={`text-[10px] font-mono font-bold ${speedColor(server.speedMbps)}`}>
          {server.speedMbps >= 1000 ? `${(server.speedMbps / 1000).toFixed(1)}G` : `${server.speedMbps}M`}
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-primary/40 truncate max-w-[90px]">{server.operator || "anon"}</span>
        <span className="text-[9px] font-mono text-primary/30">{server.sessions > 0 ? `${server.sessions}s` : "—"}</span>
      </div>

      <div className="border-t border-primary/10 pt-1.5 flex items-center justify-between gap-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="beacon-container shrink-0 scale-75"><div className="beacon-core" /><div className="beacon-ring" /></div>
            <span className="text-[8px] text-cyan-400/50 uppercase">BCN</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="spider-orbit-container shrink-0 scale-75"><div className="spider-dot" /></div>
            <span className="text-[8px] text-primary/50 uppercase">SPD</span>
          </div>
        </div>
        {server.hasOvpn && (
          <button onClick={() => onDownload(server)}
            className="flex items-center gap-0.5 text-primary/40 hover:text-primary border border-primary/15 hover:border-primary/40 px-1.5 py-0.5 transition-colors">
            <Download className="w-2.5 h-2.5" />
            <span className="text-[8px] uppercase font-mono">OVPN</span>
          </button>
        )}
      </div>
      <div className="text-[9px] font-mono text-primary/20">#{server.score.toLocaleString()}</div>
    </div>
  );
}

const LAYER_FILTER_OPTIONS = ["all", "outer", "inner", "vpngate"] as const;
type LayerFilter = (typeof LAYER_FILTER_OPTIONS)[number];

export default function NodeManager() {
  const { nodes, lifecycleMap, currentRotatingId, rotationLog } = useNodeLifecycle();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createNode = useCreateNode();

  const [layerFilter, setLayerFilter] = useState<LayerFilter>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newNodeForm, setNewNodeForm] = useState({ name: "", layer: "outer", region: "" });

  const { data: vpnGateData, isFetching: vpnGateFetching } = useQuery<{
    servers: VpnGateServer[];
    total: number;
  }>({
    queryKey: ["vpngate-swarm-nodes"],
    queryFn: () =>
      fetch(`${BASE}/api/vpngate/servers?limit=60`)
        .then((r) => r.json()),
    enabled: layerFilter === "vpngate",
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  const vpnGateNodes = vpnGateData?.servers ?? [];

  const filteredNodes =
    layerFilter === "all" ? nodes :
    layerFilter === "vpngate" ? [] :
    nodes.filter((n) => n.layer === layerFilter);

  const outerCount = nodes.filter((n) => n.layer === "outer").length;
  const innerCount = nodes.filter((n) => n.layer === "inner").length;
  const activeCount = nodes.filter((n) => n.status === "active").length;
  const rotatingCount = Object.values(lifecycleMap).filter((s) => s !== "stable").length;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createNode.mutate(
      { data: { name: newNodeForm.name, layer: newNodeForm.layer as any, region: newNodeForm.region } },
      {
        onSuccess: () => {
          toast({ title: "Node Deployed", description: `${newNodeForm.name} spawned in ${newNodeForm.region}.` });
          setIsCreateOpen(false);
          setNewNodeForm({ name: "", layer: "outer", region: "" });
          queryClient.invalidateQueries({ queryKey: getListNodesQueryKey() });
        },
      },
    );
  };

  const handleVpnGateDownload = (server: VpnGateServer) => {
    const url = `${BASE}/api/vpngate/servers/${server.ip}/config`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `vpngate-${server.countryCode}-${server.ip}.ovpn`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-4 h-full pb-8">
      <div className="border border-primary/10 bg-black/20 rounded-sm px-3 py-2.5 shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
              <Network className="w-5 h-5" />
              Node Swarm
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-primary/50">OUTER:</span>
              <span className="text-primary">{outerCount}</span>
              <span className="text-primary/30 mx-1">|</span>
              <span className="text-primary/50">INNER:</span>
              <span className="text-cyan-400">{innerCount}</span>
              <span className="text-primary/30 mx-1">|</span>
              <span className="text-primary/50">LIVE:</span>
              <span className="text-primary">{activeCount}</span>
              <span className="text-primary/30 mx-1">|</span>
              <span className="text-primary/50">VPG:</span>
              <span className="text-cyan-400">{vpnGateData?.total ?? "6k+"}</span>
              {rotatingCount > 0 && (
                <>
                  <span className="text-primary/30 mx-1">|</span>
                  <span className="text-yellow-400 flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    {rotatingCount} CYCLING
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex border border-primary/20 text-[10px] font-mono">
              {LAYER_FILTER_OPTIONS.map((f) => (
                <button key={f} onClick={() => setLayerFilter(f)}
                  className={`px-3 py-1.5 uppercase transition-colors flex items-center gap-1 ${
                    layerFilter === f ? "bg-primary text-black" : "text-primary/60 hover:text-primary hover:bg-primary/10"
                  }`}>
                  {f === "vpngate" && <Globe className="w-2.5 h-2.5" />}
                  {f}
                </button>
              ))}
            </div>

            {layerFilter !== "vpngate" && (
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10 text-xs">
                    <Plus className="w-3 h-3 mr-1" />
                    SPAWN
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-black border border-primary/40 text-primary font-mono">
                  <DialogHeader>
                    <DialogTitle className="uppercase tracking-widest text-sm text-primary/70">
                      Spawn New Node
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreate} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase text-primary/50">Node Name</Label>
                      <Input required
                        className="border-primary/20 bg-black/50 text-primary focus-visible:ring-primary/30 text-xs"
                        value={newNodeForm.name}
                        onChange={(e) => setNewNodeForm({ ...newNodeForm, name: e.target.value })}
                        placeholder="GhostNode-OUT-XX" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase text-primary/50">Layer</Label>
                      <Select value={newNodeForm.layer} onValueChange={(v) => setNewNodeForm({ ...newNodeForm, layer: v })}>
                        <SelectTrigger className="border-primary/20 bg-black/50 text-primary text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-black border-primary/30 text-primary font-mono">
                          <SelectItem value="outer" className="text-xs">OUTER (relay)</SelectItem>
                          <SelectItem value="inner" className="text-xs">INNER (core)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase text-primary/50">Region</Label>
                      <Input required
                        className="border-primary/20 bg-black/50 text-primary focus-visible:ring-primary/30 text-xs"
                        value={newNodeForm.region}
                        onChange={(e) => setNewNodeForm({ ...newNodeForm, region: e.target.value })}
                        placeholder="EU-West" />
                    </div>
                    <Button type="submit" disabled={createNode.isPending} className="w-full text-xs uppercase">
                      {createNode.isPending ? "Spawning..." : "Spawn Node"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 overflow-y-auto rounded-sm border border-primary/10 bg-black/20 p-2"
          style={{ maxHeight: "calc(100vh - 220px)" }}>

          {layerFilter === "vpngate" ? (
            vpnGateFetching && vpnGateNodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-primary/30 font-mono text-xs gap-3">
                <Globe className="w-8 h-8 opacity-30 animate-pulse" />
                <span className="uppercase tracking-widest">Loading VPN Gate nodes…</span>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Globe className="w-3 h-3 text-cyan-400" />
                  <span className="text-[10px] font-mono text-cyan-400/70 uppercase">
                    VPN Gate Outer Shield Layer — {vpnGateNodes.length} nodes shown
                  </span>
                  <Link href="/vpngate" className="ml-auto text-[9px] font-mono text-primary/40 hover:text-primary border border-primary/20 hover:border-primary/40 px-2 py-0.5 uppercase transition-colors">
                    FULL VIEW →
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                  {vpnGateNodes.map((server, idx) => (
                    <VpnGateSwarmCard
                      key={`${server.ip}-${idx}`}
                      server={server}
                      onDownload={handleVpnGateDownload}
                    />
                  ))}
                </div>
              </div>
            )
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-primary/30 font-mono text-xs uppercase tracking-widest gap-3">
              <Network className="w-8 h-8 opacity-30" />
              <span>Initializing swarm...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
              {filteredNodes.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  lifecycle={lifecycleMap[node.id] ?? "stable"}
                  isActive={node.id === currentRotatingId}
                />
              ))}
            </div>
          )}
        </div>

        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-3">
          {layerFilter !== "vpngate" && (
            <>
              <div className="border border-primary/20 bg-black flex flex-col">
                <div className="px-3 py-2 border-b border-primary/20 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-primary/70">Rotation Feed</span>
                  <span className="ml-auto text-[9px] text-primary/30 font-mono">3s cycle</span>
                </div>
                <div className="overflow-y-auto max-h-72">
                  {rotationLog.length === 0 ? (
                    <div className="px-3 py-6 text-center text-[10px] text-primary/30 font-mono">
                      AWAITING FIRST ROTATION...
                    </div>
                  ) : (
                    rotationLog.map((entry, i) => (
                      <div key={entry.ts}
                        className={`px-3 py-2 border-b border-primary/10 text-[9px] font-mono ${i === 0 ? "bg-primary/5" : ""}`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-primary/60 truncate max-w-[140px]">{entry.name}</span>
                          <span className="text-primary/30 shrink-0">{format(entry.ts, "HH:mm:ss")}</span>
                        </div>
                        <div className="flex items-center gap-1 text-primary/40">
                          <span className="text-red-400/70 line-through">{entry.oldIp}</span>
                          <span className="text-primary/25">→</span>
                          <span className="text-primary">{entry.newIp}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border border-primary/20 bg-black p-3 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 flex items-center gap-2">
                  <Radio className="w-3 h-3" />
                  Swarm Health
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] font-mono">
                  {([
                    ["TOTAL", nodes.length],
                    ["ACTIVE", activeCount],
                    ["OUTER", outerCount],
                    ["INNER", innerCount],
                    ["VPG POOL", "6,000+"],
                    ["INTERVAL", "3s"],
                  ] as [string, string | number][]).map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-primary/40">{label}</span>
                      <span className={label === "VPG POOL" ? "text-cyan-400" : label === "CYCLING" && Number(value) > 0 ? "text-yellow-400" : "text-primary"}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {layerFilter === "vpngate" && (
            <div className="border border-cyan-400/20 bg-black p-3 space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/50 flex items-center gap-2">
                <Globe className="w-3 h-3" />
                VPN Gate Layer
              </div>
              <p className="text-[9px] font-mono text-primary/40 leading-relaxed">
                These are real volunteer-run VPN nodes from the University of Tsukuba academic project.
                They form your outer shield layer — 6,000+ relays across 60+ countries, all free.
              </p>
              <div className="border border-primary/10 p-2 space-y-1">
                {[["NODES", vpnGateData?.total ?? "6,000+"], ["COST", "FREE"], ["PROTOCOL", "OpenVPN"], ["CREDS", "vpn / vpn"]].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[9px] font-mono">
                    <span className="text-primary/40">{k}</span>
                    <span className={k === "COST" ? "text-cyan-400" : "text-primary"}>{v}</span>
                  </div>
                ))}
              </div>
              <Link href="/vpngate">
                <Button size="sm" variant="outline" className="w-full text-xs border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/10 uppercase font-mono">
                  Open Full VPN Gate Dashboard →
                </Button>
              </Link>
            </div>
          )}

          <div className="border border-primary/20 bg-black p-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 mb-2">
              Indicator Legend
            </div>
            <div className="space-y-2 text-[9px] font-mono">
              <div className="flex items-center gap-2">
                <div className="spider-orbit-container shrink-0"><div className="spider-dot" /></div>
                <span className="text-primary/50">Spider — active crawl and scan</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="beacon-container shrink-0"><div className="beacon-core" /><div className="beacon-ring" /></div>
                <span className="text-cyan-400/50">Beacon — intrusion detection</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="worm-container shrink-0"><div className="worm-track"><div className="worm-dot" /></div></div>
                <span className="text-yellow-400/50">Worm — latency suppressor</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] border border-cyan-400/30 px-1 text-cyan-400">VPG</span>
                <span className="text-cyan-400/50">VPN Gate — outer shield node</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
