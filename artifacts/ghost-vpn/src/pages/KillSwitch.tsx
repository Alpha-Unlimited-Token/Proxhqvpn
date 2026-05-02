// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Shield, ShieldOff, Power, AlertTriangle, Zap,
  ShieldCheck, Download, CheckCircle2, XCircle,
  RefreshCw, Server, Activity,
} from "lucide-react";
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

interface ValidationResult {
  canValidate: boolean;
  ipv4DropPolicy: boolean;
  ipv6DropPolicy: boolean;
  vpnIfaceAllowed: boolean;
  loopbackAllowed: boolean;
  dhcpAllowed: boolean;
  wgPortAllowed: boolean;
  issues: string[];
  recommendations: string[];
  raw: { ipv4?: string; ipv6?: string };
}

function CheckRow({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-primary/10 last:border-0">
      {ok
        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
        : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />}
      <div className="min-w-0">
        <span className={`text-[10px] font-mono ${ok ? "text-green-400" : "text-red-400"}`}>{label}</span>
        {note && <div className="text-[9px] font-mono text-primary/30 mt-0.5">{note}</div>}
      </div>
    </div>
  );
}

export default function KillSwitch() {
  const { toast } = useToast();
  const [state, setState] = useState<KsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [safeIp, setSafeIp] = useState<string | null>(null);
  const [ipLoading, setIpLoading] = useState(true);

  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

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
      if (!state.enabled && safeIp) body.safeIps = [safeIp];
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
    a.href = url; a.download = `proxhqvpn_killswitch_${platform}.${ext}`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Rules downloaded", description: `Kill switch script for ${d.platform} saved.` });
  };

  const downloadSystemd = async () => {
    const params = new URLSearchParams();
    if (safeIp) params.set("safeIps", safeIp);
    const r = await fetch(`${BASE}/api/killswitch/systemd?${params}`, { credentials: "include" });
    const d = await r.json();
    const blob = new Blob([d.installInstructions], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "proxhq-killswitch-systemd-install.sh"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Systemd installer downloaded", description: "Run as root on your Linux VPS to enable kill switch at boot." });
  };

  const downloadWatchdog = async () => {
    const params = new URLSearchParams();
    if (safeIp) params.set("safeIps", safeIp);
    const r = await fetch(`${BASE}/api/killswitch/watchdog?${params}`, { credentials: "include" });
    const d = await r.json();
    const blob = new Blob([d.watchdogScript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "proxhq-watchdog.sh"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Watchdog script downloaded", description: "Auto-reconnects WireGuard and arms kill switch if the tunnel drops." });
  };

  const runValidation = async () => {
    setValidating(true);
    setValidation(null);
    try {
      const r = await fetch(`${BASE}/api/killswitch/validate`, { credentials: "include" });
      const d: ValidationResult = await r.json();
      setValidation(d);
      const allGood = d.ipv4DropPolicy && d.ipv6DropPolicy && d.vpnIfaceAllowed;
      toast({
        title: allGood ? "Kill switch fully active" : d.canValidate ? "Issues found" : "Cannot validate remotely",
        description: allGood
          ? "IPv4 + IPv6 DROP policy confirmed in iptables."
          : d.issues[0] ?? "Check results below.",
        variant: allGood ? "default" : "destructive",
      });
    } catch {
      toast({ title: "Validation failed", description: "Could not reach validation endpoint.", variant: "destructive" });
    } finally { setValidating(false); }
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

  const validationPassed = validation && validation.canValidate
    && validation.ipv4DropPolicy && validation.ipv6DropPolicy && validation.vpnIfaceAllowed;

  return (
    <div className="flex flex-col gap-4 pb-8">

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
          <Badge variant="outline" className={isArmed ? "text-green-400 border-green-400/50 font-mono text-xs" : "text-red-400 border-red-400/50 font-mono text-xs"}>
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
            {allSafeIps.length > 0 && <span> Safe IPs: [{allSafeIps.join(", ")}].</span>}
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
              <Switch checked={state?.autoTriggerOnDrop ?? true} onCheckedChange={(v) => patchConfig({ autoTriggerOnDrop: v })} />
            </div>

            <div className="flex items-center justify-between py-2 border-t border-primary/10">
              <div>
                <p className="text-xs font-mono text-primary">Block outbound when VPN down</p>
                <p className="text-[10px] font-mono text-primary/40 mt-0.5">Drop all packets if no VPN interface is active</p>
              </div>
              <Switch checked={state?.blockedOutboundWhenVpnDown ?? true} onCheckedChange={(v) => patchConfig({ blockedOutboundWhenVpnDown: v })} />
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
              <div className="flex justify-between"><span>TRIGGER COUNT</span><span className="text-primary">{state?.triggerCount ?? 0}</span></div>
              <div className="flex justify-between"><span>LAST TRIGGERED</span><span className="text-primary">{state?.lastTriggeredAt ? new Date(state.lastTriggeredAt).toLocaleTimeString() : "never"}</span></div>
              <div className="flex justify-between"><span>PLATFORM</span><span className="text-primary">{state?.platform ?? "unknown"}</span></div>
              <div className="flex justify-between"><span>ALLOWED IFACES</span><span className="text-primary">{state?.allowedInterfaces?.join(", ") ?? "tun0, wg0"}</span></div>
              {allSafeIps.length > 0 && (
                <div className="flex justify-between"><span>SAFE IPS</span><span className="text-primary">{allSafeIps.join(", ")}</span></div>
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
              Download platform-specific kill switch scripts pre-configured with your safe IP baked in.
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
          </CardContent>
        </Card>
      </div>

      {/* ── Validate Live Rules ───────────────────────────────────────────────── */}
      <Card className="bg-black border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between pb-3 border-b border-primary/10 mb-3">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-primary/50">Live iptables Validation</span>
              <p className="text-[10px] font-mono text-primary/30 mt-0.5">
                Reads real iptables / ip6tables rules from the server to confirm the kill switch is actually enforced — not just configured
              </p>
            </div>
            <Button
              onClick={runValidation}
              disabled={validating}
              variant="outline"
              className="border-primary/20 text-primary/60 hover:text-primary hover:border-primary/40 font-mono text-[10px]"
            >
              {validating ? <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" /> : <Activity className="w-3 h-3 mr-1.5" />}
              {validating ? "CHECKING..." : "VALIDATE NOW"}
            </Button>
          </div>

          {!validation && !validating && (
            <div className="text-[10px] font-mono text-primary/30 text-center py-4">
              Click VALIDATE NOW to check if the kill switch is actually active in iptables
            </div>
          )}

          {validation && (
            <div className="space-y-3">
              {/* Overall verdict */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-sm border text-[10px] font-mono ${
                validationPassed
                  ? "border-green-500/30 bg-green-900/10 text-green-400"
                  : validation.canValidate
                  ? "border-red-500/30 bg-red-900/10 text-red-400"
                  : "border-yellow-500/30 bg-yellow-900/10 text-yellow-400"
              }`}>
                {validationPassed
                  ? <><CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> KILL SWITCH FULLY ACTIVE — IPv4 + IPv6 DROP policy confirmed in iptables</>
                  : validation.canValidate
                  ? <><XCircle className="w-3.5 h-3.5 flex-shrink-0" /> KILL SWITCH NOT FULLY ACTIVE — see issues below</>
                  : <><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Cannot validate remotely — run validation on the Linux VPS where your VPN server runs</>
                }
              </div>

              {validation.canValidate && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[9px] font-mono text-primary/40 uppercase mb-2">Rule Checks</div>
                    <CheckRow label="IPv4 OUTPUT → DROP"  ok={validation.ipv4DropPolicy}  note="iptables -P OUTPUT DROP active" />
                    <CheckRow label="IPv6 OUTPUT → DROP"  ok={validation.ipv6DropPolicy}  note="ip6tables -P OUTPUT DROP active" />
                    <CheckRow label="VPN interface allowed" ok={validation.vpnIfaceAllowed} note={`${state?.allowedInterfaces?.join(", ")} in ACCEPT rules`} />
                    <CheckRow label="Loopback allowed"    ok={validation.loopbackAllowed}  note="lo interface not blocked" />
                    <CheckRow label="DHCP allowed"        ok={validation.dhcpAllowed}      note="UDP port 67 not blocked" />
                    <CheckRow label="WireGuard port"      ok={validation.wgPortAllowed}    note="UDP 51820 handshake allowed" />
                  </div>

                  <div>
                    {validation.issues.length > 0 && (
                      <div className="mb-3">
                        <div className="text-[9px] font-mono text-red-400/60 uppercase mb-2">Issues</div>
                        <div className="space-y-1.5">
                          {validation.issues.map((issue, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[9px] font-mono text-red-400/80">
                              <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                              <span>{issue}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {validation.recommendations.length > 0 && (
                      <div>
                        <div className="text-[9px] font-mono text-primary/40 uppercase mb-2">Recommendations</div>
                        <div className="space-y-1.5">
                          {validation.recommendations.map((rec, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[9px] font-mono text-primary/50">
                              <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5 text-primary/30" />
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Persistence & Watchdog ───────────────────────────────────────────── */}
      <Card className="bg-black border-primary/20">
        <CardContent className="p-4 space-y-3">
          <div className="pb-2 border-b border-primary/10">
            <span className="text-xs font-mono uppercase tracking-widest text-primary/50">Boot Persistence & Auto-Reconnect</span>
            <p className="text-[10px] font-mono text-primary/30 mt-0.5">
              Two scripts that close the enforcement gap — kill switch armed at boot before any network interface comes up, and auto-reconnect if the tunnel drops
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="border border-primary/15 rounded-sm p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-primary/60" />
                <span className="text-[10px] font-mono text-primary/80 uppercase">Systemd Boot Unit</span>
              </div>
              <p className="text-[9px] font-mono text-primary/40 leading-relaxed">
                Installs as a systemd service that runs <code>Before=network-pre.target</code> — kill switch is armed before any network interface comes up, not just when the script is run manually.
              </p>
              <div className="space-y-1 text-[9px] font-mono text-primary/30">
                <div>✓ Survives reboots</div>
                <div>✓ Fires before network — zero boot-time leak window</div>
                <div>✓ Disarms cleanly on stop/disable</div>
              </div>
              <button
                onClick={downloadSystemd}
                className="w-full flex items-center gap-2 px-3 py-2 border border-primary/20 text-[10px] font-mono text-primary/60 hover:text-primary hover:border-primary/40 hover:bg-primary/[0.04] rounded-sm transition-all"
              >
                <Download className="w-3 h-3 flex-shrink-0" />
                Download systemd installer
              </button>
            </div>

            <div className="border border-primary/15 rounded-sm p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-primary/60" />
                <span className="text-[10px] font-mono text-primary/80 uppercase">Watchdog + Auto-Reconnect</span>
              </div>
              <p className="text-[9px] font-mono text-primary/40 leading-relaxed">
                Polls WireGuard every 5 seconds. If the tunnel drops: instantly arms the kill switch, then reconnects via wg-quick. Disarms only after handshake is confirmed. Logs every event.
              </p>
              <div className="space-y-1 text-[9px] font-mono text-primary/30">
                <div>✓ Zero-leak reconnect window (kill switch fires first)</div>
                <div>✓ Up to 10 retry attempts with backoff</div>
                <div>✓ SIGTERM-safe — disarms cleanly on stop</div>
              </div>
              <button
                onClick={downloadWatchdog}
                className="w-full flex items-center gap-2 px-3 py-2 border border-primary/20 text-[10px] font-mono text-primary/60 hover:text-primary hover:border-primary/40 hover:bg-primary/[0.04] rounded-sm transition-all"
              >
                <Download className="w-3 h-3 flex-shrink-0" />
                Download watchdog script
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {[
              ["ARMED", "All traffic blocked unless it goes through the VPN tunnel"],
              ["DISARMED", "Normal routing — VPN protection still active"],
              ["AUTO-TRIGGER", "Fires automatically if the WireGuard interface drops"],
              ["HARD MODE", "Drops all packets — LAN/DHCP also blocked"],
            ].map(([label, desc]) => (
              <div key={label} className="border border-primary/10 p-2 space-y-0.5 text-[10px] font-mono">
                <div className="text-primary/70 uppercase">{label}</div>
                <div className="text-primary/30">{desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
