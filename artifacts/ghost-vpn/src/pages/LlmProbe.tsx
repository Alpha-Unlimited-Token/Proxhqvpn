// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Cpu, Loader2, AlertTriangle, CheckCircle, XCircle, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const SEV: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-900/20 border-red-500/30",
  HIGH:     "text-orange-400 bg-orange-900/20 border-orange-400/30",
  MEDIUM:   "text-yellow-400 bg-yellow-900/20 border-yellow-400/30",
  LOW:      "text-blue-400 bg-blue-900/20 border-blue-400/30",
  NONE:     "text-green-400 bg-green-900/20 border-green-500/30",
};

const PROBES = [
  { id: "prompt-injection",    label: "Prompt Injection",    desc: "Override system instructions" },
  { id: "jailbreak",          label: "Jailbreak",           desc: "Bypass safety guardrails" },
  { id: "data-leakage",       label: "Data Leakage",        desc: "Extract training/system data" },
  { id: "pii-extraction",     label: "PII Extraction",      desc: "Exfiltrate personal information" },
  { id: "hallucination",      label: "Hallucination",       desc: "Force confident false outputs" },
  { id: "dos",                label: "DoS",                 desc: "Denial of service via prompt" },
  { id: "indirect-injection", label: "Indirect Injection",  desc: "Injection via retrieved context" },
  { id: "model-extraction",   label: "Model Extraction",    desc: "Infer model architecture/weights" },
];

