// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Code2, Loader2, AlertTriangle, CheckCircle, Copy, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const SEV: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-900/20 border-red-500/30",
  HIGH:     "text-orange-400 bg-orange-900/20 border-orange-400/30",
  MEDIUM:   "text-yellow-400 bg-yellow-900/20 border-yellow-400/30",
  LOW:      "text-blue-400 bg-blue-900/20 border-blue-400/30",
  INFO:     "text-white/40 bg-white/5 border-white/10",
};

const LANGS = ["javascript","typescript","python","java","go","rust","php","ruby","c","cpp","csharp","swift","kotlin","scala","shell"];

const SAMPLE = `import express from 'express';
import mysql from 'mysql';
import crypto from 'crypto';

const app = express();
const SECRET = "mysecretkey123"; // hardcoded

app.post('/login', (req, res) => {
  const { user, pass } = req.body;
  // SQL injection
  const q = "SELECT * FROM users WHERE user='" + user + "' AND pass='" + pass + "'";
  db.query(q, (e, r) => r.length ? res.json({token: createToken(r[0])}) : res.status(401).end());
});

app.get('/page', (req, res) => {
  // XSS
  res.send('<div>' + req.query.msg + '</div>');
});

app.get('/exec', (req, res) => {
  // Command injection
  const { cmd } = req.query;
  require('child_process').exec(cmd, (e, out) => res.send(out));
});

function createToken(user: any) {
  return crypto.createHash('md5').update(user.id + SECRET).digest('hex');
}`;

export default function CodeSentinel() {
  const { toast } = useToast();
  const [code, setCode] = useState(SAMPLE);
  const [language, setLanguage] = useState("typescript");
  const [filename, setFilename] = useState("app.ts");
  const [autoFix, setAutoFix] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showFixed, setShowFixed] = useState(false);

  async function scan() {
    if (!code.trim()) toast({ title: "Code required", variant: "destructive" }); return;
    setLoading(true); setResult(null); setShowFixed(false);
    try {
      const r = await fetch(`${BASE}/api/ai-security/code-sentinel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), language, filename, fixRequested: autoFix }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResult(d);
    } catch (e: any) { toast({ title: "Error: " + e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  const findings: any[] = result?.findings ?? [];
  const summary = result?.summary ?? {};
  const fixedCode: string = result?.fixed_code ?? "";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <Code2 className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">CodeSentinel</h1>
          <p className="text-xs text-white/40">AI-Powered SAST Engine · 19+ Languages · Auto-Fix · Data Flow Analysis</p>
        </div>
        <Badge className="ml-auto bg-orange-500/10 text-orange-400 border-orange-500/20 text-xs">AI SAST</Badge>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-white/50">Language</label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="bg-black/40 border-white/10 text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/10">
              {LANGS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-white/50">Filename (optional)</label>
          <Input value={filename} onChange={e => setFilename(e.target.value)}
            className="bg-black/40 border-white/10 text-white font-mono text-sm"
            placeholder="auth.ts" />
        </div>
        <div className="flex items-end gap-3 pb-1">
          <Switch checked={autoFix} onCheckedChange={setAutoFix} />
          <div>
            <div className="text-sm text-white">AI Auto-Fix</div>
            <div className="text-xs text-white/40">Generate patched code</div>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-white/50">Source Code</label>
        <Textarea value={code} onChange={e => setCode(e.target.value)}
          className="bg-black/60 border-white/10 text-green-300 font-mono text-xs h-72 resize-none" />
      </div>

      <Button onClick={scan} disabled={loading || !code.trim()} className="bg-orange-700 hover:bg-orange-800 text-white gap-2">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Scanning...</> : <><Code2 className="w-4 h-4" />Scan Code</>}
      </Button>

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { key: "critical", label: "Critical", color: "text-red-400" },
              { key: "high", label: "High", color: "text-orange-400" },
              { key: "medium", label: "Medium", color: "text-yellow-400" },
              { key: "low", label: "Low", color: "text-blue-400" },
              { key: "info", label: "Info", color: "text-white/40" },
            ].map(s => (
              <div key={s.key} className="rounded-lg border border-white/10 bg-black/40 p-3 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{summary[s.key] ?? 0}</div>
                <div className="text-xs text-white/40">{s.label}</div>
              </div>
            ))}
            <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{result.security_score ?? "—"}</div>
              <div className="text-xs text-white/40">Score/100</div>
            </div>
          </div>

          {result.compliance && (
            <div className="flex flex-wrap gap-2">
              {[...(result.compliance?.owasp_top10 ?? []), ...(result.compliance?.cwe_top25 ?? [])].map((c: string, i: number) => (
                <Badge key={i} className="bg-red-900/10 text-red-400 border-red-500/20 border text-xs">{c}</Badge>
              ))}
            </div>
          )}

          {fixedCode && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowFixed(!showFixed)}
                className="border-green-500/30 text-green-400 hover:bg-green-900/20 gap-2">
                <Wrench className="w-3 h-3" />{showFixed ? "Hide" : "Show"} Fixed Code
              </Button>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(fixedCode); toast({ title: "Copied!" }); }}
                className="border-white/20 text-white/60 hover:text-white gap-2">
                <Copy className="w-3 h-3" />Copy Fixed
              </Button>
            </div>
          )}

          {showFixed && fixedCode && (
            <div className="rounded-lg border border-green-500/20 bg-black/60 p-4">
              <div className="text-xs text-green-400 mb-2">AI-Fixed Code</div>
              <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap overflow-x-auto">{fixedCode}</pre>
            </div>
          )}

          <div className="space-y-3">
            {findings.map((f: any, i: number) => (
              <div key={i} className={`rounded border p-4 space-y-2 ${SEV[f.severity] || SEV.INFO}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`${SEV[f.severity]} border text-xs`}>{f.severity}</Badge>
                  <span className="text-sm font-semibold">{f.title}</span>
                  {f.cwe && <Badge className="bg-black/40 text-white/40 border-white/10 border text-xs">{f.cwe}</Badge>}
                  {f.line && <span className="text-xs text-white/30 font-mono">Line {f.line}</span>}
                </div>
                <p className="text-xs text-white/60">{f.description}</p>
                {f.data_flow && <p className="text-xs text-yellow-300/70">Data flow: {f.data_flow}</p>}
                {f.snippet && (
                  <div className="rounded bg-black/60 p-2 font-mono text-xs text-red-300 overflow-x-auto">{f.snippet}</div>
                )}
                {f.fixed_snippet && (
                  <div className="rounded bg-black/60 p-2 font-mono text-xs text-green-300 overflow-x-auto">
                    <div className="text-xs text-green-400/60 mb-1">Fixed:</div>{f.fixed_snippet}
                  </div>
                )}
                {f.remediation && (
                  <div className="flex items-start gap-2 text-xs text-green-400">
                    <CheckCircle className="w-3 h-3 shrink-0 mt-0.5" />{f.remediation}
                  </div>
                )}
              </div>
            ))}
          </div>

          {result.analysis_notes && (
            <div className="rounded-lg border border-white/10 bg-black/40 p-4">
              <div className="text-xs text-white/40 mb-1">Analysis Notes</div>
              <p className="text-sm text-white/60">{result.analysis_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
