import { useState } from "react";
import { Cpu, Play, Rocket, AlertTriangle, CheckCircle2, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { FirewallPolicyRule } from "../../../api-server/src/lib/firewall-policy-engine";

const EMPTY_RULE = (): FirewallPolicyRule => ({
  id: `rule_${Date.now()}`, priority: 100, action: "deny",
  direction: "inbound", protocol: "tcp", source: "", destination: "", port: "", description: "",
});

function RuleEditor({ rule, onChange, onDelete }: { rule: FirewallPolicyRule; onChange: (r: FirewallPolicyRule) => void; onDelete: () => void }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-2">
      <div className="flex gap-2 flex-wrap">
        <input className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white w-28" placeholder="Rule ID" value={rule.id} onChange={e => onChange({ ...rule, id: e.target.value })} />
        <input className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white w-20" type="number" placeholder="Priority" value={rule.priority} onChange={e => onChange({ ...rule, priority: Number(e.target.value) })} />
        <select className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white" value={rule.action} onChange={e => onChange({ ...rule, action: e.target.value as any })}>
          <option value="allow">allow</option><option value="deny">deny</option>
        </select>
        <select className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white" value={rule.direction} onChange={e => onChange({ ...rule, direction: e.target.value as any })}>
          <option value="inbound">inbound</option><option value="outbound">outbound</option>
        </select>
        <select className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white" value={rule.protocol} onChange={e => onChange({ ...rule, protocol: e.target.value as any })}>
          <option>tcp</option><option>udp</option><option>icmp</option><option>any</option>
        </select>
        <input className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white w-28" placeholder="Source IP" value={rule.source ?? ""} onChange={e => onChange({ ...rule, source: e.target.value || undefined })} />
        <input className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white w-28" placeholder="Dest IP" value={rule.destination ?? ""} onChange={e => onChange({ ...rule, destination: e.target.value || undefined })} />
        <input className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white w-16" placeholder="Port" value={String(rule.port ?? "")} onChange={e => onChange({ ...rule, port: e.target.value || undefined })} />
        <button onClick={onDelete} className="ml-auto text-red-400 hover:text-red-300 transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
      <input className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 w-full" placeholder="Description (optional)" value={rule.description ?? ""} onChange={e => onChange({ ...rule, description: e.target.value })} />
    </div>
  );
}

function CodeBlock({ label, lines }: { label: string; lines: string[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-2 bg-gray-800 text-xs text-green-400 font-mono hover:bg-gray-700 transition-colors" onClick={() => setOpen(o => !o)}>
        {label} {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <pre className="bg-gray-950 p-4 text-xs text-gray-300 font-mono overflow-x-auto max-h-48">
          {lines.join("\n") || "(empty)"}
        </pre>
      )}
    </div>
  );
}

