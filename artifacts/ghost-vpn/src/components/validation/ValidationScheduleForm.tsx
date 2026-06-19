// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { RefreshCw, Clock, Plus } from "lucide-react";

const RUN_TYPES = ["uptime","tls","headers","wireguard","synthetic","zap","trivy","semgrep","dependency","k6"];

export default function ValidationScheduleForm() {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState("");
  const [form, setForm]     = useState({ targetId: "", runType: "uptime", intervalMinutes: 60, enabled: true });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg("");
    const r = await fetch("/api/validation/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, intervalMinutes: Number(form.intervalMinutes) }),
    });
    const d = await r.json();
    setMsg(r.ok ? `Schedule created: ${d.id} — next run ${new Date(d.next_run_at).toLocaleString()}` : d.error ?? "Error");
    setSaving(false);
    if (r.ok) setForm({ targetId: "", runType: "uptime", intervalMinutes: 60, enabled: true });
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-900/40 border border-gray-700/40 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Clock className="w-4 h-4 text-green-400" />Create Validation Schedule
        </h3>
        <p className="text-xs text-gray-500">
          Schedules are processed by the continuous-validation-worker every minute.
          Enable <code className="bg-gray-800 px-1 rounded">PROXHQ_ENABLE_CONTINUOUS_VALIDATION=1</code> to activate.
        </p>
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input required value={form.targetId} onChange={e => setForm(f => ({ ...f, targetId: e.target.value }))}
            placeholder="Target UUID"
            className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500 sm:col-span-2" />
          <select value={form.runType} onChange={e => setForm(f => ({ ...f, runType: e.target.value }))}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500">
            {RUN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={1440} value={form.intervalMinutes}
              onChange={e => setForm(f => ({ ...f, intervalMinutes: Number(e.target.value) }))}
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
            <span className="text-xs text-gray-500 whitespace-nowrap">min interval</span>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} className="accent-green-500" />
            Enabled immediately
          </label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm rounded flex items-center gap-2">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create Schedule
            </button>
            {msg && <span className="text-xs text-gray-400 font-mono">{msg}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
