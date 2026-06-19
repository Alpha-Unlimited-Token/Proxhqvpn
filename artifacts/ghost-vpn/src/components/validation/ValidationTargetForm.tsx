// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { RefreshCw, Plus, Target } from "lucide-react";

interface ValidationTarget {
  id: string; name: string; target_type: string; url: string | null;
  host: string | null; environment: string; allow_security_scans: boolean;
  allow_load_tests: boolean; owned_by: string | null; enabled: boolean; created_at: string;
}

const TARGET_TYPES = ["web","api","vpn_node","wireguard","container","repository","dns","tls","synthetic"];

export default function ValidationTargetForm() {
  const [targets, setTargets] = useState<ValidationTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState("");
  const [form, setForm]       = useState({
    name: "", target_type: "web", url: "", host: "",
    environment: "production", owned_by: "alpha-unlimited-technologies",
    allow_security_scans: false, allow_load_tests: false,
  });

  const load = () => {
    setLoading(true);
    fetch("/api/validation/targets")
      .then(r => r.json())
      .then(d => setTargets(d.targets ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg("");
    const r = await fetch("/api/validation/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, url: form.url || undefined, host: form.host || undefined }),
    });
    const d = await r.json();
    setMsg(r.ok ? `Target created: ${d.id}` : d.error ?? "Error");
    setSaving(false);
    if (r.ok) { setForm({ name:"", target_type:"web", url:"", host:"", environment:"production", owned_by:"alpha-unlimited-technologies", allow_security_scans:false, allow_load_tests:false }); load(); }
  };

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="bg-gray-900/40 border border-gray-700/40 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2"><Plus className="w-4 h-4 text-green-400" />Add ProxhqVPN Target</h3>
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Name (e.g. proxhqvpn-homepage)" className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500" />
          <select value={form.target_type} onChange={e => setForm(f => ({ ...f, target_type: e.target.value }))}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
            {TARGET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
            placeholder="URL (https://proxhqvpn.com)" className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500 sm:col-span-2" />
          <input value={form.owned_by} onChange={e => setForm(f => ({ ...f, owned_by: e.target.value }))}
            placeholder="owned_by" className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500" />
          <input value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value }))}
            placeholder="environment" className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500" />
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={form.allow_security_scans} onChange={e => setForm(f => ({ ...f, allow_security_scans: e.target.checked }))} className="accent-green-500" />
            Allow security scans (ZAP/trivy/semgrep)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={form.allow_load_tests} onChange={e => setForm(f => ({ ...f, allow_load_tests: e.target.checked }))} className="accent-green-500" />
            Allow load tests (k6)
          </label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm rounded flex items-center gap-2">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}Create Target
            </button>
            {msg && <span className="text-xs text-gray-400 font-mono">{msg}</span>}
          </div>
        </form>
      </div>

      {/* Target list */}
      <div className="bg-gray-900/40 border border-gray-700/40 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/40">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2"><Target className="w-4 h-4 text-green-400" />Registered Targets</h3>
          <button onClick={load} className="p-1.5 text-gray-400 hover:text-gray-200"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-700/60">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">URL</th>
              <th className="px-4 py-2 text-left">Sec Scans</th>
              <th className="px-4 py-2 text-left">Load Tests</th>
              <th className="px-4 py-2 text-left">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {loading ? <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Loading…</td></tr>
              : targets.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">No targets yet</td></tr>
              : targets.map(t => (
              <tr key={t.id} className="hover:bg-gray-800/30">
                <td className="px-4 py-2.5 font-medium text-gray-200">{t.name}</td>
                <td className="px-4 py-2.5 text-gray-400 font-mono text-xs uppercase">{t.target_type}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs truncate max-w-32">{t.url ?? t.host ?? "—"}</td>
                <td className="px-4 py-2.5">{t.allow_security_scans ? <span className="text-green-400 text-xs">✓</span> : <span className="text-gray-600 text-xs">✗</span>}</td>
                <td className="px-4 py-2.5">{t.allow_load_tests ? <span className="text-green-400 text-xs">✓</span> : <span className="text-gray-600 text-xs">✗</span>}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{t.id.slice(0,8)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