export default function FirewallPolicyCompiler() {
  const [rules, setRules] = useState<FirewallPolicyRule[]>([
    { id: "allow-wg", priority: 10, action: "allow", direction: "inbound", protocol: "udp", port: 51820, description: "WireGuard VPN" },
    { id: "allow-https", priority: 20, action: "allow", direction: "outbound", protocol: "tcp", port: 443, description: "HTTPS outbound" },
    { id: "deny-all-in", priority: 9999, action: "deny", direction: "inbound", protocol: "any", description: "Default deny inbound" },
  ]);

  const [simResult, setSimResult] = useState<any>(null);
  const [deployResult, setDeployResult] = useState<any>(null);
  const [loading, setLoading] = useState<"sim" | "deploy" | null>(null);
  const [err, setErr] = useState("");
  const [reason, setReason] = useState("");

  async function simulate() {
    setLoading("sim"); setErr(""); setDeployResult(null);
    try {
      const r = await fetch("/api/firewall-v2/simulate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? JSON.stringify(d));
      setSimResult(d);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(null); }
  }

  async function deploy() {
    setLoading("deploy"); setErr(""); setSimResult(null);
    try {
      const r = await fetch("/api/firewall-v2/deploy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules, reason }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? JSON.stringify(d));
      setDeployResult(d);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(null); }
  }

  const riskColor = (s: number) => s >= 50 ? "text-red-400" : s >= 20 ? "text-yellow-400" : "text-green-400";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-400 flex items-center gap-2">
          <Cpu className="w-6 h-6" /> Firewall Policy Compiler
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Build rules → simulate impact → compile to nftables / iptables / WireGuard ACL → deploy with governance.
        </p>
      </div>

      {/* Rule editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Policy Rules ({rules.length})</h2>
          <button onClick={() => setRules(r => [...r, EMPTY_RULE()])} className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 border border-green-700/50 rounded px-2 py-1 transition-colors">
            <Plus className="w-3 h-3" /> Add Rule
          </button>
        </div>
        {rules.map((rule, i) => (
          <RuleEditor key={rule.id + i} rule={rule}
            onChange={r => setRules(prev => prev.map((x, j) => j === i ? r : x))}
            onDelete={() => setRules(prev => prev.filter((_, j) => j !== i))}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="text-xs text-gray-400 mb-1 block">Deploy reason (for audit log)</label>
          <input className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white w-full" placeholder="e.g. block RU traffic per security policy" value={reason} onChange={e => setReason(e.target.value)} />
        </div>
        <button onClick={simulate} disabled={!!loading} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          <Play className="w-4 h-4" /> {loading === "sim" ? "Simulating…" : "Simulate"}
        </button>
        <button onClick={deploy} disabled={!!loading} className="flex items-center gap-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          <Rocket className="w-4 h-4" /> {loading === "deploy" ? "Deploying…" : "Deploy"}
        </button>
      </div>

      {err && <div className="bg-red-900/20 border border-red-700/40 text-red-300 rounded-lg px-4 py-3 text-sm">{err}</div>}

      {/* Simulation results */}
      {simResult && (
        <div className="space-y-4 bg-gray-900 border border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-sm font-semibold text-green-400 flex items-center gap-2"><Play className="w-4 h-4" /> Simulation Results</h2>
            <span className={`text-sm font-mono font-bold ${riskColor(simResult.simulation?.riskScore ?? 0)}`}>
              Risk Score: {simResult.simulation?.riskScore ?? 0} / 100
            </span>
            <span className={`text-xs px-2 py-1 rounded font-mono ${simResult.simulation?.deployRecommendation === "allow" ? "bg-green-500/20 text-green-300" : simResult.simulation?.deployRecommendation === "block" ? "bg-red-500/20 text-red-300" : "bg-yellow-500/20 text-yellow-300"}`}>
              {simResult.simulation?.deployRecommendation}
            </span>
          </div>
          {simResult.conflicts?.length > 0 && (
            <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-3">
              <div className="text-red-400 text-xs font-semibold mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Conflicts</div>
              {simResult.conflicts.map((c: string, i: number) => <div key={i} className="text-xs text-red-300">{c}</div>)}
            </div>
          )}
          {simResult.warnings?.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-3">
              <div className="text-yellow-400 text-xs font-semibold mb-1">Warnings</div>
              {simResult.warnings.map((w: string, i: number) => <div key={i} className="text-xs text-yellow-300">{w}</div>)}
            </div>
          )}
          {simResult.compiledPreview && (
            <div className="space-y-3">
              <CodeBlock label="nftables" lines={simResult.compiledPreview.nftables} />
              <CodeBlock label="iptables" lines={simResult.compiledPreview.iptables} />
              <CodeBlock label="WireGuard ACL" lines={simResult.compiledPreview.wireguardAcl.map((r: any) => JSON.stringify(r))} />
            </div>
          )}
        </div>
      )}

      {/* Deploy results */}
      {deployResult && (
        <div className={`border rounded-xl p-5 ${deployResult.status === "deployed" ? "bg-green-900/10 border-green-700/40" : "bg-yellow-900/10 border-yellow-700/40"}`}>
          <div className="flex items-center gap-2 mb-2">
            {deployResult.status === "deployed" ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <AlertTriangle className="w-5 h-5 text-yellow-400" />}
            <span className={`font-semibold ${deployResult.status === "deployed" ? "text-green-400" : "text-yellow-400"}`}>
              {deployResult.status === "deployed" ? `Deployed (version ${deployResult.version})` : `Requires Approval — ID: ${deployResult.commandId}`}
            </span>
          </div>
          {deployResult.status === "deployed" && deployResult.compiled && (
            <CodeBlock label="Deployed nftables" lines={deployResult.compiled.nftables} />
          )}
        </div>
      )}
    </div>
  );
}
