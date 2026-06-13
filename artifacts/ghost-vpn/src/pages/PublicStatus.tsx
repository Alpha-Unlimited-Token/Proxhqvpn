// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Public Status Page — /status
import { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Radio } from "lucide-react";

interface StatusComponent {
  name: string;
  status: "operational" | "degraded" | "outage" | "maintenance";
  description: string;
  uptime: number;
}

interface StatusData {
  overallStatus: "operational" | "degraded" | "outage";
  components: StatusComponent[];
  activeIncidents: { title: string; severity: string; startedAt: string }[];
  updatedAt: string;
}

const STATUS_CONFIG = {
  operational: { label: "Operational",  color: "text-emerald-400", bg: "bg-emerald-500", ring: "border-emerald-700/30" },
  degraded:    { label: "Degraded",     color: "text-yellow-400",  bg: "bg-yellow-500",  ring: "border-yellow-700/30" },
  outage:      { label: "Outage",       color: "text-red-400",     bg: "bg-red-500",     ring: "border-red-700/30"    },
  maintenance: { label: "Maintenance",  color: "text-blue-400",    bg: "bg-blue-500",    ring: "border-blue-700/30"   },
};

const OVERALL_CONFIG = {
  operational: { label: "All Systems Operational", color: "text-emerald-400", border: "border-emerald-700/30", bg: "bg-emerald-900/10" },
  degraded:    { label: "Partial Degradation",      color: "text-yellow-400",  border: "border-yellow-700/30",  bg: "bg-yellow-900/10"  },
  outage:      { label: "Service Outage",           color: "text-red-400",     border: "border-red-700/30",     bg: "bg-red-900/10"     },
};

function StatusDot({ status }: { status: StatusComponent["status"] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.operational;
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${cfg.bg} shrink-0`} />
  );
}

export default function PublicStatus() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/trust-center/status");
      const d = await r.json() as StatusData;
      setData(d);
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, []);

  const overall = data?.overallStatus ?? "operational";
  const cfg     = OVERALL_CONFIG[overall];

  return (
    <div className="min-h-screen bg-[#070c08] text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#0a120b] to-[#070c08] border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col items-center text-center gap-4">
          <div className="flex items-center gap-2 text-primary/70">
            <Radio className="w-4 h-4 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-widest">Live Status</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight">ProxhqVPN System Status</h1>

          {/* Overall status banner */}
          <div className={`w-full max-w-md rounded-xl border ${cfg.border} ${cfg.bg} px-5 py-3.5 flex items-center justify-between`}>
            <div className="flex items-center gap-2.5">
              {overall === "operational"
                ? <CheckCircle2 className={`w-5 h-5 ${cfg.color}`} />
                : overall === "degraded"
                ? <AlertTriangle className={`w-5 h-5 ${cfg.color}`} />
                : <XCircle className={`w-5 h-5 ${cfg.color}`} />
              }
              <span className={`font-bold text-sm ${cfg.color}`}>{cfg.label}</span>
            </div>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="text-white/25 hover:text-white/50 transition-colors disabled:opacity-30"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <p className="text-xs text-white/25">
            {data ? `Last updated: ${new Date(data.updatedAt).toLocaleString()}` : "Loading…"}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Active incidents */}
        {(data?.activeIncidents ?? []).length > 0 && (
          <div className="space-y-2.5">
            <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">Active Incidents</h2>
            {data!.activeIncidents.map((inc, i) => (
              <div key={i} className="rounded-xl border border-yellow-700/30 bg-yellow-900/10 px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                  <span className="text-sm font-medium text-yellow-300">{inc.title}</span>
                  <span className="text-[10px] text-yellow-400/60 uppercase ml-auto">{inc.severity}</span>
                </div>
                <p className="text-xs text-white/40 mt-1 ml-6">
                  Started {new Date(inc.startedAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Component list */}
        <div className="space-y-2.5">
          <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">Components</h2>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden divide-y divide-white/[0.05]">
            {(data?.components ?? []).map(comp => {
              const scfg = STATUS_CONFIG[comp.status] ?? STATUS_CONFIG.operational;
              return (
                <div key={comp.name} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusDot status={comp.status} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white/85">{comp.name}</div>
                      <div className="text-[11px] text-white/35 truncate">{comp.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-[11px] text-white/30 hidden sm:block tabular-nums">
                      {comp.uptime.toFixed(2)}%
                    </span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${scfg.color}`}>
                      {scfg.label}
                    </span>
                  </div>
                </div>
              );
            })}

            {!data && (
              <div className="py-8 text-center text-white/30 text-sm">Loading system status…</div>
            )}
          </div>
        </div>

        {/* Uptime summary */}
        {data && (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 text-center">
            <p className="text-xs text-white/30">
              API and VPN infrastructure monitored continuously. Status updates every 60 seconds.
            </p>
          </div>
        )}

        {/* Footer links */}
        <div className="flex flex-wrap gap-4 justify-center pb-8">
          {[
            { label: "Trust Center",   href: "/trust-center" },
            { label: "Security",       href: "/security" },
            { label: "Vulnerability Disclosure", href: "/trust-center#disclosure" },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-xs text-white/30 hover:text-primary/70 transition-colors underline underline-offset-4 decoration-white/10"
            >
              {label}
            </a>
          ))}
        </div>

        <p className="text-center text-[11px] text-white/15 pb-4">
          © 2024–2026 Alpha Unlimited Technologies LLC. All rights reserved.
        </p>
      </div>
    </div>
  );
}
