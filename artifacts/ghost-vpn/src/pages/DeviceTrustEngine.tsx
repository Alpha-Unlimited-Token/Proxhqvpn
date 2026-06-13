// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useEffect, useState, useCallback } from "react";
import {
  Fingerprint, RefreshCw, Shield, CheckCircle2, XCircle, AlertTriangle,
  Clock, ChevronDown, ChevronUp, Play, Cpu, Wifi, Globe, Lock,
} from "lucide-react";

interface DeviceSummary {
  trusted: number; blocked: number; pending: number; limited: number; revoked: number;
  total: number; avgScore: number | null;
}

interface ZtnaDevice {
  id: string; fingerprint: string; user_id: string; display_name: string | null;
  platform: string | null; os_version: string | null; trust_state: string;
  posture_score: number | null; last_seen_at: string | null; created_at: string;
  ip_reputation: string | null;
}

interface EvalResult {
  score: number; allow: boolean; reasons: string[]; recommendations: string[];
}

const TRUST_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  trusted: { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30"  },
  pending: { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  limited: { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  blocked: { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30"    },
  revoked: { text: "text-gray-500",   bg: "bg-gray-500/10",   border: "border-gray-500/30"   },
};

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct   = Math.round((score / max) * 100);
  const color = score >= 75 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono w-8 text-right ${score >= 75 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400"}`}>{score}</span>
    </div>
  );
}

const defaultSignals = {
  os: "linux", diskEncrypted: false, firewallEnabled: false,
  edrHealthy: false, jailbrokenOrRooted: false,
  lastPatchAgeDays: 30, certificateValid: false, ipReputation: "unknown" as const,
};

export default function DeviceTrustEngine() {
  const [summary,   setSummary]   = useState<DeviceSummary | null>(null);
  const [devices,   setDevices]   = useState<ZtnaDevice[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("all");
  const [evalOpen,  setEvalOpen]  = useState(false);
  const [signals,   setSignals]   = useState(defaultSignals);
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [actionState, setActionState] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, dRes] = await Promise.all([
      fetch("/api/device-trust/summary", { credentials: "include" }),
      fetch(`/api/device-trust/devices${filter !== "all" ? `?state=${filter}` : ""}`, { credentials: "include" }),
    ]);
    if (sRes.ok) setSummary(await sRes.json());
    if (dRes.ok) { const d = await dRes.json(); setDevices(d.devices ?? []); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  async function evaluate() {
    setEvaluating(true); setEvalResult(null);
    const r = await fetch("/api/device-trust/evaluate", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signals),
    });
    if (r.ok) setEvalResult(await r.json());
    setEvaluating(false);
  }

  async function updateState(fp: string, state: string) {
    const key = fp + state;
    setActionState(p => ({ ...p, [key]: true }));
    await fetch(`/api/device-trust/devices/${fp}/update-state`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    setActionState(p => ({ ...p, [key]: false }));
    load();
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-green-400 flex items-center gap-2">
            <Fingerprint className="w-6 h-6" /> Device Trust Engine
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            ZTNA posture scoring — devices must meet the trust threshold (≥75) to receive WireGuard configs.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 text-sm text-gray-400 hover:text-green-400 border border-gray-700 rounded-lg px-3 py-2 disabled:opacity-50 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total",   value: summary.total,   color: "text-white" },
            { label: "Trusted", value: summary.trusted,  color: "text-green-400" },
            { label: "Pending", value: summary.pending,  color: "text-yellow-400" },
            { label: "Limited", value: summary.limited,  color: "text-orange-400" },
            { label: "Blocked", value: summary.blocked,  color: "text-red-400" },
            { label: "Avg Score", value: summary.avgScore != null ? `${summary.avgScore}/100` : "—", color: summary.avgScore != null && summary.avgScore >= 75 ? "text-green-400" : "text-yellow-400" },
          ].map(c => (
            <div key={c.label} className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
              <div className={`text-2xl font-bold font-mono ${c.color}`}>{c.value}</div>
              <div className="text-gray-500 text-xs mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Posture Evaluator */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
        <button onClick={() => setEvalOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-800/50 transition-colors">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-gray-200">Posture Evaluator</span>
            <span className="text-xs text-gray-500">— run a trust score simulation</span>
          </div>
          {evalOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>

        {evalOpen && (
          <div className="p-5 border-t border-gray-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* OS */}
              <label className="block">
                <span className="text-xs text-gray-400 mb-1 block">OS</span>
                <select value={signals.os} onChange={e => setSignals(p => ({ ...p, os: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200">
                  {["linux", "windows", "macos", "ios", "android"].map(o => <option key={o}>{o}</option>)}
                </select>
              </label>
              {/* Patch age */}
              <label className="block">
                <span className="text-xs text-gray-400 mb-1 block">Last Patch Age (days)</span>
                <input type="number" min={0} max={365} value={signals.lastPatchAgeDays}
                  onChange={e => setSignals(p => ({ ...p, lastPatchAgeDays: Number(e.target.value) }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200" />
              </label>
              {/* IP Rep */}
              <label className="block">
                <span className="text-xs text-gray-400 mb-1 block">IP Reputation</span>
                <select value={signals.ipReputation} onChange={e => setSignals(p => ({ ...p, ipReputation: e.target.value as any }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200">
                  {["good", "unknown", "bad"].map(o => <option key={o}>{o}</option>)}
                </select>
              </label>
              {/* Toggles */}
              {[
                { key: "diskEncrypted",    label: "Disk Encryption" },
                { key: "firewallEnabled",  label: "Host Firewall" },
                { key: "edrHealthy",       label: "EDR Agent Healthy" },
                { key: "certificateValid", label: "Device Certificate Valid" },
                { key: "jailbrokenOrRooted", label: "Jailbroken / Rooted" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <div onClick={() => setSignals(p => ({ ...p, [key]: !p[key as keyof typeof p] }))}
                    className={`w-9 h-5 rounded-full transition-colors relative ${(signals as any)[key] ? "bg-green-500" : "bg-gray-700"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${(signals as any)[key] ? "left-4" : "left-0.5"}`} />
                  </div>
                  <span className="text-sm text-gray-300">{label}</span>
                </label>
              ))}
            </div>

            <button onClick={evaluate} disabled={evaluating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm transition-colors">
              {evaluating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Evaluate Trust
            </button>

            {evalResult && (
              <div className={`border rounded-xl p-5 space-y-3 ${evalResult.allow ? "bg-green-900/10 border-green-700/40" : "bg-red-900/10 border-red-700/40"}`}>
                <div className="flex items-center gap-3">
                  {evalResult.allow
                    ? <CheckCircle2 className="w-6 h-6 text-green-400" />
                    : <XCircle className="w-6 h-6 text-red-400" />}
                  <div>
                    <div className={`font-bold text-lg ${evalResult.allow ? "text-green-400" : "text-red-400"}`}>
                      {evalResult.allow ? "TRUSTED — Access Granted" : "UNTRUSTED — Access Denied"}
                    </div>
                    <div className="text-gray-400 text-xs">Trust score: {evalResult.score} / 100 (threshold: 75)</div>
                  </div>
                </div>
                <ScoreBar score={evalResult.score} />
                {evalResult.reasons.length > 0 && (
                  <div>
                    <div className="text-xs text-red-400 font-semibold mb-1">Penalty Reasons</div>
                    <ul className="space-y-1">
                      {evalResult.reasons.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                          <XCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" /> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {evalResult.recommendations.length > 0 && (
                  <div>
                    <div className="text-xs text-yellow-400 font-semibold mb-1">Remediation Steps</div>
                    <ul className="space-y-1">
                      {evalResult.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                          <AlertTriangle className="w-3 h-3 text-yellow-400 mt-0.5 flex-shrink-0" /> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Device table */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Shield className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-400">Filter:</span>
          {["all", "trusted", "pending", "limited", "blocked", "revoked"].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`text-xs px-2 py-1 rounded border capitalize transition-colors ${
                filter === s ? "border-green-500/40 bg-green-500/10 text-green-300" : "border-gray-700 text-gray-500 hover:border-gray-600"
              }`}>{s}</button>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          {devices.length === 0 ? (
            <div className="py-12 text-center text-gray-600">
              <Fingerprint className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No devices enrolled. Devices appear when users complete WireGuard ZTNA posture checks.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-800">
                  <tr className="text-gray-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5">Device</th>
                    <th className="text-left px-4 py-2.5">Platform</th>
                    <th className="text-left px-4 py-2.5">Trust State</th>
                    <th className="text-left px-4 py-2.5">Score</th>
                    <th className="text-left px-4 py-2.5">Last Seen</th>
                    <th className="px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {devices.map(d => {
                    const ts = TRUST_STYLE[d.trust_state] ?? TRUST_STYLE.pending;
                    return (
                      <tr key={d.id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{d.display_name ?? "Unknown Device"}</div>
                          <div className="text-gray-600 text-xs font-mono">{d.fingerprint?.substring(0, 16)}…</div>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{d.platform ?? d.os_version ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded border font-mono uppercase ${ts.text} ${ts.bg} ${ts.border}`}>
                            {d.trust_state}
                          </span>
                        </td>
                        <td className="px-4 py-3 w-32">
                          {d.posture_score != null
                            ? <ScoreBar score={d.posture_score} />
                            : <span className="text-gray-600 text-xs">n/a</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {d.last_seen_at ? new Date(d.last_seen_at).toLocaleDateString() : "Never"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            {d.trust_state !== "trusted" && (
                              <button onClick={() => updateState(d.fingerprint, "trusted")} disabled={!!actionState[d.fingerprint + "trusted"]}
                                className="text-xs px-2 py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 disabled:opacity-50 transition-colors">
                                Trust
                              </button>
                            )}
                            {d.trust_state !== "blocked" && (
                              <button onClick={() => updateState(d.fingerprint, "blocked")} disabled={!!actionState[d.fingerprint + "blocked"]}
                                className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors">
                                Block
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-600 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Auto-refreshes every 30 seconds.
        </p>
      </div>
    </div>
  );
}
