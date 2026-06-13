// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Trust Center — public-facing security posture summary.
// Does NOT expose raw findings, internal IPs, or private node details.
import { useState, useEffect } from "react";
import { Shield, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Clock, Lock } from "lucide-react";

interface TrustSummary {
  status: "trusted" | "warning" | "failed" | "unknown";
  score: number;
  maxScore: number;
  uptimePct: number;
  lastValidationAt: string | null;
  lastTlsCheckAt: string | null;
  environment: "production";
  generatedAt: string;
}

const STATUS_CONFIG = {
  trusted: { color: "text-green-400", bg: "border-green-700/40 bg-green-900/10", icon: CheckCircle2, label: "Trusted" },
  warning: { color: "text-yellow-400", bg: "border-yellow-700/40 bg-yellow-900/10", icon: AlertTriangle, label: "Monitoring" },
  failed:  { color: "text-red-400",    bg: "border-red-700/40 bg-red-900/10",       icon: XCircle,       label: "Incident" },
  unknown: { color: "text-gray-400",   bg: "border-gray-700/40 bg-gray-900/10",    icon: Shield,        label: "Initializing" },
};

function ScoreMeter({ score, max }: { score: number; max: number }) {
  const pct   = max > 0 ? score / max : 0;
  const color = pct >= 0.9 ? "bg-green-500" : pct >= 0.7 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm text-gray-300">
        <span>Security Posture</span>
        <span className="font-mono">{score}/{max}</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-1000`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

export default function TrustCenter() {
  const [data, setData]       = useState<TrustSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/trust-center/validation-summary")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(`Unable to fetch trust status (${e})`))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); const t = setInterval(load, 5 * 60_000); return () => clearInterval(t); }, []);

  const cfg = data ? STATUS_CONFIG[data.status] ?? STATUS_CONFIG.unknown : STATUS_CONFIG.unknown;
  const Icon = cfg.icon;

  return (
    <div className="min-h-screen bg-[#080d09] py-16 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-green-700/40 bg-green-900/10 text-green-400 text-xs font-medium">
            <Lock className="w-3 h-3" />ProxhqVPN Trust Center
          </div>
          <h1 className="text-4xl font-bold text-white">Security Status</h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Real-time security posture of ProxhqVPN infrastructure. Continuously validated with
            hash-chained audit records. No raw findings or internal system details are exposed.
          </p>
        </div>

        {/* Status card */}
        <div className={`border ${cfg.bg} rounded-2xl p-8`}>
          {loading && !data ? (
            <div className="flex items-center justify-center gap-3 text-gray-400 py-8">
              <RefreshCw className="animate-spin w-5 h-5" />Loading security status…
            </div>
          ) : error ? (
            <div className="text-center text-gray-400 py-8">{error}</div>
          ) : data ? (
            <div className="space-y-6">
              {/* Status badge */}
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl border ${cfg.bg}`}>
                  <Icon className={`w-8 h-8 ${cfg.color}`} />
                </div>
                <div>
                  <div className={`text-2xl font-bold ${cfg.color}`}>{cfg.label}</div>
                  <div className="text-gray-400 text-sm">ProxhqVPN Infrastructure</div>
                </div>
              </div>

              {/* Score meter */}
              <ScoreMeter score={data.score} max={data.maxScore} />

              {/* Metrics grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-gray-800/40 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Uptime (24h)</div>
                  <div className={`text-2xl font-bold font-mono ${data.uptimePct >= 99 ? "text-green-400" : data.uptimePct >= 95 ? "text-yellow-400" : "text-red-400"}`}>
                    {data.uptimePct.toFixed(2)}%
                  </div>
                </div>
                <div className="bg-gray-800/40 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Last Check</div>
                  <div className="text-sm font-medium text-gray-200 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    {data.lastValidationAt ? new Date(data.lastValidationAt).toLocaleTimeString() : "—"}
                  </div>
                </div>
                <div className="bg-gray-800/40 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">TLS Valid</div>
                  <div className="text-sm font-medium text-gray-200">
                    {data.lastTlsCheckAt ? <span className="text-green-400">✓ Verified</span> : "Pending"}
                  </div>
                </div>
              </div>

              {/* Compliance */}
              <div className="border-t border-gray-700/40 pt-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-300">Security Practices</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {[
                    "Hash-chained immutable audit records",
                    "Automated TLS certificate monitoring",
                    "WireGuard mesh node health checks",
                    "Continuous uptime monitoring",
                    "Security header validation",
                    "Synthetic endpoint journey tests",
                  ].map(p => (
                    <div key={p} className="flex items-center gap-2 text-gray-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />{p}
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-xs text-gray-600 text-center pt-2">
                Generated {new Date(data.generatedAt).toLocaleString()} · Refreshes every 5 minutes
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-600">
          © {new Date().getFullYear()} Alpha Unlimited Technologies LLC — All validation is performed
          against ProxhqVPN-owned systems only. No third-party or customer systems are scanned.
        </p>
      </div>
    </div>
  );
}