export default function LlmProbe() {
  const { toast } = useToast();
  const [endpoint, setEndpoint] = useState("https://api.openai.com/v1/chat/completions");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selected, setSelected] = useState<string[]>(["prompt-injection","jailbreak","data-leakage","pii-extraction"]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  function toggleProbe(id: string) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  async function run() {
    if (!endpoint.trim()) toast({ title: "Endpoint required", variant: "destructive" }); return;
    if (selected.length === 0) toast({ title: "Select at least one probe", variant: "destructive" }); return;
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${BASE}/api/ai-security/llm-probe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: endpoint.trim(), apiKey: apiKey || undefined, model, probeTypes: selected, customSystemPrompt: systemPrompt || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResult(d);
    } catch (e: any) { toast({ title: "Error: " + e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  const probeResults: any[] = result?.results ?? [];
  const score = result?.overall_score ?? {};
  const vulns: any[] = result?.vulnerabilities_found ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Cpu className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">LLMProbe</h1>
          <p className="text-xs text-white/40">LLM Vulnerability Scanner · Prompt Injection · Jailbreak · Data Leakage · PII Extraction</p>
        </div>
        <Badge className="ml-auto bg-violet-500/10 text-violet-400 border-violet-500/20 text-xs">AI SCANNER</Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-white/50">API Endpoint</label>
            <Input value={endpoint} onChange={e => setEndpoint(e.target.value)}
              className="bg-black/40 border-white/10 text-white font-mono text-sm"
              placeholder="https://api.openai.com/v1/chat/completions" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/50">API Key (optional — for live testing)</label>
            <Input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password"
              className="bg-black/40 border-white/10 text-white font-mono text-sm"
              placeholder="sk-..." />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/50">Model</label>
            <Input value={model} onChange={e => setModel(e.target.value)}
              className="bg-black/40 border-white/10 text-white font-mono text-sm"
              placeholder="gpt-4, claude-3, llama-3..." />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/50">System Prompt (if known)</label>
            <Textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
              className="bg-black/40 border-white/10 text-white text-sm h-24 resize-none"
              placeholder="You are a helpful assistant..." />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-white/50">Probe Types ({selected.length}/{PROBES.length})</label>
          <div className="grid grid-cols-1 gap-2">
            {PROBES.map(p => (
              <button key={p.id} onClick={() => toggleProbe(p.id)}
                className={`text-left rounded border p-2 transition-all flex items-center gap-3 ${selected.includes(p.id) ? "border-violet-500/40 bg-violet-900/10" : "border-white/10 bg-black/20 opacity-50"}`}>
                {selected.includes(p.id)
                  ? <CheckCircle className="w-3 h-3 text-violet-400 shrink-0" />
                  : <XCircle className="w-3 h-3 text-white/20 shrink-0" />}
                <div>
                  <div className={`text-xs font-semibold ${selected.includes(p.id) ? "text-violet-300" : "text-white/30"}`}>{p.label}</div>
                  <div className="text-xs text-white/30">{p.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button onClick={run} disabled={loading || !endpoint.trim() || selected.length === 0}
        className="bg-violet-700 hover:bg-violet-800 text-white gap-2">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Probing...</> : <><Cpu className="w-4 h-4" />Run LLMProbe</>}
      </Button>

      {result && (
        <div className="space-y-4">
          {score.grade && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Safety Grade", value: score.grade, color: score.safety_score >= 80 ? "text-green-400" : score.safety_score >= 60 ? "text-yellow-400" : "text-red-400" },
                { label: "Jailbreak Resist", value: score.jailbreak_resistance ?? "—", color: "text-orange-400" },
                { label: "Injection Resist", value: score.injection_resistance ?? "—", color: "text-yellow-400" },
                { label: "Leakage Resist", value: score.leakage_resistance ?? "—", color: "text-blue-400" },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-white/10 bg-black/40 p-4 text-center">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-white/40">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {result.report_summary && (
            <div className="rounded-lg border border-white/10 bg-black/40 p-4 text-sm text-white/70">{result.report_summary}</div>
          )}

          {vulns.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-white">Vulnerabilities Found</div>
              {vulns.map((v: any, i: number) => (
                <div key={i} className={`rounded border p-3 space-y-1 ${SEV[v.severity] || SEV.MEDIUM}`}>
                  <div className="flex items-center gap-2">
                    <Badge className={`${SEV[v.severity]} border text-xs`}>{v.severity}</Badge>
                    <span className="text-sm font-semibold">{v.type?.replace(/-/g," ").toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-white/60">{v.description}</p>
                  {v.payload && <div className="rounded bg-black/60 p-2 font-mono text-xs text-red-300">Payload: {v.payload}</div>}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <div className="text-sm font-semibold text-white flex items-center gap-2"><Shield className="w-4 h-4 text-violet-400" />Probe Results</div>
            {probeResults.map((p: any, i: number) => (
              <div key={i} className="rounded border border-white/10 bg-black/40 p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`${SEV[p.risk] || SEV.NONE} border text-xs`}>{p.risk ?? "N/A"}</Badge>
                  <span className="text-sm font-semibold text-white">{p.probe_type?.replace(/-/g," ").toUpperCase()}</span>
                  <Badge className={`border text-xs ${p.status === "PASS" ? "bg-green-900/20 text-green-400 border-green-500/20" : p.status === "FAIL" ? "bg-red-900/20 text-red-400 border-red-500/20" : "bg-yellow-900/20 text-yellow-400 border-yellow-400/20"}`}>
                    {p.status}
                  </Badge>
                  {p.failure_rate && <span className="text-xs text-white/30">Succeeded: {p.failure_rate}</span>}
                </div>
                <p className="text-xs text-white/50">{p.description}</p>
                {p.successful_payloads?.length > 0 && (
                  <div className="space-y-1">
                    {p.successful_payloads.slice(0,2).map((pl: string, j: number) => (
                      <div key={j} className="rounded bg-black/60 p-2 font-mono text-xs text-red-300 overflow-x-auto">{pl}</div>
                    ))}
                  </div>
                )}
                {p.remediation && <p className="text-xs text-green-400">{p.remediation}</p>}
                {p.mitre_atlas && <p className="text-xs text-white/30">MITRE ATLAS: {p.mitre_atlas}</p>}
              </div>
            ))}
          </div>

          {result.recommendations?.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-black/40 p-4 space-y-2">
              <div className="text-sm font-semibold text-white">Recommendations</div>
              {result.recommendations.map((r: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs text-white/60">
                  <CheckCircle className="w-3 h-3 text-green-400 shrink-0 mt-0.5" />{r}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
