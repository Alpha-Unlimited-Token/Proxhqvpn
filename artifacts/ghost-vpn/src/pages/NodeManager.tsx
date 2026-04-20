import { useState } from "react";
import { useNodeLifecycle } from "@/hooks/useNodeLifecycle";
import { NodeCard } from "@/components/nodes/NodeCard";
import { useCreateNode, getListNodesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Network, Plus, RefreshCw, Radio, Activity } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const LAYER_FILTER_OPTIONS = ["all", "outer", "inner"] as const;
type LayerFilter = (typeof LAYER_FILTER_OPTIONS)[number];

export default function NodeManager() {
  const { nodes, lifecycleMap, currentRotatingId, rotationLog } = useNodeLifecycle();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createNode = useCreateNode();

  const [layerFilter, setLayerFilter] = useState<LayerFilter>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newNodeForm, setNewNodeForm] = useState({ name: "", layer: "outer", region: "" });

  const filteredNodes = layerFilter === "all"
    ? nodes
    : nodes.filter((n) => n.layer === layerFilter);

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

  return (
    <div className="flex flex-col gap-4 h-full pb-8">
      <div className="flex items-center justify-between shrink-0 flex-wrap gap-3">
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
              <button
                key={f}
                onClick={() => setLayerFilter(f)}
                className={`px-3 py-1.5 uppercase transition-colors ${
                  layerFilter === f
                    ? "bg-primary text-black"
                    : "text-primary/60 hover:text-primary hover:bg-primary/10"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

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
                  <Input
                    required
                    className="border-primary/20 bg-black/50 text-primary focus-visible:ring-primary/30 text-xs"
                    value={newNodeForm.name}
                    onChange={(e) => setNewNodeForm({ ...newNodeForm, name: e.target.value })}
                    placeholder="GhostNode-OUT-XX"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase text-primary/50">Layer</Label>
                  <Select
                    value={newNodeForm.layer}
                    onValueChange={(v) => setNewNodeForm({ ...newNodeForm, layer: v })}
                  >
                    <SelectTrigger className="border-primary/20 bg-black/50 text-primary text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-primary/30 text-primary font-mono">
                      <SelectItem value="outer" className="text-xs">OUTER (relay)</SelectItem>
                      <SelectItem value="inner" className="text-xs">INNER (core)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase text-primary/50">Region</Label>
                  <Input
                    required
                    className="border-primary/20 bg-black/50 text-primary focus-visible:ring-primary/30 text-xs"
                    value={newNodeForm.region}
                    onChange={(e) => setNewNodeForm({ ...newNodeForm, region: e.target.value })}
                    placeholder="EU-West"
                  />
                </div>
                <Button type="submit" disabled={createNode.isPending} className="w-full text-xs uppercase">
                  {createNode.isPending ? "Spawning..." : "Spawn Node"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div
          className="flex-1 overflow-y-auto rounded-sm border border-primary/10 bg-black/20 p-2"
          style={{ maxHeight: "calc(100vh - 220px)" }}
        >
          {nodes.length === 0 ? (
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
          <div className="border border-primary/20 bg-black flex flex-col">
            <div className="px-3 py-2 border-b border-primary/20 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-primary/70">
                Rotation Feed
              </span>
              <span className="ml-auto text-[9px] text-primary/30 font-mono">3s cycle</span>
            </div>
            <div className="overflow-y-auto max-h-72">
              {rotationLog.length === 0 ? (
                <div className="px-3 py-6 text-center text-[10px] text-primary/30 font-mono">
                  AWAITING FIRST ROTATION...
                </div>
              ) : (
                rotationLog.map((entry, i) => (
                  <div
                    key={entry.ts}
                    className={`px-3 py-2 border-b border-primary/10 text-[9px] font-mono ${i === 0 ? "bg-primary/5" : ""}`}
                  >
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
                ["CYCLING", rotatingCount],
                ["INTERVAL", "3s"],
              ] as [string, string | number][]).map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-primary/40">{label}</span>
                  <span className={label === "CYCLING" && Number(value) > 0 ? "text-yellow-400" : "text-primary"}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-primary/20 bg-black p-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 mb-2">
              Indicator Legend
            </div>
            <div className="space-y-2 text-[9px] font-mono">
              <div className="flex items-center gap-2">
                <div className="spider-orbit-container shrink-0">
                  <div className="spider-dot" />
                </div>
                <span className="text-primary/50">Spider — active crawl and scan</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="beacon-container shrink-0">
                  <div className="beacon-core" />
                  <div className="beacon-ring" />
                </div>
                <span className="text-cyan-400/50">Beacon — intrusion detection</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="worm-container shrink-0">
                  <div className="worm-track">
                    <div className="worm-dot" />
                  </div>
                </div>
                <span className="text-yellow-400/50">Worm — latency suppressor</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
