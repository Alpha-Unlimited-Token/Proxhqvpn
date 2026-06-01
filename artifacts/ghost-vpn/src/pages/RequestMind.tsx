// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Globe, Scan, AlertTriangle, Shield, Cookie, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const SEV: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-900/20 border-red-500/30",
  HIGH:     "text-orange-400 bg-orange-900/20 border-orange-400/30",
  MEDIUM:   "text-yellow-400 bg-yellow-900/20 border-yellow-400/30",
  LOW:      "text-blue-400 bg-blue-900/20 border-blue-400/30",
  INFO:     "text-white/40 bg-white/5 border-white/10",
};

const SAMPLE_REQUEST = `POST /api/v1/users/login HTTP/1.1
Host: example.com
Content-Type: application/json
Cookie: session=abc123; role=user
Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6InVzZXIifQ.

{"username":"admin","password":"password123","redirect":"/dashboard"}`;

const SAMPLE_RESPONSE = `HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: session=newToken123; Path=/
X-Powered-By: Express 4.18

{"token":"eyJhbGciOiJub25lIn0.eyJyb2xlIjoiYWRtaW4ifQ.","user":{"id":1,"role":"admin","email":"admin@example.com"}}`;

export default function RequestMind() {
  const { toast } = useToast();
  const [request, setRequest] = useState(SAMPLE_REQUEST);
  const [response, setResponse] = useState(SAMPLE_RESPONSE);
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function analyze() {
    if (!request.trim()) toast({ title: "Request required", variant: "destructive" }); return;
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${BASE}/api/ai-security/request-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: request.trim(), response: response.trim() || undefined, context }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResult(d);
    } catch (e: any) {
      toast({ title: "Error: " + e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  const findings: any[] = result?.findings ?? [];
  const critHigh = findings.filter(f => ["CRITICAL","HIGH"].includes(f.severity));
  const missingHeaders: string[] = result?.security_headers?.missing ?? [];
  const cookies: any[] = result?.session?.cookies ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <Globe className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">RequestMind</h1>
          <p className="text-xs text-white/40">AI HTTP Request Security Analyzer · Passive + Logic Flaw Detection</p>
        </div>
        <Badge className="ml-auto bg-purple-500/10 text-purple-400 border-purple-500/20 text-xs">AI SCANNER</Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-white/50">HTTP Request</label>
          <Textarea value={request} onChange={e => setRequest(e.target.value)}
            className="bg-black/60 border-white/10 text-green-300 font-mono text-xs h-52 resize-none"
            placeholder="Paste raw HTTP request here..." />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-white/50">HTTP Response (optional but improves analysis)</label>
          <Textarea value={response} onChange={e => setResponse(e.target.value)}
            className="bg-black/60 border-white/10 text-blue-300 font-mono text-xs h-52 resize-none"
            placeholder="Paste raw HTTP response here (optional)..." />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-white/50">Context (optional)</label>
        <Textarea value={context} onChange={e => setContext(e.target.value)}
          className="bg-black/40 border-white/10 text-white text-sm h-14 resize-none"
          placeholder="e.g. This is a payment endpoint, authenticated as admin..." />
      </div>

      <Button onClick={analyze} disabled={loading || !request.trim()} className="bg-purple-700 hover:bg-purple-800 text-white gap-2">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing...</> : <><Scan className="w-4 h-4" />Analyze Request</>}
      </Button>

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Risk Score", value: result.risk_score ?? "—", icon: AlertTriangle, color: "text-red-400" },
              { label: "Findings", value: findings.length, icon: Shield, color: "text-orange-400" },
              { label: "Critical/High", value: critHigh.length, icon: AlertTriangle, color: "text-red-500" },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-white/10 bg-black/40 p-4 text-center">
                <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-white/40">{s.label}</div>
              </div>
            ))}
          </div>

          {result.summary && (
            <div className="rounded-lg border border-white/10 bg-black/40 p-4 text-sm text-white/70">{result.summary}</div>
          )}

          {findings.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-white">Findings</div>
              {findings.map((f: any, i: number) => (
                <div key={i} className={`rounded border p-4 space-y-2 ${SEV[f.severity] || SEV.INFO}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={`${SEV[f.severity]} border text-xs`}>{f.severity}</Badge>
                    <span className="text-sm font-semibold">{f.title}</span>
                    <span className="text-xs text-white/30 font-mono">{f.id}</span>
                    {f.cwe && <span className="text-xs text-white/30 font-mono">{f.cwe}</span>}
                    {f.cvss && <span className="text-xs text-white/50">CVSS: <b className="text-orange-400">{f.cvss}</b></span>}
                  </div>
                  <p className="text-xs text-white/60">{f.description}</p>
                  {f.evidence && (
                    <div className="rounded bg-black/60 p-2 font-mono text-xs text-yellow-300">
                      Evidence: {f.evidence}
                    </div>
                  )}
                  {f.poc && (
                    <div className="rounded bg-black/60 p-2 font-mono text-xs text-red-300">PoC: {f.poc}</div>
                  )}
                  {f.recommendation && (
                    <div className="text-xs text-green-400">Fix: {f.recommendation}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {missingHeaders.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-black/40 p-4 space-y-2">
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-orange-400" /> Missing Security Headers
              </div>
              <div className="flex flex-wrap gap-2">
                {missingHeaders.map((h: string, i: number) => (
                  <Badge key={i} className="bg-orange-900/20 text-orange-400 border-orange-400/20 border text-xs">{h}</Badge>
                ))}
              </div>
              {(result?.security_headers?.present ?? []).map((h: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs text-green-400">
                  <CheckCircle className="w-3 h-3" />{h}
                </div>
              ))}
            </div>
          )}

          {cookies.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-black/40 p-4 space-y-2">
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <Cookie className="w-4 h-4 text-yellow-400" /> Cookie Analysis
              </div>
              {cookies.map((c: any, i: number) => (
                <div key={i} className="rounded border border-white/10 p-3 space-y-1">
                  <div className="font-mono text-xs text-blue-300">{c.name}</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(c.flags ?? {}).map(([k, v]) => (
                      <Badge key={k} className={`text-xs border ${v ? "bg-green-900/20 text-green-400 border-green-500/20" : "bg-red-900/20 text-red-400 border-red-500/20"}`}>
                        {v ? "✓" : "✗"} {k}
                      </Badge>
                    ))}
                  </div>
                  {c.issues?.map((iss: string, j: number) => (
                    <div key={j} className="text-xs text-red-400">{iss}</div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
