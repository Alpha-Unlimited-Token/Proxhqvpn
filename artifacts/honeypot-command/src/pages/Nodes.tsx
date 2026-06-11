// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { useListHoneypotNodes, useCreateHoneypotNode, useDeleteHoneypotNode, useUpdateHoneypotNode } from "@/hooks/useApi";
import { useQueryClient } from "@tanstack/react-query";
import { getListHoneypotNodesQueryKey } from "@workspace/api-client-react";
import { Server, Plus, Trash2, Edit2, Check, X, Activity, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

function AddNodeModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateHoneypotNode();
  const [form, setForm] = useState({
    name: "", host: "", port: "22", protocol: "ssh", location: "", country: "", psk: "",
  });

  const submit = async () => {
    if (!form.name || !form.host) {
      toast({ title: "Name and host are required", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({ data: { name: form.name, host: form.host, port: Number(form.port) || 22, protocol: form.protocol, location: form.location || undefined, country: form.country || undefined, psk: form.psk || undefined } });
      await qc.invalidateQueries({ queryKey: getListHoneypotNodesQueryKey() });
      toast({ title: "Node registered" });
      onClose();
    } catch {
      toast({ title: "Failed to create node", variant: "destructive" });
    }
  };

  const field = (key: keyof typeof form, label: string, placeholder?: string, type = "text") => (
    <div>
      <label className="block text-xs text-muted-foreground font-mono mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-lg w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono font-bold text-primary">Register Honeypot Node</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          {field("name", "NODE NAME", "e.g. hpnode-us-east-01")}
          {field("host", "HOST / IP", "192.168.1.100")}
          <div className="grid grid-cols-2 gap-3">
            {field("port", "PORT", "22")}
            <div>
              <label className="block text-xs text-muted-foreground font-mono mb-1">PROTOCOL</label>
              <select value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}
                className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary">
                <option value="ssh">SSH</option>
                <option value="telnet">Telnet</option>
                <option value="http">HTTP</option>
                <option value="ftp">FTP</option>
                <option value="smb">SMB</option>
                <option value="multi">Multi</option>
              </select>
            </div>
          </div>
          {field("location", "LOCATION", "US East (Virginia)")}
          {field("country", "COUNTRY", "US")}
          {field("psk", "PRE-SHARED KEY (relay auth)", "", "password")}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm font-mono border border-border rounded hover:bg-muted">Cancel</button>
          <button onClick={submit} disabled={create.isPending}
            className="px-4 py-1.5 text-sm font-mono bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50">
            {create.isPending ? "Adding..." : "Register Node"}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_ICON: Record<string, React.FC<any>> = {
  active: Wifi,
  inactive: WifiOff,
  maintenance: Activity,
};

export default function Nodes() {
  const { data: nodes, isLoading } = useListHoneypotNodes();
  const qc = useQueryClient();
  const deleteFn = useDeleteHoneypotNode();
  const updateFn = useUpdateHoneypotNode();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);

  const del = async (id: number, name: string) => {
    if (!confirm(`Remove node "${name}"?`)) return;
    await deleteFn.mutateAsync({ id });
    await qc.invalidateQueries({ queryKey: getListHoneypotNodesQueryKey() });
    toast({ title: "Node removed" });
  };

  const toggleStatus = async (id: number, current: string) => {
    const next = current === "active" ? "inactive" : "active";
    await updateFn.mutateAsync({ id, data: { status: next } });
    await qc.invalidateQueries({ queryKey: getListHoneypotNodesQueryKey() });
  };

  return (
    <div className="p-6 space-y-5">
      {showAdd && <AddNodeModal onClose={() => setShowAdd(false)} />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold font-mono">Honeypot Nodes</h1>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-mono bg-primary text-primary-foreground rounded hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Node
        </button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm font-mono animate-pulse">Loading nodes...</div>
      ) : !nodes?.length ? (
        <div className="border border-dashed border-border rounded-lg py-16 flex flex-col items-center gap-3">
          <Server className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground font-mono">No honeypot nodes registered.</p>
          <p className="text-xs text-muted-foreground/60">Deploy a Cowrie/Dionaea instance and register it here.</p>
          <button onClick={() => setShowAdd(true)}
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-primary text-primary-foreground rounded hover:opacity-90">
            <Plus className="w-3 h-3" /> Register First Node
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {nodes.map((node: any) => {
            const StatusIcon = STATUS_ICON[node.status] ?? WifiOff;
            const isActive = node.status === "active";
            return (
              <div key={node.id} className="border border-border rounded-lg p-4 bg-card flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={cn("p-2 rounded mt-0.5", isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                    <StatusIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-foreground">{node.name}</span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-mono",
                        isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                        {node.status.toUpperCase()}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-accent/10 text-accent">
                        {node.protocol.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {node.host}:{node.port}
                      {node.location && <span className="ml-2">• {node.location}</span>}
                    </div>
                    <div className="flex gap-4 mt-2 text-xs font-mono">
                      <span className="text-primary">{node.totalSessions} sessions</span>
                      <span className="text-muted-foreground">{node.totalAttackers} attackers</span>
                      {node.lastSeenAt && (
                        <span className="text-muted-foreground">last: {new Date(node.lastSeenAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleStatus(node.id, node.status)}
                    className={cn("p-1.5 rounded hover:opacity-80", isActive ? "text-primary" : "text-muted-foreground")}
                    title={isActive ? "Deactivate" : "Activate"}
                  >
                    {isActive ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </button>
                  <button onClick={() => del(node.id, node.name)} className="p-1.5 rounded text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deploy instructions */}
      <div className="border border-border rounded-lg p-4 bg-card/50 space-y-2">
        <p className="text-xs font-mono font-bold text-primary">QUICK DEPLOY</p>
        <p className="text-xs text-muted-foreground font-mono">
          Run on your honeypot server to start capturing attacks:
        </p>
        <pre className="text-xs bg-background border border-border rounded p-3 overflow-x-auto text-primary/80 font-mono">{`# Clone and start the honeypot stack
git clone https://github.com/proxhqvpn/honeypot-stack
cd honeypot-stack
export PROXHQ_API_URL=https://your-app.replit.app
export HONEYPOT_PSK=<generate-with-openssl-rand-hex-32>
export HONEYPOT_NODE_NAME=hpnode-<location>
docker compose up -d`}</pre>
      </div>
    </div>
  );
}
