import { useEffect, useState } from "react";
import { GitCompare, CheckCircle2, AlertTriangle, RefreshCw, Clock, Wrench, AlertCircle, ShieldAlert } from "lucide-react";

interface DriftResult {
  drifted: boolean;
  component: string;
  expectedHash: string;
  actualHash: string;
  detectedAt: string;
  severity?: "low" | "medium" | "high" | "critical";
  remediable?: boolean;
  remediationHint?: string;
}

interface DriftSummary {
  total: number;
  drifted: number;
  remediableCount: number;
  results: DriftResult[];
}

interface RemediationReport {
  component: string;
  status: "applied" | "skipped" | "failed" | "manual_required";
  action: string;
  timestamp: string;
  error?: string;
}

interface RemediationResult {
  attempted: number;
  applied: number;
  skipped: number;
  failed: number;
  manualRequired: number;
  reports: RemediationReport[];
  timestamp: string;
}

const COMPONENT_LABELS: Record<string, string> = {
  firewall_policy:      "Firewall Policy",
  node_credentials:     "Node Daemon Credentials",
  device_config_parity: "Device ↔ Config Parity",
  ztna_policy:          "ZTNA Device Trust State",
  wireguard_keys:       "WireGuard Key Store",
  rbac_policy:          "RBAC Access Policy",
  kill_switch_state:    "Kill Switch State",
  dns_shield_rules:     "DNS Shield Rules",
};

const SEVERITY_COLORS: Record<string, string> = {
  low:      "text-yellow-400 border-yellow-500/30 bg-yellow-500/5",
  medium:   "text-orange-400 border-orange-500/30 bg-orange-500/5",
  high:     "text-red-400 border-red-500/30 bg-red-500/5",
  critical: "text-red-300 border-red-400/50 bg-red-500/10",
};

const REMEDIATION_STATUS_STYLES: Record<string, string> = {
  applied:         "text-green-400 bg-green-500/10 border-green-500/30",
  skipped:         "text-gray-400 bg-gray-500/10 border-gray-500/30",
  failed:          "text-red-400 bg-red-500/10 border-red-500/30",
  manual_required: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
};

function HashChip({ hash }: { hash: string }) {
  if (hash === "-") return <span className="text-gray-600 font-mono text-xs">n/a</span>;
  return (
    <span className="font-mono text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
      {hash.substring(0, 16)}…
    </span>
  );
}

