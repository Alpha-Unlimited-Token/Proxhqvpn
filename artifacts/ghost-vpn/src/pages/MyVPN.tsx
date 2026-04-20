import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Download, Key, Plus, Trash2, Wifi, AlertCircle, CheckCircle, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { useListNodes } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    credentials: "include",
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${r.status}`);
  }
  return r.json();
}

type WgConfig = {
  id: number;
  userId: string;
  nodeId: number;
  clientPrivateKey: string;
  clientPublicKey: string;
  assignedIp: string;
  createdAt: string;
  revokedAt: string | null;
  node: {
    id: number;
    name: string;
    region: string;
    publicIp: string | null;
    listenPort: number;
    publicKey: string;
    status: string;
  } | null;
};

function ConfigCard({ cfg, onRevoke }: { cfg: WgConfig; onRevoke: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const node = cfg.node;
  const endpoint = node?.publicIp ? `${node.publicIp}:${node.listenPort}` : "SERVER_IP_NOT_SET";
  const confText = `[Interface]
PrivateKey = ${cfg.clientPrivateKey}
Address = ${cfg.assignedIp}/24
DNS = 1.1.1.1, 1.0.0.1

[Peer]
PublicKey = ${node?.publicKey ?? "PEER_KEY"}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${endpoint}
PersistentKeepalive = 25`;

  const copy = () => {
    navigator.clipboard.writeText(confText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const filename = `proxhqvpn-${node?.region ?? "server"}-${cfg.assignedIp.replace(/\./g, "-")}.conf`;
    const blob = new Blob([confText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-primary/20 bg-black">
      <div className="flex items-center gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-primary/60" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
              {node?.name ?? `Node #${cfg.nodeId}`}
            </span>
            {node?.status === "active" ? (
              <span className="text-[8px] bg-green-900/20 border border-green-500/30 text-green-400 px-1.5 py-0.5">ACTIVE</span>
            ) : (
              <span className="text-[8px] border border-yellow-500/30 text-yellow-400 px-1.5 py-0.5">OFFLINE</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-[8px] text-primary/40 font-mono">
            <span>Client IP: <span className="text-primary/70">{cfg.assignedIp}/24</span></span>
            <span>Server: <span className="text-primary/70">{node?.publicIp ?? "IP not configured"}</span></span>
            <span>Region: <span className="text-primary/70">{node?.region ?? "—"}</span></span>
          </div>
          <div className="mt-0.5 text-[7px] text-primary/25 font-mono">
            Created {new Date(cfg.createdAt).toLocaleDateString()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            className="flex items-center gap-1.5 text-[8px] uppercase tracking-widest border border-primary/20 hover:border-primary/50 px-2.5 py-1.5 text-primary/60 hover:text-primary transition-colors"
          >
            {copied ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "COPIED" : "COPY"}
          </button>
          <button
            onClick={download}
            className="flex items-center gap-1.5 text-[8px] uppercase tracking-widest bg-primary text-black hover:bg-primary/80 px-2.5 py-1.5 transition-colors"
          >
            <Download className="w-3 h-3" />
            DOWNLOAD
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 border border-primary/15 hover:border-primary/40 text-primary/40 hover:text-primary transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-primary/15 p-4 space-y-3">
          <div className="text-[8px] text-primary/30 uppercase tracking-widest mb-1">WireGuard Config File</div>
          <pre className="text-[8px] font-mono text-primary/70 leading-relaxed bg-primary/5 border border-primary/10 p-3 overflow-x-auto whitespace-pre">
            {confText}
          </pre>

          {!node?.publicIp && (
            <div className="flex items-start gap-2 border border-yellow-500/30 bg-yellow-900/10 p-3">
              <AlertCircle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
              <span className="text-[8px] text-yellow-400">
                This node's public IP hasn't been set yet. Ask your admin to configure the server's public IP in Node Manager.
              </span>
            </div>
          )}

          <div className="border-t border-primary/10 pt-3">
            <button
              onClick={() => onRevoke(cfg.id)}
              className="flex items-center gap-1.5 text-[8px] uppercase tracking-widest text-red-400/60 hover:text-red-400 border border-red-500/15 hover:border-red-500/40 px-2.5 py-1.5 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              REVOKE THIS CONFIG
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyVPN() {
  const { user } = useUser();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [generating, setGenerating] = useState<number | null>(null);

  const { data: myConfigs, isLoading } = useQuery<{ configs: WgConfig[]; hasConfig: boolean }>({
    queryKey: ["my-wg-configs"],
    queryFn: () => apiFetch("/api/wireguard/my-config"),
    enabled: !!user,
  });

  const { data: nodesData } = useListNodes();
  const activeNodes = (nodesData?.nodes ?? []).filter((n: any) => n.status === "active");

  const revokeMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/wireguard/my-config/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-wg-configs"] });
      toast({ title: "Config revoked", description: "Your VPN config has been deactivated." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const generateMutation = useMutation({
    mutationFn: (nodeId: number) =>
      apiFetch("/api/wireguard/my-config", { method: "POST", body: JSON.stringify({ nodeId }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-wg-configs"] });
      toast({ title: "Config generated", description: "Your WireGuard config is ready to download." });
      setGenerating(null);
    },
    onError: (e: Error) => {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
      setGenerating(null);
    },
  });

  const handleGenerate = (nodeId: number) => {
    setGenerating(nodeId);
    generateMutation.mutate(nodeId);
  };

  const configuredNodeIds = new Set((myConfigs?.configs ?? []).map((c) => c.nodeId));

  return (
    <div className="space-y-6 font-mono max-w-3xl">
      <div>
        <h1 className="text-lg font-bold tracking-widest uppercase text-primary flex items-center gap-2">
          <Key className="w-5 h-5" />
          My VPN Configs
        </h1>
        <p className="text-[9px] text-primary/40 mt-0.5">
          Generate a personal WireGuard config for each server. Each config uses unique keys tied to your account.
        </p>
      </div>

      {isLoading && (
        <div className="text-[9px] text-primary/40 animate-pulse">Loading your configs...</div>
      )}

      {!isLoading && (myConfigs?.configs ?? []).length > 0 && (
        <div className="space-y-2">
          <div className="text-[9px] tracking-[0.2em] text-primary/30 uppercase">Your Active Configs</div>
          {myConfigs!.configs.map((cfg) => (
            <ConfigCard key={cfg.id} cfg={cfg} onRevoke={(id) => revokeMutation.mutate(id)} />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-[9px] tracking-[0.2em] text-primary/30 uppercase">Generate Config for a Server</div>
        {activeNodes.length === 0 ? (
          <div className="border border-primary/15 p-6 text-center text-[9px] text-primary/30">
            No active nodes found. Add a VPN server in Node Manager first.
          </div>
        ) : (
          <div className="space-y-1">
            {activeNodes.map((node: any) => {
              const hasConfig = configuredNodeIds.has(node.id);
              return (
                <div key={node.id} className="flex items-center gap-3 border border-primary/15 hover:border-primary/30 p-3 transition-colors">
                  <div className="flex-1">
                    <div className="text-[10px] font-bold text-primary">{node.name}</div>
                    <div className="text-[8px] text-primary/40 mt-0.5">
                      {node.region} · {node.publicIp ?? "Public IP not set"}
                    </div>
                  </div>
                  {hasConfig ? (
                    <span className="text-[8px] text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Config Active
                    </span>
                  ) : (
                    <button
                      onClick={() => handleGenerate(node.id)}
                      disabled={generating === node.id}
                      className="flex items-center gap-1.5 text-[8px] uppercase tracking-widest bg-primary text-black hover:bg-primary/80 px-3 py-1.5 transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-3 h-3" />
                      {generating === node.id ? "GENERATING..." : "GENERATE"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border border-primary/10 bg-primary/5 p-4 space-y-2">
        <div className="text-[9px] font-bold text-primary uppercase tracking-widest">How to connect</div>
        <ol className="text-[8px] text-primary/50 space-y-1 list-decimal list-inside">
          <li>Click GENERATE next to your preferred server</li>
          <li>Click DOWNLOAD to save the .conf file</li>
          <li>Open WireGuard on your device (iOS, Android, Windows, macOS, Linux)</li>
          <li>Import the .conf file and activate the tunnel</li>
          <li>Your traffic is now routed through ProxhqVPN</li>
        </ol>
      </div>
    </div>
  );
}
