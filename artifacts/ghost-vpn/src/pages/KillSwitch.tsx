import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Shield, ShieldOff, Power, AlertTriangle, Zap, ShieldCheck, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface KsState {
  enabled: boolean;
  mode: "hard" | "soft";
  allowedInterfaces: string[];
  autoTriggerOnDrop: boolean;
  blockedOutboundWhenVpnDown: boolean;
  lastTriggeredAt: string | null;
  triggerCount: number;
  platform: string;
  safeIps: string[];
}

export default function KillSwitch() {
  const { toast } = useToast();
  const [state, setState] = useState<KsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [safeIp, setSafeIp] = useState<string | null>(null);
  const [ipLoading, setIpLoading] = useState(true);

  useEffect(() => {
    setIpLoading(true);
    fetch(`${BASE}/api/my-ip`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.ip && d.ip !== "unknown") setSafeIp(d.ip); })
      .catch(() => {})
      .finally(() => setIpLoading(false));
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/killswitch/status`, { credentials: "include" });
      const d = await r.json();
      setState(d);
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchState(); }, [fetchState]);

  const toggle = async () => {
    if (!state) return;
    setToggling(true);
    try {
      const endpoint = state.enabled ? "disable" : "enable";
      const body: Record<string, unknown> = {
        mode: state.mode,
        allowedInterfaces: state.allowedInterfaces,
      };
      if (!state.enabled && safeIp) {
        body.safeIps = [safeIp];
      }
      const r = await fetch(`${BASE}/api/killswitch/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      setState(d);
      toast({
        title: d.enabled ? "Kill Switch ARMED" : "Kill Switch Disarmed",
        description: d.enabled
          ? `All non-VPN traffic blocked. Safe IP ${safeIp ?? "unknown"} whitelisted.`
          : "Normal routing restored. VPN protection only.",
        variant: d.enabled ? "default" : "destructive",
      });
    } finally { setToggling(false); }
  };

  const patchConfig = async (field: Partial<KsState>) => {
    const r = await fetch(`${BASE}/api/killswitch/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(field),
    });
    const d = await r.json();
    setState(d);
  };

  const downloadRules = async (platform: string) => {
    const params = new URLSearchParams({ platform });
    if (safeIp) params.set("safeIps", safeIp);
    const r = await fetch(`${BASE}/api/killswitch/generate-rules?${params}`, { credentials: "include" });
    const d = await r.json();
    const ext = platform === "darwin" ? "conf" : platform === "win32" ? "ps1" : "sh";
    const blob = new Blob([d.enable], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proxhqvpn_killswitch_${platform}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Rules downloaded", description: `Kill switch script for ${d.platform} saved.` });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-primary/40 font-mono text-sm">
        LOADING KILL SWITCH STATUS...
      </div>
    );
  }

  const isArmed = state?.enabled ?? false;
  const allSafeIps = Array.from(new Set([...(state?.safeIps ?? []), ...(safeIp ? [safeIp] : [])]));

  return (
    <div className="flex flex-col gap-4 pb-8">

      {/* Safe IP badge */}
      {!ipLoading && safeIp && (
        <div className="border border-primary/20 bg-primary/[0.04] rounded-sm px-3 py-2.5 flex items-center gap-3 text-xs font-mono">
          <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-primary/80">SAFE IP AUTO-DETECTED: </span>
            <span className="text-primary font-bold">{safeIp}</span>
            <span className="text-primary/40 ml-2">— whitelisted in all generated rules</span>
          </div>
        </div>
      )}

      <div className="border border-primary/10 bg-black/20 rounded-sm px-3 py-2.5 flex items-center justify-between flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
            {isArmed ? <Shield className="w-5 h-5 text-green-400" /> : <ShieldOff className="w-5 h-5 text-red-400" />}
            Kill Switch
          </h2>
          <Badge
            variant="outline"
            className={isArmed ? "text-green-400 border-green-400/50 font-mono text-xs" : "text-red-400 border-red-400/50 font-mono text-xs"}
          >
            {isArmed ? "ARMED" : "DISARMED"}
          </Badge>
          <Badge variant="outline" className="text-primary/50 border-primary/20 font-mono text-xs">
            {state?.mode?.toUpperCase()} MODE
          </Badge>
        </div>
        <Button
          onClick={toggle}
          disabled={toggling}
          className={isArmed
            ? "bg-red-900/30 border border-red-500/50 text-red-400 hover:bg-red-900/50 font-mono text-xs"
            : "bg-green-900/30 border border-green-500/50 text-green-400 hover:bg-green-900/50 font-mono text-xs"}
          variant="outline"
        >
          <Power className="w-3 h-3 mr-1.5" />
          {toggling ? "SWITCHING..." : isArmed ? "DISARM" : "ARM KILL SWITCH"}
        </Button>
      </div>

      {isArmed && (
        <div className="border border-green-500/30 bg-green-900/10 rounded-sm px-4 py-3 flex items-center gap-3 text-xs font-mono text-green-400">
          <Zap className="w-4 h-4 flex-shrink-0" />
          <div className="min-w-0">
            <span>KILL SWITCH ARMED — All internet blocked if VPN drops. VPN interfaces [{state?.allowedInterfaces?.join(", ")}] allowed.</span>
            {allSafeIps.length > 0 && (
              <span> Safe IPs: [{allSafeIps.join(", ")}].</span>
            )}
          </div>
        </div>
      )}

      {!isArmed && (
        <div className="border border-yellow-500/30 bg-yellow-900/10 rounded-sm px-4 py-3 flex items-center gap-3 text-xs font-mono text-yellow-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Kill switch is DISARMED. If the VPN drops, your real IP may be exposed to network observers.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-black border-primary/20">
          <CardContent className="p-4 space-y-4">
            <div className="text-xs font-mono uppercase tracking-widest text-primary/50 pb-2 border-b border-primary/10">
              Configuration
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-xs font-mono text-primary">Auto-trigger on VPN drop</p>
                <p className="text-[10px] font-mono text-primary/40 mt-0.5">Activates automatically if WireGuard/TUN interface goes down</p>
              </div>
              <Switch
                checked={state?.autoTriggerOnDrop ?? true}
                onCheckedChange={(v) => patchConfig({ autoTriggerOnDrop: v })}
              />
            </div>

            <div className="flex items-center justify-between py-2 border-t border-primary/10">
              <div>
                <p className="text-xs font-mono text-primary">Block outbound when VPN down</p>
                <p className="text-[10px] font-mono text-primary/40 mt-0.5">Drop all packets if no VPN interface is active</p>
              </div>
              <Switch
                checked={state?.blockedOutboundWhenVpnDown ?? true}
                onCheckedChange={(v) => patchConfig({ blockedOutboundWhenVpnDown: v })}
              />
            </div>

            <div className="flex items-center justify-between py-2 border-t border-primary/10">
              <div>
                <p className="text-xs font-mono text-primary">Mode</p>
                <p className="text-[10px] font-mono text-primary/40 mt-0.5">Hard = drop all | Soft = allow LAN/DHCP</p>
              </div>
              <div className="flex border border-primary/20 text-[10px] font-mono">
                {(["hard", "soft"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => patchConfig({ mode: m })}
                    className={`px-3 py-1 uppercase ${state?.mode === m ? "bg-primary text-black" : "text-primary/60 hover:text-primary hover:bg-primary/10"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-primary/10 pt-3 text-[10px] font-mono text-primary/40 space-y-1">
              <div className="flex justify-between">
                <span>TRIGGER COUNT</span>
                <span className="text-primary">{state?.triggerCount ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>LAST TRIGGERED</span>
                <span className="text-primary">{state?.lastTriggeredAt ? new Date(state.lastTriggeredAt).toLocaleTimeString() : "never"}</span>
              </div>
              <div className="flex justify-between">
                <span>PLATFORM</span>
                <span className="text-primary">{state?.platform ?? "unknown"}</span>
              </div>
              <div className="flex justify-between">
                <span>ALLOWED IFACES</span>
                <span className="text-primary">{state?.allowedInterfaces?.join(", ") ?? "tun0, wg0"}</span>
              </div>
              {allSafeIps.length > 0 && (
                <div className="flex justify-between">
                  <span>SAFE IPS</span>
                  <span className="text-primary">{allSafeIps.join(", ")}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="pb-2 border-b border-primary/10">
              <span className="text-xs font-mono uppercase tracking-widest text-primary/50">Download Rules</span>
            </div>
            <p className="text-[10px] font-mono text-primary/40 leading-relaxed">
              Download a platform-specific kill switch script pre-configured with your safe IP baked in. Apply to any device.
            </p>
            <div className="space-y-2">
              {[
                { label: "Linux / Raspberry Pi / VPS", platform: "linux" },
                { label: "macOS / Mac", platform: "darwin" },
                { label: "Windows (PowerShell)", platform: "win32" },
              ].map(({ label, platform }) => (
                <button
                  key={platform}
                  onClick={() => downloadRules(platform)}
                  className="w-full flex items-center gap-2 px-3 py-2 border border-primary/20 text-[10px] font-mono text-primary/60 hover:text-primary hover:border-primary/40 hover:bg-primary/[0.04] rounded-sm transition-all"
                >
                  <Download className="w-3 h-3 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </div>
            <div className="pt-1 space-y-2 text-[10px] font-mono text-primary/50 leading-relaxed">
              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  ["ARMED", "All traffic blocked unless it goes through the VPN tunnel"],
                  ["DISARMED", "Normal routing — VPN protection still active"],
                  ["AUTO-TRIGGER", "Fires automatically if the WireGuard interface drops"],
                  ["HARD MODE", "Drops all packets — LAN/DHCP also blocked"],
                ].map(([label, desc]) => (
                  <div key={label} className="border border-primary/10 p-2 space-y-0.5">
                    <div className="text-primary/70 uppercase">{label}</div>
                    <div className="text-primary/30">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
