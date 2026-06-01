// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Loader2, AlertTriangle, Link2, Target, CheckCircle, XCircle, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const SEV: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-900/20 border-red-500/30",
  HIGH:     "text-orange-400 bg-orange-900/20 border-orange-400/30",
  MEDIUM:   "text-yellow-400 bg-yellow-900/20 border-yellow-400/30",
  LOW:      "text-blue-400 bg-blue-900/20 border-blue-400/30",
  NONE:     "text-white/40 bg-white/5 border-white/10",
};

const ALL_MODULES = [
  { id: "recon",              label: "Recon Agent",              desc: "Surface discovery, DNS, ports, technologies" },
  { id: "tech-fingerprint",   label: "Tech Fingerprint Agent",   desc: "Framework, CMS, WAF, CDN detection" },
  { id: "vuln-test",          label: "Vulnerability Test Agent", desc: "Active vuln probing, CVE matching" },
  { id: "chain-correlation",  label: "Chain Correlation Agent",  desc: "Multi-finding attack path chaining" },
  { id: "impact-assessment",  label: "Impact Assessment Agent",  desc: "Business impact and blast radius" },
];

export default function AgentStrike() {
  const { toast } = useToast();
  const [target, setTarget] = useState("");
  const [depth, setDepth] = useState("standard");
  const [selected, setSelected] = useState<string[]>(["recon","tech-fingerprint","vuln-test","chain-correlation","impact-assessment"]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  function toggleModule(id: string) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  async function run() {
    if (!target.trim()) toast({ title: "Target required", variant: "destructive" }); return;
    if (selected.length === 0) toast({ title: "Select at least one module", variant: "destructive" }); return;
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${BASE}/api/ai-security/agent-strike`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: target.trim(), modules: selected, depth }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResult(d);
    } catch (e: any) { toast({ title: "Error: " + e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  const pipeline: any[] = result?.pipeline ?? [];
  const paths: any[] = result?.attack_paths ?? [];
  const correlations: any[] = result?.correlation_matrix ?? [];
  const cves: any[] = result?.cves_found ?? [];
  const roadmap: any[] = result?.remediation_roadmap ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">AgentStrike</h1>
          <p className="text-xs text-white/40">Agentic Multi-Phase Security Framework · 5 Specialized Agents · Attack Chain Correlation</p>
        </div>
        <Badge className="ml-auto bg-red-500/10 text-red-400 border-red-500/20 text-xs">AGENTIC AI</Badge>
      </div>

      <div className="rounded-lg border border-yellow-500/20 bg-yellow-900/10 p-3 text-xs text-yellow-400 flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Authorized use only. This framework orchestrates coordinated security assessments. Only target systems you own or have written permission to test.</span>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-1">
          <label className="text-xs text-white/50">Target</label>
          <Input value={target} onChange={e => setTarget(e.target.value)}
            placeholder="https://target.com, 10.0.0.1, or CIDR range"
            className="bg-black/40 border-white/10 text-white font-mono text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-white/50">Scan Depth</label>
          <Select value={depth} onValueChange={setDepth}>
            <SelectTrigger className="bg-black/40 border-white/10 text-white text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/10">
              <SelectItem value="shallow">Shallow (fast)</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="deep">Deep (thorough)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-white/50">Active Agents ({selected.length}/{ALL_MODULES.length})</label>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
          {ALL_MODULES.map(m => (
            <button key={m.id} onClick={() => toggleModule(m.id)}
              className={`text-left rounded border p-3 transition-all ${selected.includes(m.id) ? "border-red-500/40 bg-red-900/10" : "border-white/10 bg-black/20 opacity-50"}`}>
              <div className="flex items-center gap-2">
                {selected.includes(m.id)
                  ? <CheckCircle className="w-3 h-3 text-red-400 shrink-0" />
                  : <XCircle className="w-3 h-3 text-white/20 shrink-0" />}
                <span className={`text-xs font-semibold ${selected.includes(m.id) ? "text-red-300" : "text-white/30"}`}>{m.label}</span>
              </div>
              <p className="text-xs text-white/30 mt-1 pl-5">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <Button onClick={run} disabled={loading || !target.trim() || selected.length === 0}
        className="bg-red-700 hover:bg-red-800 text-white gap-2">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Agents Running...</> : <><Zap className="w-4 h-4" />Launch AgentStrike</>}
      </Button>

      {loading && (
        <div className="rounded-lg border border-red-500/20 bg-black/60 p-4 space-y-3">
          {ALL_MODULES.filter(m => selected.includes(m.id)).map((m, i) => (
            <div key={m.id} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
              <span className="text-xs text-white/60 font-mono">[{m.label}] Running...</span>
            </div>
          ))}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Risk Score", value: result.risk_score + "/100", color: "text-red-400" },
              { label: "Attack Paths", value: paths.length, color: "text-orange-400" },
              { label: "CVEs Found", value: cves.length, color: "text-yellow-400" },
              { label: "Chain Correlations", value: correlations.length, color: "text-purple-400" },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-white/10 bg-black/40 p-4 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-white/40">{s.label}</div>
              </div>
            ))}
          </div>

          {result.executive_summary && (
            <div className="rounded-lg border border-white/10 bg-black/40 p-4 text-sm text-white/70">{result.executive_summary}</div>
          )}

          {pipeline.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-white flex items-center gap-2"><Activity className="w-4 h-4 text-red-400" />Agent Pipeline Results</div>
              {pipeline.map((a: any, i: number) => (
                <div key={i} className="rounded border border-white/10 bg-black/40 p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-900/20 text-red-400 border-red-500/20 border text-xs font-mono">{a.agent_id ?? `AGENT-${String(i+1).padStart(3,"0")}`}</Badge>
                    <span className="text-sm font-semibold text-white">{a.agent?.replace(/-/g," ").toUpperCase()}</span>
                    <Badge className="bg-green-900/20 text-green-400 border-green-500/20 border text-xs">{a.status}</Badge>
                    {a.duration_ms && <span className="text-xs text-white/30">{a.duration_ms}ms</span>}
                    <span className="text-xs text-white/30 ml-auto">{a.findings_count ?? a.findings?.length ?? 0} findings</span>
                  </div>
                  {a.summary && <p className="text-xs text-white/50">{a.summary}</p>}
                  {a.findings?.slice(0,3).map((f: any, j: number) => (
                    <div key={j} className="text-xs text-white/40 pl-4">• {typeof f === "string" ? f : f.title ?? JSON.stringify(f)}</div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {paths.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-white flex items-center gap-2"><Link2 className="w-4 h-4 text-orange-400" />Attack Paths</div>
              {paths.map((p: any, i: number) => (
                <div key={i} className="rounded border border-orange-500/20 bg-orange-900/10 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-semibold text-white">{p.name}</span>
                    <Badge className={`${SEV[p.likelihood?.toUpperCase()] || SEV.MEDIUM} border text-xs`}>{p.likelihood}</Badge>
                  </div>
                  <ol className="list-decimal list-inside space-y-1">
                    {p.steps?.map((s: string, j: number) => <li key={j} className="text-xs text-white/60">{s}</li>)}
                  </ol>
                  {p.impact && <p className="text-xs text-orange-300/70">Impact: {p.impact}</p>}
                </div>
              ))}
            </div>
          )}

          {cves.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-white">CVEs Identified</div>
              <div className="overflow-x-auto"><table className="w-full text-xs">
                <thead><tr className="border-b border-white/10 text-white/40">
                  <th className="text-left py-2 pr-4">CVE</th><th className="text-left pr-4">CVSS</th><th className="text-left pr-4">Component</th><th className="text-left">Exploitable</th>
                </tr></thead>
                <tbody>{cves.map((c: any, i: number) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-1 pr-4 font-mono text-blue-400">{c.cve}</td>
                    <td className="pr-4"><span className={c.cvss >= 9 ? "text-red-400" : c.cvss >= 7 ? "text-orange-400" : "text-yellow-400"}>{c.cvss}</span></td>
                    <td className="pr-4 text-white/60">{c.component}</td>
                    <td>{c.exploitable ? <Badge className="bg-red-900/20 text-red-400 border-red-500/20 border text-xs">YES</Badge> : <span className="text-white/30">No</span>}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            </div>
          )}

          {roadmap.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-black/40 p-4 space-y-2">
              <div className="text-sm font-semibold text-white">Remediation Roadmap</div>
              {roadmap.map((r: any, i: number) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <span className="text-white/30 font-mono shrink-0">#{r.priority ?? i+1}</span>
                  <span className="text-white/70 flex-1">{r.action}</span>
                  <Badge className="bg-blue-900/20 text-blue-400 border-blue-500/20 border text-xs shrink-0">{r.effort}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
