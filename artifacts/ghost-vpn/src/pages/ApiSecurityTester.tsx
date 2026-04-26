import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FlaskConical, AlertTriangle, CheckCircle, Loader2, Play, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "border-red-500/30 bg-red-900/10 text-red-400",
  HIGH:     "border-orange-400/30 bg-orange-900/10 text-orange-400",
  MEDIUM:   "border-yellow-400/30 bg-yellow-900/10 text-yellow-400",
  LOW:      "border-blue-400/30 bg-blue-900/10 text-blue-400",
  INFO:     "border-primary/20 bg-primary/5 text-primary/60",
};

const SAMPLE_URL = "https://petstore.swagger.io/v2/swagger.json";

export default function ApiSecurityTester() {
  const { toast } = useToast();
  const [specUrl, setSpecUrl] = useState(SAMPLE_URL);
  const [specRaw, setSpecRaw] = useState("");
  const [inputMode, setInputMode] = useState<"url" | "paste">("url");
  const [baseUrl, setBaseUrl] = useState("");
  const [authHeader, setAuthHeader] = useState("");

  const [parsing, setParsing] = useState(false);
  const [session, setSession] = useState<{ sessionId: string; endpoints: any[] } | null>(null);

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function parseSpec() {
    setParsing(true);
    setSession(null);
    setResults([]);
    try {
      const body: any = inputMode === "url" ? { specUrl: specUrl.trim() } : { specRaw: specRaw.trim() };
      if (baseUrl) body.baseUrl = baseUrl;
      const r = await fetch(`${BASE}/api/api-tester/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Parse failed");
      setSession(data);
    } catch (e: any) {
      toast({ title: "Parse failed", description: e.message, variant: "destructive" });
    } finally { setParsing(false); }
  }

  async function runTests() {
    if (!session) return;
    setRunning(true);
    setResults([]);
    try {
      const extraHeaders: Record<string, string> = {};
      if (authHeader) {
        const [key, ...rest] = authHeader.split(":");
        if (key && rest.length) extraHeaders[key.trim()] = rest.join(":").trim();
      }
      const r = await fetch(`${BASE}/api/api-tester/run/${session.sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraHeaders }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Run failed");
      setResults(data.results ?? []);
    } catch (e: any) {
      toast({ title: "Run failed", description: e.message, variant: "destructive" });
    } finally { setRunning(false); }
  }

  const failing = results.filter(r => !r.passed);
  const bySev = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].map(s => ({
    s, count: failing.filter(r => r.severity === s).length
  })).filter(x => x.count > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-mono">
      <div>
        <h1 className="text-xl font-bold text-primary tracking-tight">API Security Tester</h1>
        <p className="text-xs text-white/40 mt-1">OpenAPI-driven auth bypass, CORS, header, HTTPS redirect & verbose error tests</p>
      </div>

      {/* Spec input */}
      <Card className="bg-black/40 border-primary/15">
        <CardContent className="p-4 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-1 bg-black/40 rounded-lg p-1 w-fit">
            {(["url", "paste"] as const).map(m => (
              <button key={m} onClick={() => setInputMode(m)}
                className={`px-3 py-1 text-xs rounded-md font-semibold transition-colors ${inputMode === m ? "bg-primary text-black" : "text-white/40 hover:text-white/60"}`}>
                {m === "url" ? "URL" : "Paste Spec"}
              </button>
            ))}
          </div>

          {inputMode === "url" ? (
            <div>
              <label className="text-[10px] uppercase tracking-widest text-white/40 mb-1 block">OpenAPI / Swagger URL</label>
              <Input value={specUrl} onChange={e => setSpecUrl(e.target.value)}
                className="bg-black/60 border-primary/20 text-primary text-sm font-mono"
                placeholder="https://example.com/openapi.json" />
              <div className="flex flex-wrap gap-2 mt-2">
                {[SAMPLE_URL, "https://petstore3.swagger.io/api/v3/openapi.json"].map(u => (
                  <button key={u} onClick={() => setSpecUrl(u)}
                    className="text-[10px] border border-primary/20 text-primary/50 px-2 py-0.5 rounded hover:bg-primary/10 transition-colors">
                    {u.includes("v3") ? "Petstore v3" : "Petstore v2"}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[10px] uppercase tracking-widest text-white/40 mb-1 block">OpenAPI JSON/YAML</label>
              <textarea value={specRaw} onChange={e => setSpecRaw(e.target.value)} rows={8}
                placeholder='{"openapi":"3.0.0","info":{"title":"..."},...}'
                className="w-full bg-black/60 border border-primary/15 text-primary text-[11px] font-mono rounded-lg p-3 resize-y focus:outline-none focus:border-primary/40 placeholder:text-white/20" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-white/40 mb-1 block">Base URL override (optional)</label>
              <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
                className="bg-black/60 border-primary/20 text-primary text-sm font-mono" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-white/40 mb-1 block">Auth Header (Key: Value)</label>
              <Input value={authHeader} onChange={e => setAuthHeader(e.target.value)}
                placeholder="Authorization: Bearer token123"
                className="bg-black/60 border-primary/20 text-primary text-sm font-mono" />
            </div>
          </div>

          <Button onClick={parseSpec} disabled={parsing} className="bg-primary text-black font-bold hover:bg-primary/85">
            {parsing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FlaskConical className="w-4 h-4 mr-2" />}
            Parse Spec
          </Button>
        </CardContent>
      </Card>

      {/* Parsed endpoints */}
      {session && (
        <Card className="bg-black/40 border-primary/15">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-widest text-white/40">
                {session.endpoints.length} Endpoints Parsed
              </div>
              <Button onClick={runTests} disabled={running} className="bg-primary text-black font-bold text-xs hover:bg-primary/85">
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                Run Security Tests
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
              {session.endpoints.map((ep: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-[11px] px-2 py-1 bg-black/40 rounded border border-primary/8">
                  <span className={`font-bold w-12 shrink-0 ${
                    ep.method === "GET" ? "text-green-400" : ep.method === "POST" ? "text-yellow-400" :
                    ep.method === "PUT" ? "text-blue-400" : ep.method === "DELETE" ? "text-red-400" : "text-primary/50"
                  }`}>{ep.method}</span>
                  <span className="text-white/60 truncate font-mono">{ep.path}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center gap-6 p-4 border border-primary/15 bg-black/40 rounded-xl">
            <div>
              <div className={`text-2xl font-black ${failing.length > 0 ? "text-red-400" : "text-green-400"}`}>{failing.length}</div>
              <div className="text-[9px] text-white/30 uppercase mt-0.5">Failed</div>
            </div>
            <div className="h-8 w-px bg-primary/10" />
            <div>
              <div className="text-2xl font-black text-green-400">{results.filter(r => r.passed).length}</div>
              <div className="text-[9px] text-white/30 uppercase mt-0.5">Passed</div>
            </div>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {bySev.map(({ s, count }) => (
                <Badge key={s} className={`text-[10px] ${SEV_COLOR[s]} border`}>{count} {s}</Badge>
              ))}
            </div>
          </div>

          {/* Failing findings */}
          {failing.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-widest text-white/30">Security Issues</div>
              {failing.map((r: any) => (
                <div key={r.testId} className={`rounded-lg border ${SEV_COLOR[r.severity]} overflow-hidden`}>
                  <button
                    className="w-full flex items-start gap-3 p-3 text-left hover:opacity-90 transition-opacity"
                    onClick={() => setExpanded(expanded === r.testId ? null : r.testId)}>
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold">{r.testName}</div>
                      <div className="text-[10px] opacity-70 mt-0.5">{r.endpoint} · {r.method}</div>
                    </div>
                    <Badge className={`text-[9px] ${SEV_COLOR[r.severity]} border shrink-0`}>{r.severity}</Badge>
                    {expanded === r.testId ? <ChevronDown className="w-3 h-3 shrink-0 mt-0.5" /> : <ChevronRight className="w-3 h-3 shrink-0 mt-0.5" />}
                  </button>
                  {expanded === r.testId && (
                    <div className="px-4 pb-3 border-t border-white/5 space-y-1.5">
                      <p className="text-xs opacity-80 mt-2">{r.detail}</p>
                      {r.status && <div className="text-[10px] opacity-50">HTTP Status: {r.status}</div>}
                      {r.request && (
                        <pre className="text-[10px] bg-black/40 p-2 rounded border border-white/5 font-mono break-all whitespace-pre-wrap opacity-70 max-h-32 overflow-auto">
                          {JSON.stringify(r.request, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Passing checks (collapsed) */}
          {results.filter(r => r.passed).length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-white/30 hover:text-white/50 transition-colors list-none flex items-center gap-2">
                <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                {results.filter(r => r.passed).length} checks passed
              </summary>
              <div className="mt-2 space-y-1.5">
                {results.filter(r => r.passed).map((r: any) => (
                  <div key={r.testId} className="flex items-center gap-2 text-xs text-green-400/60 px-3 py-1.5 bg-green-900/5 border border-green-500/10 rounded-lg">
                    <CheckCircle className="w-3 h-3 shrink-0" />
                    <span>{r.testName}</span>
                    <span className="text-white/20 ml-auto">{r.endpoint}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
