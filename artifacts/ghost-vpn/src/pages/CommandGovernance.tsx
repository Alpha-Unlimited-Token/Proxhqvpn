import { useState, useEffect } from "react";
import { ShieldAlert, Clock, CheckCircle2, XCircle, RotateCcw, RefreshCw, Send } from "lucide-react";

type Job = {
  id: string;
  requested_by: string;
  command_type: string;
  risk_level: "low" | "medium" | "high" | "critical";
  status: string;
  output_summary: string | null;
  created_at: string;
  updated_at: string;
};

const RISK_COLOR: Record<string, string> = {
  low:      "text-green-400 border-green-500/30 bg-green-500/10",
  medium:   "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  high:     "text-orange-400 border-orange-500/30 bg-orange-500/10",
  critical: "text-red-400 border-red-500/30 bg-red-500/10",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending_approval: <Clock className="w-4 h-4 text-yellow-400" />,
  queued:           <Clock className="w-4 h-4 text-cyan-400" />,
  running:          <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />,
  succeeded:        <CheckCircle2 className="w-4 h-4 text-green-400" />,
  failed:           <XCircle className="w-4 h-4 text-red-400" />,
  denied:           <XCircle className="w-4 h-4 text-red-500" />,
  rolled_back:      <RotateCcw className="w-4 h-4 text-orange-400" />,
  cancelled:        <XCircle className="w-4 h-4 text-gray-400" />,
};

const COMMAND_SUGGESTIONS = [
  "firewall.deploy",
  "node.restart",
  "wireguard.rotate_keys",
  "terminal.exec",
  "sql.migration",
  "firewall.emergency_lockdown",
  "user.revoke",
];

