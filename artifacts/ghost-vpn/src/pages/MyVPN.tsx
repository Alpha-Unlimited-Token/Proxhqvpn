import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Download, Shield, CheckCircle, ChevronDown, ChevronUp, RefreshCw, Wifi, WifiOff } from "lucide-react";
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

function buildConfText(cfg: WgConfig): string {
  const node = cfg.node;
  const endpoint = node?.publicIp ? `${node.publicIp}:${node.listenPort}` : "SERVER_IP_NOT_SET";
  return `[Interface]
PrivateKey = ${cfg.clientPrivateKey}
Address = ${cfg.assignedIp}/24
DNS = 1.1.1.1, 1.0.0.1

[Peer]
PublicKey = ${node?.publicKey ?? "PEER_KEY"}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${endpoint}
PersistentKeepalive = 25`;
}

function downloadConf(cfg: WgConfig) {
  const node = cfg.node;
  const filename = `proxhqvpn-${(node?.region ?? "server").toLowerCase().replace(/\s+/g, "-")}.conf`;
  const blob = new Blob([buildConfText(cfg)], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STEPS = [
  {
    num: "1",
    title: "Install WireGuard",
    desc: "Download the free WireGuard app for your device.",
    links: [
      { label: "iOS", url: "https://apps.apple.com/app/wireguard/id1441195209" },
      { label: "Android", url: "https://play.google.com/store/apps/details?id=com.wireguard.android" },
      { label: "Windows", url: "https://download.wireguard.com/windows-client/wireguard-installer.exe" },
      { label: "macOS", url: "https://apps.apple.com/app/wireguard/id1451685025" },
    ],
  },
  {
    num: "2",
    title: "Download your config",
    desc: "Click the button above to download your personal VPN config file.",
  },
  {
    num: "3",
    title: "Import & connect",
    desc: 'In WireGuard, tap "+" → "Import from file" and select your .conf file. Toggle the switch to connect.',
  },
];

export default function Connect() {
  const { user } = useUser();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  const { data: myConfigs, isLoading } = useQuery<{ configs: WgConfig[]; hasConfig: boolean }>({
    queryKey: ["my-wg-configs"],
    queryFn: () => apiFetch("/api/wireguard/my-config"),
    enabled: !!user,
  });

  const { data: nodesData } = useListNodes();
  const activeNodes = (nodesData?.nodes ?? []).filter((n: any) => n.status === "active");

  const activeConfig = (myConfigs?.configs ?? []).find((c) => !c.revokedAt) ?? null;

  const generateMutation = useMutation({
    mutationFn: (nodeId: number) =>
      apiFetch("/api/wireguard/my-config", { method: "POST", body: JSON.stringify({ nodeId }) }),
    onSuccess: (data: WgConfig) => {
      qc.invalidateQueries({ queryKey: ["my-wg-configs"] });
      downloadConf(data);
    },
    onError: (e: Error) => {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/wireguard/my-config/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-wg-configs"] });
      toast({ title: "Config revoked", description: "Generating a new one now..." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const bestNode = activeNodes[0] as any;
  const targetNodeId = selectedNodeId ?? bestNode?.id ?? null;
  const targetNode = activeNodes.find((n: any) => n.id === targetNodeId) as any ?? bestNode;

  const handleConnect = () => {
    if (!targetNodeId) {
      toast({ title: "No servers available", description: "No active VPN servers found.", variant: "destructive" });
      return;
    }
    if (activeConfig) {
      downloadConf(activeConfig);
    } else {
      generateMutation.mutate(targetNodeId);
    }
  };

  const handleSwitch = async () => {
    if (!targetNodeId) return;
    if (activeConfig) {
      await revokeMutation.mutateAsync(activeConfig.id);
    }
    generateMutation.mutate(targetNodeId);
  };

  const isWorking = generateMutation.isPending || revokeMutation.isPending;
  const hasConfig = !!activeConfig;
  const configNode = activeConfig?.node;

  return (
    <div className="max-w-xl mx-auto space-y-8 font-mono py-4">

      {/* Header */}
      <div className="text-center space-y-1">
        <div className="flex justify-center mb-3">
          <div className={`w-16 h-16 border-2 flex items-center justify-center transition-colors ${
            hasConfig ? "border-green-500/60 bg-green-900/10" : "border-primary/30 bg-primary/5"
          }`}>
            {hasConfig
              ? <Wifi className="w-8 h-8 text-green-400" />
              : <WifiOff className="w-8 h-8 text-primary/40" />
            }
          </div>
        </div>
        <h1 className="text-sm font-bold tracking-[0.3em] uppercase text-primary">
          {hasConfig ? "You're Connected" : "Get Connected"}
        </h1>
        <p className="text-[9px] text-primary/40 tracking-widest">
          {hasConfig
            ? `Active on ${configNode?.name ?? "server"} · ${configNode?.region ?? ""}`
            : "One click to download your personal VPN config"
          }
        </p>
      </div>

      {/* Main action */}
      {isLoading ? (
        <div className="border border-primary/15 p-8 text-center">
          <div className="text-[9px] text-primary/30 animate-pulse tracking-widest">LOADING...</div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Server selector (simple) */}
          {activeNodes.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-primary/30 uppercase tracking-widest shrink-0">Server</span>
              <select
                value={targetNodeId ?? ""}
                onChange={(e) => setSelectedNodeId(Number(e.target.value))}
                className="flex-1 bg-black border border-primary/20 text-primary/70 text-[9px] font-mono px-2 py-1.5 focus:outline-none focus:border-primary/50"
              >
                {activeNodes.map((n: any) => (
                  <option key={n.id} value={n.id}>
                    {n.name} — {n.region}
                    {n === bestNode ? " (Recommended)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeNodes.length === 0 && (
            <div className="border border-yellow-500/20 bg-yellow-900/10 p-4 text-center">
              <p className="text-[9px] text-yellow-400 tracking-widest">No active VPN servers available right now.</p>
            </div>
          )}

          {/* Big connect button */}
          <button
            onClick={handleConnect}
            disabled={isWorking || activeNodes.length === 0}
            className="w-full py-4 bg-primary text-black font-bold text-xs tracking-[0.3em] uppercase hover:bg-primary/85 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {isWorking ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> GENERATING...</>
            ) : hasConfig ? (
              <><Download className="w-4 h-4" /> DOWNLOAD CONFIG</>
            ) : (
              <><Shield className="w-4 h-4" /> CONNECT NOW</>
            )}
          </button>

          {hasConfig && targetNodeId !== activeConfig?.nodeId && (
            <button
              onClick={handleSwitch}
              disabled={isWorking}
              className="w-full py-2 border border-primary/20 text-primary/50 text-[9px] uppercase tracking-widest hover:border-primary/50 hover:text-primary/80 transition-colors disabled:opacity-40"
            >
              Switch to {targetNode?.name ?? "this server"} & Download New Config
            </button>
          )}

          {hasConfig && (
            <div className="flex items-center gap-2 border border-green-500/20 bg-green-900/5 p-3">
              <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
              <span className="text-[8px] text-green-400 tracking-wide">
                Config active — re-download anytime if you need to set up a new device.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Setup steps */}
      <div className="border border-primary/10 divide-y divide-primary/10">
        <div className="px-4 py-2.5 text-[8px] uppercase tracking-[0.3em] text-primary/30">Setup Guide</div>
        {STEPS.map((step) => (
          <div key={step.num} className="flex gap-3 px-4 py-3">
            <div className="w-5 h-5 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[8px] text-primary/50">{step.num}</span>
            </div>
            <div className="space-y-1">
              <div className="text-[9px] font-bold text-primary uppercase tracking-widest">{step.title}</div>
              <div className="text-[8px] text-primary/50 leading-relaxed">{step.desc}</div>
              {step.links && (
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {step.links.map((l) => (
                    <a
                      key={l.label}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[8px] text-primary/60 border border-primary/20 hover:border-primary/50 hover:text-primary px-2 py-0.5 transition-colors"
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Advanced — revoke */}
      {hasConfig && (
        <div>
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-[8px] text-primary/30 hover:text-primary/60 uppercase tracking-widest transition-colors"
          >
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Advanced options
          </button>
          {showAdvanced && (
            <div className="mt-3 border border-primary/10 p-4 space-y-2">
              <p className="text-[8px] text-primary/40">
                If your device is lost or compromised, revoke your current config. A new one can be generated on your next visit.
              </p>
              <button
                onClick={() => revokeMutation.mutate(activeConfig!.id)}
                disabled={revokeMutation.isPending}
                className="text-[8px] uppercase tracking-widest text-red-400/60 hover:text-red-400 border border-red-500/15 hover:border-red-500/40 px-3 py-1.5 transition-colors"
              >
                Revoke Config (Invalidates Current Key)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