function DriftRow({ r, onRemediate }: { r: DriftResult; onRemediate: (c: string) => void }) {
  const severityClass = r.severity ? SEVERITY_COLORS[r.severity] ?? "" : "";
  return (
    <div className={`border rounded-lg p-4 ${r.drifted ? (severityClass || "bg-yellow-900/10 border-yellow-700/40") : "bg-gray-900 border-gray-700"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {r.drifted
            ? <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            : <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />}
          <div>
            <div className="font-semibold text-sm text-white flex items-center gap-2">
              {COMPONENT_LABELS[r.component] ?? r.component}
              {r.severity && r.drifted && (
                <span className={`text-xs px-1.5 py-0.5 rounded border font-mono uppercase ${severityClass}`}>
                  {r.severity}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {new Date(r.detectedAt).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded font-mono ${r.drifted ? "bg-yellow-500/20 text-yellow-300" : "bg-green-500/20 text-green-300"}`}>
            {r.drifted ? "DRIFTED" : "IN SYNC"}
          </span>
          {r.drifted && r.remediable && (
            <button
              onClick={() => onRemediate(r.component)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
            >
              <Wrench className="w-3 h-3" /> Auto-Fix
            </button>
          )}
        </div>
      </div>
      {r.drifted && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-gray-500 mb-1">Expected</div>
              <HashChip hash={r.expectedHash} />
            </div>
            <div>
              <div className="text-gray-500 mb-1">Actual</div>
              <HashChip hash={r.actualHash} />
            </div>
          </div>
          {r.remediationHint && (
            <p className="text-xs text-gray-500 italic mt-1">{r.remediationHint}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function DriftMonitor() {
  const [data, setData]                   = useState<DriftSummary | null>(null);
  const [loading, setLoading]             = useState(true);
  const [err, setErr]                     = useState("");
  const [lastChecked, setLastChecked]     = useState<Date | null>(null);
  const [remediating, setRemediating]     = useState(false);
  const [remediationResult, setRemediationResult] = useState<RemediationResult | null>(null);

  async function load() {
    setLoading(true); setErr(""); setRemediationResult(null);
    try {
      const r = await fetch("/api/drift-monitor/check", { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
      setLastChecked(new Date());
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function remediateAll() {
    setRemediating(true);
    try {
      const r = await fetch("/api/drift-monitor/remediate", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const result = await r.json();
      setRemediationResult(result);
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setRemediating(false); }
  }

  async function remediateOne(component: string) {
    setRemediating(true);
    try {
      const r = await fetch(`/api/drift-monitor/remediate/${component}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const report = await r.json();
      setRemediationResult({ attempted: 1, applied: report.status === "applied" ? 1 : 0, skipped: 0, failed: report.status === "failed" ? 1 : 0, manualRequired: report.status === "manual_required" ? 1 : 0, reports: [report], timestamp: report.timestamp });
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setRemediating(false); }
  }

  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, []);

  const hasDrift = (data?.drifted ?? 0) > 0;
  const hasRemediable = (data?.remediableCount ?? 0) > 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-green-400 flex items-center gap-2">
            <GitCompare className="w-6 h-6" /> Infrastructure Drift Monitor
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Compares expected vs actual state across firewall, nodes, ZTNA, and device configs. Auto-remediates where possible.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasDrift && hasRemediable && (
            <button
              onClick={remediateAll}
              disabled={remediating}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
            >
              <Wrench className={`w-4 h-4 ${remediating ? "animate-bounce" : ""}`} />
              {remediating ? "Remediating…" : `Auto-Fix All (${data?.remediableCount})`}
            </button>
          )}
          <button onClick={load} disabled={loading} className="flex items-center gap-2 text-sm text-gray-400 hover:text-green-400 transition-colors border border-gray-700 rounded-lg px-3 py-2 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Check Now
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-white font-mono">{data.total}</div>
            <div className="text-gray-400 text-xs mt-1">Checked</div>
          </div>
          <div className={`border rounded-lg p-4 text-center ${hasDrift ? "bg-yellow-900/10 border-yellow-700/40" : "bg-green-900/10 border-green-700/40"}`}>
            <div className={`text-3xl font-bold font-mono ${hasDrift ? "text-yellow-400" : "text-green-400"}`}>{data.drifted}</div>
            <div className="text-gray-400 text-xs mt-1">Drifted</div>
          </div>
          <div className="bg-green-900/10 border border-green-700/40 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-400 font-mono">{data.total - data.drifted}</div>
            <div className="text-gray-400 text-xs mt-1">In Sync</div>
          </div>
          <div className={`border rounded-lg p-4 text-center ${hasRemediable ? "bg-blue-900/10 border-blue-700/40" : "bg-gray-900 border-gray-700"}`}>
            <div className={`text-3xl font-bold font-mono ${hasRemediable ? "text-blue-400" : "text-gray-600"}`}>{data.remediableCount}</div>
            <div className="text-gray-400 text-xs mt-1">Auto-Fixable</div>
          </div>
        </div>
      )}

      {err && <div className="bg-red-900/20 border border-red-700/40 text-red-300 rounded-lg px-4 py-3 text-sm">{err}</div>}

      {/* Remediation result */}
      {remediationResult && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-400" /> Remediation Report
          </h2>
          <div className="flex gap-4 text-xs">
            <span className="text-green-400">✓ {remediationResult.applied} applied</span>
            <span className="text-gray-400">— {remediationResult.skipped} skipped</span>
            {remediationResult.failed > 0 && <span className="text-red-400">✗ {remediationResult.failed} failed</span>}
            {remediationResult.manualRequired > 0 && <span className="text-yellow-400">⚠ {remediationResult.manualRequired} manual required</span>}
          </div>
          <div className="space-y-2">
            {remediationResult.reports.map((r, i) => (
              <div key={i} className={`text-xs px-3 py-2 rounded border ${REMEDIATION_STATUS_STYLES[r.status] ?? ""}`}>
                <span className="font-semibold uppercase">{r.status.replace("_", " ")}</span>
                {" — "}
                <span className="font-mono">{COMPONENT_LABELS[r.component] ?? r.component}</span>
                {": "}
                {r.action}
                {r.error && <span className="text-red-400 ml-2">({r.error})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drift results */}
      <div className="space-y-3">
        {data?.results.map(r => <DriftRow key={r.component} r={r} onRemediate={remediateOne} />) ?? (
          loading ? <div className="text-center text-gray-500 py-8">Running drift check…</div> : null
        )}
      </div>

      {lastChecked && (
        <p className="text-xs text-gray-600 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Last checked: {lastChecked.toLocaleString()} — auto-checks every 60 seconds.
        </p>
      )}
    </div>
  );
}