export default function CommandGovernance() {
  const [commandType, setCommandType] = useState("firewall.deploy");
  const [targetScope, setTargetScope] = useState('{"environment":"staging"}');
  const [payload, setPayload] = useState("{}");
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [actionState, setActionState] = useState<Record<string, boolean>>({});

  async function loadJobs() {
    setLoadingJobs(true);
    const r = await fetch("/api/command-governance/jobs", { credentials: "include" });
    const d = await r.json();
    setJobs(d.jobs ?? []);
    setLoadingJobs(false);
  }

  useEffect(() => { loadJobs(); }, []);

  async function submit() {
    let parsedPayload: Record<string, unknown> = {};
    let parsedScope: Record<string, unknown> = {};
    try { parsedPayload = JSON.parse(payload); } catch { return alert("Payload must be valid JSON."); }
    try { parsedScope = JSON.parse(targetScope); } catch { return alert("Target scope must be valid JSON."); }

    setSubmitting(true);
    const r = await fetch("/api/command-governance/request", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: commandType, payload: parsedPayload, targetScope: parsedScope }),
    });
    const d = await r.json();
    setLastResult(d);
    setSubmitting(false);
    loadJobs();
  }

  async function jobAction(jobId: string, action: "approve" | "deny" | "rollback") {
    setActionState((p) => ({ ...p, [jobId + action]: true }));
    await fetch(`/api/command-governance/${jobId}/${action}`, { method: "POST", credentials: "include" });
    setActionState((p) => ({ ...p, [jobId + action]: false }));
    loadJobs();
  }

  return (
    <div className="p-6 space-y-6 font-mono">
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-6 h-6 text-orange-400" />
        <h1 className="text-xl font-bold text-green-300">Command Governance</h1>
        <span className="text-xs text-gray-500 border border-gray-700 rounded px-2 py-0.5">High-risk actions require approval before execution</span>
      </div>

      {/* Submit form */}
      <div className="rounded border border-orange-500/20 bg-black/40 p-4 space-y-3">
        <h2 className="text-orange-300 font-semibold text-sm">Submit Command Request</h2>
        <div className="space-y-2">
          <label className="block text-xs text-gray-500">Command Type</label>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-black border border-green-500/30 rounded px-3 py-1.5 text-sm text-green-300 placeholder-gray-600 focus:outline-none focus:border-green-400"
              value={commandType}
              onChange={(e) => setCommandType(e.target.value)}
            />
            <select
              className="bg-black border border-green-500/30 rounded px-2 py-1.5 text-sm text-gray-400 focus:outline-none"
              onChange={(e) => setCommandType(e.target.value)}
              value=""
            >
              <option value="" disabled>Quick select…</option>
              {COMMAND_SUGGESTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Target Scope (JSON)</label>
            <textarea className="w-full bg-black border border-green-500/30 rounded px-3 py-1.5 text-sm text-green-300 font-mono h-20 focus:outline-none focus:border-green-400" value={targetScope} onChange={(e) => setTargetScope(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Payload (JSON)</label>
            <textarea className="w-full bg-black border border-green-500/30 rounded px-3 py-1.5 text-sm text-green-300 font-mono h-20 focus:outline-none focus:border-green-400" value={payload} onChange={(e) => setPayload(e.target.value)} />
          </div>
        </div>
        <button
          onClick={submit}
          disabled={submitting || !commandType}
          className="flex items-center gap-2 rounded border border-orange-500/40 px-4 py-1.5 text-sm text-orange-400 hover:bg-orange-500/10 disabled:opacity-50"
        >
          {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit Command
        </button>

        {lastResult && (
          <div className="mt-2 rounded border border-green-500/20 bg-black p-3">
            <div className="text-xs text-gray-500 mb-1">Result:</div>
            <pre className="text-xs text-green-300 overflow-auto">{JSON.stringify(lastResult, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Job queue */}
      <div className="rounded border border-green-500/20 bg-black/40">
        <div className="flex items-center justify-between px-4 py-3 border-b border-green-500/20">
          <h2 className="text-green-300 font-semibold">Your Command Jobs</h2>
          <button onClick={loadJobs} className="text-gray-500 hover:text-green-400">
            <RefreshCw className={`w-4 h-4 ${loadingJobs ? "animate-spin" : ""}`} />
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">No command jobs yet.</div>
        ) : (
          <div className="divide-y divide-green-500/5">
            {jobs.map((job) => (
              <div key={job.id} className="p-4 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  {STATUS_ICON[job.status] ?? <Clock className="w-4 h-4 text-gray-500" />}
                  <span className="text-green-300 font-medium">{job.command_type}</span>
                  <span className={`text-xs border rounded px-2 py-0.5 ${RISK_COLOR[job.risk_level] ?? "text-gray-400"}`}>{job.risk_level}</span>
                  <span className="text-xs text-gray-500">{job.status.replace(/_/g, " ")}</span>
                  <span className="text-xs text-gray-600 ml-auto">{new Date(job.created_at).toLocaleString()}</span>
                </div>
                {job.output_summary && <p className="text-xs text-gray-400 pl-7">{job.output_summary}</p>}
                {job.status === "pending_approval" && (
                  <div className="flex gap-2 pl-7">
                    <button onClick={() => jobAction(job.id, "approve")} disabled={actionState[job.id + "approve"]} className="text-xs border border-green-500/30 rounded px-3 py-1 text-green-400 hover:bg-green-500/10 disabled:opacity-50">
                      {actionState[job.id + "approve"] ? "…" : "Approve"}
                    </button>
                    <button onClick={() => jobAction(job.id, "deny")} disabled={actionState[job.id + "deny"]} className="text-xs border border-red-500/30 rounded px-3 py-1 text-red-400 hover:bg-red-500/10 disabled:opacity-50">
                      {actionState[job.id + "deny"] ? "…" : "Deny"}
                    </button>
                  </div>
                )}
                {job.status === "succeeded" && (
                  <div className="pl-7">
                    <button onClick={() => jobAction(job.id, "rollback")} disabled={actionState[job.id + "rollback"]} className="text-xs border border-orange-500/30 rounded px-3 py-1 text-orange-400 hover:bg-orange-500/10 disabled:opacity-50">
                      {actionState[job.id + "rollback"] ? "…" : "Rollback"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
