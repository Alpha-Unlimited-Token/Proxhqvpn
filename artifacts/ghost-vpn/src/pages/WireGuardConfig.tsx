// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { usePersistedState } from "@/hooks/usePersistedState";
import { useGetNodeWireguardConfig, useListNodes } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2 } from "lucide-react";

export default function WireGuardConfig() {
  const { data: nodes } = useListNodes();
  const [selectedNode, setSelectedNode] = usePersistedState<string>("wireguard-node", "");
  
  const { data: config, isLoading } = useGetNodeWireguardConfig(Number(selectedNode), {
    query: { enabled: !!selectedNode } as any
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
          <Settings2 className="w-6 h-6" />
          WireGuard Configs
        </h2>
        <div className="w-64">
          <Select value={selectedNode} onValueChange={setSelectedNode}>
            <SelectTrigger className="border-primary/50 bg-black font-mono text-xs">
              <SelectValue placeholder="SELECT NODE..." />
            </SelectTrigger>
            <SelectContent className="bg-black border-primary/50">
              {nodes?.nodes?.map(n => (
                <SelectItem key={n.id} value={n.id.toString()} className="font-mono text-xs text-primary hover:bg-primary/20">
                  {n.name} ({n.ipAddress})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedNode && (
        <div className="flex-1 flex items-center justify-center border border-primary/20 rounded bg-black/50 p-12">
           <span className="text-primary/50 font-mono text-sm uppercase">Select a node to view configuration</span>
        </div>
      )}

      {selectedNode && isLoading && (
        <div className="flex-1 flex items-center justify-center border border-primary/20 rounded bg-black/50 p-12">
           <span className="text-primary animate-pulse font-mono text-sm uppercase">Decrypting configuration...</span>
        </div>
      )}

      {selectedNode && config && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-primary/70 uppercase">wg0.conf</h3>
            <pre className="p-4 border border-primary/20 rounded bg-black text-primary font-mono text-xs overflow-auto h-[600px] whitespace-pre-wrap">
              {config.configText}
            </pre>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-primary/70 uppercase">Routing Table</h3>
              <pre className="p-4 border border-primary/20 rounded bg-black text-primary font-mono text-xs overflow-auto h-[250px] whitespace-pre-wrap">
                {config.routingTable}
              </pre>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-primary/70 uppercase">iptables Masquerade</h3>
              <pre className="p-4 border border-primary/20 rounded bg-black text-primary font-mono text-xs overflow-auto h-[250px] whitespace-pre-wrap">
                {config.iptablesRules}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
