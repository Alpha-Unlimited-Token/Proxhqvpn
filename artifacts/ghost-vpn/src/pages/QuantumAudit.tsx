// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useEffect, useState, useCallback } from "react";
import {
  ExternalLink, Atom, Key, Activity, Globe,
  RefreshCw, Loader2, ChevronRight, Zap, Hash,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/ghost-vpn\/?$/, "") ?? "";

interface CcSummary {
  runner: { running: boolean; uptimeHours: number; windowsCompleted: number; statusMessage: string; errors: number };
  signatures: { totalSigs: number; addresses: number; uniqueRValues: number };
  progress: { processed: number; total: number; pct: number; unknownChain: number };
  keys: {
    recovered: number; txHashKeys: number; confirmedKeys: number;
    recent: Array<{ address?: string; privateKey: string; engine: string; discoveredAt: string; detail: string }>;
  };
  chains: Record<string, number>;
  recentFindings: Array<{
    engine: string; kind: string; address?: string; value: string;
    detail: string; confidence: number; hasKey: boolean; discoveredAt: string;
  }>;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

function StatBox({ label, value, sub, color = "text-cyan-400" }: {
  label: string; value: React.ReactNode; sub?: string; color?: string;
}) {
  return (
    <div className="border border-white/8 bg-white/3 p-4 flex flex-col gap-1">
      <span className="text-white/35 text-[10px] uppercase tracking-widest font-mono">{label}</span>
      <span className={`text-2xl font-bold font-mono ${color}`}>{value}</span>
      {sub && <span className="text-white/30 text-[10px] font-mono">{sub}</span>}
    </div>
  );
}

export default function QuantumAudit() {
  const qaUrl = `${BASE}/quantum-audit/`;
  const [data, setData] = useState<CcSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/quantum-audit/cc-summary`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  const chainsSorted = data ? Object.entries(data.chains).sort((a, b) => b[1] - a[1]) : [];
  const totalChainSigs = chainsSorted.reduce((s, [, n]) => s + n, 0);

  return (
    <div className="min-h-screen bg-black text-white font-mono p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Atom className="text-cyan-400" size={28} />
          <div>
            <h1 className="text-xl font-bold tracking-widest text-cyan-400 uppercase">QuantumAudit</h1>
            <p className="text-white/35 text-[10px] uppercase tracking-widest">Blockchain Security Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest ${data.runner.running ? "text-[#00ff88]" : "text-white/30"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${data.runner.running ? "bg-[#00ff88] animate-pulse" : "bg-white/20"}`} />
              {data.runner.running ? "Engine active" : "Engine idle"}
            </div>
          )}
          <button onClick={load} className="border border-white/10 hover:border-cyan-400/30 p-1.5 text-white/40 hover:text-cyan-400 transition-colors">
            <RefreshCw size={13} />
          </button>
          <a href={qaUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-[10px] uppercase tracking-widest px-3 py-1.5 hover:bg-cyan-500/25 transition-colors">
            <ExternalLink size={12} />Full Platform
          </a>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48 gap-2 text-white/40">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-xs uppercase tracking-widest">Loading scan data…</span>
        </div>
      )}

      {error && !loading && (
        <div className="border border-red-500/20 bg-red-500/5 p-4 text-red-400 text-xs">
          Could not reach QuantumAudit API — engine may still be starting up.
        </div>
      )}

      {data && !loading && (
        <>
          {/* Stat grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox label="Signatures" value={data.signatures.totalSigs.toLocaleString()} sub={`${data.signatures.addresses} addresses`} />
            <StatBox label="Scan Progress" value={`${data.progress.pct}%`} sub={`${data.progress.processed.toLocaleString()} / ${data.progress.total.toLocaleString()}`} color="text-orange-400" />
            <StatBox label="Keys Recovered" value={data.keys.recovered} sub={`${data.keys.txHashKeys} from E0 engine`} color={data.keys.recovered > 0 ? "text-red-400" : "text-white/40"} />
            <StatBox label="Unknown Chain" value={data.progress.unknownChain.toLocaleString()} sub="queued for rescan" color="text-yellow-400" />
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-white/30 uppercase tracking-widest">
              <span>Engine 0 · TX Hash ECDSA Scan</span>
              <span>{data.progress.processed.toLocaleString()} / {data.progress.total.toLocaleString()} hashes</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all" style={{ width: `${data.progress.pct}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chain breakdown */}
            <div className="border border-white/8 bg-white/2 p-4 space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Globe size={13} className="text-cyan-400" />
                <span className="text-[10px] uppercase tracking-widest text-white/50">Chain Breakdown</span>
              </div>
              {chainsSorted.length === 0 && <p className="text-white/25 text-[10px]">Waiting for first batch…</p>}
              {chainsSorted.map(([chain, count]) => (
                <div key={chain} className="space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/60 capitalize">{chain}</span>
                    <span className="text-cyan-400">{count} ({totalChainSigs > 0 ? Math.round(count / totalChainSigs * 100) : 0}%)</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500/60" style={{ width: `${totalChainSigs > 0 ? (count / totalChainSigs) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Recent findings */}
            <div className="border border-white/8 bg-white/2 p-4 space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={13} className="text-orange-400" />
                <span className="text-[10px] uppercase tracking-widest text-white/50">Recent Findings</span>
              </div>
              {data.recentFindings.length === 0 && <p className="text-white/25 text-[10px]">No findings yet…</p>}
              {data.recentFindings.slice(0, 8).map((f, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
                  {f.hasKey ? <Key size={11} className="text-red-400 mt-0.5 shrink-0" /> : <Hash size={11} className="text-cyan-400/60 mt-0.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] uppercase border px-1 ${f.hasKey ? "border-red-400/30 text-red-400" : "border-cyan-400/20 text-cyan-400/60"}`}>{f.kind}</span>
                      <span className="text-white/25 text-[9px]">{f.engine}</span>
                    </div>
                    <p className="text-white/55 text-[10px] truncate mt-0.5">{f.detail || f.value}</p>
                    <p className="text-white/25 text-[9px]">{timeAgo(f.discoveredAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Runner status bar */}
          <div className="border border-white/5 bg-white/2 px-4 py-2 flex items-center gap-3 text-[10px] text-white/30">
            <Zap size={10} className={data.runner.running ? "text-[#00ff88]" : "text-white/20"} />
            <span className="flex-1 truncate">{data.runner.statusMessage || "Idle"}</span>
            <span>{data.runner.windowsCompleted} windows</span>
            <span>·</span>
            <span>{data.runner.uptimeHours.toFixed(1)}h uptime</span>
            {data.runner.errors > 0 && <><span>·</span><span className="text-red-400">{data.runner.errors} errors</span></>}
          </div>

          {/* Open platform link */}
          <div className="flex justify-center pt-2">
            <a href={qaUrl} className="flex items-center gap-2 border border-cyan-400/20 text-cyan-400/70 text-[10px] uppercase tracking-widest px-6 py-2 hover:border-cyan-400/40 hover:text-cyan-400 transition-colors">
              <ExternalLink size={12} />Open Full QuantumAudit Platform<ChevronRight size={12} />
            </a>
          </div>
        </>
      )}
    </div>
  );
}
