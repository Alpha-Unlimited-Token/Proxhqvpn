import { useState, useEffect, useRef } from "react";
import { CheckCircle, XCircle, Loader, Zap, RefreshCw, Shield, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Dep {
  name: string;
  label: string;
  installed: boolean;
  version?: string;
  purpose: string;
}

interface StatusResponse {
  allInstalled: boolean;
  readyForProduction: boolean;
  dependencies: Dep[];
}

interface InstallEvent {
  step: string;
  name?: string;
  message: string;
  dependencies?: Dep[];
  allInstalled?: boolean;
}

export default function Setup() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [log, setLog] = useState<InstallEvent[]>([]);
  const [done, setDone] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  async function loadStatus() {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/setup/status`);
      const d: StatusResponse = await r.json();
      setStatus(d);
    } catch {
      toast({ title: "Status check failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStatus(); }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  async function runInstall() {
    setInstalling(true);
    setLog([]);
    setDone(false);

    try {
      const r = await fetch(`${BASE}/api/setup/install`, { method: "POST" });
      const reader = r.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response stream");

      let buffer = "";
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event: InstallEvent = JSON.parse(line.slice(6));
              setLog((prev) => [...prev, event]);
              if (event.step === "complete") {
                setDone(true);
                if (event.dependencies) {
                  setStatus({
                    allInstalled: event.allInstalled ?? false,
                    readyForProduction: event.allInstalled ?? false,
                    dependencies: event.dependencies,
                  });
                }
              }
            } catch {}
          }
        }
      }
    } catch (e: any) {
      toast({ title: "Install error", description: e.message, variant: "destructive" });
    } finally {
      setInstalling(false);
    }
  }

  const stepColor: Record<string, string> = {
    start:      "text-cyan-400",
    progress:   "text-primary/60",
    info:       "text-primary/50",
    installing: "text-yellow-400",
    done:       "text-green-400",
    skip:       "text-primary/40",
    service:    "text-cyan-400/70",
    config:     "text-primary/60",
    warn:       "text-yellow-400/70",
    error:      "text-red-400",
    complete:   "text-green-400",
  };

  const stepPrefix: Record<string, string> = {
    start:      "▶",
    progress:   "·",
    info:       "·",
    installing: "⟳",
    done:       "✓",
    skip:       "–",
    service:    "⚙",
    config:     "⚙",
    warn:       "⚠",
    error:      "✗",
    complete:   "✓",
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="border border-primary/10 bg-black/20 rounded-sm px-3 py-2.5 flex items-center justify-between flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <Package className="w-5 h-5 text-cyan-400" />
            Auto-Installer
          </h2>
          {status && (
            <span className={`text-xs font-mono px-2 py-0.5 border uppercase ${
              status.allInstalled
                ? "text-green-400 border-green-400/40"
                : "text-yellow-400 border-yellow-400/40"
            }`}>
              {status.allInstalled ? "FULLY INSTALLED" : "PARTIAL"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadStatus}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 border border-primary/20 text-primary/60 hover:text-primary hover:border-primary/40 transition-colors uppercase"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            CHECK STATUS
          </button>
          <button
            onClick={runInstall}
            disabled={installing}
            className="flex items-center gap-1.5 text-xs font-mono px-4 py-1.5 border border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10 transition-colors uppercase disabled:opacity-40"
          >
            {installing ? (
              <><Loader className="w-3 h-3 animate-spin" /> INSTALLING…</>
            ) : (
              <><Zap className="w-3 h-3" /> AUTO-INSTALL ALL</>
            )}
          </button>
        </div>
      </div>

      <div className="text-xs font-mono text-primary/40 border border-primary/10 bg-black/20 px-3 py-2">
        All VPN dependencies are installed automatically when ProxhqVPN starts. This page lets you
        check status and trigger a manual install if needed. Users never need to install anything manually.
      </div>

      {/* Dependency Status Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-primary/30 font-mono text-xs gap-3">
          <Loader className="w-4 h-4 animate-spin" />
          <span>Checking installed components...</span>
        </div>
      ) : status ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {status.dependencies.map((dep) => (
            <div key={dep.name} className={`border p-3 space-y-2 bg-black/20 ${
              dep.installed ? "border-green-400/20" : "border-yellow-400/20"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className={`w-3.5 h-3.5 ${dep.installed ? "text-green-400" : "text-yellow-400"}`} />
                  <span className="text-sm font-mono font-bold text-primary">{dep.label}</span>
                </div>
                {dep.installed ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-yellow-400/70" />
                )}
              </div>
              <div className="text-[10px] font-mono text-primary/40 leading-relaxed">{dep.purpose}</div>
              {dep.version && (
                <div className="text-[9px] font-mono text-primary/30 truncate">{dep.version}</div>
              )}
              <div className={`text-[9px] font-mono uppercase tracking-wider ${
                dep.installed ? "text-green-400/70" : "text-yellow-400/60"
              }`}>
                {dep.installed ? "INSTALLED" : "WILL BE AUTO-INSTALLED"}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Install Log */}
      {log.length > 0 && (
        <div className="border border-primary/10 bg-black rounded-sm">
          <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10">
            <span className="text-[10px] font-mono text-primary/40 uppercase tracking-widest">Install Log</span>
            {done && (
              <span className="text-[10px] font-mono text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> COMPLETE
              </span>
            )}
          </div>
          <div ref={logRef} className="p-3 max-h-72 overflow-y-auto space-y-0.5">
            {log.map((evt, i) => (
              <div key={i} className={`text-[10px] font-mono ${stepColor[evt.step] ?? "text-primary/50"}`}>
                <span className="mr-2 opacity-60">{stepPrefix[evt.step] ?? "·"}</span>
                {evt.name ? <span className="mr-1 opacity-80">[{evt.name}]</span> : null}
                {evt.message}
              </div>
            ))}
            {installing && (
              <div className="text-[10px] font-mono text-yellow-400/60 flex items-center gap-1 mt-1">
                <Loader className="w-2.5 h-2.5 animate-spin" /> Running...
              </div>
            )}
          </div>
        </div>
      )}

      {/* What gets installed */}
      <div className="border border-primary/10 bg-black/20 p-4 space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-primary/40">What Auto-Install Covers</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              title: "OpenVPN",
              desc: "Required for VPNGate double-hop and Ghost Chain relay connections. Installed server-side — users never install this.",
            },
            {
              title: "Proxychains4",
              desc: "Enables Ghost Chain multi-veil routing. Configured automatically with the Tor SOCKS proxy. No user action needed.",
            },
            {
              title: "WireGuard Tools",
              desc: "Server-side WireGuard management. Subscriber client apps are pre-built — they just scan a QR code.",
            },
            {
              title: "Tor Daemon",
              desc: "Starts automatically on port 9050 at server boot. Powers Ghost Chain Mask 1 (Tor Veil). Zero user config.",
            },
            {
              title: "iptables",
              desc: "Kill switch and firewall rules applied server-side. Toggled from the dashboard — no user commands needed.",
            },
            {
              title: "Proxychains Config",
              desc: "Ghost Chain proxychains4.conf is written to /etc/proxychains4.conf automatically. One-click activation in UI.",
            },
          ].map(({ title, desc }) => (
            <div key={title} className="flex gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-green-400/60 shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] font-mono text-primary font-bold">{title}</div>
                <div className="text-[9px] font-mono text-primary/40 leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
