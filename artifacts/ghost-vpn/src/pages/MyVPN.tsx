import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Download, Shield, CheckCircle, ChevronDown, ChevronUp, RefreshCw, Smartphone, Apple, Monitor, Loader2, ShieldCheck } from "lucide-react";
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

type PeerStatus = "pending" | "applied" | "failed" | "unknown";

function buildConfText(cfg: WgConfig, safeIp?: string | null): string {
  const node = cfg.node;
  const endpoint = node?.publicIp ? `${node.publicIp}:${node.listenPort}` : "SERVER_IP_NOT_SET";
  const serverIp = node?.publicIp ?? null;

  const preUp = serverIp
    ? `PostUp = iptables -I OUTPUT -d ${serverIp} -j ACCEPT\nPostDown = iptables -D OUTPUT -d ${serverIp} -j ACCEPT`
    : "";

  const safeIpLine = safeIp
    ? `PostUp = iptables -I OUTPUT -s ${safeIp} -j ACCEPT; iptables -I OUTPUT -d ${safeIp} -j ACCEPT\nPostDown = iptables -D OUTPUT -s ${safeIp} -j ACCEPT; iptables -D OUTPUT -d ${safeIp} -j ACCEPT`
    : "";

  const hooks = [preUp, safeIpLine].filter(Boolean).join("\n");

  return `[Interface]
PrivateKey = ${cfg.clientPrivateKey}
Address = ${cfg.assignedIp}/24
DNS = 1.1.1.1, 1.0.0.1${hooks ? "\n" + hooks : ""}

[Peer]
PublicKey = ${node?.publicKey ?? "PEER_KEY"}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${endpoint}
PersistentKeepalive = 25`;
}

