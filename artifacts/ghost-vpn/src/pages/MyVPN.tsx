import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Download, Shield, CheckCircle, ChevronDown, ChevronUp, RefreshCw, Smartphone, Apple, Monitor } from "lucide-react";
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

const PLATFORMS = [
  { label: "iOS", icon: Smartphone, url: "https://apps.apple.com/app/wireguard/id1441195209" },
  { label: "Android", icon: Smartphone, url: "https://play.google.com/store/apps/details?id=com.wireguard.android" },
  { label: "macOS", icon: Apple, url: "https://apps.apple.com/app/wireguard/id1451685025" },
  { label: "Windows", icon: Monitor, url: "https://download.wireguard.com/windows-client/wireguard-installer.exe" },
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
  const hasConfig = !!activeConfig;

  const bestNode = activeNodes[0] as any;
  const targetNodeId = selectedNodeId ?? bestNode?.id ?? null;
  const targetNode = (activeNodes.find((n: any) => n.id === targetNodeId) ?? bestNode) as any;
  const configNode = activeConfig?.node;
  const displayNode = configNode ?? targetNode;

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
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isWorking = generateMutation.isPending || revokeMutation.isPending;

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
    if (activeConfig) await revokeMutation.mutateAsync(activeConfig.id);
    generateMutation.mutate(targetNodeId);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 py-2">

      {/* Main connection card — ExpressVPN-style */}
      <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl overflow-hidden">

        {/* Status header */}
        <div className={`px-8 pt-10 pb-8 flex flex-col items-center text-center transition-colors ${
          hasConfig ? "bg-gradient-to-b from-primary/[0.08] to-transparent" : "bg-gradient-to-b from-white/[0.02] to-transparent"
        }`}>
          {/* Big status ring */}
          <div className={`relative w-28 h-28 mb-6 ${isWorking ? "animate-pulse" : ""}`}>
            {/* Outer glow ring */}
            <div className={`absolute inset-0 rounded-full transition-all duration-700 ${
              hasConfig
                ? "shadow-[0_0_40px_rgba(0,255,136,0.25)] bg-primary/10 border-2 border-primary/40"
                : "border-2 border-white/10 bg-white/[0.03]"
            }`} />
            {/* Icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              {isWorking ? (
                <RefreshCw className="w-10 h-10 text-primary animate-spin" />
              ) : hasConfig ? (
                <Shield className="w-12 h-12 text-primary drop-shadow-[0_0_12px_rgba(0,255,136,0.6)]" />
              ) : (
                <Shield className="w-12 h-12 text-white/20" />
              )}
            </div>
          </div>

          {/* Status text */}
          <div className={`text-2xl font-bold tracking-tight mb-1 ${hasConfig ? "text-primary" : "text-white/40"}`}>
            {isLoading ? "Checking..." : hasConfig ? "Protected" : "Not Protected"}
          </div>
          <div className="text-sm text-white/40">
            {hasConfig
              ? `Connected via ${configNode?.name ?? "your server"} · ${configNode?.region ?? ""}`
              : activeNodes.length > 0
                ? "Click below to set up your VPN"
                : "No active servers — contact admin"
            }
          </div>
        </div>

        {/* Server picker */}
        {activeNodes.length > 1 && !isLoading && (
          <div className="px-6 pb-2">
            <div className="flex items-center gap-3 bg-white/[0.04] rounded-xl px-4 py-3 border border-white/[0.06]">
              <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <select
                value={targetNodeId ?? ""}
                onChange={(e) => setSelectedNodeId(Number(e.target.value))}
                className="flex-1 bg-transparent text-sm text-white/80 focus:outline-none cursor-pointer"
              >
                {activeNodes.map((n: any) => (
                  <option key={n.id} value={n.id} className="bg-[#0d1610]">
                    {n.name} — {n.region}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeNodes.length === 1 && !isLoading && (
          <div className="px-6 pb-2">
            <div className="flex items-center gap-3 bg-white/[0.04] rounded-xl px-4 py-3 border border-white/[0.06]">
              <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <span className="text-sm text-white/70">{activeNodes[0]?.name} — {(activeNodes[0] as any)?.region}</span>
            </div>
          </div>
        )}

        {/* Action button */}
        <div className="px-6 pb-6 pt-3">
          <button
            onClick={handleConnect}
            disabled={isWorking || activeNodes.length === 0 || isLoading}
            className={`w-full py-4 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-all duration-200 disabled:opacity-40 ${
              hasConfig
                ? "bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25"
                : "bg-primary text-black hover:brightness-110 shadow-[0_0_30px_rgba(0,255,136,0.25)]"
            }`}
          >
            {isWorking ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Setting up...</>
            ) : hasConfig ? (
              <><Download className="w-4 h-4" /> Download Config</>
            ) : (
              <><Shield className="w-4 h-4" /> Connect Now</>
            )}
          </button>

          {hasConfig && targetNodeId && targetNodeId !== activeConfig?.nodeId && (
            <button
              onClick={handleSwitch}
              disabled={isWorking}
              className="w-full mt-2 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
            >
              Switch to {targetNode?.name} and get new config
            </button>
          )}
        </div>
      </div>

      {/* Download apps */}
      <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-6">
        <div className="text-sm font-semibold text-white/60 mb-4">Get the WireGuard App</div>
        <div className="grid grid-cols-4 gap-2">
          {PLATFORMS.map(({ label, icon: Icon, url }) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:border-primary/20 transition-all group"
            >
              <Icon className="w-5 h-5 text-white/40 group-hover:text-primary/70 transition-colors" />
              <span className="text-[11px] text-white/40 group-hover:text-white/70 font-medium">{label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* How to connect */}
      <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-6">
        <div className="text-sm font-semibold text-white/60 mb-4">How to Connect</div>
        <div className="space-y-4">
          {[
            { n: "1", title: "Install WireGuard", body: "Download the free WireGuard app from the links above for your device." },
            { n: "2", title: "Download your config", body: "Click Connect Now above. Your unique VPN config file will download automatically." },
            { n: "3", title: "Import & connect", body: 'In WireGuard, tap "+" → "Import from file". Select your .conf file, then toggle the switch to connect.' },
          ].map((step) => (
            <div key={step.n} className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">{step.n}</span>
              </div>
              <div className="pt-0.5">
                <div className="text-sm font-medium text-white/80 mb-0.5">{step.title}</div>
                <div className="text-sm text-white/40 leading-relaxed">{step.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced */}
      {hasConfig && (
        <div>
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-2 text-sm text-white/30 hover:text-white/50 transition-colors"
          >
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Advanced options
          </button>
          {showAdvanced && (
            <div className="mt-3 bg-[#0d1610] border border-white/[0.07] rounded-2xl p-5 space-y-3">
              <p className="text-sm text-white/40 leading-relaxed">
                If your device is lost or you suspect your config is compromised, revoke it here. You can generate a new one on your next visit.
              </p>
              <button
                onClick={() => revokeMutation.mutate(activeConfig!.id)}
                disabled={revokeMutation.isPending}
                className="text-sm text-red-400/60 hover:text-red-400 border border-red-500/20 hover:border-red-500/50 rounded-xl px-4 py-2 transition-all"
              >
                Revoke Config (invalidates current key)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