function downloadConf(cfg: WgConfig, safeIp?: string | null) {
  const node = cfg.node;
  const filename = `proxhqvpn-${(node?.region ?? "server").toLowerCase().replace(/\s+/g, "-")}.conf`;
  const blob = new Blob([buildConfText(cfg, safeIp)], { type: "text/plain" });
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
  const [peerStatus, setPeerStatus] = useState<PeerStatus>("unknown");
  const [justConnected, setJustConnected] = useState(false);
  const [myPublicIp, setMyPublicIp] = useState<string | null>(null);
  const [ipLoading, setIpLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setIpLoading(true);
    fetch(`${BASE}/api/my-ip`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.ip && d.ip !== "unknown") setMyPublicIp(d.ip); })
      .catch(() => {})
      .finally(() => setIpLoading(false));
  }, []);

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

  const pollPeerStatus = (configId: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await apiFetch(`/api/wireguard/peer-status/${configId}`);
        setPeerStatus(data.status);
        if (data.status === "applied" || data.status === "failed") {
          clearInterval(pollRef.current!);
          if (data.status === "applied") {
            qc.invalidateQueries({ queryKey: ["my-wg-configs"] });
          }
        }
      } catch {
        // silent
      }
    }, 4000);
  };

  useEffect(() => {
    if (activeConfig && justConnected) {
      setPeerStatus("pending");
      pollPeerStatus(activeConfig.id);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeConfig?.id, justConnected]);

  const generateMutation = useMutation({
    mutationFn: (nodeId: number) =>
      apiFetch("/api/wireguard/my-config", { method: "POST", body: JSON.stringify({ nodeId }) }),
    onSuccess: (data: WgConfig) => {
      setJustConnected(true);
      setPeerStatus("pending");
      qc.invalidateQueries({ queryKey: ["my-wg-configs"] });
      pollPeerStatus(data.id);
    },
    onError: (e: Error) => {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/wireguard/my-config/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setPeerStatus("unknown");
      setJustConnected(false);
      qc.invalidateQueries({ queryKey: ["my-wg-configs"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isWorking = generateMutation.isPending || revokeMutation.isPending;
  const isRegistering = peerStatus === "pending" && hasConfig;
  const tunnelReady = peerStatus === "applied" || (hasConfig && !justConnected);

  const handleConnect = () => {
    if (!targetNodeId) {
      toast({ title: "No servers available", description: "No active VPN servers found.", variant: "destructive" });
      return;
    }
    if (activeConfig) {
      downloadConf(activeConfig, myPublicIp);
    } else {
      generateMutation.mutate(targetNodeId);
    }
  };

  const handleSwitch = async () => {
    if (!targetNodeId) return;
    if (activeConfig) await revokeMutation.mutateAsync(activeConfig.id);
    generateMutation.mutate(targetNodeId);
  };

  const statusLabel = () => {
    if (isLoading) return "Checking...";
    if (isWorking) return "Setting up...";
    if (isRegistering) return "Registering Tunnel...";
    if (tunnelReady) return "Protected";
    return "Not Protected";
  };

  const statusSub = () => {
    if (isRegistering) return "Your key is being registered on the server — this takes up to 30 seconds";
    if (tunnelReady) return `Connected via ${configNode?.name ?? "your server"} · ${configNode?.region ?? ""}`;
    if (activeNodes.length > 0) return "Click below to set up your VPN";
    return "No active servers — contact admin";
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 py-2">

      {/* Safe IP banner */}
      {!ipLoading && myPublicIp && (
        <div className="flex items-center gap-3 bg-primary/[0.06] border border-primary/20 rounded-xl px-4 py-3">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-primary/90">
              Your current IP detected: <span className="font-mono">{myPublicIp}</span>
            </div>
            <div className="text-[11px] text-primary/50 mt-0.5">
              Automatically whitelisted — your device will stay reachable when the VPN is active
            </div>
          </div>
        </div>
      )}

      {/* Main connection card */}
      <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl overflow-hidden">

        {/* Status header */}
        <div className={`px-8 pt-10 pb-8 flex flex-col items-center text-center transition-colors ${
          tunnelReady ? "bg-gradient-to-b from-primary/[0.08] to-transparent" :
          isRegistering ? "bg-gradient-to-b from-yellow-500/[0.05] to-transparent" :
          "bg-gradient-to-b from-white/[0.02] to-transparent"
        }`}>
          {/* Big status ring */}
          <div className={`relative w-28 h-28 mb-6 ${(isWorking || isRegistering) ? "animate-pulse" : ""}`}>
            <div className={`absolute inset-0 rounded-full transition-all duration-700 ${
              tunnelReady
                ? "shadow-[0_0_40px_rgba(0,255,136,0.25)] bg-primary/10 border-2 border-primary/40"
                : isRegistering
                  ? "shadow-[0_0_30px_rgba(255,200,0,0.15)] bg-yellow-500/10 border-2 border-yellow-500/30"
                  : "border-2 border-white/10 bg-white/[0.03]"
            }`} />
            <div className="absolute inset-0 flex items-center justify-center">
              {isWorking ? (
                <RefreshCw className="w-10 h-10 text-primary animate-spin" />
              ) : isRegistering ? (
                <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
              ) : tunnelReady ? (
                <Shield className="w-12 h-12 text-primary drop-shadow-[0_0_12px_rgba(0,255,136,0.6)]" />
              ) : (
                <Shield className="w-12 h-12 text-white/70" />
              )}
            </div>
          </div>

          <div className={`text-2xl font-bold tracking-tight mb-1 ${
            tunnelReady ? "text-primary" : isRegistering ? "text-yellow-400" : "text-white/78"
          }`}>
            {statusLabel()}
          </div>
          <div className="text-sm text-white/78 max-w-xs leading-relaxed">
            {statusSub()}
          </div>

          {/* Registration progress bar */}
          {isRegistering && (
            <div className="mt-4 w-full max-w-xs bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-yellow-400/60 rounded-full animate-[pulse_1.5s_ease-in-out_infinite] w-2/3" />
            </div>
          )}

          {/* Applied confirmation */}
          {peerStatus === "applied" && justConnected && (
            <div className="mt-3 flex items-center gap-2 text-sm text-primary/80">
              <CheckCircle className="w-4 h-4" />
              Tunnel registered — download your config below
            </div>
          )}

          {peerStatus === "failed" && (
            <div className="mt-3 text-sm text-red-400/80">
              Registration failed — please try disconnecting and reconnecting
            </div>
          )}
        </div>

        {/* Server picker */}
        {activeNodes.length > 1 && !isLoading && (
          <div className="px-6 pb-2">
            <div className="flex items-center gap-3 bg-white/[0.04] rounded-xl px-4 py-3 border border-white/[0.06]">
              <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <select
                value={targetNodeId ?? ""}
                onChange={(e) => setSelectedNodeId(Number(e.target.value))}
                className="flex-1 bg-transparent text-sm text-white/93 focus:outline-none cursor-pointer"
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
              <span className="text-sm text-white/88">{activeNodes[0]?.name} — {(activeNodes[0] as any)?.region}</span>
            </div>
          </div>
        )}

        {/* Action button */}
        <div className="px-6 pb-6 pt-3">
          <button
            onClick={handleConnect}
            disabled={isWorking || isRegistering || activeNodes.length === 0 || isLoading}
            className={`w-full py-4 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-all duration-200 disabled:opacity-40 ${
              tunnelReady
                ? "bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25"
                : isRegistering
                  ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 cursor-not-allowed"
                  : "bg-primary text-black hover:brightness-110 shadow-[0_0_30px_rgba(0,255,136,0.25)]"
            }`}
          >
            {isWorking ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Setting up...</>
            ) : isRegistering ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Registering tunnel...</>
            ) : tunnelReady ? (
              <><Download className="w-4 h-4" /> Download Config</>
            ) : (
              <><Shield className="w-4 h-4" /> Connect Now</>
            )}
          </button>

          {hasConfig && targetNodeId && targetNodeId !== activeConfig?.nodeId && !isRegistering && (
            <button
              onClick={handleSwitch}
              disabled={isWorking}
              className="w-full mt-2 py-2.5 rounded-xl text-sm text-white/78 hover:text-white/70 hover:bg-white/5 transition-all"
            >
              Switch to {targetNode?.name} and get new config
            </button>
          )}
        </div>
      </div>

      {/* Download apps */}
      <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-6">
        <div className="text-sm font-semibold text-white/88 mb-4">Get the WireGuard App</div>
        <div className="grid grid-cols-4 gap-2">
          {PLATFORMS.map(({ label, icon: Icon, url }) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:border-primary/20 transition-all group"
            >
              <Icon className="w-5 h-5 text-white/78 group-hover:text-primary/70 transition-colors" />
              <span className="text-[11px] text-white/78 group-hover:text-white/70 font-medium">{label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* How to connect */}
      <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-6">
        <div className="text-sm font-semibold text-white/88 mb-4">How to Connect</div>
        <div className="space-y-4">
          {[
            { n: "1", title: "Install WireGuard", body: "Download the free WireGuard app from the links above for your device." },
            { n: "2", title: "Click Connect Now", body: "Your unique VPN tunnel is automatically registered on the server. Your current IP is detected and whitelisted so the VPN never blocks your own connection." },
            { n: "3", title: "Import & connect", body: 'In WireGuard, tap "+" → "Import from file". Select your .conf file, then toggle the switch to connect.' },
          ].map((step) => (
            <div key={step.n} className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">{step.n}</span>
              </div>
              <div className="pt-0.5">
                <div className="text-sm font-medium text-white/93 mb-0.5">{step.title}</div>
                <div className="text-sm text-white/78 leading-relaxed">{step.body}</div>
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
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white/50 transition-colors"
          >
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Advanced options
          </button>
          {showAdvanced && (
            <div className="mt-3 bg-[#0d1610] border border-white/[0.07] rounded-2xl p-5 space-y-3">
              {myPublicIp && (
                <div className="text-[11px] text-primary/50 font-mono bg-primary/[0.04] border border-primary/10 rounded-lg px-3 py-2">
                  Safe IP in config: <span className="text-primary/80">{myPublicIp}</span> — whitelisted in PostUp rules
                </div>
              )}
              <p className="text-sm text-white/78 leading-relaxed">
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
